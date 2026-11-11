// Lectura del paquete estático (generado por tools/gtfs) desde el bucket R2 `STATIC`,
// con la Cache API del colo delante para no leer R2 en cada request.
// Ojo: en previews y en el editor del dashboard la Cache API no tiene efecto. Los headers que ve
// el cliente son siempre los propios (`ownHeaders`), no los que devuelve `cache.match`.
import { ManifestV1 } from '@transportate/contracts';
import { ApiError } from '../adapters/types';
import { hashHex } from '../lib/hash';
import { runInBackground } from '../lib/http';
import { JSON_CONTENT_TYPE } from '../middleware/envelope';

export const MANIFEST_KEY = 'latest/manifest.json';
export const MANIFEST_CACHE_CONTROL = 'public, max-age=300';
export const FILE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const CONTENT_TYPES: Record<string, string> = {
  json: JSON_CONTENT_TYPE,
  geojson: 'application/geo+json; charset=utf-8',
};

/** Content-Type por extensión; `undefined` si la extensión no está permitida. */
export function contentTypeFor(archivo: string): string | undefined {
  const ext = archivo.slice(archivo.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[ext];
}

interface CachedBody {
  body: ArrayBuffer;
  headers: Headers;
}

/** Clave de caché: solo origen + path (sin query ni headers condicionales de la request). */
function cacheKey(url: string): Request {
  const u = new URL(url);
  return new Request(`${u.origin}${u.pathname}`, { method: 'GET' });
}

/**
 * Headers propios de una entrada guardada. Lo que devuelve `cache.match` no se reenvía tal cual:
 * trae `CF-Cache-Status` y `Age`, y en un dominio propio la zona puede reescribirle el
 * `Cache-Control` (Browser Cache TTL: el manifiesto salía con `max-age=14400` en vez de 300).
 */
function ownHeaders(hit: Headers, cacheControl: string): Headers {
  const headers = new Headers({ 'Cache-Control': cacheControl });
  for (const name of ['Content-Type', 'ETag']) {
    const value = hit.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

/**
 * Devuelve el cuerpo y headers desde `caches.default` o, si no está, desde `load()`;
 * en el segundo caso guarda en caché en segundo plano. `cacheControl` es el que ve el cliente,
 * venga el dato de la caché o de R2.
 */
async function cachedOrLoad(
  url: string,
  ctx: ExecutionContext | undefined,
  cacheControl: string,
  load: () => Promise<CachedBody>,
): Promise<CachedBody> {
  const cache = caches.default;
  const key = cacheKey(url);
  const hit = await cache.match(key);
  if (hit) {
    return { body: await hit.arrayBuffer(), headers: ownHeaders(hit.headers, cacheControl) };
  }

  const loaded = await load();
  const toCache = new Response(loaded.body.slice(0), { headers: loaded.headers });
  await runInBackground(ctx, cache.put(key, toCache));
  return loaded;
}

/** `latest/manifest.json` validado con `ManifestV1`. */
export function loadManifest(
  bucket: R2Bucket,
  url: string,
  ctx: ExecutionContext | undefined,
): Promise<CachedBody> {
  return cachedOrLoad(url, ctx, MANIFEST_CACHE_CONTROL, async () => {
    const obj = await bucket.get(MANIFEST_KEY);
    if (!obj) throw new ApiError('not_found', 'Todavía no hay paquete estático publicado', 404);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await obj.text());
    } catch {
      throw new ApiError('upstream_unavailable', 'Manifiesto estático inválido', 503);
    }
    const manifest = ManifestV1.safeParse(parsed);
    if (!manifest.success) {
      throw new ApiError('upstream_unavailable', 'Manifiesto estático inválido', 503);
    }
    const text = JSON.stringify(manifest.data);
    const headers = new Headers({
      'Content-Type': JSON_CONTENT_TYPE,
      'Cache-Control': MANIFEST_CACHE_CONTROL,
      ETag: `W/"${await hashHex(text)}"`,
    });
    return { body: await new Response(text).arrayBuffer(), headers };
  });
}

/** Objeto `<version>/<archivo>` del bucket, inmutable. */
export function loadFile(
  bucket: R2Bucket,
  key: string,
  contentType: string,
  url: string,
  ctx: ExecutionContext | undefined,
): Promise<CachedBody> {
  return cachedOrLoad(url, ctx, FILE_CACHE_CONTROL, async () => {
    const obj = await bucket.get(key);
    if (!obj) throw new ApiError('not_found', 'Archivo estático inexistente', 404);
    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': FILE_CACHE_CONTROL,
      ETag: obj.httpEtag,
    });
    return { body: await obj.arrayBuffer(), headers };
  });
}
