import { Hono } from 'hono';
import type { AppEnv } from '../container';
import { IdParam, parseParam } from '../lib/params';
import { sendEnvelope } from '../middleware/envelope';

export const trenes = new Hono<AppEnv>()
  .get('/estado', async (c) => sendEnvelope(c, await c.var.adapters.trenes.estadoLineas()))
  .get('/alertas', async (c) => sendEnvelope(c, await c.var.adapters.trenes.alertas()))
  .get('/estaciones/:estacionId/arribos', async (c) => {
    const estacionId = parseParam(IdParam, c.req.param('estacionId'), 'estacionId');
    return sendEnvelope(c, await c.var.adapters.trenes.arribos(estacionId));
  });
