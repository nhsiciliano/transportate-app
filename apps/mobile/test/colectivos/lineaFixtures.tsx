// Fixtures del detalle de línea (tarea 4.6): posiciones validadas con `PosicionesLineaResponseV1`,
// un recorrido mínimo validado con `GeoJsonFeatureCollectionV1` y un harness con el router, los
// providers reales y áreas seguras. Reusa el estático y el descargador falso de Subtes/Colectivos.
import {
  GeoJsonFeatureCollectionV1,
  ManifestV1,
  PosicionesLineaResponseV1,
  type MetaV1,
} from '@transportate/contracts';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import ColectivosLayout from '@/app/(tabs)/colectivos/_layout';
import LineaRoute from '@/app/(tabs)/colectivos/[linea]';
import { MemoryKeyValueStore } from '@/shared/storage/kv';

import {
  createFakeDownloader,
  createHarness,
  defaultRoutes,
  isoAgo,
  jsonResponse,
  manifest,
  meta,
  VERSION,
  type Routes,
} from '../subtes/fixtures';
import { ARCHIVOS_TEXTO } from './data';

export const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Recorrido aproximado de la 60 (un `MultiLineString`, como lo genera tools/gtfs). */
export const recorridos = GeoJsonFeatureCollectionV1.parse({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-58.3816, -34.6037],
            [-58.4, -34.59],
            [-58.42, -34.57],
          ],
        ],
      },
      properties: { numero: 60, lineas2021: ['60A'], aproximado: true },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-58.5, -34.6],
            [-58.51, -34.61],
          ],
        ],
      },
      properties: { numero: 152, lineas2021: ['152A'], aproximado: true },
    },
  ],
});

const ARCHIVOS = {
  ...ARCHIVOS_TEXTO,
  'recorridos-colectivos.geojson': JSON.stringify(recorridos),
};

/** Manifiesto de Subtes/Colectivos + el recorrido. */
export function manifestConRecorridos() {
  const base = manifest();
  return ManifestV1.parse({
    ...base,
    archivos: {
      ...base.archivos,
      'recorridos-colectivos.geojson': {
        url: `${VERSION}/recorridos-colectivos.geojson`,
        bytes: ARCHIVOS['recorridos-colectivos.geojson'].length,
        sha256: 'e'.repeat(64),
      },
    },
  });
}

export interface VehiculoFixture {
  id: string;
  /** Segundos desde el reporte. */
  edad?: number;
  lat?: number;
  lon?: number;
  rumbo?: number | null;
}

export function posicionesDe(
  lineaId: string,
  vehiculos: readonly VehiculoFixture[],
  metaOverrides: Partial<MetaV1> = {},
) {
  return PosicionesLineaResponseV1.parse({
    meta: meta(metaOverrides),
    data: {
      lineaId,
      vehiculos: vehiculos.map((v, i) => ({
        id: v.id,
        lineaId,
        linea: lineaId === '602' ? '60 B' : '60 A',
        empresa: 'MOCBA',
        lat: v.lat ?? -34.6 + i * 0.001,
        lon: v.lon ?? -58.39 - i * 0.001,
        rumbo: v.rumbo ?? null,
        ts: isoAgo(v.edad ?? 20),
        edadSegundos: v.edad ?? 20,
      })),
    },
  });
}

export const RUTA_601 = '/v1/colectivos/lineas/601/posiciones';
export const RUTA_602 = '/v1/colectivos/lineas/602/posiciones';

export function lineaRoutes(extra: Routes = {}): Routes {
  return {
    ...defaultRoutes(),
    '/v1/static/manifest': () => jsonResponse(manifestConRecorridos()),
    [RUTA_601]: () =>
      jsonResponse(
        posicionesDe('601', [
          { id: '1404', edad: 25 },
          { id: '1410', edad: 50 },
        ]),
      ),
    [RUTA_602]: () => jsonResponse(posicionesDe('602', [{ id: '2001' }])),
    ...extra,
  };
}

export async function renderLinea(initialUrl = '/colectivos/601', routes: Routes = lineaRoutes()) {
  const harness = createHarness(routes, {
    kv: new MemoryKeyValueStore(),
    downloader: createFakeDownloader(ARCHIVOS).downloader,
  });
  const Inner = harness.Wrapper;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={METRICS}>
          <Inner>{children}</Inner>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }
  await renderRouter(
    { 'colectivos/_layout': ColectivosLayout, 'colectivos/[linea]': LineaRoute },
    { initialUrl, wrapper: Wrapper },
  );
  return harness;
}
