// Reglas del estado de una línea de trenes a partir de las alertas de SOFSE (documentadas en
// README.md). Se reutilizan a propósito los textos, la severidad y `estadoDe` de subtes
// (../subtes/reglas.ts): el mismo criterio para toda la app.
import { effectName } from '../../lib/gtfs-rt';
import {
  estadoDe,
  ORDEN_SEVERIDAD,
  TEXTO_DEMORADA,
  TEXTO_INTERRUMPIDA,
  type Severidad,
} from '../subtes/reglas';
import { parseFechaSofse } from './sofse';

export { estadoDe, ORDEN_SEVERIDAD, type Severidad };

/** Efectos GTFS que cuentan como demora (además del texto). */
const EFECTOS_DEMORA = new Set([
  'SIGNIFICANT_DELAYS',
  'REDUCED_SERVICE',
  'DETOUR',
  'MODIFIED_SERVICE',
  'STOP_MOVED',
]);

/** `efecto_gtfs` como nombre (`SIGNIFICANT_DELAYS`) o número GTFS-RT (`8`) → nombre. */
export function nombreEfecto(efecto: string | number | null | undefined): string | undefined {
  if (efecto === null || efecto === undefined) return undefined;
  if (typeof efecto === 'number') return effectName(efecto);
  const v = efecto.trim();
  if (/^\d+$/.test(v)) return effectName(Number(v));
  return v ? v.toUpperCase() : undefined;
}

export interface AlertaParaReglas {
  efecto_gtfs?: string | number | null | undefined;
  contenido?: string | null | undefined;
  habilitado?: number | boolean | null | undefined;
  vigencia_desde?: string | null | undefined;
  vigencia_hasta?: string | null | undefined;
}

export function severidadAlerta(a: AlertaParaReglas): Severidad {
  const efecto = nombreEfecto(a.efecto_gtfs);
  const texto = a.contenido ?? '';
  if (efecto === 'NO_SERVICE' || TEXTO_INTERRUMPIDA.test(texto)) return 'interrumpida';
  if ((efecto !== undefined && EFECTOS_DEMORA.has(efecto)) || TEXTO_DEMORADA.test(texto)) {
    return 'demorada';
  }
  return 'informativa';
}

/**
 * Cuenta solo si está habilitada (`1`) y `vigencia_desde ≤ ahora ≤ vigencia_hasta` (`hasta` null =
 * sin fin). Una `vigencia_desde` ilegible o ausente no la deja afuera.
 */
export function alertaVigente(a: AlertaParaReglas, nowMs: number): boolean {
  if (a.habilitado !== 1 && a.habilitado !== true) return false;
  const desde = parseFechaSofse(a.vigencia_desde);
  const hasta = parseFechaSofse(a.vigencia_hasta);
  return (desde === null || desde <= nowMs) && (hasta === null || nowMs <= hasta);
}

const MENSAJE_INTERRUMPIDA = /interrump|suspend|sin servicio|cancelad/i;
const MENSAJE_DEMORADA = /demor|limitad|reducid/i;

/** `estado.mensaje` de la gerencia. «Alertas por ramal» (el genérico de hoy) es informativo. */
export function severidadEstadoSofse(mensaje: string | null | undefined): Severidad {
  const m = mensaje ?? '';
  if (MENSAJE_INTERRUMPIDA.test(m)) return 'interrumpida';
  if (MENSAJE_DEMORADA.test(m)) return 'demorada';
  return 'informativa';
}

/** Abreviaturas frecuentes en los textos de SOFSE: un punto después de ellas no cierra oración. */
const ABREVIATURAS = new Set([
  'av',
  'avda',
  'bmé',
  'bme',
  'cap',
  'cnel',
  'dr',
  'dra',
  'est',
  'fco',
  'gral',
  'hs',
  'hr',
  'ing',
  'nro',
  'pdte',
  'pres',
  'prof',
  'pte',
  'pza',
  'sgto',
  'sr',
  'sra',
  'sta',
  'sto',
  'tte',
]);

export const TITULO_MAX = 120;

/** Espacios normalizados (los textos de SOFSE traen espacios de más al final). */
export const normalizarTexto = (s: string | null | undefined): string =>
  (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Título de una alerta: su primera oración, o los primeros ~120 caracteres cortados en un
 * espacio. Un punto cierra oración si lo sigue un espacio y una mayúscula, y la palabra anterior
 * no es una abreviatura (`Pza.`, `Fco.`, `hs.`) ni una inicial (`M.C.G.`).
 */
export function tituloDe(contenido: string): string {
  const texto = normalizarTexto(contenido);
  const fin = /[.!?](?= [¿¡"«(]?[A-ZÁÉÍÓÚÑ])/g;
  let corte = -1;
  for (let m = fin.exec(texto); m; m = fin.exec(texto)) {
    const palabra = /([\p{L}]+)$/u.exec(texto.slice(0, m.index))?.[1] ?? '';
    if (palabra.length <= 1 || ABREVIATURAS.has(palabra.toLowerCase())) continue;
    corte = m.index + 1;
    break;
  }
  const oracion = corte > 0 ? texto.slice(0, corte) : texto;
  if (oracion.length <= TITULO_MAX) return oracion;
  const espacio = oracion.lastIndexOf(' ', TITULO_MAX - 1);
  return `${oracion.slice(0, espacio > 0 ? espacio : TITULO_MAX - 1).replace(/[\s,;:.-]+$/, '')}…`;
}
