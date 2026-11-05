import { z } from 'zod';
import { HexColor, IsoDateTime } from './common.js';
import { LineaColectivoV1 } from './colectivos.js';
import { LineaSubteId } from './subtes.js';
import { LineaTrenId } from './trenes.js';

/*
 * Paquete estático versionado en R2 (lo genera tools/gtfs y lo consume la app directamente).
 * Estos esquemas son la única fuente de verdad: tools/gtfs valida su salida contra ellos
 * (tools/gtfs/test/contracts.test.ts), así que cualquier cambio acá rompe ese build primero.
 */

const Lat = z.number().min(-90).max(90);
const Lon = z.number().min(-180).max(180);

export const FuenteEstaticaV1 = z.object({
  nombre: z.string(),
  url: z.string(),
  fecha: z.string(),
  licencia: z.string(),
  nota: z.string().optional(),
});
export type FuenteEstaticaV1 = z.infer<typeof FuenteEstaticaV1>;

/** Manifiesto del paquete estático versionado en R2. */
export const ManifestV1 = z.object({
  /** Hash del contenido (identifica la versión). */
  version: z.string().min(1),
  generatedAt: IsoDateTime,
  archivos: z.record(
    z.string(),
    z.object({
      /** Ruta relativa a `/v1/static/`: `<version>/<archivo>`. */
      url: z.string().min(1),
      bytes: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
  /** Archivos opcionales que no se generaron, con el motivo. */
  omitidos: z.record(z.string(), z.string()).optional(),
  /** Fuentes de datos (URL, fecha y licencia) para la atribución. */
  fuentes: z.record(z.string(), FuenteEstaticaV1).optional(),
});
export type ManifestV1 = z.infer<typeof ManifestV1>;

// ---------------------------------------------------------------- colectivos

/** Línea que para en una parada, según el dataset BA (columnas L1…L6 / l1_sen…l6_sen). */
export const ParadaLineaV1 = z.object({
  linea: z.string().min(1),
  /** Parte numérica de la línea (`null` si no tiene, por ejemplo `EBUS`). */
  numero: z.number().int().nullable(),
  sentido: z.enum(['ida', 'vuelta']).nullable(),
});
export type ParadaLineaV1 = z.infer<typeof ParadaLineaV1>;

/** Parada de colectivo (dataset BA "Colectivos: paradas"). */
export const ParadaV1 = z.object({
  id: z.string().min(1),
  calle: z.string(),
  altura: z.number().int().nonnegative().nullable(),
  nombre: z.string(),
  lat: Lat,
  lon: Lon,
  comuna: z.number().int().min(1).max(15).nullable(),
  barrio: z.string().nullable(),
  lineas: z.array(ParadaLineaV1),
});
export type ParadaV1 = z.infer<typeof ParadaV1>;

/**
 * Equivalencia `stop_id` del tiempo real → parada BA (ver docs/01b-gtfs-alternativos.md).
 * - `ajustada-ba`: coordenada del GTFS 2021 ajustada a la parada BA más cercana (≤ 40 m) de la
 *   misma línea;
 * - `aprendida`: parada elegida por los votos de las capturas de posiciones;
 * - `gtfs2021`: reservado (coordenada 2021 sin parada BA); el archivo publicado no la incluye.
 */
export const EquivalenciaParadaV1 = z.object({
  stopId: z.string().min(1),
  paradaId: z.string().min(1),
  origen: z.enum(['gtfs2021', 'aprendida', 'ajustada-ba']),
  confianza: z.number().min(0).max(1),
  /** Observaciones independientes que la respaldan (vehículos informantes + pasadas capturadas). */
  observaciones: z.number().int().nonnegative(),
});
export type EquivalenciaParadaV1 = z.infer<typeof EquivalenciaParadaV1>;

/** Entrada de `lineas-colectivos.json`: `LineaColectivoV1` más datos para unir por número. */
export const LineaColectivoEstaticaV1 = LineaColectivoV1.extend({
  /** Parte numérica de `linea` (`null` si no tiene). */
  numero: z.number().int().nullable(),
  agencyId: z.string().nullable(),
  /** Algún vehículo de la captura estaba dentro de CABA. */
  enCaba: z.boolean(),
});
export type LineaColectivoEstaticaV1 = z.infer<typeof LineaColectivoEstaticaV1>;

// ---------------------------------------------------------------- subte

export const EstacionSubteV1 = z.object({
  /** `stop_id` de la estación (`location_type=1`) en el GTFS de subtes. */
  id: z.string().regex(/^\d{4}$/),
  /** Nombre con tildes restituidas. */
  nombre: z.string().min(1),
  /** Nombre tal cual el GTFS (sin tildes). */
  nombreGtfs: z.string().min(1),
  lat: Lat,
  lon: Lon,
  /** Las estaciones del Premetro pertenecen a los dos ramales (`PM-C` y `PM-S`). */
  lineas: z.array(LineaSubteId).min(1),
  /** `stop_id` de los andenes (`location_type=0`), los que usan forecast y stop_times. */
  andenes: z.array(z.string()),
  /** `wheelchair_boarding`: `true` = 1, `false` = 2, `null` = sin dato. */
  accesible: z.boolean().nullable(),
});
export type EstacionSubteV1 = z.infer<typeof EstacionSubteV1>;

export const SentidoSubteV1 = z.object({
  directionId: z.number().int(),
  cabecera: z.string(),
  estacionIds: z.array(z.string()).min(2),
});
export type SentidoSubteV1 = z.infer<typeof SentidoSubteV1>;

export const LineaSubteV1 = z.object({
  id: LineaSubteId,
  /** `route_id` del GTFS (`LineaA`, `PM-Civico`…). */
  routeId: z.string().min(1),
  nombre: z.string(),
  tipo: z.enum(['subte', 'premetro']),
  color: HexColor,
  colorTexto: HexColor,
  /** De una cabecera a la otra (orden del sentido 0, con las estaciones de un solo sentido). */
  estacionIds: z.array(z.string()).min(2),
  sentidos: z.array(SentidoSubteV1).min(1),
});
export type LineaSubteV1 = z.infer<typeof LineaSubteV1>;

// ---------------------------------------------------------------- archivos del paquete

export const ParadasArchivoV1 = z.object({
  version: z.literal(1),
  fuente: z.string(),
  paradas: z.array(ParadaV1),
});
export type ParadasArchivoV1 = z.infer<typeof ParadasArchivoV1>;

export const LineasColectivoArchivoV1 = z.object({
  version: z.literal(1),
  fuente: z.string(),
  nota: z.string(),
  capturadoEn: z.string(),
  lineas: z.array(LineaColectivoEstaticaV1),
});
export type LineasColectivoArchivoV1 = z.infer<typeof LineasColectivoArchivoV1>;

export const EquivalenciasArchivoV1 = z.object({
  version: z.literal(1),
  metodo: z.string(),
  equivalencias: z.array(EquivalenciaParadaV1),
});
export type EquivalenciasArchivoV1 = z.infer<typeof EquivalenciasArchivoV1>;

export const SubteLineasArchivoV1 = z.object({
  version: z.literal(1),
  fuente: z.string(),
  /** `feed_end_date` del GTFS de subtes (AAAAMMDD), para avisar cuando vence. */
  feedEndDate: z.string().nullable(),
  lineas: z.array(LineaSubteV1),
});
export type SubteLineasArchivoV1 = z.infer<typeof SubteLineasArchivoV1>;

export const SubteEstacionesArchivoV1 = z.object({
  version: z.literal(1),
  fuente: z.string(),
  estaciones: z.array(EstacionSubteV1),
});
export type SubteEstacionesArchivoV1 = z.infer<typeof SubteEstacionesArchivoV1>;

/**
 * Índice compacto para el proxy (`indice-colectivos.json`): lo único que necesita para
 * posiciones y arribos, sin parsear `paradas.json` (1,7 MB) ni `equivalencias-paradas.json`
 * en el Worker. Medido en workerd: el índice completo costaba ~27 ms de CPU en frío (el plan
 * Free da 10 ms); ver apps/proxy/src/adapters/README.md.
 */
export const IndiceColectivosArchivoV1 = z.object({
  version: z.literal(1),
  /** Número de línea → `lineaId` con vehículos en CABA (ramales de esa línea). */
  lineasPorNumero: z.record(z.string(), z.array(z.string())),
  /** `paradaId` → [stop_id del tiempo real que la informan, números de línea que paran]. */
  paradas: z.record(z.string(), z.tuple([z.array(z.string()), z.array(z.number().int())])),
});
export type IndiceColectivosArchivoV1 = z.infer<typeof IndiceColectivosArchivoV1>;

// ---------------------------------------------------------------- trenes (Fase 6)

/**
 * Ramal de una línea de tren (`trenes-lineas.json`). Los ids de ramal y de estación son los
 * numéricos de SOFSE como string: son lo único que cruza con `/v1/trenes/estaciones/:id/arribos`.
 */
export const RamalTrenV1 = z.object({
  id: z.string().min(1),
  linea: LineaTrenId,
  /** Como lo nombra SOFSE («Once-Moreno»). */
  nombre: z.string().min(1),
  siglas: z.string().optional(),
  cabeceraInicial: z.object({ id: z.string().min(1), nombre: z.string().min(1) }),
  cabeceraFinal: z.object({ id: z.string().min(1), nombre: z.string().min(1) }),
  electrico: z.boolean(),
  /** De `cabeceraInicial` a `cabeceraFinal`, en el orden del upstream. */
  estacionIds: z.array(z.string()).min(2),
});
export type RamalTrenV1 = z.infer<typeof RamalTrenV1>;

export const LineaTrenV1 = z.object({
  id: LineaTrenId,
  /** `id` de `gerencias` en la fuente actual (SOFSE), por si hay que cruzar con ella. */
  idGerencia: z.string().min(1),
  nombre: z.string().min(1),
  /** Colores de `docs/02c-colores-trenes.md` (la API no los trae). */
  color: HexColor,
  colorTexto: HexColor,
  /** Solo ramales `publico`, en el `orden_ramal` del upstream. */
  ramales: z.array(RamalTrenV1).min(1),
});
export type LineaTrenV1 = z.infer<typeof LineaTrenV1>;

export const EstacionTrenV1 = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  lat: Lat,
  lon: Lon,
  lineas: z.array(LineaTrenId).min(1),
  ramalIds: z.array(z.string()).min(1),
});
export type EstacionTrenV1 = z.infer<typeof EstacionTrenV1>;

export const TrenesLineasArchivoV1 = z.object({
  version: z.literal(1),
  fuente: z.string(),
  /** Fecha de captura de los volcados de `tools/sofse-probe` (ISO), para saber cuánto envejeció. */
  capturadoEn: z.string(),
  lineas: z.array(LineaTrenV1),
});
export type TrenesLineasArchivoV1 = z.infer<typeof TrenesLineasArchivoV1>;

export const TrenesEstacionesArchivoV1 = z.object({
  version: z.literal(1),
  fuente: z.string(),
  capturadoEn: z.string(),
  estaciones: z.array(EstacionTrenV1),
});
export type TrenesEstacionesArchivoV1 = z.infer<typeof TrenesEstacionesArchivoV1>;

// ---------------------------------------------------------------- GeoJSON del paquete

/** Posición GeoJSON `[lon, lat]` (RFC 7946 §3.1.1; una altura opcional se tolera). */
const PosicionGeoJsonV1 = z.array(z.number()).min(2);

const GeometriaGeoJsonV1 = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: PosicionGeoJsonV1 }),
  z.object({ type: z.literal('MultiPoint'), coordinates: z.array(PosicionGeoJsonV1) }),
  z.object({ type: z.literal('LineString'), coordinates: z.array(PosicionGeoJsonV1).min(2) }),
  z.object({
    type: z.literal('MultiLineString'),
    coordinates: z.array(z.array(PosicionGeoJsonV1).min(2)),
  }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(PosicionGeoJsonV1)) }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(z.array(PosicionGeoJsonV1))),
  }),
]);

/**
 * `FeatureCollection` GeoJSON mínima (RFC 7946): valida la forma que necesita el mapa
 * (tipo, geometría y coordenadas), no el contenido de `properties`. Para los `.geojson` del
 * paquete que no tienen un esquema propio (`recorridos-colectivos.geojson`).
 */
export const GeoJsonFeatureCollectionV1 = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      id: z.union([z.string(), z.number()]).optional(),
      geometry: GeometriaGeoJsonV1,
      properties: z.record(z.string(), z.unknown()).nullable(),
    }),
  ),
});
export type GeoJsonFeatureCollectionV1 = z.infer<typeof GeoJsonFeatureCollectionV1>;

/** Trazo de una línea de subte en `subte-red.geojson` (lo genera tools/gtfs desde `shapes.txt`). */
export const SubteRedFeatureV1 = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(PosicionGeoJsonV1).min(2),
  }),
  properties: z.object({
    linea: LineaSubteId,
    routeId: z.string().min(1),
    /** `route_color` del GTFS (docs/02b-colores-subte.md §3). */
    color: HexColor,
  }),
});
export type SubteRedFeatureV1 = z.infer<typeof SubteRedFeatureV1>;

/** `subte-red.geojson`: un `LineString` por línea (los dos ramales del Premetro por separado). */
export const SubteRedGeoJsonV1 = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(SubteRedFeatureV1),
});
export type SubteRedGeoJsonV1 = z.infer<typeof SubteRedGeoJsonV1>;

/** Esquema de cada `.geojson` del paquete (lo usa `staticGeoJson` del cliente de la app). */
export const GEOJSON_ESTATICOS_V1 = {
  'subte-red.geojson': SubteRedGeoJsonV1,
  'recorridos-colectivos.geojson': GeoJsonFeatureCollectionV1,
} as const;

/** Esquema de cada archivo JSON del paquete (los GeoJSON están en `GEOJSON_ESTATICOS_V1`). */
export const ARCHIVOS_ESTATICOS_V1 = {
  'paradas.json': ParadasArchivoV1,
  'lineas-colectivos.json': LineasColectivoArchivoV1,
  'equivalencias-paradas.json': EquivalenciasArchivoV1,
  'subte-lineas.json': SubteLineasArchivoV1,
  'subte-estaciones.json': SubteEstacionesArchivoV1,
  'indice-colectivos.json': IndiceColectivosArchivoV1,
  'trenes-lineas.json': TrenesLineasArchivoV1,
  'trenes-estaciones.json': TrenesEstacionesArchivoV1,
} as const;
