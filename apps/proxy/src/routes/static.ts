import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { ApiError } from '../adapters/types';
import type { AppEnv } from '../container';
import { executionCtxOf } from '../lib/context';
import { ifNoneMatchHits } from '../lib/http';
import { IdParam, parseParam } from '../lib/params';
import { contentTypeFor, loadFile, loadManifest } from '../static/r2';

/** Nombre de archivo del paquete: sin barras ni `..`, con extensión `.json` o `.geojson`. */
const ArchivoParam = z.string().regex(/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}\.(json|geojson)$/);

function respond(c: Context<AppEnv>, body: ArrayBuffer, headers: Headers): Response {
  const etag = headers.get('ETag');
  const out = Object.fromEntries(headers.entries());
  if (etag && ifNoneMatchHits(c.req.header('If-None-Match'), etag)) {
    return c.body(null, 304, out);
  }
  return c.body(body, 200, out);
}

export const staticRoutes = new Hono<AppEnv>()
  .get('/manifest', async (c) => {
    const { body, headers } = await loadManifest(c.env.STATIC, c.req.url, executionCtxOf(c));
    return respond(c, body, headers);
  })
  .get('/:version/:archivo', async (c) => {
    const version = parseParam(IdParam, c.req.param('version'), 'version');
    const archivo = parseParam(ArchivoParam, c.req.param('archivo'), 'archivo');
    if (archivo.includes('..'))
      throw new ApiError('bad_request', 'Parámetro inválido: archivo', 400);
    const contentType = contentTypeFor(archivo);
    if (!contentType) throw new ApiError('bad_request', 'Parámetro inválido: archivo', 400);
    const { body, headers } = await loadFile(
      c.env.STATIC,
      `${version}/${archivo}`,
      contentType,
      c.req.url,
      executionCtxOf(c),
    );
    return respond(c, body, headers);
  });
