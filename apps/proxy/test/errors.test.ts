import { ErrorV1 } from '@transportate/contracts';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/adapters/types';
import { createApp } from '../src/app';

function appWithFailingRoutes() {
  const app = createApp();
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
    const res = await appWithFailingRoutes().request('/boom', {}, env);
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
    const res = await appWithFailingRoutes().request('/upstream', {}, env);
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(ErrorV1.parse(await res.json())).toEqual({
      error: {
        code: 'upstream_unavailable',
        message: 'El servicio de la Ciudad no responde',
        retryAfterSeconds: 30,
      },
    });
  });
});
