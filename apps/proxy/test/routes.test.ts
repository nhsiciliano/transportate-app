import {
  AlertasResponseV1,
  ArribosEstacionResponseV1,
  ArribosParadaResponseV1,
  ErrorV1,
  EstadoLineasResponseV1,
  LineasColectivoResponseV1,
  PosicionesLineaResponseV1,
} from '@transportate/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { createApp } from '../src/app';
import { V1_ROUTES } from '../src/routes/index';
import { resetEdgeCacheMemory } from '../src/sources/edge-cached';
import { alertas, type Calls, estado, FAKE_SECRET, fakeAdapters, lineas, testEnv } from './helpers';

function setup() {
  const calls: Calls = { arribosSubte: [], posiciones: [], arribosColectivo: [] };
  const app = createApp({ adapters: fakeAdapters(calls) });
  const get = (path: string, headers: Record<string, string> = {}) =>
    app.request(path, { headers }, testEnv());
  return { app, calls, get };
}

const casos: [string, z.ZodType][] = [
  ['/v1/subtes/estado', EstadoLineasResponseV1],
  ['/v1/subtes/alertas', AlertasResponseV1],
  ['/v1/subtes/estaciones/1059N/arribos', ArribosEstacionResponseV1],
  ['/v1/colectivos/lineas', LineasColectivoResponseV1],
  ['/v1/colectivos/lineas/1858/posiciones', PosicionesLineaResponseV1],
  ['/v1/colectivos/paradas/ba-1524-defensa/arribos', ArribosParadaResponseV1],
];

describe('rutas de datos v1', () => {
  it.each(casos)('%s devuelve un sobre válido con headers de caché', async (path, schema) => {
    const { get } = setup();
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('ETag')).toMatch(/^W\/"[0-9a-f]{40}"$/);
    expect(res.headers.get('X-Transportate-Generated-At')).toBe('2026-11-01T20:00:05Z');
    expect(schema.safeParse(await res.json()).success).toBe(true);
  });

  it('devuelve el sobre tal cual lo arma el adaptador', async () => {
    const { get } = setup();
    expect(await (await get('/v1/subtes/estado')).json()).toEqual(estado);
    expect(await (await get('/v1/colectivos/lineas')).json()).toEqual(lineas);
  });

  it('Cache-Control usa meta.ttlSeconds y stale-while-revalidate = 2×ttl', async () => {
    const { get } = setup();
    const res = await get('/v1/subtes/estado');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=20, stale-while-revalidate=40');
    expect(res.headers.get('X-Transportate-Stale')).toBeNull();
  });

  it('marca X-Transportate-Stale cuando meta.stale', async () => {
    const { get } = setup();
    const res = await get('/v1/subtes/alertas');
    expect(alertas.meta.stale).toBe(true);
    expect(res.headers.get('X-Transportate-Stale')).toBe('1');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=15, stale-while-revalidate=30');
  });

  it('responde 304 sin cuerpo si If-None-Match coincide (también débil o en lista)', async () => {
    const { get } = setup();
    const first = await get('/v1/colectivos/lineas');
    const etag = first.headers.get('ETag') ?? '';
    for (const inm of [etag, etag.replace(/^W\//, ''), `"otro", ${etag}`]) {
      const res = await get('/v1/colectivos/lineas', { 'If-None-Match': inm });
      expect(res.status).toBe(304);
      expect(await res.text()).toBe('');
      expect(res.headers.get('ETag')).toBe(etag);
    }
    const distinto = await get('/v1/colectivos/lineas', { 'If-None-Match': 'W/"nada"' });
    expect(distinto.status).toBe(200);
  });

  it('pasa los ids de la ruta al adaptador e ignora la query desconocida', async () => {
    const { get, calls } = setup();
    await get('/v1/subtes/estaciones/1059N/arribos?foo=bar');
    await get('/v1/colectivos/lineas/1858/posiciones');
    await get('/v1/colectivos/paradas/S00085138/arribos');
    expect(calls).toEqual({
      arribosSubte: ['1059N'],
      posiciones: ['1858'],
      arribosColectivo: ['S00085138'],
    });
  });

  it.each([
    '/v1/subtes/estaciones/1059N%24/arribos',
    `/v1/colectivos/lineas/${'1'.repeat(65)}/posiciones`,
    '/v1/colectivos/paradas/a.b/arribos',
  ])('param inválido en %s → 400 bad_request', async (path) => {
    const { get, calls } = setup();
    const res = await get(path);
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(ErrorV1.parse(await res.json()).error.code).toBe('bad_request');
    expect(
      calls.arribosSubte.length + calls.posiciones.length + calls.arribosColectivo.length,
    ).toBe(0);
  });

  it('/v1/transito/cortes está diferido: 503 upstream_unavailable', async () => {
    const { get } = setup();
    const res = await get('/v1/transito/cortes');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: { code: 'upstream_unavailable', message: 'Fuente de cortes no disponible' },
    });
  });

  it('/v1 lista las rutas disponibles', async () => {
    const { get } = setup();
    const res = await get('/v1');
    expect(res.status).toBe(200);
    const body = await res.json<{ rutas: string[] }>();
    expect(body.rutas).toEqual([...V1_ROUTES]);
  });
});

describe('createAdapters (adaptadores reales, sin red)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetEdgeCacheMemory();
  });

  it('upstream 401 sin caché → /v1/subtes/estado 200 con sin_datos y meta.stale; 503 en alertas', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"error":"Invalid Client"}', { status: 401 }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { createAdapters } = await import('../src/adapters/index');
    const app = createApp({ adapters: createAdapters });

    const res = await app.request('/v1/subtes/estado', {}, testEnv());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(FAKE_SECRET);
    const body = EstadoLineasResponseV1.parse(JSON.parse(text));
    expect(new Set(body.data.lineas.map((l) => l.estado))).toEqual(new Set(['sin_datos']));
    expect(body.meta).toMatchObject({ stale: true, sourceTimestamp: null });

    const input = fetchSpy.mock.calls[0]?.[0];
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.pathname).toBe('/subtes/serviceAlerts');
    expect(url.searchParams.get('json')).toBe('1');

    const alertasRes = await app.request('/v1/subtes/alertas', {}, testEnv());
    expect(alertasRes.status).toBe(503);
    expect(await alertasRes.text()).not.toContain(FAKE_SECRET);
  });
});
