import type { EnvelopeV1 } from '@transportate/contracts';
import type { Context } from 'hono';
import { hashHex } from '../lib/hash';
import { ifNoneMatchHits } from '../lib/http';

export const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

/**
 * Responde un `EnvelopeV1` con los headers de caché del contrato:
 * - `Cache-Control: public, max-age=<ttl>, stale-while-revalidate=<2×ttl>`
 * - `ETag` débil (SHA-1 del cuerpo) y 304 si coincide `If-None-Match`
 * - `X-Transportate-Generated-At` y `X-Transportate-Stale: 1` si el dato es el último bueno.
 * La compresión (gzip/brotli) la aplica el runtime de Workers al devolver la respuesta.
 */
export async function sendEnvelope<T>(c: Context, envelope: EnvelopeV1<T>): Promise<Response> {
  const body = JSON.stringify(envelope);
  const etag = `W/"${await hashHex(body)}"`;
  const ttl = envelope.meta.ttlSeconds;
  const headers: Record<string, string> = {
    'Content-Type': JSON_CONTENT_TYPE,
    'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${2 * ttl}`,
    ETag: etag,
    'X-Transportate-Generated-At': envelope.meta.generatedAt,
  };
  if (envelope.meta.stale) headers['X-Transportate-Stale'] = '1';

  if (ifNoneMatchHits(c.req.header('If-None-Match'), etag)) {
    return c.body(null, 304, headers);
  }
  return c.body(body, 200, headers);
}
