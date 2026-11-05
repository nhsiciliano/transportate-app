import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { AppDeps, AppEnv } from './container';
import { injectDeps } from './middleware/adapters';
import { notFound, onError } from './middleware/errors';
import { rateLimit } from './middleware/rate-limit';
import { colectivos } from './routes/colectivos';
import { health } from './routes/health';
import { index } from './routes/index';
import { staticRoutes } from './routes/static';
import { subtes } from './routes/subtes';
import { transito } from './routes/transito';
import { trenes } from './routes/trenes';

export type { AppEnv } from './container';

/** Arma la app con sus dependencias. Separado de `index.ts` para inyectar fakes en tests. */
export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', secureHeaders());
  app.use('*', cors({ origin: '*', allowMethods: ['GET'] }));
  app.use('/v1/*', rateLimit);
  app.use('*', injectDeps(deps));

  app.route('/v1', index);
  app.route('/v1/health', health);
  app.route('/v1/subtes', subtes);
  app.route('/v1/colectivos', colectivos);
  app.route('/v1/trenes', trenes);
  app.route('/v1/transito', transito);
  app.route('/v1/static', staticRoutes);

  app.onError(onError);
  app.notFound(notFound);
  return app;
}
