// Esquemas Zod de las salidas de tools/gtfs. Son el contrato del JSON estático que sirve el proxy en
// /v1/static/*; cuando exista packages/contracts, el manifest y estos tipos deberían migrar ahí.
import { z } from 'zod';

const lat = z.number().min(-90).max(90);
const lon = z.number().min(-180).max(180);
/** 6 decimales como máximo (formato de coordenadas de todas las salidas). */
const coord6 = (s: z.ZodNumber) =>
  s.refine((x) => Math.abs(Math.round(x * 1e6) - x * 1e6) < 1e-6, 'más de 6 decimales');
const hex = z.string().regex(/^#[0-9A-F]{6}$/);
const isoDate = z.iso.datetime();

// ---------------------------------------------------------------- paradas.json

export const ParadaLineaSchema = z.strictObject({
  linea: z.string().min(1),
  numero: z.number().int().nullable(),
  sentido: z.enum(['ida', 'vuelta']).nullable(),
});

export const ParadaSchema = z.strictObject({
  id: z.string().regex(/^p[0-9a-f]{10}$/),
  calle: z.string().min(1),
  altura: z.number().int().nonnegative().nullable(),
  nombre: z.string().min(1),
  lat: coord6(lat),
  lon: coord6(lon),
  comuna: z.number().int().min(1).max(15).nullable(),
  barrio: z.string().nullable(),
  lineas: z.array(ParadaLineaSchema),
});
export type Parada = z.infer<typeof ParadaSchema>;

export const ParadasFileSchema = z.strictObject({
  version: z.literal(1),
  fuente: z.string(),
  paradas: z.array(ParadaSchema).min(1),
});

// ---------------------------------------------------------------- lineas-colectivos.json

export const LineaColectivoSchema = z.strictObject({
  routeId: z.string().min(1),
  linea: z.string().min(1),
  numero: z.number().int().nullable(),
  ramal: z.string().nullable(),
  empresa: z.string().nullable(),
  agencyId: z.string().nullable(),
  cabeceras: z.array(z.string()),
  /** Algún vehículo de la captura estaba dentro de CABA. */
  enCaba: z.boolean(),
});
export type LineaColectivo = z.infer<typeof LineaColectivoSchema>;

export const LineasColectivosFileSchema = z.strictObject({
  version: z.literal(1),
  fuente: z.string(),
  nota: z.string(),
  capturadoEn: z.string(),
  lineas: z.array(LineaColectivoSchema).min(1),
});

// ---------------------------------------------------------------- equivalencias-paradas.json

export const EquivalenciaSchema = z.strictObject({
  stopId: z.string().min(1),
  paradaId: z
    .string()
    .regex(/^p[0-9a-f]{10}$/)
    .nullable(),
  origen: z.enum(['gtfs2021', 'aprendida', 'ajustada-ba']),
  confianza: z.number().min(0).max(1),
  lat: coord6(lat),
  lon: coord6(lon),
  /** Distancia (m) entre la coordenada estimada del stop_id y la parada BA asignada. */
  distanciaM: z.number().int().nonnegative().nullable(),
  observaciones: z.string(),
});
export type Equivalencia = z.infer<typeof EquivalenciaSchema>;

export const EquivalenciasFileSchema = z.strictObject({
  version: z.literal(1),
  metodo: z.string(),
  equivalencias: z.array(EquivalenciaSchema).min(1),
});

// ---------------------------------------------------------------- subte

export const SubteSentidoSchema = z.strictObject({
  directionId: z.number().int(),
  cabecera: z.string(),
  estaciones: z.array(z.string()).min(2),
});

export const SubteLineaSchema = z.strictObject({
  id: z.string().min(1),
  routeId: z.string().min(1),
  nombre: z.string(),
  tipo: z.enum(['subte', 'premetro']),
  color: hex,
  colorTexto: hex,
  /** Orden de una cabecera a la otra (sentido 0 si existe). */
  estaciones: z.array(z.string()).min(2),
  sentidos: z.array(SubteSentidoSchema).min(1),
});
export type SubteLinea = z.infer<typeof SubteLineaSchema>;

export const SubteLineasFileSchema = z.strictObject({
  version: z.literal(1),
  fuente: z.string(),
  feedEndDate: z.string().nullable(),
  lineas: z.array(SubteLineaSchema).min(1),
});

export const SubteEstacionSchema = z.strictObject({
  id: z.string().regex(/^\d{4}$/),
  nombre: z.string().min(1),
  nombreGtfs: z.string().min(1),
  lat: coord6(lat),
  lon: coord6(lon),
  lineas: z.array(z.string()).min(1),
  andenes: z.array(z.string()),
  accesible: z.boolean().nullable(),
});
export type SubteEstacion = z.infer<typeof SubteEstacionSchema>;

export const SubteEstacionesFileSchema = z.strictObject({
  version: z.literal(1),
  fuente: z.string(),
  estaciones: z.array(SubteEstacionSchema).min(1),
});

// ---------------------------------------------------------------- GeoJSON

const position = z.tuple([coord6(lon), coord6(lat)]);
const lineString = z.strictObject({
  type: z.literal('LineString'),
  coordinates: z.array(position).min(2),
});
const multiLineString = z.strictObject({
  type: z.literal('MultiLineString'),
  coordinates: z.array(z.array(position).min(2)).min(1),
});

export const SubteRedSchema = z.strictObject({
  type: z.literal('FeatureCollection'),
  features: z
    .array(
      z.strictObject({
        type: z.literal('Feature'),
        properties: z.strictObject({ linea: z.string(), routeId: z.string(), color: hex }),
        geometry: lineString,
      }),
    )
    .min(1),
});

export const RecorridosSchema = z.strictObject({
  type: z.literal('FeatureCollection'),
  features: z
    .array(
      z.strictObject({
        type: z.literal('Feature'),
        properties: z.strictObject({
          numero: z.number().int(),
          lineas2021: z.array(z.string()),
          aproximado: z.literal(true),
        }),
        geometry: multiLineString,
      }),
    )
    .min(1),
});

// ---------------------------------------------------------------- manifest.json

export const FuenteSchema = z.strictObject({
  nombre: z.string(),
  url: z.string(),
  fecha: z.string(),
  licencia: z.string(),
  nota: z.string().optional(),
});

export const ManifestSchema = z.strictObject({
  version: z.string().regex(/^[0-9a-f]{12}$/),
  generatedAt: isoDate,
  archivos: z.record(
    z.string(),
    z.strictObject({
      bytes: z.number().int().positive(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
  omitidos: z.record(z.string(), z.string()),
  fuentes: z.record(z.string(), FuenteSchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const SCHEMAS = {
  'paradas.json': ParadasFileSchema,
  'lineas-colectivos.json': LineasColectivosFileSchema,
  'equivalencias-paradas.json': EquivalenciasFileSchema,
  'subte-lineas.json': SubteLineasFileSchema,
  'subte-estaciones.json': SubteEstacionesFileSchema,
  'subte-red.geojson': SubteRedSchema,
  'recorridos-colectivos.geojson': RecorridosSchema,
  'manifest.json': ManifestSchema,
} as const;
