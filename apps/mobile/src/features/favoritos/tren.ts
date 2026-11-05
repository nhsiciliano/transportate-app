// Qué dice el estático de trenes sobre un favorito de ramal o de estación: el color de la insignia
// de su línea y si ya no existe («huérfano», como en subte). Puro: recibe la red ya armada. El
// huérfano lo consume `useFavoritoLiveData` (único criterio); la insignia queda disponible para
// las filas (hoy la banda lleva el pictograma del tipo, F5-favoritos-2).
import type { RedTrenes } from '@/features/trenes/model';

import type { FavoritoV1 } from './model';
import type { ResolvedFavorito } from './subte';

/**
 * `red` es `undefined` mientras el estático no cargó o si falló: ahí no se afirma nada y la fila
 * queda neutra. Una estación con varias líneas toma la insignia de la primera en el orden fijo.
 */
export function resolveFavoritoTren(
  fav: Pick<FavoritoV1, 'tipo' | 'refId'>,
  red: RedTrenes | undefined,
): ResolvedFavorito {
  if (fav.tipo !== 'ramal_tren' && fav.tipo !== 'estacion_tren') return { orphan: false };
  if (red === undefined) return { orphan: false };
  const lineaId =
    fav.tipo === 'ramal_tren'
      ? red.ramalPorId.get(fav.refId)?.linea
      : red.estacionPorId.get(fav.refId)?.lineas.find((id) => red.lineaPorId.has(id));
  if (lineaId === undefined) return { orphan: true };
  const linea = red.lineaPorId.get(lineaId);
  if (linea === undefined) return { orphan: false };
  return {
    orphan: false,
    badge: { label: linea.siglas, color: linea.color, textColor: linea.colorTexto },
  };
}
