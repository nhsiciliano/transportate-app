import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { notFound, onError } from './middleware/errors';
import { health } from './routes/health';

export type AppEnv = { Bindings: CloudflareBindings };

/** Arma la app. Separado de `index.ts` para poder montar rutas extra en tests. */
export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', secureHeaders());
  app.use('*', cors({ origin: '*', allowMethods: ['GET'] }));
  app.route('/v1/health', health);
  app.onError(onError);
  app.notFound(notFound);
  return app;
}
