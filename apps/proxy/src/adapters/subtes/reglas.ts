// Reglas para derivar el estado de una línea desde las alertas (documentadas en README.md).
import type { EstadoServicioV1 } from '@transportate/contracts';
import { transit_realtime } from '../../lib/gtfs-rt';

const { Effect } = transit_realtime.Alert;

export const TEXTO_INTERRUMPIDA = /sin servicio|no (presta|funciona)|interrumpid|suspendid/i;
export const TEXTO_DEMORADA =
  /demor|limitad|lentitud|con demoras|servicio reducido|no se detiene|cerrad/i;

const EFECTOS_DEMORA = new Set<number>([
  Effect.SIGNIFICANT_DELAYS,
  Effect.REDUCED_SERVICE,
  Effect.DETOUR,
  Effect.MODIFIED_SERVICE,
  Effect.STOP_MOVED,
]);

/** Severidad de una alerta: `informativa` no cambia el estado (la línea sigue `normal`). */
export type Severidad = 'interrumpida' | 'demorada' | 'informativa';

export const ORDEN_SEVERIDAD: Record<Severidad, number> = {
  interrumpida: 2,
  demorada: 1,
  informativa: 0,
};

export function severidad(effect: number | null | undefined, texto: string): Severidad {
  if (effect === Effect.NO_SERVICE || TEXTO_INTERRUMPIDA.test(texto)) return 'interrumpida';
  if (
    (effect !== null && effect !== undefined && EFECTOS_DEMORA.has(effect)) ||
    TEXTO_DEMORADA.test(texto)
  ) {
    return 'demorada';
  }
  return 'informativa';
}

export function estadoDe(s: Severidad | null): EstadoServicioV1 {
  return s === 'interrumpida' ? 'interrumpida' : s === 'demorada' ? 'demorada' : 'normal';
}

/** Una alerta está activa si no tiene períodos o si `now` cae en alguno (bordes abiertos = sin límite). */
export function alertaActiva(
  periodos:
    | readonly { start?: number | null | undefined; end?: number | null | undefined }[]
    | null
    | undefined,
  nowMs: number,
): boolean {
  if (!periodos || periodos.length === 0) return true;
  const s = nowMs / 1000;
  return periodos.some(
    (p) =>
      (p.start ?? 0) <= s && (p.end === null || p.end === undefined || p.end === 0 || s <= p.end),
  );
}
