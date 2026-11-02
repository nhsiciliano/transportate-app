// Rutas, fuentes y parámetros del preprocesado. Todo lo que cambia entre corridas vive acá.
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG_DIR = resolve(HERE, '..');
export const REPO_DIR = resolve(PKG_DIR, '..', '..');
export const OUT_DIR = join(PKG_DIR, 'out');

const CACHE = process.env.TRANSPORTATE_CACHE ?? join(homedir(), '.cache', 'transportate');
export const CAPTURAS_DIR = process.env.CAPTURAS_DIR ?? join(CACHE, 'capturas');
const FIXTURES = join(REPO_DIR, 'apps', 'proxy', 'test', 'fixtures');

export const INPUTS = {
  baParadas: join(CACHE, 'gtfs', 'ba-paradas', 'paradas-de-colectivo.csv'),
  colectivosGtfs: join(CACHE, 'gtfs', 'colectivos_feed-gtfs.zip'),
  subtesGtfs: join(CACHE, 'gtfs', 'subtes_feed-gtfs.zip'),
  vehiclePositions: join(FIXTURES, 'colectivos', 'vehiclePositions.pb'),
  tripUpdates: join(FIXTURES, 'colectivos', 'tripUpdates.pb'),
  vehiclePositionsSimple: join(FIXTURES, 'colectivos', 'vehiclePositionsSimple.json'),
  /** Nombres de estación con tildes (el GTFS de subte los trae sin tildes). */
  subtesForecast: join(FIXTURES, 'subtes', 'forecastGTFS.json'),
} as const;

/** Fuentes declaradas en el manifest (URL y fecha de los datos, no de la descarga). */
export const FUENTES = {
  baParadas: {
    nombre: 'BA Data — Colectivos: paradas (CSV)',
    url: 'https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/colectivos-paradas/paradas-de-colectivo.csv',
    fecha: '2026-09-21',
    licencia: 'CC-BY-2.5-AR',
  },
  colectivosGtfs: {
    nombre: 'API Transporte GCBA /colectivos/feed-gtfs (GTFS 2021)',
    url: 'https://apitransporte.buenosaires.gob.ar/colectivos/feed-gtfs',
    fecha: '2021-02-26',
    licencia: 'CC-BY-2.5-AR',
  },
  subtesGtfs: {
    nombre: 'API Transporte GCBA /subtes/feed-gtfs',
    url: 'https://apitransporte.buenosaires.gob.ar/subtes/feed-gtfs',
    fecha: '2026-11-01',
    licencia: 'CC-BY-2.5-AR',
  },
  tiempoReal: {
    nombre:
      'API Transporte GCBA /colectivos/{vehiclePositions,vehiclePositionsSimple,tripUpdates} (fixtures)',
    url: 'https://apitransporte.buenosaires.gob.ar/colectivos/vehiclePositions',
    fecha: '2026-11-01',
    licencia: 'CC-BY-2.5-AR',
  },
  coloresSubte: {
    nombre: 'docs/02b-colores-subte.md §3 (tabla final)',
    url: 'docs/02b-colores-subte.md',
    fecha: '2026-11-01',
    licencia: 'CC-BY-2.5-AR',
  },
} as const;

export const PARAMS = {
  /** Radio para considerar que un stop_id del tiempo real es una parada BA. */
  matchRadiusM: 40,
  /** Un stop_id cuya coordenada 2021 queda más lejos que esto de los vehículos que lo informan se descarta. */
  maxReporterDistanceM: 1_000,
  /** Tolerancia de Douglas-Peucker para recorridos de colectivo y red de subte. */
  simplifyColectivosM: 10,
  simplifySubteM: 5,
  /** Tope de tamaño de recorridos-colectivos.geojson (si lo supera, se omite). */
  recorridosMaxBytes: 5 * 1024 * 1024,
  /** Aprendizaje desde capturas: votos mínimos (pasadas) para aceptar o reemplazar una equivalencia. */
  minVotos: 3,
} as const;

/** Colores oficiales de docs/02b-colores-subte.md §3 (fuente de verdad acordada). */
export const COLORES_SUBTE: Record<string, { color: string; texto: string }> = {
  LineaA: { color: '#A5C8FF', texto: '#000000' },
  LineaB: { color: '#FF0000', texto: '#000000' },
  LineaC: { color: '#0000FF', texto: '#FFFFFF' },
  LineaD: { color: '#00AC67', texto: '#000000' },
  LineaE: { color: '#8300BB', texto: '#FFFFFF' },
  LineaH: { color: '#FFF300', texto: '#000000' },
  'PM-Civico': { color: '#FFBD33', texto: '#000000' },
  'PM-Savio': { color: '#FFBD33', texto: '#000000' },
};

export const OUTPUT_FILES = [
  'paradas.json',
  'lineas-colectivos.json',
  'equivalencias-paradas.json',
  'indice-colectivos.json',
  'subte-lineas.json',
  'subte-estaciones.json',
  'subte-red.geojson',
  'recorridos-colectivos.geojson',
] as const;
export type OutputFile = (typeof OUTPUT_FILES)[number];
