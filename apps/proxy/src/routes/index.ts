import { Hono } from 'hono';
import type { AppEnv } from '../container';
import { PROXY_VERSION } from '../lib/version';

/** Rutas públicas de la API v1 (todas GET). */
export const V1_ROUTES = [
  '/v1/health',
  '/v1/subtes/estado',
  '/v1/subtes/alertas',
  '/v1/subtes/estaciones/:estacionId/arribos',
  '/v1/trenes/estado',
  '/v1/trenes/alertas',
  '/v1/trenes/estaciones/:estacionId/arribos',
  '/v1/colectivos/lineas',
  '/v1/colectivos/lineas/:lineaId/posiciones',
  '/v1/colectivos/paradas/:paradaId/arribos',
  '/v1/transito/cortes',
  '/v1/static/manifest',
  '/v1/static/:version/:archivo',
] as const;

export const index = new Hono<AppEnv>().get('/', (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ version: PROXY_VERSION, rutas: V1_ROUTES });
});
