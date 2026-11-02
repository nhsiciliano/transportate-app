import type { EnvelopeV1 } from '@transportate/contracts';
import type { Context } from 'hono';
import { hashHex } from '../lib/hash';
import { ifNoneMatchHits } from '../lib/http';

export const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

/**
 * Responde un `EnvelopeV1` con los headers de caché del contrato:
 * - `Cache-Control: public, max-age=<ttl>, stale-while-revalidate=<2×ttl>`
 * - `ETag` débil y 304 si coincide `If-None-Match`. El ETag se calcula sobre lo que identifica
 *   al dato (`data`, `meta.sourceTimestamp`, `meta.stale`), NO sobre `generatedAt`/`ageSeconds`,
 *   que cambian en cada request aunque el dato servido desde caché sea el mismo. Así un cliente
 *   que repite la consulta dentro del TTL recibe 304 de verdad; la frescura la calcula con
 *   `sourceTimestamp`.
 * - `X-Transportate-Generated-At` y `X-Transportate-Stale: 1` si el dato es el último bueno.
 * La compresión (gzip/brotli) la aplica el runtime de Workers al devolver la respuesta.
 */
/** ETag débil estable para un sobre: no depende de `generatedAt` ni de `ageSeconds`. */
export async function envelopeEtag<T>(envelope: EnvelopeV1<T>): Promise<string> {
  const identity = JSON.stringify({
    data: envelope.data,
    sourceTimestamp: envelope.meta.sourceTimestamp,
    stale: envelope.meta.stale,
  });
  return `W/"${await hashHex(identity)}"`;
}

export async function sendEnvelope<T>(c: Context, envelope: EnvelopeV1<T>): Promise<Response> {
  const body = JSON.stringify(envelope);
  const etag = await envelopeEtag(envelope);
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
