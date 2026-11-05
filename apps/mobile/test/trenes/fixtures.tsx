// Fixtures y harness de Trenes: el estático mínimo de `data.ts`, respuestas del proxy armadas a
// mano pero validadas con los `*ResponseV1` del contrato (los datos son los de las fixtures reales
// de `apps/proxy/test/fixtures/sofse/`), y `renderTrenes` con el stack real del tab sobre el
// harness de Subtes (mismos providers, stores en memoria, `fetch` mockeado: nada de red).
import {
  AlertasTrenResponseV1,
  ArribosEstacionTrenResponseV1,
  EstadoLineasTrenResponseV1,
  type AlertaTrenV1,
  type ArriboTrenV1,
  type EstadoLineaTrenV1,
  type LineaTrenId,
  type MetaV1,
} from '@transportate/contracts';
import { renderRouter } from 'expo-router/testing-library';

import TrenesLayout from '@/app/(tabs)/trenes/_layout';
import LineaTrenRoute from '@/app/(tabs)/trenes/[linea]';
import EstacionTrenRoute from '@/app/(tabs)/trenes/estacion/[id]';
import TrenesRoute from '@/app/(tabs)/trenes/index';
import RamalRoute from '@/app/(tabs)/trenes/ramal/[id]';

import { createHarness, defaultRoutes, jsonResponse, meta, type Routes } from '../subtes/fixtures';
import { lineasTren } from './data';

export { estacionesTren, lineasTren } from './data';

const LINEAS: readonly LineaTrenId[] = [
  'roca',
  'sarmiento',
  'mitre',
  'san-martin',
  'belgrano-sur',
  'tren-de-la-costa',
];

/** `/v1/trenes/estado` con las 6 líneas en `normal` y cada ramal del estático; `overrides` por línea. */
export function estadoTrenes(
  overrides: Partial<Record<LineaTrenId, Partial<EstadoLineaTrenV1>>> = {},
  metaOverrides: Partial<MetaV1> = {},
) {
  return EstadoLineasTrenResponseV1.parse({
    meta: meta({ ttlSeconds: 60, ...metaOverrides }),
    data: {
      lineas: LINEAS.map((id) => {
        const l = lineasTren.lineas.find((x) => x.id === id);
        return {
          linea: id,
          nombre: l?.nombre ?? id,
          color: l?.color ?? '#000000',
          colorTexto: l?.colorTexto ?? '#FFFFFF',
          estado: 'normal',
          alertaIds: [],
          ramales: (l?.ramales ?? []).map((r) => ({
            ramalId: r.id,
            nombre: r.nombre,
            estado: 'normal',
            alertaIds: [],
          })),
          ...overrides[id],
        };
      }),
    },
  });
}

export function alertasTrenes(lista: AlertaTrenV1[] = []) {
  return AlertasTrenResponseV1.parse({ meta: meta({ ttlSeconds: 60 }), data: { alertas: lista } });
}

/** Arribos con `horaProgramada` (y `horaEstimada` si se pasa una demora) relativos a ahora. */
export function arribosTren(
  estacionId: string,
  lista: (Omit<ArriboTrenV1, 'estacionId' | 'horaProgramada' | 'horaEstimada' | 'linea'> & {
    linea?: LineaTrenId;
    /** Segundos de demora: la programada queda `demora` antes de la estimada. */
    demora?: number;
  })[],
  metaOverrides: Partial<MetaV1> = {},
) {
  const now = Date.now();
  return ArribosEstacionTrenResponseV1.parse({
    meta: meta({ ttlSeconds: 30, ...metaOverrides }),
    data: {
      estacionId,
      arribos: lista.map(({ demora, linea, ...a }) => {
        const estimada = now + a.enSegundos * 1000;
        return {
          ...a,
          estacionId,
          linea: linea ?? 'sarmiento',
          horaProgramada: new Date(estimada - (demora ?? 0) * 1000).toISOString(),
          ...(demora === undefined ? {} : { horaEstimada: new Date(estimada).toISOString() }),
        };
      }),
    },
  });
}

/** Lo de Subtes (manifiesto con el estático de trenes) más estado y alertas de trenes. */
export function trenesRoutes(): Routes {
  return {
    ...defaultRoutes(),
    '/v1/trenes/estado': () => jsonResponse(estadoTrenes()),
    '/v1/trenes/alertas': () => jsonResponse(alertasTrenes()),
  };
}

/** Monta el stack real de Trenes en `initialUrl`. */
export async function renderTrenes(initialUrl: string, routes: Routes = trenesRoutes()) {
  const harness = createHarness(routes);
  await renderRouter(
    {
      'trenes/_layout': TrenesLayout,
      'trenes/index': TrenesRoute,
      'trenes/[linea]': LineaTrenRoute,
      'trenes/ramal/[id]': RamalRoute,
      'trenes/estacion/[id]': EstacionTrenRoute,
    },
    { initialUrl, wrapper: harness.Wrapper },
  );
  return harness;
}
