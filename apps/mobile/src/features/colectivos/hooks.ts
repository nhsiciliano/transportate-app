// Índice de colectivos para las pantallas: archivos grandes del estático (`paradas.json`,
// `lineas-colectivos.json`) + líneas vigentes del proxy si están (F4-colectivos-1).
import { useMemo } from 'react';

import { useLineasColectivo, type ApiError } from '@/shared/api';
import { useStaticArchivoGrande } from '@/shared/static';

import { buildIndice, type IndiceColectivos } from './model';

/** Archivos grandes de Colectivos (también los muestra Ajustes, `IndiceRow`). */
export const ARCHIVOS_COLECTIVOS = ['paradas.json', 'lineas-colectivos.json'] as const;

export interface IndiceColectivosQuery {
  indice: IndiceColectivos | undefined;
  isPending: boolean;
  isLoadingError: boolean;
  isDownloading: boolean;
  /** 0 a 1 (promedio de los dos archivos ponderado por tamaño); `null` sin descarga. */
  progress: number | null;
  error: ApiError | null;
  refetch: () => Promise<unknown>;
}

export function useIndiceColectivos({
  enabled = true,
}: { enabled?: boolean } = {}): IndiceColectivosQuery {
  const paradas = useStaticArchivoGrande('paradas.json', { enabled });
  const lineas = useStaticArchivoGrande('lineas-colectivos.json', { enabled });
  // `route_id` vigentes: el archivo es una semilla (docs/06-proxy.md §6).
  const vivas = useLineasColectivo({ enabled });

  const fuenteLineas = vivas.data?.lineas ?? lineas.data?.lineas;
  const indice = useMemo(
    () =>
      paradas.data === undefined || fuenteLineas === undefined
        ? undefined
        : buildIndice(fuenteLineas, paradas.data.paradas),
    [paradas.data, fuenteLineas],
  );

  const downloading = [paradas, lineas].filter((q) => q.isDownloading);
  let progress: number | null = null;
  if (downloading.length > 0) {
    const total = downloading.reduce((s, q) => s + (q.bytes ?? 1), 0);
    progress = downloading.reduce((s, q) => s + (q.progress ?? 0) * (q.bytes ?? 1), 0) / total;
  }
  const isLoadingError =
    indice === undefined &&
    (paradas.isLoadingError || (lineas.isLoadingError && vivas.data === undefined));
  const error = paradas.error ?? lineas.error;
  return {
    indice,
    isPending: indice === undefined && !isLoadingError,
    isLoadingError,
    isDownloading: downloading.length > 0,
    progress,
    error,
    refetch: () => Promise.all([paradas.refetch(), lineas.refetch()]),
  };
}
