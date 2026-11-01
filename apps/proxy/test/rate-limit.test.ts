import { ErrorV1 } from '@transportate/contracts';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { fakeAdapters, testEnv } from './helpers';

/*
 * El binding `ratelimit` existe en el entorno local del plugin (Miniflare), pero sus
 * contadores son compartidos y dependen del reloj: para tests deterministas se inyecta
 * un `RATE_LIMITER` falso en `env` que registra las claves y decide el resultado.
 */
function limiter(success: boolean) {
  const keys: string[] = [];
  const binding: RateLimit = {
    limit: ({ key }) => {
      keys.push(key);
      return Promise.resolve({ success });
    },
  };
  return { binding, keys };
}

const IP = '203.0.113.42';

describe('rate limiting', () => {
  it('responde 429 rate_limited con Retry-After cuando el limitador rechaza', async () => {
    const { binding } = limiter(false);
    const app = createApp({ adapters: fakeAdapters() });
    const res = await app.request(
      '/v1/subtes/estado',
      { headers: { 'cf-connecting-ip': IP } },
      testEnv({ RATE_LIMITER: binding }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(ErrorV1.parse(await res.json()).error).toMatchObject({
      code: 'rate_limited',
      retryAfterSeconds: 60,
    });
  });

  it('la clave del limitador es un hash: la IP no viaja ni aparece en la respuesta', async () => {
    const { binding, keys } = limiter(true);
    const app = createApp({ adapters: fakeAdapters() });
    const res = await app.request(
      '/v1/colectivos/lineas',
      { headers: { 'cf-connecting-ip': IP } },
      testEnv({ RATE_LIMITER: binding }),
    );
    expect(res.status).toBe(200);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(keys[0]).not.toContain(IP);
    expect(await res.text()).not.toContain(IP);
  });

  it('sin cf-connecting-ip usa una clave común ("anon")', async () => {
    const { binding, keys } = limiter(true);
    const app = createApp({ adapters: fakeAdapters() });
    const env = testEnv({ RATE_LIMITER: binding });
    await app.request('/v1/subtes/estado', {}, env);
    await app.request('/v1/subtes/alertas', {}, env);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('no limita /v1/health ni /v1/static/*', async () => {
    const { binding, keys } = limiter(false);
    const app = createApp({ adapters: fakeAdapters() });
    const env = testEnv({ RATE_LIMITER: binding });
    expect((await app.request('/v1/health', {}, env)).status).toBe(200);
    const est = await app.request('/v1/static/no-existe/paradas.json', {}, env);
    expect(est.status).toBe(404);
    expect(keys).toHaveLength(0);
  });
});
