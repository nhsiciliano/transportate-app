import type { EnvelopeV1, EstadoLineasV1 } from '@transportate/contracts';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { envelopeEtag } from '../src/middleware/envelope';
import { estado, fakeAdapters, testEnv } from './helpers';

/**
 * Adaptador que simula lo que pasa con un dato servido desde caché: el mismo `data` y el mismo
 * `sourceTimestamp`, pero `generatedAt` y `ageSeconds` distintos en cada llamada.
 */
function appWithMovingGeneratedAt(
  overrides: () => Partial<EnvelopeV1<EstadoLineasV1>['meta']> = () => ({}),
) {
  let n = 0;
  const base = fakeAdapters();
  return createApp({
    adapters: {
      ...base,
      subtes: {
        ...base.subtes,
        estadoLineas: () => {
          n += 1;
          const second = String(n).padStart(2, '0');
          return Promise.resolve({
            meta: {
              ...estado.meta,
              generatedAt: `2026-11-01T20:00:${second}Z`,
              ageSeconds: 25 + n,
              ...overrides(),
            },
            data: estado.data,
          });
        },
      },
    },
  });
}

describe('ETag estable', () => {
  it('dos requests con el mismo dato y distinto generatedAt → el segundo es 304 sin cuerpo', async () => {
    const app = appWithMovingGeneratedAt();
    const first = await app.request('/v1/subtes/estado', {}, testEnv());
    expect(first.status).toBe(200);
    const etag = first.headers.get('ETag') ?? '';
    expect(etag).toMatch(/^W\/"[0-9a-f]{40}"$/);

    const second = await app.request(
      '/v1/subtes/estado',
      { headers: { 'If-None-Match': etag } },
      testEnv(),
    );
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
    expect(second.headers.get('ETag')).toBe(etag);
    // generatedAt sí cambia (header informativo), sin invalidar el ETag.
    expect(second.headers.get('X-Transportate-Generated-At')).not.toBe(
      first.headers.get('X-Transportate-Generated-At'),
    );
  });

  it('cambia si cambia el dato, el sourceTimestamp o el estado stale', async () => {
    const base = await envelopeEtag(estado);
    expect(
      await envelopeEtag({
        ...estado,
        meta: { ...estado.meta, generatedAt: '2026-11-02T00:00:00Z', ageSeconds: 99 },
      }),
    ).toBe(base);
    expect(
      await envelopeEtag({
        ...estado,
        meta: { ...estado.meta, sourceTimestamp: '2026-11-01T20:01:00Z' },
      }),
    ).not.toBe(base);
    expect(await envelopeEtag({ ...estado, meta: { ...estado.meta, stale: true } })).not.toBe(base);
    expect(await envelopeEtag({ ...estado, data: { lineas: [] } })).not.toBe(base);
  });

  it('un sourceTimestamp nuevo invalida el ETag anterior → 200', async () => {
    let ts = '2026-11-01T19:59:40Z';
    const app = appWithMovingGeneratedAt(() => ({ sourceTimestamp: ts }));
    const first = await app.request('/v1/subtes/estado', {}, testEnv());
    const etag = first.headers.get('ETag') ?? '';
    ts = '2026-11-01T20:00:40Z';
    const second = await app.request(
      '/v1/subtes/estado',
      { headers: { 'If-None-Match': etag } },
      testEnv(),
    );
    expect(second.status).toBe(200);
    expect(second.headers.get('ETag')).not.toBe(etag);
  });
});
