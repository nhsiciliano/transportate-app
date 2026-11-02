// Composición de los adaptadores reales por request: una fuente `EdgeCachedFeedSource` (capa A)
// con las credenciales de `env` y el índice estático sobre el bucket R2 `STATIC`.
// Es barato: el estado caro (coalescing, copia en memoria, índices estáticos) vive por isolate.
import type { Adapters } from '../container';
import { DEFAULT_UPSTREAM_TIMEOUT_MS, EdgeCachedFeedSource } from '../sources/edge-cached';
import { feedTtl } from '../sources/upstream';
import { createColectivosAdapter } from './colectivos';
import { r2Store } from './colectivos/static-index';
import { createSubtesAdapter } from './subtes';
import { createTransitoAdapter } from './transito';

/**
 * `UPSTREAM_TIMEOUT_MS` (ms por intento upstream, default 5000). Todavía no está en
 * wrangler.jsonc: se lee de forma opcional para no depender de los tipos generados.
 */
export function upstreamTimeoutMs(env: { UPSTREAM_TIMEOUT_MS?: string }): number {
  // Tipo estructural a propósito: `wrangler types` genera el literal "5000" para la var
  // y los tests necesitan pasar otros valores.
  return feedTtl(env.UPSTREAM_TIMEOUT_MS, DEFAULT_UPSTREAM_TIMEOUT_MS);
}

export function createAdapters(env: CloudflareBindings, ctx?: ExecutionContext): Adapters {
  const ttlSeconds = feedTtl(env.FEED_TTL_SECONDS);
  const staticTtlSeconds = feedTtl(env.STATIC_TTL_SECONDS, 86_400);
  const source = new EdgeCachedFeedSource({
    credentials: { clientId: env.GCBA_CLIENT_ID, clientSecret: env.GCBA_CLIENT_SECRET },
    ctx,
    timeoutMs: upstreamTimeoutMs(env),
  });
  const now = Date.now;
  return {
    subtes: createSubtesAdapter({ source, ttlSeconds, now }),
    colectivos: createColectivosAdapter({
      source,
      store: r2Store(env.STATIC, ctx),
      ttlSeconds,
      staticTtlSeconds,
      now,
    }),
    transito: createTransitoAdapter(),
  };
}
