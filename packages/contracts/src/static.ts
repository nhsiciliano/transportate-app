import { z } from 'zod';
import { HexColor, IsoDateTime } from './common.js';
import { LineaSubteId } from './subtes.js';

/** Manifiesto del paquete estático versionado en R2. */
export const ManifestV1 = z.object({
  /** Hash del contenido (identifica la versión). */
  version: z.string().min(1),
  generatedAt: IsoDateTime,
  archivos: z.record(
    z.string(),
    z.object({
      url: z.string().min(1),
      bytes: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
});
export type ManifestV1 = z.infer<typeof ManifestV1>;

/** Parada de colectivo (dataset BA "Colectivos: paradas"). */
export const ParadaV1 = z.object({
  id: z.string(),
  calle: z.string(),
  altura: z.string().optional(),
  nombre: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  comuna: z.string().optional(),
  barrio: z.string().optional(),
  lineas: z.array(z.object({ linea: z.string(), sentido: z.string().optional() })),
});
export type ParadaV1 = z.infer<typeof ParadaV1>;

export const EstacionSubteV1 = z.object({
  id: z.string(),
  nombre: z.string(),
  linea: LineaSubteId,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  orden: z.number().int().nonnegative(),
});
export type EstacionSubteV1 = z.infer<typeof EstacionSubteV1>;

export const LineaSubteV1 = z.object({
  id: LineaSubteId,
  nombre: z.string(),
  color: HexColor,
  colorTexto: HexColor,
  estacionIds: z.array(z.string()),
});
export type LineaSubteV1 = z.infer<typeof LineaSubteV1>;

/** Equivalencia `stop_id` del tiempo real → parada BA (ver docs/01b-gtfs-alternativos.md). */
export const EquivalenciaParadaV1 = z.object({
  stopId: z.string(),
  paradaId: z.string(),
  origen: z.enum(['gtfs2021', 'aprendida', 'ajustada-ba']),
  confianza: z.number().min(0).max(1),
  observaciones: z.number().int().nonnegative(),
});
export type EquivalenciaParadaV1 = z.infer<typeof EquivalenciaParadaV1>;
