import { HealthV1 } from '@transportate/contracts';
import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('GET /v1/health', () => {
  it('responde ok, versión y entorno', async () => {
    const res = await exports.default.fetch('https://proxy.test/v1/health');
    expect(res.status).toBe(200);
    const body = HealthV1.parse(await res.json());
    expect(body).toEqual({ ok: true, version: '0.1.0', environment: 'dev' });
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('una ruta inexistente devuelve el sobre de error 404', async () => {
    const res = await exports.default.fetch('https://proxy.test/v1/nada');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'not_found', message: 'Recurso inexistente' },
    });
  });
});
