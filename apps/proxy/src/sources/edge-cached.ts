// Capa A de acceso al upstream (tarea 2.4): Cache API por colo + coalescing por isolate +
// último dato bueno. Implementa `FeedSource`; la capa B (Durable Object FeedHub) tendrá la misma
// interfaz.
//
// Orden de lectura: memoria del isolate → `caches.default` → upstream. La copia en memoria existe
// porque la Cache API no tiene efecto en `*.workers.dev` (hoy el deploy está ahí): sin ella, cada
// request iría al upstream.
//
// Privacidad y secretos: las credenciales se agregan a la URL solo al hacer el fetch. Nunca
// aparecen en claves de caché (URL ficticia derivada de `req.key`), errores ni logs; el log de
// fallo upstream solo lleva { event, key, status, ms }.
import { ApiError } from '../adapters/types';
import { Coalescer } from '../cache/coalesce';
import { DeadlineExceeded, raceAbort } from '../cache/deadline';
import {
  feedCacheKey,
  fromCacheResponse,
  toCacheResponse,
  type CachedFeed,
} from '../cache/feed-cache';
import { runInBackground } from '../lib/http';
import type { FeedRequest, FeedResult, FeedSource } from './types';

/** Opciones por llamada (extensión compatible de `FeedSource.fetch`). */
export interface FetchOptions {
  signal?: AbortSignal;
  retry?: boolean;
}

/** `FeedSource` que además acepta plazo y control de reintento por llamada. */
export interface DeadlineFeedSource extends FeedSource {
  fetch(req: FeedRequest, opts?: FetchOptions): Promise<FeedResult>;
}

export const USER_AGENT = 'transportate-proxy/0.1';
/** Timeout por intento si `env.UPSTREAM_TIMEOUT_MS` no lo define. */
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 5_000;

const unavailable = (ttlSeconds: number): ApiError =>
  new ApiError('upstream_unavailable', 'Servicio del GCBA no disponible', 503, ttlSeconds);

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

export interface EdgeCachedOptions {
  credentials: Credentials;
  ctx?: ExecutionContext | undefined;
  /** Edad máxima (s) de una entrada vencida que se sirve si el upstream falla. Default 300. */
  maxStaleSeconds?: number;
  /** Timeout por intento (ms). Default 5000 (`UPSTREAM_TIMEOUT_MS`). */
  timeoutMs?: number;
  /** Pausa antes del reintento (ms). Default 300. */
  retryDelayMs?: number;
  /** Inyectables para tests. */
  cache?: Cache;
  now?: () => number;
}

/** Fallo de un intento upstream: `status` null = timeout o error de red. */
class UpstreamFailure extends Error {
  constructor(
    public readonly status: number | null,
    public readonly retryable: boolean,
  ) {
    super(status === null ? 'upstream_network' : `upstream_${status}`);
    this.name = 'UpstreamFailure';
  }
}

// Estado por isolate (compartido entre requests; los adaptadores se arman por request).
const coalescer = new Coalescer<FeedResult>();
const MEMORY_MAX_ENTRIES = 256;
const memory = new Map<string, CachedFeed>();

function remember(key: string, entry: CachedFeed): void {
  memory.delete(key);
  memory.set(key, entry);
  if (memory.size > MEMORY_MAX_ENTRIES) {
    const oldest = memory.keys().next();
    if (!oldest.done) memory.delete(oldest.value);
  }
}

/** Solo para tests: vacía la copia en memoria del isolate. */
export function resetEdgeCacheMemory(): void {
  memory.clear();
}

const ACCEPT: Record<NonNullable<FeedRequest['accept']>, string> = {
  protobuf: 'application/x-protobuf, application/octet-stream',
  json: 'application/json',
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class EdgeCachedFeedSource implements DeadlineFeedSource {
  private readonly maxStaleSeconds: number;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly now: () => number;

  constructor(private readonly opts: EdgeCachedOptions) {
    this.maxStaleSeconds = opts.maxStaleSeconds ?? 300;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
    this.retryDelayMs = opts.retryDelayMs ?? 300;
    this.now = opts.now ?? Date.now;
  }

  /**
   * `opts.signal`: plazo del llamador (p. ej. el presupuesto de un fan-out). Si se vence antes de
   * que llegue el dato, se devuelve el último dato bueno (`stale: true`) o 503; el fetch compartido
   * sigue y llena la caché para la próxima. `opts.retry` (default true): reintentar una vez.
   */
  fetch(req: FeedRequest, opts: FetchOptions = {}): Promise<FeedResult> {
    const shared = coalescer.run(req.key, () => this.load(req, opts.retry ?? true));
    if (!opts.signal) return shared;
    return raceAbort(shared, opts.signal).catch(async (err: unknown) => {
      if (!(err instanceof DeadlineExceeded)) throw err;
      console.error(JSON.stringify({ event: 'upstream_deadline', key: req.key }));
      const cached = await this.readCached(req.key, 0);
      if (cached && this.now() - cached.fetchedAt <= this.maxStaleSeconds * 1000) {
        return { ...cached, body: cached.body.slice(0), fromCache: true, stale: true };
      }
      throw unavailable(req.ttlSeconds);
    });
  }

  private cache(): Cache {
    return this.opts.cache ?? caches.default;
  }

  /** Memoria del isolate si está fresca; si no, la más nueva entre memoria y Cache API. */
  private async readCached(key: string, ttlMs: number): Promise<CachedFeed | null> {
    const mem = memory.get(key) ?? null;
    if (mem && this.now() - mem.fetchedAt < ttlMs) return mem;
    const hit = await this.cache().match(feedCacheKey(key));
    const fromEdge = hit ? await fromCacheResponse(hit) : null;
    // Gana la más nueva (otro isolate del colo pudo haber refrescado la Cache API).
    if (mem && (!fromEdge || mem.fetchedAt >= fromEdge.fetchedAt)) return mem;
    if (fromEdge) remember(key, fromEdge);
    return fromEdge;
  }

  private async load(req: FeedRequest, retry: boolean): Promise<FeedResult> {
    const cached = await this.readCached(req.key, req.ttlSeconds * 1000);
    const ageMs = cached ? this.now() - cached.fetchedAt : Infinity;
    if (cached && ageMs < req.ttlSeconds * 1000) {
      return { ...cached, body: cached.body.slice(0), fromCache: true, stale: false };
    }

    const t0 = this.now();
    try {
      const fresh = await this.fetchWithRetry(req, retry);
      remember(req.key, fresh);
      const retain = req.ttlSeconds + this.maxStaleSeconds;
      await runInBackground(
        this.opts.ctx,
        this.cache().put(feedCacheKey(req.key), toCacheResponse(fresh, retain)),
      );
      return { ...fresh, body: fresh.body.slice(0), fromCache: false, stale: false };
    } catch (err) {
      const status = err instanceof UpstreamFailure ? err.status : null;
      console.error(
        JSON.stringify({ event: 'upstream_error', key: req.key, status, ms: this.now() - t0 }),
      );
      if (cached && ageMs <= this.maxStaleSeconds * 1000) {
        return { ...cached, body: cached.body.slice(0), fromCache: true, stale: true };
      }
      throw unavailable(req.ttlSeconds);
    }
  }

  private async fetchWithRetry(req: FeedRequest, retry: boolean): Promise<CachedFeed> {
    try {
      return await this.attempt(req);
    } catch (err) {
      if (!retry || !(err instanceof UpstreamFailure) || !err.retryable) throw err;
      await sleep(this.retryDelayMs);
      return this.attempt(req);
    }
  }

  /** Un intento con timeout. Las credenciales se agregan acá y no salen de esta función. */
  private async attempt(req: FeedRequest): Promise<CachedFeed> {
    const url = new URL(req.url);
    url.searchParams.set('client_id', this.opts.credentials.clientId);
    url.searchParams.set('client_secret', this.opts.credentials.clientSecret);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: ACCEPT[req.accept ?? 'json'] },
        signal: controller.signal,
      });
      if (res.status >= 500) throw new UpstreamFailure(res.status, true);
      if (!res.ok) throw new UpstreamFailure(res.status, false);
      const body = await res.arrayBuffer();
      return { body, fetchedAt: this.now(), upstreamStatus: res.status };
    } catch (err) {
      if (err instanceof UpstreamFailure) throw err;
      // Timeout (AbortError), ECONNRESET y demás errores de red: reintentables. No se propaga el
      // mensaje original porque puede incluir la URL con el secret.
      throw new UpstreamFailure(null, true);
    } finally {
      clearTimeout(timer);
    }
  }
}
