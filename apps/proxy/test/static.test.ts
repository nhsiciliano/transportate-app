import { ErrorV1, ManifestV1 } from '@transportate/contracts';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { fakeAdapters, testEnv } from './helpers';

/*
 * Los objetos se escriben en el R2 local del plugin (`env.STATIC.put`). La Cache API
 * (`caches.default`) también es real en estos tests: cada caso usa un host distinto para
 * no compartir entradas de caché entre casos.
 */
const app = createApp({ adapters: fakeAdapters() });
let n = 0;
const host = () => `https://static-${String(++n)}.test`;

const manifest: ManifestV1 = {
  version: 'v20261101a',
  generatedAt: '2026-11-01T12:00:00Z',
  archivos: {
    'paradas.json': {
      url: '/v1/static/v20261101a/paradas.json',
      bytes: 27,
      sha256: 'b'.repeat(64),
    },
  },
};

describe('GET /v1/static/manifest', () => {
  it('404 not_found cuando el bucket no tiene manifiesto', async () => {
    await env.STATIC.delete('latest/manifest.json');
    const res = await app.request(`${host()}/v1/static/manifest`, {}, testEnv());
    expect(res.status).toBe(404);
    expect(ErrorV1.parse(await res.json()).error.code).toBe('not_found');
  });

  it('503 si el manifiesto no cumple ManifestV1', async () => {
    await env.STATIC.put('latest/manifest.json', JSON.stringify({ version: '' }));
    const res = await app.request(`${host()}/v1/static/manifest`, {}, testEnv());
    expect(res.status).toBe(503);
  });

  it('200 con el manifiesto validado, Cache-Control de 5 min, ETag y 304', async () => {
    await env.STATIC.put('latest/manifest.json', JSON.stringify(manifest));
    const base = host();
    const res = await app.request(`${base}/v1/static/manifest`, {}, testEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    const etag = res.headers.get('ETag') ?? '';
    expect(etag).toMatch(/^W\/"[0-9a-f]{40}"$/);
    expect(ManifestV1.parse(await res.json())).toEqual(manifest);

    const again = await app.request(
      `${base}/v1/static/manifest`,
      { headers: { 'If-None-Match': etag } },
      testEnv(),
    );
    expect(again.status).toBe(304);
    expect(again.headers.get('ETag')).toBe(etag);
  });

  it('sirve desde la Cache API: un cambio en R2 no se ve hasta que vence la caché', async () => {
    await env.STATIC.put('latest/manifest.json', JSON.stringify(manifest));
    const base = host();
    await app.request(`${base}/v1/static/manifest`, {}, testEnv());
    await env.STATIC.put('latest/manifest.json', JSON.stringify({ ...manifest, version: 'otra' }));
    const res = await app.request(`${base}/v1/static/manifest`, {}, testEnv());
    expect(ManifestV1.parse(await res.json()).version).toBe('v20261101a');
  });
});

describe('GET /v1/static/:version/:archivo', () => {
  it('200 inmutable con ETag del objeto R2 y 304 si coincide', async () => {
    const obj = await env.STATIC.put('v20261101a/paradas.json', '{"paradas":[]}');
    if (!obj) throw new Error('R2 local no guardó el objeto');
    const base = host();
    const res = await app.request(`${base}/v1/static/v20261101a/paradas.json`, {}, testEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('ETag')).toBe(obj.httpEtag);
    expect(await res.text()).toBe('{"paradas":[]}');

    const again = await app.request(
      `${base}/v1/static/v20261101a/paradas.json`,
      { headers: { 'If-None-Match': obj.httpEtag } },
      testEnv(),
    );
    expect(again.status).toBe(304);
  });

  it('Content-Type geo+json para .geojson', async () => {
    await env.STATIC.put('v20261101a/lineas.geojson', '{"type":"FeatureCollection","features":[]}');
    const res = await app.request(`${host()}/v1/static/v20261101a/lineas.geojson`, {}, testEnv());
    expect(res.headers.get('Content-Type')).toBe('application/geo+json; charset=utf-8');
  });

  it('404 si el objeto no existe', async () => {
    const res = await app.request(`${host()}/v1/static/v20261101a/no-existe.json`, {}, testEnv());
    expect(res.status).toBe(404);
    expect(ErrorV1.parse(await res.json()).error.code).toBe('not_found');
  });

  it.each(['paradas.txt', '..json', '%2E%2E%2Fsecret.json', 'a..b.json'])(
    '400 si el archivo no es válido (%s)',
    async (archivo) => {
      const res = await app.request(`${host()}/v1/static/v1/${archivo}`, {}, testEnv());
      expect(res.status).toBe(400);
    },
  );
});
