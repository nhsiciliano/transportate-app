// Qué dice el estático de subte sobre un favorito: el color de su insignia y si ya no existe
// ("huérfano", brief `docs/briefs/05-favoritos.md`, estados). Puro: recibe la red ya armada.
// `orphan` lo consume `useFavoritoLiveData` (único criterio de huérfano para los cuatro tipos);
// la pantalla solo usa `badge`.
import { isLineaKey, type LineaSubte, type RedSubte } from '@/features/subtes/model';

import type { FavoritoV1 } from './model';

export interface SubteBadge {
  /** Letra de la insignia: "A", "PM" (o siglas de tren: "SM"). */
  label: string;
  /** `route_color` y `route_text_color` del estático. */
  color: string;
  textColor: string;
}

export interface ResolvedFavorito {
  /** Líneas y estaciones de subte, y ramales y estaciones de tren (`tren.ts`), con el estático cargado. */
  badge?: SubteBadge;
  /** El destino ya no figura en los datos oficiales. */
  orphan: boolean;
}

function toBadge(linea: LineaSubte): SubteBadge {
  return { label: linea.badge, color: linea.color, textColor: linea.colorTexto };
}

/**
 * `red` es `undefined` mientras el estático no cargó o si falló: ahí no se puede afirmar nada
 * y la fila queda neutra y sin marcar (F4-favoritos-10).
 */
export function resolveFavorito(fav: FavoritoV1, red: RedSubte | undefined): ResolvedFavorito {
  switch (fav.tipo) {
    case 'linea_subte': {
      if (red === undefined) return { orphan: false };
      const linea = isLineaKey(fav.refId) ? red.lineaPorKey.get(fav.refId) : undefined;
      return linea === undefined ? { orphan: true } : { orphan: false, badge: toBadge(linea) };
    }
    case 'estacion_subte': {
      if (red === undefined) return { orphan: false };
      const estacion = red.estacionPorId.get(fav.refId);
      if (estacion === undefined) return { orphan: true };
      const linea = red.lineaPorKey.get(estacion.linea);
      return linea === undefined ? { orphan: false } : { orphan: false, badge: toBadge(linea) };
    }
    case 'ramal_tren':
    case 'estacion_tren':
      // Su estático es otro (`tren.ts`, `resolveFavoritoTren`).
      return { orphan: false };
    case 'linea_colectivo':
    case 'parada_colectivo':
      // Sin criterio acá: el estático de subte no dice nada de colectivos. Su huérfano (línea
      // contra las vigentes del proxy, parada contra el índice) lo decide `useFavoritoLiveData`.
      return { orphan: false };
  }
}

const PALABRA: Record<FavoritoV1['tipo'], string> = {
  linea_subte: 'línea',
  linea_colectivo: 'línea',
  estacion_subte: 'estación',
  estacion_tren: 'estación',
  parada_colectivo: 'parada',
  ramal_tren: 'ramal',
};

export function orphanMessage(fav: FavoritoV1): string {
  const palabra = PALABRA[fav.tipo];
  // «Este ramal» / «Esta estación».
  return `${palabra === 'ramal' ? 'Este' : 'Esta'} ${palabra} ya no figura en los datos oficiales`;
}
