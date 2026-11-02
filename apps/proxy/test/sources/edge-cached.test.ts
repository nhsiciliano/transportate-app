import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/adapters/types';
import {
  EdgeCachedFeedSource,
  resetEdgeCacheMemory,
  USER_AGENT,
} from '../../src/sources/edge-cached';
import type { FeedRequest } from '../../src/sources/types';
import { FAKE_SECRET } from '../helpers';

const BASE = 'https://apitransporte.buenosaires.gob.ar';
let n = 0;

/** Cada test usa su propio cache y su propia clave: la Cache API es real y persiste en el archivo. */
async function setup(opts: { timeoutMs?: number } = {}) {
  n++;
  const cache = await caches.open(`edge-cached-test-${n}`);
  let clock = 1_800_000_000_000;
  const source = new EdgeCachedFeedSource({
    credentials: { clientId: 'id-de-prueba', clientSecret: FAKE_SECRET },
    cache,
    now: () => clock,
    retryDelayMs: 1,
    timeoutMs: opts.timeoutMs ?? 1_000,
  });
  const req: FeedRequest = {
    key: `test:feed:${n}`,
    url: new URL(`${BASE}/subtes/serviceAlerts?json=1`),
    ttlSeconds: 20,
    accept: 'json',
  };
  return {
    cache,
    source,
    req,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const text = (buf: ArrayBuffer) => new TextDecoder().decode(buf);
const ok = (body: string, status = 200) => new Response(body, { status });

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

let fetchSpy: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>;
beforeEach(() => {
  resetEdgeCacheMemory();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('EdgeCachedFeedSource', () => {
  it('miss → upstream; dentro del TTL → caché sin nuevo fetch', async () => {
    const { source, req, advance } = await setup();
    fetchSpy.mockResolvedValue(ok('v1'));
    const a = await source.fetch(req);
    expect(a).toMatchObject({ fromCache: false, stale: false, upstreamStatus: 200 });
    expect(text(a.body)).toBe('v1');
    advance(10_000);
    const b = await source.fetch(req);
    expect(b).toMatchObject({ fromCache: true, stale: false });
    expect(text(b.body)).toBe('v1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('agrega credenciales y User-Agent solo en el fetch upstream', async () => {
    const { source, req } = await setup();
    fetchSpy.mockResolvedValue(ok('x'));
    await source.fetch(req);
    const [input, init] = fetchSpy.mock.calls[0] ?? [];
    const url = new URL(urlOf(input ?? ''));
    expect(url.searchParams.get('client_secret')).toBe(FAKE_SECRET);
    expect(url.searchParams.get('json')).toBe('1');
    expect(new Headers(init?.headers).get('User-Agent')).toBe(USER_AGENT);
    // La URL de la request original no se modifica
    expect(req.url.searchParams.has('client_secret')).toBe(false);
  });

  it('coalescing: 10 llamadas concurrentes → 1 fetch upstream', async () => {
    const { source, req } = await setup();
    let release: (r: Response) => void = () => undefined;
    fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const all = Promise.all(Array.from({ length: 10 }, () => source.fetch(req)));
    await new Promise((r) => setTimeout(r, 10));
    release(ok('compartido'));
    const results = await all;
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(results.map((r) => text(r.body))).toEqual(Array(10).fill('compartido'));
  });

  it('vencido + upstream ok → dato fresco', async () => {
    const { source, req, advance } = await setup();
    fetchSpy.mockResolvedValueOnce(ok('viejo')).mockResolvedValueOnce(ok('nuevo'));
    await source.fetch(req);
    advance(21_000);
    const r = await source.fetch(req);
    expect(r).toMatchObject({ fromCache: false, stale: false });
    expect(text(r.body)).toBe('nuevo');
  });

  it('vencido + upstream 500 (con reintento) → último dato bueno con stale: true', async () => {
    const { source, req, advance } = await setup();
    fetchSpy.mockResolvedValueOnce(ok('bueno')).mockResolvedValue(ok('error', 500));
    await source.fetch(req);
    advance(60_000);
    const r = await source.fetch(req);
    expect(r).toMatchObject({ fromCache: true, stale: true });
    expect(text(r.body)).toBe('bueno');
    expect(fetchSpy).toHaveBeenCalledTimes(3); // 1 inicial + intento + reintento
  });

  it('dato vencido más allá de maxStale (300 s) + fallo → ApiError 503', async () => {
    const { source, req, advance } = await setup();
    fetchSpy.mockResolvedValueOnce(ok('bueno')).mockResolvedValue(ok('error', 503));
    await source.fetch(req);
    advance(400_000);
    await expect(source.fetch(req)).rejects.toMatchObject({ status: 503 });
  });

  it('timeout → reintento', async () => {
    const { source, req } = await setup({ timeoutMs: 20 });
    fetchSpy
      .mockImplementationOnce(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      )
      .mockResolvedValueOnce(ok('segundo intento'));
    const r = await source.fetch(req);
    expect(text(r.body)).toBe('segundo intento');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('error de red (ECONNRESET) → reintento', async () => {
    const { source, req } = await setup();
    fetchSpy
      .mockRejectedValueOnce(new TypeError('Network connection lost'))
      .mockResolvedValueOnce(ok('ok'));
    expect(text((await source.fetch(req)).body)).toBe('ok');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('4xx no se reintenta', async () => {
    const { source, req } = await setup();
    fetchSpy.mockResolvedValue(ok('no listener', 404));
    await expect(source.fetch(req)).rejects.toBeInstanceOf(ApiError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('sin caché + fallo → ApiError upstream_unavailable 503 con Retry-After = TTL', async () => {
    const { source, req } = await setup();
    fetchSpy.mockResolvedValue(ok('x', 500));
    const err: unknown = await source.fetch(req).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: 'upstream_unavailable',
      message: 'Servicio del GCBA no disponible',
      status: 503,
      retryAfterSeconds: 20,
    });
  });

  it('la clave de caché y los logs no contienen credenciales', async () => {
    const { cache, source, req, advance } = await setup();
    const putSpy = vi.spyOn(cache, 'put');
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchSpy
      .mockResolvedValueOnce(ok('a'))
      .mockRejectedValue(new TypeError(`fetch failed for ${BASE}/x?client_secret=${FAKE_SECRET}`));
    await source.fetch(req);
    const keyUrl = urlOf(putSpy.mock.calls[0]?.[0] ?? '');
    expect(keyUrl).toBe(`https://cache.transportate.internal/feed/${encodeURIComponent(req.key)}`);
    expect(keyUrl).not.toContain(FAKE_SECRET);
    expect(keyUrl).not.toContain('apitransporte');

    advance(25_000);
    await source.fetch(req); // falla → stale; loguea
    const logged = logSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toContain('upstream_error');
    expect(logged).not.toContain(FAKE_SECRET);
    expect(logged).not.toContain('client_secret');
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual({
      event: 'upstream_error',
      key: req.key,
      status: null,
      ms: 0,
    });
  });

  it('con ExecutionContext guarda en caché con waitUntil y otra instancia lo lee', async () => {
    const { cache, req } = await setup();
    fetchSpy.mockResolvedValue(ok('desde-upstream'));
    const ctx = createExecutionContext();
    const opts = { credentials: { clientId: 'i', clientSecret: FAKE_SECRET }, cache, ctx };
    await new EdgeCachedFeedSource(opts).fetch(req);
    await waitOnExecutionContext(ctx);
    resetEdgeCacheMemory(); // simula otro isolate: solo queda la Cache API
    const r = await new EdgeCachedFeedSource({ ...opts, ctx: undefined }).fetch(req);
    expect(r).toMatchObject({ fromCache: true, stale: false });
    expect(text(r.body)).toBe('desde-upstream');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
