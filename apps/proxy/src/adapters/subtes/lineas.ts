import type { LineaSubteId } from '@transportate/contracts';

export interface LineaSubteInfo {
  id: LineaSubteId;
  /** `route_id` upstream (GTFS de subtes y feeds de tiempo real). */
  routeId: string;
  nombre: string;
  color: string;
  colorTexto: string;
}

/**
 * Líneas de subte y premetro. Colores: docs/02b-colores-subte.md §3 (tabla final, = `route_color`
 * / `route_text_color` del GTFS). Nombres: `route_long_name` del GTFS de subtes con las tildes
 * restituidas (tools/gtfs/out/subte-lineas.json).
 */
export const LINEAS_SUBTE: readonly LineaSubteInfo[] = [
  {
    id: 'A',
    routeId: 'LineaA',
    nombre: 'Plaza de Mayo - San Pedrito',
    color: '#A5C8FF',
    colorTexto: '#000000',
  },
  {
    id: 'B',
    routeId: 'LineaB',
    nombre: 'Leandro N. Alem - Juan Manuel de Rosas',
    color: '#FF0000',
    colorTexto: '#000000',
  },
  {
    id: 'C',
    routeId: 'LineaC',
    nombre: 'Retiro - Constitución',
    color: '#0000FF',
    colorTexto: '#FFFFFF',
  },
  {
    id: 'D',
    routeId: 'LineaD',
    nombre: 'Catedral - Congreso de Tucumán',
    color: '#00AC67',
    colorTexto: '#000000',
  },
  {
    id: 'E',
    routeId: 'LineaE',
    nombre: 'Retiro - Plaza de los Virreyes',
    color: '#8300BB',
    colorTexto: '#FFFFFF',
  },
  {
    id: 'H',
    routeId: 'LineaH',
    nombre: 'Facultad de Derecho - Hospitales',
    color: '#FFF300',
    colorTexto: '#000000',
  },
  {
    id: 'PM-C',
    routeId: 'PM-Civico',
    nombre: 'Saguier - Centro Cívico',
    color: '#FFBD33',
    colorTexto: '#000000',
  },
  {
    id: 'PM-S',
    routeId: 'PM-Savio',
    nombre: 'Saguier - Savio',
    color: '#FFBD33',
    colorTexto: '#000000',
  },
];

const BY_ROUTE = new Map(LINEAS_SUBTE.map((l) => [l.routeId.toLowerCase(), l.id]));

/**
 * `route_id` upstream → líneas del contrato. Acepta las variantes vistas o razonables
 * (`LineaA`, `PM-Civico`) y "Premetro"/"PM" a secas, que afecta a los dos ramales.
 */
export function lineasDeRoute(routeId: string | null | undefined): LineaSubteId[] {
  const r = (routeId ?? '').trim().toLowerCase();
  if (!r) return [];
  const exact = BY_ROUTE.get(r);
  if (exact) return [exact];
  if (r === 'premetro' || r === 'pm' || r === 'lineap') return ['PM-C', 'PM-S'];
  const m = /^linea\s*([a-h])$/.exec(r);
  const id = m?.[1]?.toUpperCase();
  return LINEAS_SUBTE.filter((l) => l.id === id).map((l) => l.id);
}
