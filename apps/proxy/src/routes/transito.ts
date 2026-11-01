import { Hono } from 'hono';
import type { AppEnv } from '../container';

// Diferido (tarea 2.7): el adaptador siempre lanza `upstream_unavailable` (503).
export const transito = new Hono<AppEnv>().get('/cortes', async (c) => {
  return c.var.adapters.transito.cortes();
});
