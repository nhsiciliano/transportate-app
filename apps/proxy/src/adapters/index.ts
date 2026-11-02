// Composición de los adaptadores reales por request: una fuente `EdgeCachedFeedSource` (capa A)
// con las credenciales de `env` y el índice estático sobre el bucket R2 `STATIC`.
// Es barato: el estado caro (coalescing, copia en memoria, índices estáticos) vive por isolate.
import type { Adapters } from '../container';
import { EdgeCachedFeedSource } from '../sources/edge-cached';
import { feedTtl } from '../sources/upstream';
import { createColectivosAdapter } from './colectivos';
import { r2Store } from './colectivos/static-index';
import { createSubtesAdapter } from './subtes';
import { createTransitoAdapter } from './transito';

export function createAdapters(env: CloudflareBindings, ctx?: ExecutionContext): Adapters {
  const ttlSeconds = feedTtl(env.FEED_TTL_SECONDS);
  const staticTtlSeconds = feedTtl(env.STATIC_TTL_SECONDS, 86_400);
  const source = new EdgeCachedFeedSource({
    credentials: { clientId: env.GCBA_CLIENT_ID, clientSecret: env.GCBA_CLIENT_SECRET },
    ctx,
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
