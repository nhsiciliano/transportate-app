// Archivos grandes del estático, con la misma forma que `useStaticArchivo` más el progreso de
// descarga (README.md, "Archivos grandes"). El estado lo guarda `LargeFileManager`.
import { useEffect, useSyncExternalStore } from 'react';

import { useManifest, type ApiError, type ArchivoEstatico } from '../api';
import type { ArchivoData } from './lastKnown';
import { useLargeFileManager } from './StaticStoreProvider';
import { versionFromManifest } from './useStaticArchivo';

export interface StaticArchivoGrandeQuery<T> {
  data: T | undefined;
  version: string | undefined;
  /** Sin dato todavía (leyendo la copia, esperando el manifiesto o bajando). */
  isPending: boolean;
  /** Sin dato y falló la descarga o el manifiesto. */
  isLoadingError: boolean;
  /** Bajando (primera vez o versión nueva en segundo plano). */
  isDownloading: boolean;
  /** 0 a 1 mientras baja; `null` sin descarga. */
  progress: number | null;
  /** Tamaño según el manifiesto (para "0,4 de 1,7 MB"). */
  bytes: number | undefined;
  /** El dato no es (todavía) el de la versión del manifiesto. */
  fromLastKnown: boolean;
  error: ApiError | null;
  refetch: () => Promise<unknown>;
}

/**
 * Archivo grande del paquete estático (`paradas.json`, `lineas-colectivos.json`…). Con
 * `enabled: false` solo lee lo que ya esté en memoria: no carga de MMKV ni baja nada.
 */
export function useStaticArchivoGrande<K extends ArchivoEstatico>(
  archivo: K,
  { enabled = true }: { enabled?: boolean } = {},
): StaticArchivoGrandeQuery<ArchivoData<K>> {
  const manager = useLargeFileManager();
  const state = useSyncExternalStore(
    (cb) => manager.subscribe(archivo, cb),
    () => manager.getState(archivo),
  );
  const manifest = useManifest({ enabled });
  const version = versionFromManifest(manifest.data, archivo);
  const bytes = manifest.data?.archivos[archivo]?.bytes;

  useEffect(() => {
    if (enabled) manager.loadStored(archivo);
  }, [enabled, manager, archivo]);

  useEffect(() => {
    if (!enabled || !state.loaded || version === undefined) return;
    void manager.ensure(archivo, version, bytes);
  }, [enabled, manager, archivo, version, bytes, state.loaded]);

  const hasData = state.data !== undefined;
  const failed =
    state.error !== null || (manifest.isLoadingError && state.loaded && version === undefined);
  const isLoadingError = enabled && !hasData && !state.downloading && failed;
  return {
    data: state.data,
    version: state.version,
    isPending: !hasData && !isLoadingError,
    isLoadingError,
    isDownloading: state.downloading,
    progress: state.progress,
    bytes,
    fromLastKnown: hasData && version !== undefined && state.version !== version,
    error: state.error ?? manifest.error,
    refetch: () =>
      version === undefined ? manifest.refetch() : manager.retry(archivo, version, bytes),
  };
}

/** Avance combinado de varias descargas (para Ajustes); `null` si no baja ninguna. */
export function useStaticDownloadProgress(archivos: readonly ArchivoEstatico[]): number | null {
  const manager = useLargeFileManager();
  const snapshot = useSyncExternalStore(
    (cb) => {
      const offs = archivos.map((a) => manager.subscribe(a, cb));
      return () => {
        for (const off of offs) off();
      };
    },
    () =>
      archivos
        .map((a) => {
          const s = manager.getState(a);
          return s.downloading ? String(s.progress ?? 0) : '-';
        })
        .join('|'),
  );
  const parts = snapshot.split('|').filter((p) => p !== '-');
  if (parts.length === 0) return null;
  return parts.reduce((sum, p) => sum + Number(p), 0) / parts.length;
}
