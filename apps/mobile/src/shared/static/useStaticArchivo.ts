// Archivos del paquete estático versionado (`/v1/static/manifest` + `/v1/static/:version/:archivo`,
// docs/06-proxy.md §7). README.md de esta carpeta: cómo se resuelve la versión y qué pasa offline.
import type { ManifestV1 } from '@transportate/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { toApiError, useApiClient, useManifest, type ApiError, type ArchivoEstatico } from '../api';
import { GC_TIME_MS } from '../query';
import type { ArchivoData } from './lastKnown';
import { useLastKnownStore } from './StaticStoreProvider';

/** Query keys del estático: la versión es parte de la key (cada versión es inmutable). */
export const staticKeys = {
  archivos: () => ['static', 'archivo'] as const,
  archivo: (archivo: ArchivoEstatico, version: string) =>
    ['static', 'archivo', archivo, version] as const,
};

/** `archivos[archivo].url` = `<version>/<archivo>` → `version`. */
export function versionFromManifest(
  manifest: ManifestV1 | undefined,
  archivo: ArchivoEstatico,
): string | undefined {
  const url = manifest?.archivos[archivo]?.url;
  if (url === undefined) return undefined;
  const slash = url.lastIndexOf('/');
  const version = slash > 0 ? url.slice(0, slash) : manifest?.version;
  return version === '' ? undefined : version;
}

export interface StaticQuery<T> {
  data: T | undefined;
  /** Versión del dato mostrado (la del manifiesto o la última conocida). */
  version: string | undefined;
  /** Sin dato todavía (manifiesto o archivo cargando): Skeleton. */
  isPending: boolean;
  /** Sin dato y falló el manifiesto o el archivo: ErrorState. */
  isLoadingError: boolean;
  isFetching: boolean;
  /** `true` si el dato es la última versión guardada y no la del manifiesto actual. */
  fromLastKnown: boolean;
  error: ApiError | null;
  refetch: () => Promise<unknown>;
}

/**
 * Un archivo del estático, por versión:
 * 1. Lee el manifiesto (`useManifest`, TTL 300 s) y resuelve la versión del archivo.
 * 2. Pide el archivo con la versión en la key, `staleTime: Infinity` (es inmutable) y `gcTime`
 *    de 24 h (el persister MMKV lo guarda con el resto de la caché).
 * 3. Además guarda la "última versión conocida" en MMKV (`lastKnown.ts`): con esa copia la
 *    pantalla arranca sin esperar al manifiesto, y sin red sigue andando aunque la caché
 *    persistida haya vencido. Si el manifiesto trae otra versión, se muestra la vieja como
 *    `placeholderData` mientras baja la nueva.
 */
export function useStaticArchivo<K extends ArchivoEstatico>(
  archivo: K,
): StaticQuery<ArchivoData<K>> {
  const client = useApiClient();
  const store = useLastKnownStore();
  const manifest = useManifest();
  const remoteVersion = versionFromManifest(manifest.data, archivo);
  // Se lee una vez por montaje (el store memoiza); las escrituras llegan por `setLastKnown`.
  const [lastKnown, setLastKnown] = useState(() => store.read(archivo));
  const version = remoteVersion ?? lastKnown?.version;
  const sameVersion = lastKnown !== undefined && lastKnown.version === version;

  const query = useQuery({
    queryKey: staticKeys.archivo(archivo, version ?? ''),
    queryFn: async ({ signal }) => {
      // `enabled` garantiza que hay versión del manifiesto.
      const v = remoteVersion ?? '';
      try {
        const result = await client.staticFile(v, archivo, { signal });
        const entry = { version: v, savedAt: Date.now(), data: result.data };
        store.write(archivo, entry);
        setLastKnown(entry);
        return result.data;
      } catch (error) {
        throw toApiError(error, '/v1/static/:version/:archivo');
      }
    },
    // Solo se baja con la versión confirmada por el manifiesto; la última conocida no se pide.
    enabled: remoteVersion !== undefined,
    staleTime: Infinity,
    gcTime: GC_TIME_MS,
    ...(sameVersion
      ? { initialData: lastKnown.data, initialDataUpdatedAt: lastKnown.savedAt }
      : {}),
    ...(lastKnown !== undefined && !sameVersion ? { placeholderData: lastKnown.data } : {}),
  });

  // `unknown` adentro: TS no sigue `ArchivoData<K>` a través de las opciones genéricas de
  // `useQuery`; la validación con Zod la hace el cliente (`staticFile`) o `lastKnown.read`.
  const data = query.data as ArchivoData<K> | undefined;
  const hasData = data !== undefined;
  const isLoadingError = !hasData && (query.isLoadingError || manifest.isLoadingError);
  return {
    data,
    version: query.isPlaceholderData ? lastKnown?.version : version,
    isPending: !hasData && !isLoadingError,
    isLoadingError,
    isFetching: query.isFetching || manifest.isFetching,
    fromLastKnown: query.isPlaceholderData || (hasData && remoteVersion === undefined),
    error: query.error ?? manifest.error,
    refetch: () => (manifest.data === undefined ? manifest.refetch() : query.refetch()),
  };
}
