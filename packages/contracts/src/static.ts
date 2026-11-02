import { z } from 'zod';
import { HexColor, IsoDateTime } from './common.js';
import { LineaColectivoV1 } from './colectivos.js';
import { LineaSubteId } from './subtes.js';

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

/** Esquema de cada archivo JSON del paquete (los GeoJSON no tienen contrato v1). */
export const ARCHIVOS_ESTATICOS_V1 = {
  'paradas.json': ParadasArchivoV1,
  'lineas-colectivos.json': LineasColectivoArchivoV1,
  'equivalencias-paradas.json': EquivalenciasArchivoV1,
  'subte-lineas.json': SubteLineasArchivoV1,
  'subte-estaciones.json': SubteEstacionesArchivoV1,
} as const;
