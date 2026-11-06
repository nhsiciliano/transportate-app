// Líneas metropolitanas de trenes que cubre la app, con su id de gerencia en SOFSE. El orden de
// la tabla es el orden fijo de `/v1/trenes/estado`. La API no trae colores: los de acá salen de
// docs/02c-colores-trenes.md (plano de la red aportado por el usuario el 2026-11-06).
import type { LineaTrenId } from '@transportate/contracts';

export interface LineaTren {
  id: LineaTrenId;
  /** `id` de la gerencia en SOFSE (`/infraestructura/gerencias`). */
  idGerencia: number;
  nombre: string;
  color: string;
  colorTexto: string;
}

export const LINEAS_TREN: readonly LineaTren[] = [
  { id: 'roca', idGerencia: 11, nombre: 'Roca', color: '#F07D2B', colorTexto: '#000000' },
  { id: 'sarmiento', idGerencia: 1, nombre: 'Sarmiento', color: '#B8237A', colorTexto: '#FFFFFF' },
  { id: 'mitre', idGerencia: 5, nombre: 'Mitre', color: '#42B874', colorTexto: '#000000' },
  {
    id: 'san-martin',
    idGerencia: 31,
    nombre: 'San Martín',
    color: '#6438C4',
    colorTexto: '#FFFFFF',
  },
  {
    id: 'belgrano-sur',
    idGerencia: 21,
    nombre: 'Belgrano Sur',
    color: '#5C4858',
    colorTexto: '#FFFFFF',
  },
  {
    id: 'tren-de-la-costa',
    idGerencia: 41,
    nombre: 'Tren de la Costa',
    color: '#A020B8',
    colorTexto: '#FFFFFF',
  },
];

const POR_GERENCIA = new Map<string, LineaTrenId>(
  LINEAS_TREN.map((l) => [String(l.idGerencia), l.id]),
);

/** Id de gerencia de SOFSE → línea de la app (`undefined` para Regionales y cualquier otra). */
export function lineaDeGerencia(id: number | string | null | undefined): LineaTrenId | undefined {
  return id === null || id === undefined ? undefined : POR_GERENCIA.get(String(id));
}
