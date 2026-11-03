// Búsqueda de favoritos (S15): por alias y nombre, sin tildes ni mayúsculas.
import type { FavoritoV1 } from './model';

/** Con más favoritos que esto aparece el campo de búsqueda (S15). */
export const SEARCH_THRESHOLD = 15;

/** `"Línea Ñandú"` → `"linea nandu"`. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function filterFavoritos(
  favoritos: readonly FavoritoV1[],
  query: string,
): readonly FavoritoV1[] {
  const q = normalizeText(query);
  if (q === '') return favoritos;
  return favoritos.filter((f) =>
    normalizeText([f.alias, f.nombre, f.subtitulo].filter(Boolean).join(' ')).includes(q),
  );
}
