// ¿El servicio de la Ciudad está caído? (brief `docs/briefs/05-favoritos.md`, estado "Servicio no
// disponible"). Una fila cuenta como "caída" si su dato vivo falló (`status: 'error'`) con un error
// que se puede reintentar (red, timeout, 5xx, 429): un 404 de una línea que ya no existe no es el
// servicio caído. `useFavoritoLiveData` no expone el error, así que se lee del estado de la query
// que usa esa fila (misma key de `shared/api`).
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { isApiError, queryKeys } from '@/shared/api';

import type { FavoritoV1 } from './model';
import type { LiveDataStatus } from './useFavoritoLiveData';

/** `down`: falló por un error reintentable. `up`: cualquier otro estado con dato vivo. */
export type ServiceHealth = 'up' | 'down';

/** La query que alimenta el dato vivo del favorito (`undefined` si no tiene: la parada). */
export function liveQueryKey(favorito: Pick<FavoritoV1, 'tipo' | 'refId'>): QueryKey | undefined {
  switch (favorito.tipo) {
    case 'linea_subte':
      return queryKeys.subtes.estado();
    case 'estacion_subte':
      return queryKeys.subtes.arribos(favorito.refId);
    case 'linea_colectivo':
      return queryKeys.colectivos.posiciones(favorito.refId);
    case 'parada_colectivo':
      return undefined;
    case 'ramal_tren':
      return queryKeys.trenes.estado();
    case 'estacion_tren':
      return queryKeys.trenes.arribos(favorito.refId);
  }
}

export function serviceHealth(
  favorito: Pick<FavoritoV1, 'tipo' | 'refId'>,
  status: LiveDataStatus,
  client: QueryClient,
): ServiceHealth {
  if (status !== 'error') return 'up';
  const key = liveQueryKey(favorito);
  if (key === undefined) return 'up';
  const error = client.getQueryState(key)?.error;
  return isApiError(error) && error.retryable ? 'down' : 'up';
}

/** Alert única: hay filas con dato vivo y TODAS están caídas. Una sola que ande, y no hay alerta. */
export function isServiceDown(health: Readonly<Record<string, ServiceHealth>>): boolean {
  const values = Object.values(health);
  return values.length > 0 && values.every((h) => h === 'down');
}
