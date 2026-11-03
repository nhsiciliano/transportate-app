// Hooks de la feature: estático derivado (red de subte) y selectores que lo combinan con el
// tiempo real de `shared/api`.
import { useCallback, useMemo, useState } from 'react';

import { useAlertasSubtes, useEstadoSubtes, type ApiError } from '@/shared/api';
import { useStaticArchivo } from '@/shared/static';

import {
  alertasDeLinea,
  buildRed,
  estadoDeLinea,
  type EstacionSubte,
  type EstadoLinea,
  type LineaKey,
  type LineaSubte,
  type RedSubte,
} from './model';

export interface RedSubteQuery {
  red: RedSubte | undefined;
  isPending: boolean;
  isLoadingError: boolean;
  error: ApiError | null;
  refetch: () => Promise<unknown>;
}

/** Las 7 líneas y las 108 estaciones del estático (`subte-lineas.json` + `subte-estaciones.json`). */
export function useRedSubte(): RedSubteQuery {
  const lineas = useStaticArchivo('subte-lineas.json');
  const estaciones = useStaticArchivo('subte-estaciones.json');
  const red = useMemo(
    () =>
      lineas.data !== undefined && estaciones.data !== undefined
        ? buildRed(lineas.data, estaciones.data)
        : undefined,
    [lineas.data, estaciones.data],
  );
  const isLoadingError = red === undefined && (lineas.isLoadingError || estaciones.isLoadingError);
  const refetchLineas = lineas.refetch;
  const refetchEstaciones = estaciones.refetch;
  const refetch = useCallback(
    () => Promise.all([refetchLineas(), refetchEstaciones()]),
    [refetchLineas, refetchEstaciones],
  );
  return {
    red,
    isPending: red === undefined && !isLoadingError,
    isLoadingError,
    error: lineas.error ?? estaciones.error,
    refetch,
  };
}

/** Las 7 líneas en orden fijo (A, B, C, D, E, H, Premetro). */
export function useLineasSubte(): readonly LineaSubte[] | undefined {
  return useRedSubte().red?.lineas;
}

/** Las 108 estaciones con su línea de la app. */
export function useEstacionesSubte(): readonly EstacionSubte[] | undefined {
  return useRedSubte().red?.estaciones;
}

export interface LineaConEstado extends EstadoLinea {
  linea: LineaSubte;
}

/** Cada línea con su estado (el más severo de sus ramales). Sin dato: `sin_datos`. */
export function useLineasConEstado(): {
  lineas: LineaConEstado[] | undefined;
  estado: ReturnType<typeof useEstadoSubtes>;
  red: RedSubteQuery;
} {
  const red = useRedSubte();
  const estado = useEstadoSubtes();
  const lineas = useMemo(
    () =>
      red.red?.lineas.map((linea) => ({
        linea,
        ...estadoDeLinea(linea, estado.data?.lineas),
      })),
    [red.red, estado.data],
  );
  return { lineas, estado, red };
}

/** Una línea con su estado y sus alertas. */
export function useLineaDetalle(key: LineaKey | undefined) {
  const red = useRedSubte();
  const estado = useEstadoSubtes();
  const alertas = useAlertasSubtes();
  const linea = key === undefined ? undefined : red.red?.lineaPorKey.get(key);
  const estadoLinea = useMemo(
    () => (linea === undefined ? undefined : estadoDeLinea(linea, estado.data?.lineas)),
    [linea, estado.data],
  );
  const alertasLinea = useMemo(
    () => (linea === undefined ? [] : alertasDeLinea(linea, alertas.data?.alertas)),
    [linea, alertas.data],
  );
  return { red, linea, estado, estadoLinea, alertas, alertasLinea };
}

/**
 * Pull to refresh: el indicador nativo se muestra solo mientras dura el refresco que pidió la
 * persona (no con el polling automático, que no tiene que mover la pantalla).
 */
export function usePullToRefresh(refetchers: readonly (() => Promise<unknown>)[]) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    setRefreshing(true);
    void Promise.allSettled(refetchers.map((r) => r())).finally(() => {
      setRefreshing(false);
    });
  };
  return { refreshing, onRefresh };
}
