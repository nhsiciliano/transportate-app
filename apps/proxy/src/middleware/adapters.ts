import type { MiddlewareHandler } from 'hono';
import { resolveAdapters, type AppDeps, type AppEnv } from '../container';
import { executionCtxOf } from '../lib/context';

/** Arma los adaptadores de la request (con su `env`) y el reloj, y los deja en `c.var`. */
export function injectDeps(deps: AppDeps): MiddlewareHandler<AppEnv> {
  const now = deps.now ?? Date.now;
  return async (c, next) => {
    c.set('adapters', resolveAdapters(deps.adapters, c.env, executionCtxOf(c)));
    c.set('now', now);
    await next();
  };
}
