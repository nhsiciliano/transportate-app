// Lectura mínima de archivos del paquete estático para los mapas (manifiesto → `<version>/<archivo>`).
//
// PROVISORIO: mid-dev agrega `useStaticArchivo(archivo)` en `src/shared/static` (tarea 4.2).
// Cuando llegue a `main`, `useStaticJson` se reemplaza por ese hook y `useStaticGeoJson` se muda
// ahí (o pasa a usarlo por debajo). Mientras tanto, misma política que los demás estáticos:
// - la versión sale de `useManifest` (TTL 300 s): si el paquete cambia, la key cambia y se baja
//   el archivo nuevo; el contenido de una versión no cambia nunca, así que `staleTime: Infinity`;
// - se persiste en MMKV como cualquier consulta exitosa (`QueryProvider`): con la app abierta sin
//   red, el mapa usa la última versión guardada.
import { useQuery } from '@tanstack/react-query';
import type { ARCHIVOS_ESTATICOS_V1, GEOJSON_ESTATICOS_V1 } from '@transportate/contracts';
import type { z } from 'zod';

import { toApiError, useApiClient, useManifest, type ApiError } from '../api';
import type { ApiClient, ArchivoEstatico, ArchivoGeoJson, ApiResult } from '../api/client';

/** Mismo prefijo `static` que el manifiesto (`queryKeys.static`), con versión y archivo. */
export const staticFileKey = (version: string, archivo: string) =>
  ['static', 'archivo', version, archivo] as const;

/** Estado de un archivo estático, con la misma semántica que `ResourceQuery` de `shared/api`. */
export interface StaticResource<T> {
  data: T | undefined;
  error: ApiError | null;
  /** Primera carga (sin manifiesto o sin archivo todavía): Skeleton. */
  isPending: boolean;
  isFetching: boolean;
  /** Sin conexión y sin datos guardados: la consulta espera a que vuelva la red. */
  isPaused: boolean;
  /** Error sin datos que mostrar: ErrorState. */
  isLoadingError: boolean;
  /** Hay datos y la última actualización falló: Alert en línea. */
  isRefreshError: boolean;
  refetch(): Promise<unknown>;
}

const ROUTE = '/v1/static/:version/:archivo';

function useStaticResource<T>(
  archivo: string,
  fetcher: (client: ApiClient, version: string, signal: AbortSignal) => Promise<ApiResult<T>>,
): StaticResource<T> {
  const client = useApiClient();
  const manifest = useManifest();
  const version = manifest.data?.version;

  const query = useQuery({
    queryKey: staticFileKey(version ?? '', archivo),
    queryFn: async ({ signal }) => {
      if (version === undefined) throw toApiError(new Error('sin manifiesto'), ROUTE);
      try {
        return await fetcher(client, version, signal);
      } catch (error) {
        throw toApiError(error, ROUTE);
      }
    },
    enabled: version !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const data = query.data?.data;
  const manifestFailed = data === undefined && manifest.isLoadingError;
  const isLoadingError = query.isLoadingError || manifestFailed;

  return {
    data,
    error: query.error ?? (manifestFailed ? manifest.error : null),
    isPending: data === undefined && !isLoadingError,
    isFetching: query.isFetching || manifest.isFetching,
    isPaused: query.fetchStatus === 'paused' || manifest.isPaused,
    isLoadingError,
    isRefreshError: query.isRefetchError,
    refetch: () => (version === undefined ? manifest.refetch() : query.refetch()),
  };
}

/** JSON del paquete con contrato (`subte-estaciones.json`, `subte-lineas.json`…). */
export function useStaticJson<K extends ArchivoEstatico>(
  archivo: K,
): StaticResource<z.infer<(typeof ARCHIVOS_ESTATICOS_V1)[K]>> {
  return useStaticResource(archivo, (client, version, signal) =>
    client.staticFile(version, archivo, { signal }),
  );
}

/** `.geojson` del paquete (`subte-red.geojson`, `recorridos-colectivos.geojson`). */
export function useStaticGeoJson<K extends ArchivoGeoJson>(
  archivo: K,
): StaticResource<z.infer<(typeof GEOJSON_ESTATICOS_V1)[K]>> {
  return useStaticResource(archivo, (client, version, signal) =>
    client.staticGeoJson(version, archivo, { signal }),
  );
}
