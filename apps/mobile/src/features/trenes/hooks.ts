// Hooks de la feature: estático derivado (red de trenes) y selectores que lo combinan con el
// tiempo real de `shared/api`. El polling lo hacen los hooks de `shared/api` (solo en primer plano).
import { useCallback, useMemo } from 'react';

import {
  useAlertasTrenes,
  useArribosEstacionTren,
  useEstadoTrenes,
  type ApiError,
} from '@/shared/api';
import { useStaticArchivo } from '@/shared/static';

import {
  alertasDeEstacion,
  alertasDeLinea,
  alertasDeRamal,
  buildRedTrenes,
  estadoDeLineaTren,
  estadoDeRamal,
  isLineaTrenId,
  lineasDeEstacion,
  type EstadoLineaTren,
  type LineaTren,
  type RedTrenes,
} from './model';

export interface RedTrenesQuery {
  red: RedTrenes | undefined;
  isPending: boolean;
  isLoadingError: boolean;
  error: ApiError | null;
  refetch: () => Promise<unknown>;
}

/** Las 6 líneas, sus ramales y las estaciones del estático (`trenes-lineas.json` + `trenes-estaciones.json`). */
export function useRedTrenes(): RedTrenesQuery {
  const lineas = useStaticArchivo('trenes-lineas.json');
  const estaciones = useStaticArchivo('trenes-estaciones.json');
  const red = useMemo(
    () =>
      lineas.data !== undefined && estaciones.data !== undefined
        ? buildRedTrenes(lineas.data, estaciones.data)
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

export interface LineaTrenConEstado extends EstadoLineaTren {
  linea: LineaTren;
}

/** Las líneas en orden fijo con su estado (sin dato: `sin_datos`). */
export function useLineasTrenConEstado(): {
  lineas: LineaTrenConEstado[] | undefined;
  estado: ReturnType<typeof useEstadoTrenes>;
  red: RedTrenesQuery;
} {
  const red = useRedTrenes();
  const estado = useEstadoTrenes();
  const lineas = useMemo(
    () =>
      red.red?.lineas.map((linea) => ({
        linea,
        ...estadoDeLineaTren(linea.id, estado.data),
      })),
    [red.red, estado.data],
  );
  return { lineas, estado, red };
}

/** Una línea con su estado y las alertas que no apuntan a un ramal. */
export function useLineaTrenDetalle(id: string | undefined) {
  const red = useRedTrenes();
  const estado = useEstadoTrenes();
  const alertas = useAlertasTrenes();
  const lineaId = id !== undefined && isLineaTrenId(id) ? id : undefined;
  const linea = lineaId === undefined ? undefined : red.red?.lineaPorId.get(lineaId);
  const estadoLinea = useMemo(
    () => (lineaId === undefined ? undefined : estadoDeLineaTren(lineaId, estado.data)),
    [lineaId, estado.data],
  );
  const alertasLinea = useMemo(
    () => (lineaId === undefined ? [] : alertasDeLinea(lineaId, alertas.data?.alertas)),
    [lineaId, alertas.data],
  );
  return { red, lineaId, linea, estado, estadoLinea, alertas, alertasLinea };
}

/** Un ramal con su línea, su estado y sus alertas (propias y las de la línea sin ramal). */
export function useRamalDetalle(ramalId: string | undefined) {
  const red = useRedTrenes();
  const estado = useEstadoTrenes();
  const alertas = useAlertasTrenes();
  const ramal = ramalId === undefined ? undefined : red.red?.ramalPorId.get(ramalId);
  const linea = ramal === undefined ? undefined : red.red?.lineaPorId.get(ramal.linea);
  const estadoRamal = useMemo(
    () => (ramal === undefined ? undefined : estadoDeRamal(ramal.id, estado.data)),
    [ramal, estado.data],
  );
  const alertasRamal = useMemo(
    () => (ramal === undefined ? [] : alertasDeRamal(ramal, alertas.data?.alertas)),
    [ramal, alertas.data],
  );
  return { red, ramal, linea, estado, estadoRamal, alertas, alertasRamal };
}

/** Una estación con sus líneas, sus arribos y las alertas de la estación y sus ramales. */
export function useEstacionTrenDetalle(id: string | undefined) {
  const red = useRedTrenes();
  const estado = useEstadoTrenes();
  const alertas = useAlertasTrenes();
  const arribos = useArribosEstacionTren(id);
  const estacion = id === undefined ? undefined : red.red?.estacionPorId.get(id);
  const lineas = useMemo(
    () =>
      estacion === undefined || red.red === undefined ? [] : lineasDeEstacion(estacion, red.red),
    [estacion, red.red],
  );
  const alertasEstacion = useMemo(
    () => (estacion === undefined ? [] : alertasDeEstacion(estacion, alertas.data?.alertas)),
    [estacion, alertas.data],
  );
  return { red, estacion, lineas, estado, alertas, alertasEstacion, arribos };
}
