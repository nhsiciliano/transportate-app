import { Hono } from 'hono';
import type { AppEnv } from '../container';
import { IdParam, parseParam } from '../lib/params';
import { sendEnvelope } from '../middleware/envelope';

export const subtes = new Hono<AppEnv>()
  .get('/estado', async (c) => sendEnvelope(c, await c.var.adapters.subtes.estadoLineas()))
  .get('/alertas', async (c) => sendEnvelope(c, await c.var.adapters.subtes.alertas()))
  .get('/estaciones/:estacionId/arribos', async (c) => {
    const estacionId = parseParam(IdParam, c.req.param('estacionId'), 'estacionId');
    return sendEnvelope(c, await c.var.adapters.subtes.arribos(estacionId));
  });
