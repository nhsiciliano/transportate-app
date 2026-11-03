// Textos y destinos de cada tipo de favorito: etiqueta para el lector de pantalla, ícono y ruta.
import type { IconName } from '@/shared/icons';

import type { FavoritoTipo, FavoritoV1 } from './model';

export const TIPO_ICON: Record<FavoritoTipo, IconName> = {
  linea_subte: 'subtes',
  estacion_subte: 'estacion',
  linea_colectivo: 'colectivos',
  parada_colectivo: 'parada',
};

/** Nombre que se muestra (y se anuncia) como principal: el alias o, si no hay, el oficial. */
export function displayName(fav: FavoritoV1): string {
  return fav.alias ?? fav.nombre;
}

/** Texto secundario: el nombre oficial cuando hay alias, y el subtítulo (líneas, sentido…). */
export function secondaryText(fav: FavoritoV1): string | undefined {
  const parts = [fav.alias ? fav.nombre : undefined, fav.subtitulo].filter(
    (p): p is string => p !== undefined,
  );
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** "Línea A" → "A"; "Línea 60" → "60". Para el `LineBadge`. */
export function lineLabel(fav: FavoritoV1): string {
  return fav.nombre.replace(/^l[ií]nea\s+/i, '').trim() || fav.refId;
}

/** Con "Casa" → "Casa. Estación Medrano, línea B." (alias + tipo + nombre oficial). */
export function accessibleLabel(fav: FavoritoV1, liveLabel?: string): string {
  let oficial: string;
  switch (fav.tipo) {
    case 'linea_subte':
      oficial = `${fav.nombre} de subte`;
      break;
    case 'linea_colectivo':
      oficial = `${fav.nombre} de colectivo`;
      break;
    case 'estacion_subte':
      oficial = `Estación ${fav.nombre}`;
      break;
    case 'parada_colectivo':
      oficial = `Parada ${fav.nombre}`;
      break;
  }
  const detalle = fav.subtitulo ? `${oficial}, ${fav.subtitulo}` : oficial;
  return [fav.alias, detalle, liveLabel].filter(Boolean).join('. ') + '.';
}

export type FavoritoHref =
  | { pathname: '/subtes/[linea]'; params: { linea: string } }
  | { pathname: '/subtes/estacion/[id]'; params: { id: string } }
  | { pathname: '/colectivos/[linea]'; params: { linea: string } }
  | { pathname: '/colectivos/parada/[id]'; params: { id: string } };

/** Detalle de cada tipo (N1: `router.push` cambia de tab solo). */
export function hrefFor(fav: FavoritoV1): FavoritoHref {
  switch (fav.tipo) {
    case 'linea_subte':
      return { pathname: '/subtes/[linea]', params: { linea: fav.refId } };
    case 'estacion_subte':
      return { pathname: '/subtes/estacion/[id]', params: { id: fav.refId } };
    case 'linea_colectivo':
      return { pathname: '/colectivos/[linea]', params: { linea: fav.refId } };
    case 'parada_colectivo':
      return { pathname: '/colectivos/parada/[id]', params: { id: fav.refId } };
  }
}
