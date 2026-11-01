import type { Context } from 'hono';

/**
 * ExecutionContext de la request, o `undefined` cuando no hay (por ejemplo, `app.request`
 * en tests). Hono tipa `c.executionCtx` con una interfaz propia más chica; en runtime es el
 * ExecutionContext real de Workers, por eso se afirma el tipo de Workers.
 */
export function executionCtxOf(c: Context): ExecutionContext | undefined {
  try {
    return c.executionCtx as ExecutionContext;
  } catch {
    return undefined;
  }
}
