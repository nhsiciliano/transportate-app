// Qué dice el estático de subte sobre un favorito: el color de su insignia y si ya no existe
// ("huérfano", brief `docs/briefs/05-favoritos.md`, estados). Puro: recibe la red ya armada.
import { isLineaKey, type LineaSubte, type RedSubte } from '@/features/subtes/model';

import type { FavoritoV1 } from './model';

export interface SubteBadge {
  /** Letra de la insignia: "A", "PM". */
  label: string;
  /** `route_color` y `route_text_color` del estático. */
  color: string;
  textColor: string;
}

export interface ResolvedFavorito {
  /** Solo líneas y estaciones de subte, y solo con el estático cargado. */
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
    case 'linea_colectivo':
    case 'parada_colectivo':
      // Gancho: se completa en 4.5, cuando la app tenga el índice de colectivos para comparar.
      return { orphan: isOrphanColectivo() };
  }
}

/** TODO(4.5): comparar con el índice estático de colectivos. Hoy nunca se marca huérfano. */
function isOrphanColectivo(): boolean {
  return false;
}

export function orphanMessage(fav: FavoritoV1): string {
  const que =
    fav.tipo === 'estacion_subte' || fav.tipo === 'parada_colectivo' ? 'estación' : 'línea';
  const palabra = fav.tipo === 'parada_colectivo' ? 'parada' : que;
  return `Esta ${palabra} ya no figura en los datos oficiales`;
}
