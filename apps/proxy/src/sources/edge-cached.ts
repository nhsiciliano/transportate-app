// Capa A de acceso al upstream (tarea 2.4): Cache API por colo + copia en memoria del isolate +
// un solo refresco por clave + último dato bueno. Implementa `FeedSource`; la capa B (Durable
// Object FeedHub) tendrá la misma interfaz.
//
// Regla de workerd (src/cache/README.md): el I/O (fetch, Cache API, waitUntil) pertenece a la
// request que lo inició. Una request que awaitea una promesa de I/O de OTRA request queda colgada
// si aquella termina ("Worker's code had hung"). Por eso NO se comparten promesas entre requests:
// a nivel de módulo solo se guardan DATOS (copias de respuestas) y un flag de "refrescando".
//
// - Hay copia vencida (≤ maxStale) y nadie refresca → esta request toma el flag, refresca con su
//   propio I/O y devuelve el dato nuevo. Las requests concurrentes no esperan: sirven la copia.
// - Arranque en frío (nada en memoria ni en Cache API) y otra request está refrescando → se sondea
//   la memoria del isolate hasta `coldWaitMs` (500 ms) y, si no llegó, se hace un fetch propio
//   (duplicados solo en frío, por isolate).
//
// La copia en memoria existe además porque la Cache API no tiene efecto en `*.workers.dev`.
//
// Secretos: las credenciales (si la fuente las usa) se agregan a la URL solo al hacer el fetch.
// Nunca aparecen en claves de caché (URL ficticia derivada de `req.key`), errores ni logs; los
// logs solo llevan { event, key, status, ms }.
import { ApiError } from '../adapters/types';
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
  /** Plazo del llamador (p. ej. el presupuesto de un fan-out). */
  signal?: AbortSignal;
  /** Reintentar una vez ante timeout, 5xx o error de red (default true). */
  retry?: boolean;
}

/** `FeedSource` que además acepta plazo y control de reintento por llamada. */
export interface DeadlineFeedSource extends FeedSource {
  fetch(req: FeedRequest, opts?: FetchOptions): Promise<FeedResult>;
}

export const USER_AGENT = 'transportate-proxy/0.1';
/** Timeout por intento si `env.UPSTREAM_TIMEOUT_MS` no lo define. */
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 5_000;

/** Texto del 503 si `EdgeCachedOptions.unavailableMessage` no lo define. */
export const DEFAULT_UNAVAILABLE_MESSAGE = 'Servicio del GCBA no disponible';

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

export interface EdgeCachedOptions {
  /** Credenciales de la API del GCBA. Sin ellas (fuentes públicas, como trenes) la URL va tal cual. */
  credentials?: Credentials | undefined;
  /** Texto del 503 cuando no hay dato (default `DEFAULT_UNAVAILABLE_MESSAGE`). */
  unavailableMessage?: string;
  ctx?: ExecutionContext | undefined;
  /** Edad máxima (s) de una entrada vencida que se sirve si el upstream falla. Default 300. */
  maxStaleSeconds?: number;
  /** Timeout por intento (ms). Default 5000 (`UPSTREAM_TIMEOUT_MS`). */
  timeoutMs?: number;
  /** Pausa antes del reintento (ms). Default 300. */
  retryDelayMs?: number;
  /** Espera máxima (ms) en frío mientras otra request refresca la misma clave. Default 500. */
  coldWaitMs?: number;
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

// ---------------------------------------------------------------- estado por isolate (solo datos)

const MEMORY_MAX_ENTRIES = 256;
const memory = new Map<string, CachedFeed>();
/** Clave → epoch ms (reloj real) hasta el que una request tiene tomado el refresco. */
const refreshing = new Map<string, number>();

function remember(key: string, entry: CachedFeed): void {
  memory.delete(key);
  memory.set(key, entry);
  if (memory.size > MEMORY_MAX_ENTRIES) {
    const oldest = memory.keys().next();
    if (!oldest.done) memory.delete(oldest.value);
  }
}

/** Toma el flag de refresco si está libre (o vencido). No hay promesas: solo un timestamp. */
function tryAcquire(key: string, holdMs: number): boolean {
  const until = refreshing.get(key);
  const t = Date.now();
  if (until !== undefined && until > t) return false;
  refreshing.set(key, t + holdMs);
  return true;
}

function release(key: string): void {
  refreshing.delete(key);
}

/** Solo para tests: vacía la memoria del isolate y los flags de refresco. */
export function resetEdgeCacheMemory(): void {
  memory.clear();
  refreshing.clear();
}

const ACCEPT: Record<NonNullable<FeedRequest['accept']>, string> = {
  protobuf: 'application/x-protobuf, application/octet-stream',
  json: 'application/json',
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const asResult = (e: CachedFeed, fromCache: boolean, stale: boolean): FeedResult => ({
  body: e.body.slice(0),
  fetchedAt: e.fetchedAt,
  upstreamStatus: e.upstreamStatus,
  fromCache,
  stale,
});

export class EdgeCachedFeedSource implements DeadlineFeedSource {
  private readonly maxStaleSeconds: number;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly coldWaitMs: number;
  private readonly now: () => number;

  constructor(private readonly opts: EdgeCachedOptions) {
    this.maxStaleSeconds = opts.maxStaleSeconds ?? 300;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
    this.retryDelayMs = opts.retryDelayMs ?? 300;
    this.coldWaitMs = opts.coldWaitMs ?? 500;
    this.now = opts.now ?? Date.now;
  }

  private cache(): Cache {
    return this.opts.cache ?? caches.default;
  }

  private ageMs(e: CachedFeed): number {
    return this.now() - e.fetchedAt;
  }

  /** Memoria del isolate si está fresca; si no, la más nueva entre memoria y Cache API. */
  private async readCached(key: string, ttlMs: number): Promise<CachedFeed | null> {
    const mem = memory.get(key) ?? null;
    if (mem && this.ageMs(mem) < ttlMs) return mem;
    const hit = await this.cache().match(feedCacheKey(key));
    const fromEdge = hit ? await fromCacheResponse(hit) : null;
    // Gana la más nueva (otro isolate del colo pudo haber refrescado la Cache API).
    if (mem && (!fromEdge || mem.fetchedAt >= fromEdge.fetchedAt)) return mem;
    if (fromEdge) remember(key, fromEdge);
    return fromEdge;
  }

  /**
   * `opts.signal`: si el plazo se vence antes de que llegue el dato, se devuelve el último dato
   * bueno (`stale: true`) o 503. `opts.retry` (default true): reintentar una vez.
   */
  async fetch(req: FeedRequest, opts: FetchOptions = {}): Promise<FeedResult> {
    const ttlMs = req.ttlSeconds * 1000;
    const cached = await this.readCached(req.key, ttlMs);
    if (cached && this.ageMs(cached) < ttlMs) return asResult(cached, true, false);
    const usable = cached && this.ageMs(cached) <= this.maxStaleSeconds * 1000 ? cached : null;

    // Ventana del refresco: el peor caso de un intento + reintento.
    const holdMs = this.timeoutMs * 2 + this.retryDelayMs + 1_000;
    if (!tryAcquire(req.key, holdMs)) {
      // Otra request de este isolate está refrescando: no se espera su promesa.
      if (usable) return asResult(usable, true, this.ageMs(usable) > ttlMs * 2);
      const waited = await this.waitForMemory(req.key, ttlMs);
      if (waited) return asResult(waited, true, false);
      // Sigue sin dato: fetch propio (sin tomar el flag, que tiene otra request).
      return this.refresh(req, opts, usable, false);
    }
    return this.refresh(req, opts, usable, true);
  }

  /** Sondea la memoria del isolate (datos, no I/O) mientras otra request trae el dato en frío. */
  private async waitForMemory(key: string, ttlMs: number): Promise<CachedFeed | null> {
    const until = Date.now() + this.coldWaitMs;
    while (Date.now() < until) {
      await sleep(25);
      const mem = memory.get(key);
      if (mem && this.ageMs(mem) < ttlMs) return mem;
    }
    return null;
  }

  private async refresh(
    req: FeedRequest,
    opts: FetchOptions,
    fallback: CachedFeed | null,
    holdsLock: boolean,
  ): Promise<FeedResult> {
    const t0 = this.now();
    const work = this.fetchWithRetry(req, opts.retry ?? true).then(async (fresh) => {
      console.log(
        JSON.stringify({
          event: 'upstream_fetch',
          key: req.key,
          status: fresh.upstreamStatus,
          ms: this.now() - t0,
        }),
      );
      remember(req.key, fresh);
      const retain = req.ttlSeconds + this.maxStaleSeconds;
      await runInBackground(
        this.opts.ctx,
        this.cache().put(feedCacheKey(req.key), toCacheResponse(fresh, retain)),
      );
      return fresh;
    });
    try {
      const fresh = await raceAbort(work, opts.signal);
      return asResult(fresh, false, false);
    } catch (err) {
      const deadline = err instanceof DeadlineExceeded;
      // Si el plazo venció, el fetch sigue en esta misma request y llena la caché al terminar.
      if (deadline) void work.catch(() => undefined);
      const status = err instanceof UpstreamFailure ? err.status : null;
      console.error(
        JSON.stringify({
          event: deadline ? 'upstream_deadline' : 'upstream_error',
          key: req.key,
          status,
          ms: this.now() - t0,
        }),
      );
      if (fallback) return asResult(fallback, true, true);
      throw new ApiError(
        'upstream_unavailable',
        this.opts.unavailableMessage ?? DEFAULT_UNAVAILABLE_MESSAGE,
        503,
        req.ttlSeconds,
      );
    } finally {
      if (holdsLock) {
        // Con plazo vencido el flag se libera cuando termina el fetch (no antes: evita duplicados).
        void work.then(
          () => {
            release(req.key);
          },
          () => {
            release(req.key);
          },
        );
      }
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
    const { credentials } = this.opts;
    if (credentials) {
      url.searchParams.set('client_id', credentials.clientId);
      url.searchParams.set('client_secret', credentials.clientSecret);
    }
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: ACCEPT[req.accept ?? 'json'] },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.status >= 500) throw new UpstreamFailure(res.status, true);
      if (!res.ok) throw new UpstreamFailure(res.status, false);
      const body = await res.arrayBuffer();
      // Un evento por fetch real (lo cuenta tools/carga). Nunca la URL: lleva el secret.
      console.log(
        JSON.stringify({
          event: 'upstream_fetch',
          key: req.key,
          status: res.status,
          ms: Date.now() - t0,
        }),
      );
      return { body, fetchedAt: this.now(), upstreamStatus: res.status };
    } catch (err) {
      if (err instanceof UpstreamFailure) throw err;
      // Timeout, ECONNRESET y demás errores de red: reintentables. No se propaga el mensaje
      // original porque puede incluir la URL con el secret.
      throw new UpstreamFailure(null, true);
    }
  }
}
