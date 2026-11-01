import { ErrorV1 } from '@transportate/contracts';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/adapters/types';
import { createApp } from '../src/app';
import { FAKE_SECRET, fakeAdapters, testEnv } from './helpers';

function appWithFailingRoutes() {
  const app = createApp({ adapters: fakeAdapters() });
  app.get('/boom', () => {
    throw new Error('falló https://apitransporte.buenosaires.gob.ar/x?client_secret=NO-FILTRAR');
  });
  app.get('/upstream', () => {
    throw new ApiError('upstream_unavailable', 'El servicio de la Ciudad no responde', 503, 30);
  });
  return app;
}

describe('manejador global de errores', () => {
  it('un error desconocido devuelve 500 con el sobre y sin stack ni URL', async () => {
    const res = await appWithFailingRoutes().request('/boom', {}, testEnv());
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('stack');
    expect(text).not.toContain('client_secret');
    expect(text).not.toContain('apitransporte');
    expect(ErrorV1.parse(JSON.parse(text))).toEqual({
      error: { code: 'internal', message: 'Error interno' },
    });
  });

  it('un ApiError respeta código, status y Retry-After', async () => {
    const res = await appWithFailingRoutes().request('/upstream', {}, testEnv());
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(ErrorV1.parse(await res.json())).toEqual({
      error: {
        code: 'upstream_unavailable',
        message: 'El servicio de la Ciudad no responde',
        retryAfterSeconds: 30,
      },
    });
  });

  it('el secret de env nunca llega a la respuesta aunque un adaptador lo meta en el error', async () => {
    const app = createApp({
      adapters: (e) => {
        const base = fakeAdapters();
        return {
          ...base,
          subtes: {
            ...base.subtes,
            estadoLineas: () =>
              Promise.reject(new Error(`upstream 500 en ?client_secret=${e.GCBA_CLIENT_SECRET}`)),
          },
        };
      },
    });
    const res = await app.request('/v1/subtes/estado', {}, testEnv());
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain(FAKE_SECRET);
    expect([...res.headers.values()].join(' ')).not.toContain(FAKE_SECRET);
  });
});
