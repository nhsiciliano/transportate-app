// `.geojson` del paquete estático para los mapas. Los JSON con contrato van por `useStaticArchivo`
// de `src/shared/static` (4.2); este hook sigue su misma convención para los GeoJSON, que ese
// hook no cubre (`client.staticFile` acepta solo `ARCHIVOS_ESTATICOS_V1`):
// - la versión sale de `archivos[archivo].url` del manifiesto (`<version>/<archivo>`);
// - query key `['static', 'archivo', <archivo>, <version>]` (`staticKeys`), `staleTime: Infinity`
//   (una versión no cambia nunca) y `gcTime` de 24 h: el persister MMKV lo guarda con el resto de
//   la caché, así que con la app abierta sin red el mapa usa la versión guardada;
// - sin la copia de "última versión conocida" de `shared/static`: si la caché persistida venció
//   (24 h sin abrir la app) y no hay red, el mapa espera a la conexión (F4-mapa-6).
import { useQuery } from '@tanstack/react-query';
import type { GEOJSON_ESTATICOS_V1, ManifestV1 } from '@transportate/contracts';
import type { z } from 'zod';

import { HttpError, toApiError, useApiClient, useManifest, type ApiError } from '../api';
import type { ArchivoGeoJson } from '../api/client';
import { GC_TIME_MS } from '../query';
import { staticKeys } from '../static';

const ROUTE = '/v1/static/:version/:archivo';

export type GeoJsonData<K extends ArchivoGeoJson> = z.infer<(typeof GEOJSON_ESTATICOS_V1)[K]>;

/** Mismo contrato que `StaticQuery` de `shared/static`, sin la última versión conocida. */
export interface StaticGeoJsonQuery<T> {
  data: T | undefined;
  version: string | undefined;
  /** Sin dato todavía: Skeleton. */
  isPending: boolean;
  /** Sin dato y falló el manifiesto o el archivo (o el manifiesto no lo publica): ErrorState. */
  isLoadingError: boolean;
  isFetching: boolean;
  error: ApiError | null;
  refetch: () => Promise<unknown>;
}

/** `archivos[archivo].url` = `<version>/<archivo>` → `version` (como `versionFromManifest`). */
export function geoJsonVersion(
  manifest: ManifestV1 | undefined,
  archivo: ArchivoGeoJson,
): string | undefined {
  const url = manifest?.archivos[archivo]?.url;
  if (url === undefined) return undefined;
  const slash = url.lastIndexOf('/');
  const version = slash > 0 ? url.slice(0, slash) : manifest?.version;
  return version === '' ? undefined : version;
}

export function useStaticGeoJson<K extends ArchivoGeoJson>(
  archivo: K,
): StaticGeoJsonQuery<GeoJsonData<K>> {
  const client = useApiClient();
  const manifest = useManifest();
  const version = geoJsonVersion(manifest.data, archivo);

  const query = useQuery({
    queryKey: [...staticKeys.archivos(), archivo, version ?? ''],
    queryFn: async ({ signal }): Promise<GeoJsonData<K>> => {
      try {
        // `enabled` garantiza que hay versión.
        return (await client.staticGeoJson(version ?? '', archivo, { signal })).data;
      } catch (error) {
        throw toApiError(error, ROUTE);
      }
    },
    enabled: version !== undefined,
    staleTime: Infinity,
    gcTime: GC_TIME_MS,
  });

  // El manifiesto llegó y no publica el archivo (`omitidos`): no hay nada que esperar.
  const missing = manifest.data !== undefined && version === undefined;
  const data = query.data;
  const hasData = data !== undefined;
  const isLoadingError = !hasData && (missing || query.isLoadingError || manifest.isLoadingError);
  const error =
    query.error ??
    manifest.error ??
    (missing ? new HttpError(ROUTE, 404, 'not_found', null) : null);

  return {
    data,
    version,
    isPending: !hasData && !isLoadingError,
    isLoadingError,
    isFetching: query.isFetching || manifest.isFetching,
    error,
    refetch: () => (version === undefined ? manifest.refetch() : query.refetch()),
  };
}
