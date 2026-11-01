import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../container';
import { ApiError } from '../adapters/types';
import { hashHex } from '../lib/hash';

/** Período configurado en `wrangler.jsonc` (`ratelimits[].simple.period`). */
export const RATE_LIMIT_PERIOD_SECONDS = 60;

/** Rutas que no cuentan para el límite: salud y paquete estático (inmutable y cacheado). */
function isExempt(path: string): boolean {
  return path === '/v1/health' || path.startsWith('/v1/static/');
}

/**
 * Rate limiting con el binding nativo de Workers (contadores en memoria por colo).
 * Privacidad: la IP nunca se loguea ni se persiste; al limitador le llega solo un hash
 * truncado, que alcanza para distinguir clientes dentro de una ventana de 60 s.
 */
export const rateLimit: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (isExempt(c.req.path)) {
    await next();
    return;
  }
  const ip = c.req.header('cf-connecting-ip') ?? 'anon';
  const key = (await hashHex(`transportate-rl:${ip}`, 'SHA-256')).slice(0, 32);
  const { success } = await c.env.RATE_LIMITER.limit({ key });
  if (!success) {
    throw new ApiError(
      'rate_limited',
      'Demasiadas consultas. Probá de nuevo en un rato.',
      429,
      RATE_LIMIT_PERIOD_SECONDS,
    );
  }
  await next();
};
