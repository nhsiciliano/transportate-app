import { z } from 'zod';
import { envelope, HexColor, IsoDateTime } from './common.js';
import { EstadoServicioV1 } from './subtes.js';

/*
 * Contratos v1 de trenes metropolitanos (SOFSE / Trenes Argentinos, Fase 6). Los ids de línea son
 * slugs propios, independientes de la fuente; `ramalId` y `estacionId` son el id numérico de
 * SOFSE como string (es lo único que cruza con los arribos).
 */

/** Líneas metropolitanas de Trenes Argentinos que cubre la app. */
export const LineaTrenId = z.enum([
  'roca',
  'sarmiento',
  'mitre',
  'san-martin',
  'belgrano-sur',
  'tren-de-la-costa',
]);
export type LineaTrenId = z.infer<typeof LineaTrenId>;

/** Sentido de un servicio: `1` va hacia la cabecera final del ramal, `2` hacia la inicial. */
export const SentidoTrenV1 = z.enum(['1', '2']);
export type SentidoTrenV1 = z.infer<typeof SentidoTrenV1>;

export const EstadoRamalTrenV1 = z.object({
  ramalId: z.string(),
  nombre: z.string(),
  estado: EstadoServicioV1,
  alertaIds: z.array(z.string()),
});
export type EstadoRamalTrenV1 = z.infer<typeof EstadoRamalTrenV1>;

export const EstadoLineaTrenV1 = z.object({
  linea: LineaTrenId,
  nombre: z.string(),
  color: HexColor,
  colorTexto: HexColor,
  estado: EstadoServicioV1,
  resumen: z.string().optional(),
  alertaIds: z.array(z.string()),
  /** Ramales públicos; vacío si la fuente de ramales de esa línea no respondió. */
  ramales: z.array(EstadoRamalTrenV1),
});
export type EstadoLineaTrenV1 = z.infer<typeof EstadoLineaTrenV1>;

export const AlertaTrenV1 = z.object({
  id: z.string(),
  linea: LineaTrenId,
  ramalId: z.string().optional(),
  estacionId: z.string().optional(),
  sentido: SentidoTrenV1.optional(),
  /** Primera oración del texto de la alerta (o sus primeros ~120 caracteres). */
  titulo: z.string(),
  /** Texto completo con los espacios normalizados. */
  descripcion: z.string(),
  /** Causa GTFS como texto (`TECHNICAL_PROBLEM`, `OTHER_CAUSE`…). */
  causa: z.string().optional(),
  /** Efecto GTFS como texto (`SIGNIFICANT_DELAYS`, `OTHER_EFFECT`…). */
  efecto: z.string().optional(),
  desde: IsoDateTime.optional(),
  hasta: IsoDateTime.optional(),
});
export type AlertaTrenV1 = z.infer<typeof AlertaTrenV1>;

export const ArriboTrenV1 = z.object({
  estacionId: z.string(),
  linea: LineaTrenId,
  ramalId: z.string(),
  /** Nombre del ramal (`Once-Moreno`). */
  ramal: z.string(),
  /** Cabecera hacia la que va el servicio según `sentido`. */
  destino: z.string(),
  sentido: SentidoTrenV1,
  /** Segundos hasta el arribo (estimado si lo hay, si no el programado); negativo = recién pasó. */
  enSegundos: z.number().int(),
  horaProgramada: IsoDateTime,
  horaEstimada: IsoDateTime.optional(),
  anden: z.string().optional(),
  cancelado: z.boolean(),
  servicioId: z.string().optional(),
});
export type ArriboTrenV1 = z.infer<typeof ArriboTrenV1>;

export const EstadoLineasTrenV1 = z.object({ lineas: z.array(EstadoLineaTrenV1) });
export type EstadoLineasTrenV1 = z.infer<typeof EstadoLineasTrenV1>;

export const AlertasTrenV1 = z.object({ alertas: z.array(AlertaTrenV1) });
export type AlertasTrenV1 = z.infer<typeof AlertasTrenV1>;

export const ArribosEstacionTrenV1 = z.object({
  estacionId: z.string(),
  arribos: z.array(ArriboTrenV1),
});
export type ArribosEstacionTrenV1 = z.infer<typeof ArribosEstacionTrenV1>;

export const EstadoLineasTrenResponseV1 = envelope(EstadoLineasTrenV1);
export const AlertasTrenResponseV1 = envelope(AlertasTrenV1);
export const ArribosEstacionTrenResponseV1 = envelope(ArribosEstacionTrenV1);
