// Líneas metropolitanas de trenes que cubre la app, con su id de gerencia en SOFSE. El orden de
// la tabla es el orden fijo de `/v1/trenes/estado`. La API no trae colores: los de acá salen de
// docs/02c-colores-trenes.md y son provisorios.
import type { LineaTrenId } from '@transportate/contracts';

export interface LineaTren {
  id: LineaTrenId;
  /** `id` de la gerencia en SOFSE (`/infraestructura/gerencias`). */
  idGerencia: number;
  nombre: string;
  color: string;
  colorTexto: string;
}

// TODO colores oficiales: docs/02c-colores-trenes.md (provisorios, todos AA con su texto).
export const LINEAS_TREN: readonly LineaTren[] = [
  { id: 'roca', idGerencia: 11, nombre: 'Roca', color: '#FAB700', colorTexto: '#000000' },
  { id: 'sarmiento', idGerencia: 1, nombre: 'Sarmiento', color: '#B766C2', colorTexto: '#000000' },
  { id: 'mitre', idGerencia: 5, nombre: 'Mitre', color: '#8FBE00', colorTexto: '#000000' },
  {
    id: 'san-martin',
    idGerencia: 31,
    nombre: 'San Martín',
    color: '#6495ED',
    colorTexto: '#000000',
  },
  {
    id: 'belgrano-sur',
    idGerencia: 21,
    nombre: 'Belgrano Sur',
    color: '#F85900',
    colorTexto: '#000000',
  },
  {
    id: 'tren-de-la-costa',
    idGerencia: 41,
    nombre: 'Tren de la Costa',
    color: '#002D9A',
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
