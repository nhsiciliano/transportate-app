// Fixtures y harness de Subtes: estático mínimo de las 7 líneas (8 rutas del GTFS) validado con
// los esquemas de `@transportate/contracts`, respuestas del proxy y un `renderRouter` con los
// providers reales sobre stores en memoria. Nada de red: `fetch` es un mock que responde por URL.
import {
  AlertasResponseV1,
  ArribosEstacionResponseV1,
  EstadoLineasResponseV1,
  ManifestV1,
  PosicionesLineaResponseV1,
  SubteEstacionesArchivoV1,
  SubteLineasArchivoV1,
  type AlertaV1,
  type ArriboSubteV1,
  type EstadoLineaV1,
  type LineaSubteId,
  type MetaV1,
} from '@transportate/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import SubtesLayout from '@/app/(tabs)/subtes/_layout';
import LineaRoute from '@/app/(tabs)/subtes/[linea]';
import EstacionRoute from '@/app/(tabs)/subtes/estacion/[id]';
import SubtesRoute from '@/app/(tabs)/subtes/index';
import MapaRoute from '@/app/(tabs)/subtes/mapa';
import { FavoritosProvider, MmkvFavoritosRepository } from '@/features/favoritos';
import { ApiClientProvider, createApiClient, HttpError } from '@/shared/api';
import { createMemoryRefreshIntervalStore, RefreshIntervalProvider } from '@/shared/query';
import {
  createRecientesStore,
  RecientesProvider,
  type RecientesStore,
} from '@/features/colectivos';
import {
  createLastKnownStore,
  LargeFileManager,
  STATIC_FILE_ROUTE,
  StaticStoreProvider,
  type LastKnownStore,
  type StaticDownloader,
} from '@/shared/static';
import { MemoryKeyValueStore } from '@/shared/storage/kv';

import { ARCHIVOS_TEXTO } from '../colectivos/data';
import { estacionesTren, lineasTren } from '../trenes/data';
import { createMemoryPreferenceStore, ThemeProvider } from '@/shared/theme';

// ---------------------------------------------------------------- estático

const est = (id: string, nombre: string, lineas: LineaSubteId[], nombreGtfs = nombre) => ({
  id,
  nombre,
  nombreGtfs,
  lat: -34.6,
  lon: -58.4,
  lineas,
  andenes: [`${id}N`, `${id}S`],
  accesible: true,
});

export const estaciones = SubteEstacionesArchivoV1.parse({
  version: 1,
  fuente: 'prueba',
  estaciones: [
    est('1001', 'Plaza de Mayo', ['A']),
    est('1002', 'Perú', ['A'], 'Peru'),
    est('1059', 'San Pedrito', ['A']),
    est('2001', 'Leandro N. Alem', ['B']),
    est('2002', 'Medrano', ['B']),
    est('2003', 'Juan Manuel de Rosas', ['B']),
    est('3001', 'Retiro', ['C']),
    est('3002', 'Constitución', ['C'], 'Constitucion'),
    est('4001', 'Catedral', ['D']),
    est('4002', 'Congreso de Tucumán', ['D'], 'Congreso de Tucuman'),
    est('5001', 'Retiro', ['E']),
    est('5002', 'Plaza de los Virreyes', ['E']),
    est('6001', 'Facultad de Derecho', ['H']),
    est('6002', 'Corrientes', ['H']),
    est('6003', 'Hospitales', ['H']),
    est('7001', 'Intendente Saguier', ['PM-C', 'PM-S']),
    est('7002', 'Pola', ['PM-C', 'PM-S']),
    est('7003', 'Centro Cívico', ['PM-C'], 'Centro Civico'),
    est('7005', 'Larrazábal', ['PM-S'], 'Larrazabal'),
    est('7004', 'General Savio', ['PM-S']),
  ],
});

const nombrePorId = new Map(estaciones.estaciones.map((e) => [e.id, e.nombre]));

function linea(
  id: LineaSubteId,
  color: string,
  colorTexto: string,
  ids: string[],
  cabeceras: [string, string] = [
    nombrePorId.get(ids[ids.length - 1] ?? '') ?? '',
    nombrePorId.get(ids[0] ?? '') ?? '',
  ],
) {
  return {
    id,
    routeId: id.startsWith('PM') ? (id === 'PM-C' ? 'PM-Civico' : 'PM-Savio') : `Linea${id}`,
    nombre: `${nombrePorId.get(ids[0] ?? '')} - ${nombrePorId.get(ids[ids.length - 1] ?? '')}`,
    tipo: id.startsWith('PM') ? 'premetro' : 'subte',
    color,
    colorTexto,
    estacionIds: ids,
    sentidos: [
      { directionId: 0, cabecera: cabeceras[0], estacionIds: ids },
      { directionId: 1, cabecera: cabeceras[1], estacionIds: [...ids].reverse() },
    ],
  };
}

export const lineas = SubteLineasArchivoV1.parse({
  version: 1,
  fuente: 'prueba',
  feedEndDate: '20261231',
  lineas: [
    linea('A', '#A5C8FF', '#000000', ['1001', '1002', '1059']),
    linea('B', '#FF0000', '#000000', ['2001', '2002', '2003']),
    linea('C', '#0000FF', '#FFFFFF', ['3001', '3002']),
    linea('D', '#00AC67', '#000000', ['4001', '4002']),
    linea('E', '#8300BB', '#FFFFFF', ['5001', '5002']),
    linea('H', '#FFF300', '#000000', ['6001', '6002', '6003']),
    linea('PM-C', '#FFBD33', '#000000', ['7001', '7002', '7003'], ['Centro Cívico', 'Saguier']),
    linea(
      'PM-S',
      '#FFBD33',
      '#000000',
      ['7001', '7002', '7005', '7004'],
      ['General Savio', 'Saguier'],
    ),
  ],
});

export const VERSION = 'v1abc';

export function manifest(version = VERSION) {
  return ManifestV1.parse({
    version,
    generatedAt: '2026-11-01T00:00:00.000Z',
    archivos: {
      'subte-lineas.json': {
        url: `${version}/subte-lineas.json`,
        bytes: 1,
        sha256: 'a'.repeat(64),
      },
      'subte-estaciones.json': {
        url: `${version}/subte-estaciones.json`,
        bytes: 1,
        sha256: 'b'.repeat(64),
      },
      // Estático de Trenes (lo leen Favoritos e Inicio para los favoritos de tren).
      'trenes-lineas.json': {
        url: `${version}/trenes-lineas.json`,
        bytes: 1,
        sha256: 'e'.repeat(64),
      },
      'trenes-estaciones.json': {
        url: `${version}/trenes-estaciones.json`,
        bytes: 1,
        sha256: 'f'.repeat(64),
      },
      // Archivos grandes de Colectivos (los sirve el descargador falso del harness).
      'paradas.json': {
        url: `${version}/paradas.json`,
        bytes: ARCHIVOS_TEXTO['paradas.json']?.length ?? 1,
        sha256: 'c'.repeat(64),
      },
      'lineas-colectivos.json': {
        url: `${version}/lineas-colectivos.json`,
        bytes: ARCHIVOS_TEXTO['lineas-colectivos.json']?.length ?? 1,
        sha256: 'd'.repeat(64),
      },
    },
  });
}

// ---------------------------------------------------------------- tiempo real

export function isoAgo(seconds: number, now = Date.now()): string {
  return new Date(now - seconds * 1000).toISOString();
}

export function meta(overrides: Partial<MetaV1> = {}): MetaV1 {
  return {
    generatedAt: isoAgo(2),
    sourceTimestamp: isoAgo(12),
    ttlSeconds: 20,
    stale: false,
    ageSeconds: 12,
    ...overrides,
  };
}

const COLORES: Record<LineaSubteId, [string, string]> = {
  A: ['#A5C8FF', '#000000'],
  B: ['#FF0000', '#000000'],
  C: ['#0000FF', '#FFFFFF'],
  D: ['#00AC67', '#000000'],
  E: ['#8300BB', '#FFFFFF'],
  H: ['#FFF300', '#000000'],
  'PM-C': ['#FFBD33', '#000000'],
  'PM-S': ['#FFBD33', '#000000'],
};

export function estado(overrides: Partial<Record<LineaSubteId, Partial<EstadoLineaV1>>> = {}) {
  const ids = Object.keys(COLORES) as LineaSubteId[];
  return EstadoLineasResponseV1.parse({
    meta: meta(),
    data: {
      lineas: ids.map((id) => ({
        linea: id,
        estado: 'normal',
        color: COLORES[id][0],
        colorTexto: COLORES[id][1],
        nombre: `Línea ${id}`,
        alertaIds: [],
        ...overrides[id],
      })),
    },
  });
}

export function alertas(lista: AlertaV1[] = []) {
  return AlertasResponseV1.parse({ meta: meta(), data: { alertas: lista } });
}

export function arribos(
  estacionId: string,
  lista: Omit<ArriboSubteV1, 'estacionId' | 'horaEstimada'>[],
  metaOverrides: Partial<MetaV1> = {},
) {
  const now = Date.now();
  return ArribosEstacionResponseV1.parse({
    meta: meta(metaOverrides),
    data: {
      estacionId,
      arribos: lista.map((a) => ({
        ...a,
        estacionId,
        horaEstimada: new Date(now + a.enSegundos * 1000).toISOString(),
      })),
    },
  });
}

// Posiciones de colectivo para los datos vivos de líneas de colectivo.
export function posiciones(lineaId: string, n: number) {
  return PosicionesLineaResponseV1.parse({
    meta: meta(),
    data: {
      lineaId,
      vehiculos: Array.from({ length: n }, (_, i) => ({
        id: `v${i}`,
        lineaId,
        linea: '152',
        empresa: 'Empresa de prueba',
        lat: -34.6,
        lon: -58.4,
        ts: meta().sourceTimestamp,
        edadSegundos: 12,
      })),
    },
  });
}

export function errorBody(code: 'upstream_unavailable' | 'not_found') {
  return { error: { code, message: 'mensaje del proxy' } };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ---------------------------------------------------------------- harness

/** Respuesta por ruta; `undefined` = pedido que nunca responde (carga infinita). */
export type Routes = Record<string, () => Response | undefined>;

export function defaultRoutes(): Routes {
  return {
    '/v1/static/manifest': () => jsonResponse(manifest()),
    [`/v1/static/${VERSION}/subte-lineas.json`]: () => jsonResponse(lineas),
    [`/v1/static/${VERSION}/subte-estaciones.json`]: () => jsonResponse(estaciones),
    [`/v1/static/${VERSION}/trenes-lineas.json`]: () => jsonResponse(lineasTren),
    [`/v1/static/${VERSION}/trenes-estaciones.json`]: () => jsonResponse(estacionesTren),
    '/v1/subtes/estado': () => jsonResponse(estado()),
    '/v1/subtes/alertas': () => jsonResponse(alertas()),
  };
}

export function createFetch(routes: Routes) {
  return jest.fn((input: string) => {
    const path = new URL(input).pathname;
    const responder = routes[path];
    if (responder === undefined) {
      return Promise.resolve(jsonResponse(errorBody('not_found'), 404));
    }
    const res = responder();
    return res === undefined ? new Promise<Response>(() => undefined) : Promise.resolve(res);
  });
}

export interface Harness {
  queryClient: QueryClient;
  kv: MemoryKeyValueStore;
  lastKnown: LastKnownStore;
  largeFiles: LargeFileManager;
  recientes: RecientesStore;
  fetchMock: ReturnType<typeof createFetch>;
  repository: MmkvFavoritosRepository;
}

/**
 * Descargador falso de archivos grandes: sirve `ARCHIVOS_TEXTO` en dos pasos de progreso.
 * `gate` permite frenar la descarga hasta que el test la suelte.
 */
export function createFakeDownloader(
  archivos: Record<string, string> = ARCHIVOS_TEXTO,
  { fail = false, gate }: { fail?: boolean; gate?: Promise<void> } = {},
) {
  const calls: string[] = [];
  const downloader: StaticDownloader = {
    async download(version, archivo, { onProgress } = {}) {
      calls.push(`${version}/${archivo}`);
      const text = archivos[archivo];
      if (fail || text === undefined) throw new HttpError(STATIC_FILE_ROUTE, 503, null, null);
      onProgress?.(Math.floor(text.length / 2), null);
      if (gate !== undefined) await gate;
      onProgress?.(text.length, null);
      return text;
    },
  };
  return { downloader, calls };
}

export function createHarness(
  routes: Routes,
  {
    kv = new MemoryKeyValueStore(),
    downloader = createFakeDownloader().downloader,
  }: { kv?: MemoryKeyValueStore; downloader?: StaticDownloader } = {},
): Harness & { Wrapper: (props: { children: ReactNode }) => ReactNode } {
  const fetchMock = createFetch(routes);
  const api = createApiClient({
    baseUrl: 'https://proxy.test',
    fetch: fetchMock as unknown as typeof fetch,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const lastKnown = createLastKnownStore(kv);
  const largeFiles = new LargeFileManager(kv, downloader);
  const recientes = createRecientesStore(kv);
  const repository = new MmkvFavoritosRepository(kv);
  const themeStore = createMemoryPreferenceStore('light');
  const intervalStore = createMemoryRefreshIntervalStore(20);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider store={themeStore}>
        <QueryClientProvider client={queryClient}>
          <ApiClientProvider client={api}>
            <RefreshIntervalProvider store={intervalStore}>
              <StaticStoreProvider store={lastKnown} largeFiles={largeFiles}>
                <RecientesProvider store={recientes}>
                  <FavoritosProvider repository={repository}>{children}</FavoritosProvider>
                </RecientesProvider>
              </StaticStoreProvider>
            </RefreshIntervalProvider>
          </ApiClientProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }
  return { queryClient, kv, lastKnown, largeFiles, recientes, fetchMock, repository, Wrapper };
}

/** Monta el stack real de Subtes en `initialUrl`. */
export async function renderSubtes(initialUrl: string, routes: Routes = defaultRoutes()) {
  const harness = createHarness(routes);
  await renderRouter(
    {
      'subtes/_layout': SubtesLayout,
      'subtes/index': SubtesRoute,
      'subtes/[linea]': LineaRoute,
      'subtes/estacion/[id]': EstacionRoute,
      'subtes/mapa': MapaRoute,
    },
    { initialUrl, wrapper: harness.Wrapper },
  );
  return harness;
}
