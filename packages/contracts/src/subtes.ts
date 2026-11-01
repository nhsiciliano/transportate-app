import { z } from 'zod';
import { envelope, HexColor, IsoDateTime } from './common.js';

/** Líneas de subte y premetro (el premetro tiene dos rutas en el GTFS). */
export const LineaSubteId = z.enum(['A', 'B', 'C', 'D', 'E', 'H', 'PM-C', 'PM-S']);
export type LineaSubteId = z.infer<typeof LineaSubteId>;

export const EstadoServicioV1 = z.enum(['normal', 'demorada', 'interrumpida', 'sin_datos']);
export type EstadoServicioV1 = z.infer<typeof EstadoServicioV1>;

export const EstadoLineaV1 = z.object({
  linea: LineaSubteId,
  estado: EstadoServicioV1,
  color: HexColor,
  colorTexto: HexColor,
  nombre: z.string(),
  resumen: z.string().optional(),
  alertaIds: z.array(z.string()),
});
export type EstadoLineaV1 = z.infer<typeof EstadoLineaV1>;

export const AlertaV1 = z.object({
  id: z.string(),
  lineas: z.array(LineaSubteId),
  titulo: z.string(),
  descripcion: z.string(),
  /** Causa GTFS-RT como texto (`CONSTRUCTION`, `OTHER_CAUSE`…). */
  causa: z.string().optional(),
  /** Efecto GTFS-RT como texto (`REDUCED_SERVICE`, `OTHER_EFFECT`…). */
  efecto: z.string().optional(),
  desde: IsoDateTime.optional(),
  hasta: IsoDateTime.optional(),
  estacionIds: z.array(z.string()).optional(),
});
export type AlertaV1 = z.infer<typeof AlertaV1>;

export const ArriboSubteV1 = z.object({
  linea: LineaSubteId,
  estacionId: z.string(),
  estacion: z.string(),
  destino: z.string(),
  enSegundos: z.number().int(),
  horaEstimada: IsoDateTime,
  sentido: z.string().optional(),
});
export type ArriboSubteV1 = z.infer<typeof ArriboSubteV1>;

export const EstadoLineasV1 = z.object({ lineas: z.array(EstadoLineaV1) });
export type EstadoLineasV1 = z.infer<typeof EstadoLineasV1>;

export const AlertasV1 = z.object({ alertas: z.array(AlertaV1) });
export type AlertasV1 = z.infer<typeof AlertasV1>;

export const ArribosEstacionV1 = z.object({
  estacionId: z.string(),
  arribos: z.array(ArriboSubteV1),
});
export type ArribosEstacionV1 = z.infer<typeof ArribosEstacionV1>;

export const EstadoLineasResponseV1 = envelope(EstadoLineasV1);
export const AlertasResponseV1 = envelope(AlertasV1);
export const ArribosEstacionResponseV1 = envelope(ArribosEstacionV1);
