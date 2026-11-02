// Esquemas de las salidas. Los JSON del paquete usan los contratos v1 de @transportate/contracts
// (única fuente de verdad, packages/contracts/src/static.ts); acá solo quedan los GeoJSON, que no
// tienen contrato v1, y el tipo interno de equivalencias (más rico que el publicado).
import {
  ARCHIVOS_ESTATICOS_V1,
  ManifestV1,
  type EquivalenciaParadaV1,
  type EstacionSubteV1,
  type LineaColectivoEstaticaV1,
  type LineaSubteV1,
  type ParadaV1,
} from '@transportate/contracts';
import { z } from 'zod';

export type Parada = ParadaV1;
export type LineaColectivo = LineaColectivoEstaticaV1;
export type SubteLinea = LineaSubteV1;
export type SubteEstacion = EstacionSubteV1;
export type EquivalenciaPublicada = EquivalenciaParadaV1;
export type Manifest = ManifestV1;

/**
 * Equivalencia interna (antes de publicar): incluye las filas sin parada BA, la coordenada
 * estimada y las notas, que van a last-build.json y a los tests pero no al archivo servido.
 */
export interface Equivalencia {
  stopId: string;
  paradaId: string | null;
  origen: EquivalenciaParadaV1['origen'];
  confianza: number;
  lat: number;
  lon: number;
  /** Distancia (m) entre la coordenada 2021 y la parada BA asignada; `null` si no aplica. */
  distanciaM: number | null;
  /** Observaciones independientes: vehículos informantes + pasadas capturadas. */
  observaciones: number;
  notas: string;
}

// ---------------------------------------------------------------- GeoJSON (sin contrato v1)

const lat = z.number().min(-90).max(90);
const lon = z.number().min(-180).max(180);
const hex = z.string().regex(/^#[0-9A-F]{6}$/);
const position = z.tuple([lon, lat]);
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

/** Interfaz mínima común a los esquemas de Zod de este paquete y de @transportate/contracts. */
export interface Validator {
  safeParse(data: unknown):
    | { success: true }
    | {
        success: false;
        error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] };
      };
}

export const SCHEMAS: Record<string, Validator> = {
  ...ARCHIVOS_ESTATICOS_V1,
  'subte-red.geojson': SubteRedSchema,
  'recorridos-colectivos.geojson': RecorridosSchema,
  'manifest.json': ManifestV1,
};

/** Valida y devuelve los errores legibles (vacío si es válido). */
export function validate(schema: Validator, data: unknown): string[] {
  const r = schema.safeParse(data);
  if (r.success) return [];
  return r.error.issues
    .slice(0, 10)
    .map((i) => `✖ ${i.message} → en ${i.path.map(String).join('.') || '(raíz)'}`);
}
