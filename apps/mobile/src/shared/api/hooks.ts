// Hooks de datos (TanStack Query v5) sobre el cliente del proxy. Política común
// (src/shared/query/README.md):
// - `staleTime` = `meta.ttlSeconds` del último dato (20 s si todavía no hay dato).
// - Tiempo real: `refetchInterval` = intervalo elegido (S17) ± 10 % de jitter, solo en primer
//   plano (`refetchIntervalInBackground: false` + focusManager ← AppState).
// - Estáticos (líneas de colectivo, manifiesto): sin polling; se revalidan al volver a la app.
// - Último dato bueno: si una actualización falla y ya había datos, `data` sigue siendo el
//   anterior y `error` trae la falla (`isRefreshError`): la pantalla muestra la Alert en línea y
//   no el ErrorState (docs/briefs/README.md, "ErrorState"). No se usa `keepPreviousData`: al
//   cambiar de estación o de línea, mostrar los datos de la anterior sería un error.
import type {
  AlertasTrenV1,
  AlertasV1,
  ArribosEstacionTrenV1,
  ArribosEstacionV1,
  ArribosParadaV1,
  EstadoLineasTrenV1,
  EstadoLineasV1,
  LineasColectivoV1,
  ManifestV1,
  MetaV1,
  PosicionesLineaV1,
} from '@transportate/contracts';
import { useQuery, type QueryKey, type UseQueryResult } from '@tanstack/react-query';

import { withJitter } from '../query/queryClient';
import { useRefreshInterval } from '../query/refreshInterval';
import { useApiClient } from './ApiClientProvider';
import type { ApiClient, ApiResult, FeedResult } from './client';
import { toApiError, type ApiError } from './errors';
import { queryKeys } from './keys';

/** `staleTime` cuando todavía no hay dato (el TTL de los feeds del proxy, docs/06-proxy.md §2). */
export const DEFAULT_STALE_TIME_MS = 20_000;
/** TTL del manifiesto en el proxy (docs/06-proxy.md §2). */
export const MANIFEST_STALE_TIME_MS = 300_000;

/** Lo común a toda consulta, sin el resto de `UseQueryResult` (más fácil de usar y de mockear). */
export interface ResourceQuery<T> {
  data: T | undefined;
  error: ApiError | null;
  status: 'pending' | 'error' | 'success';
  /** Primera carga sin datos: Skeleton. */
  isPending: boolean;
  isFetching: boolean;
  /** Sin conexión: la consulta quedó en pausa (no falló) y se reanuda al reconectar. */
  isPaused: boolean;
  /** Hay datos de antes y la última actualización falló: Alert en línea + FreshnessLabel. */
  isRefreshError: boolean;
  /** Error sin datos que mostrar: ErrorState. */
  isLoadingError: boolean;
  stale: boolean;
  fromCache: boolean;
  dataUpdatedAt: number;
  refetch(): Promise<unknown>;
}

/** Consulta de un feed `{ meta, data }`, con la frescura lista para `FreshnessLabel`. */
export interface FeedQuery<T> extends ResourceQuery<T> {
  meta: MetaV1 | undefined;
  /** Para `<FreshnessLabel sourceTimestamp={…} />`. */
  sourceTimestamp: string | null;
  /** Edad del dato al recibirlo (s); FreshnessLabel la sigue contando con `sourceTimestamp`. */
  ageSeconds: number | null;
}

function toResource<T, R extends ApiResult<T>>(query: UseQueryResult<R>): ResourceQuery<T> {
  const result = query.data;
  return {
    data: result?.data,
    error: query.error,
    status: query.status,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isPaused: query.fetchStatus === 'paused',
    isRefreshError: query.isRefetchError,
    isLoadingError: query.isLoadingError,
    stale: result?.stale ?? false,
    fromCache: result?.fromCache ?? false,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
}

function toFeed<T>(query: UseQueryResult<FeedResult<T>>): FeedQuery<T> {
  const result = query.data;
  return {
    ...toResource<T, FeedResult<T>>(query),
    meta: result?.meta,
    sourceTimestamp: result?.sourceTimestamp ?? null,
    ageSeconds: result?.ageSeconds ?? null,
  };
}

interface FeedOptions {
  enabled?: boolean;
}

/** Ejecuta la consulta normalizando cualquier falla a `ApiError` (ver `query/register.ts`). */
async function run<R>(route: string, fn: () => Promise<R>): Promise<R> {
  try {
    return await fn();
  } catch (error) {
    throw toApiError(error, route);
  }
}

function useFeed<T>(
  queryKey: QueryKey,
  route: string,
  fetcher: (client: ApiClient, signal: AbortSignal) => Promise<FeedResult<T>>,
  { enabled = true, polling }: FeedOptions & { polling: boolean },
): FeedQuery<T> {
  const client = useApiClient();
  const { seconds } = useRefreshInterval();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => run(route, () => fetcher(client, signal)),
    enabled,
    staleTime: (q) => {
      const ttl = q.state.data?.meta.ttlSeconds;
      return ttl === undefined ? DEFAULT_STALE_TIME_MS : ttl * 1000;
    },
    // Se recalcula después de cada respuesta: cada ciclo tiene su propio jitter.
    refetchInterval: polling ? () => withJitter(seconds * 1000) : false,
  });
  return toFeed(query);
}

const hasId = (id: string | null | undefined): id is string => typeof id === 'string' && id !== '';

// ---------------------------------------------------------------- subtes

export function useEstadoSubtes(options: FeedOptions = {}): FeedQuery<EstadoLineasV1> {
  return useFeed(
    queryKeys.subtes.estado(),
    '/v1/subtes/estado',
    (client, signal) => client.estadoSubtes({ signal }),
    { ...options, polling: true },
  );
}

export function useAlertasSubtes(options: FeedOptions = {}): FeedQuery<AlertasV1> {
  return useFeed(
    queryKeys.subtes.alertas(),
    '/v1/subtes/alertas',
    (client, signal) => client.alertasSubtes({ signal }),
    { ...options, polling: true },
  );
}

export function useArribosEstacion(
  estacionId: string | null | undefined,
  options: FeedOptions = {},
): FeedQuery<ArribosEstacionV1> {
  const id = hasId(estacionId) ? estacionId : '';
  return useFeed(
    queryKeys.subtes.arribos(id),
    '/v1/subtes/estaciones/:estacionId/arribos',
    (client, signal) => client.arribosEstacion(id, { signal }),
    { enabled: (options.enabled ?? true) && hasId(estacionId), polling: true },
  );
}

// ---------------------------------------------------------------- trenes
// Estado y alertas tienen TTL de 60 s en el proxy (`meta.ttlSeconds`): `staleTime` sale de ahí.

export function useEstadoTrenes(options: FeedOptions = {}): FeedQuery<EstadoLineasTrenV1> {
  return useFeed(
    queryKeys.trenes.estado(),
    '/v1/trenes/estado',
    (client, signal) => client.estadoTrenes({ signal }),
    { ...options, polling: true },
  );
}

export function useAlertasTrenes(options: FeedOptions = {}): FeedQuery<AlertasTrenV1> {
  return useFeed(
    queryKeys.trenes.alertas(),
    '/v1/trenes/alertas',
    (client, signal) => client.alertasTrenes({ signal }),
    { ...options, polling: true },
  );
}

export function useArribosEstacionTren(
  estacionId: string | null | undefined,
  options: FeedOptions = {},
): FeedQuery<ArribosEstacionTrenV1> {
  const id = hasId(estacionId) ? estacionId : '';
  return useFeed(
    queryKeys.trenes.arribos(id),
    '/v1/trenes/estaciones/:estacionId/arribos',
    (client, signal) => client.arribosEstacionTren(id, { signal }),
    { enabled: (options.enabled ?? true) && hasId(estacionId), polling: true },
  );
}

// ---------------------------------------------------------------- colectivos

/** Estático (TTL 24 h en el proxy): sin polling. */
export function useLineasColectivo(options: FeedOptions = {}): FeedQuery<LineasColectivoV1> {
  return useFeed(
    queryKeys.colectivos.lineas(),
    '/v1/colectivos/lineas',
    (client, signal) => client.lineasColectivo({ signal }),
    { ...options, polling: false },
  );
}

export function usePosicionesLinea(
  lineaId: string | null | undefined,
  options: FeedOptions = {},
): FeedQuery<PosicionesLineaV1> {
  const id = hasId(lineaId) ? lineaId : '';
  return useFeed(
    queryKeys.colectivos.posiciones(id),
    '/v1/colectivos/lineas/:lineaId/posiciones',
    (client, signal) => client.posicionesLinea(id, { signal }),
    { enabled: (options.enabled ?? true) && hasId(lineaId), polling: true },
  );
}

export function useArribosParada(
  paradaId: string | null | undefined,
  options: FeedOptions = {},
): FeedQuery<ArribosParadaV1> {
  const id = hasId(paradaId) ? paradaId : '';
  return useFeed(
    queryKeys.colectivos.arribos(id),
    '/v1/colectivos/paradas/:paradaId/arribos',
    (client, signal) => client.arribosParada(id, { signal }),
    { enabled: (options.enabled ?? true) && hasId(paradaId), polling: true },
  );
}

// ---------------------------------------------------------------- estático

/** Manifiesto del paquete estático (TTL 300 s + ETag en el proxy): sin polling. */
export function useManifest(options: FeedOptions = {}): ResourceQuery<ManifestV1> {
  const client = useApiClient();
  const query = useQuery({
    queryKey: queryKeys.static.manifest(),
    queryFn: ({ signal }) => run('/v1/static/manifest', () => client.manifest({ signal })),
    enabled: options.enabled ?? true,
    staleTime: MANIFEST_STALE_TIME_MS,
  });
  return toResource<ManifestV1, ApiResult<ManifestV1>>(query);
}
