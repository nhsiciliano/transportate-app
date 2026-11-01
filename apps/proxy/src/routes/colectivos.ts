import { Hono } from 'hono';
import type { AppEnv } from '../container';
import { IdParam, parseParam } from '../lib/params';
import { sendEnvelope } from '../middleware/envelope';

export const colectivos = new Hono<AppEnv>()
  .get('/lineas', async (c) => sendEnvelope(c, await c.var.adapters.colectivos.lineas()))
  .get('/lineas/:lineaId/posiciones', async (c) => {
    const lineaId = parseParam(IdParam, c.req.param('lineaId'), 'lineaId');
    return sendEnvelope(c, await c.var.adapters.colectivos.posiciones(lineaId));
  })
  .get('/paradas/:paradaId/arribos', async (c) => {
    const paradaId = parseParam(IdParam, c.req.param('paradaId'), 'paradaId');
    return sendEnvelope(c, await c.var.adapters.colectivos.arribos(paradaId));
  });
