import { z } from 'zod';
import { envelope, IsoDateTime } from './common.js';

export const VehiculoV1 = z.object({
  id: z.string(),
  /** `route_id` upstream (es un ramal, no una línea). */
  lineaId: z.string(),
  /** `route_short_name` visible, por ejemplo `"10"`. */
  linea: z.string(),
  ramal: z.string().optional(),
  empresa: z.string(),
  destino: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  /** Velocidad en m/s. */
  velocidad: z.number().nonnegative().optional(),
  /** Rumbo en grados; `null` si el feed no lo trae (hoy no lo trae). */
  rumbo: z.number().min(0).max(360).nullable().optional(),
  paradaId: z.string().optional(),
  /** Hora del reporte del vehículo. */
  ts: IsoDateTime,
  edadSegundos: z.number().nonnegative(),
});
export type VehiculoV1 = z.infer<typeof VehiculoV1>;

export const PosicionesLineaV1 = z.object({
  lineaId: z.string(),
  vehiculos: z.array(VehiculoV1),
});
export type PosicionesLineaV1 = z.infer<typeof PosicionesLineaV1>;

export const LineaColectivoV1 = z.object({
  lineaId: z.string(),
  linea: z.string(),
  ramal: z.string().optional(),
  empresa: z.string(),
  cabeceras: z.array(z.string()).optional(),
});
export type LineaColectivoV1 = z.infer<typeof LineaColectivoV1>;

export const LineasColectivoV1 = z.object({ lineas: z.array(LineaColectivoV1) });
export type LineasColectivoV1 = z.infer<typeof LineasColectivoV1>;

export const ArriboColectivoV1 = z.object({
  paradaId: z.string(),
  lineaId: z.string(),
  linea: z.string(),
  destino: z.string().optional(),
  enSegundos: z.number().int(),
  horaEstimada: IsoDateTime,
  retrasoSegundos: z.number().int().optional(),
  incertidumbre: z.number().int().nonnegative().optional(),
  viajeId: z.string(),
});
export type ArriboColectivoV1 = z.infer<typeof ArriboColectivoV1>;

export const ArribosParadaV1 = z.object({
  paradaId: z.string(),
  arribos: z.array(ArriboColectivoV1),
});
export type ArribosParadaV1 = z.infer<typeof ArribosParadaV1>;

export const PosicionesLineaResponseV1 = envelope(PosicionesLineaV1);
export const LineasColectivoResponseV1 = envelope(LineasColectivoV1);
export const ArribosParadaResponseV1 = envelope(ArribosParadaV1);
