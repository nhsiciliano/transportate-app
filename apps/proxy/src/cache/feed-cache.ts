// Entradas de caché de feeds upstream en la Cache API (`caches.default`).
//
// La clave es una URL ficticia derivada de la clave lógica del feed (`colectivos:vehiclePositions:
// route=1858`), NUNCA la URL upstream: esa lleva `client_secret` en la query y la Cache API la
// guardaría tal cual. El cuerpo es el crudo del upstream; la frescura viaja en headers propios.

const CACHE_ORIGIN = 'https://cache.transportate.internal';
const H_FETCHED_AT = 'x-fetched-at';
const H_UPSTREAM_STATUS = 'x-upstream-status';

/** Request sintética usada como clave de caché para una clave lógica de feed. */
export function feedCacheKey(key: string): Request {
  return new Request(`${CACHE_ORIGIN}/feed/${encodeURIComponent(key)}`, { method: 'GET' });
}

export interface CachedFeed {
  body: ArrayBuffer;
  fetchedAt: number;
  upstreamStatus: number;
}

/**
 * Arma la `Response` que se guarda. `max-age` cubre TTL + ventana de dato viejo, para que la
 * entrada vencida siga disponible como último dato bueno (la frescura la decide `x-fetched-at`).
 */
export function toCacheResponse(entry: CachedFeed, retainSeconds: number): Response {
  return new Response(entry.body.slice(0), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': `public, max-age=${Math.max(1, Math.ceil(retainSeconds))}`,
      [H_FETCHED_AT]: String(entry.fetchedAt),
      [H_UPSTREAM_STATUS]: String(entry.upstreamStatus),
    },
  });
}

/** Lee una entrada guardada con `toCacheResponse`; `null` si le faltan los headers propios. */
export async function fromCacheResponse(res: Response): Promise<CachedFeed | null> {
  const fetchedAt = Number(res.headers.get(H_FETCHED_AT));
  const upstreamStatus = Number(res.headers.get(H_UPSTREAM_STATUS) ?? 200);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return null;
  return { body: await res.arrayBuffer(), fetchedAt, upstreamStatus };
}
