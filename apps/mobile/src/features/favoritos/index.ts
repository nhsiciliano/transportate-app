// API pública de la feature de favoritos: lógica (repositorio, provider) y pantalla.
export {
  ALIAS_MAX_LENGTH,
  FAVORITO_TIPOS,
  favoritoId,
  type FavoritoTipo,
  type FavoritoV1,
  type FavoritosDocV1,
  type NuevoFavorito,
} from './model';
export {
  FAVORITOS_STORAGE_KEY,
  MmkvFavoritosRepository,
  getDefaultFavoritosRepository,
  type FavoritosRepository,
} from './repository';
export {
  FavoritosProvider,
  useFavoritos,
  useFavoritosRepository,
  type UseFavoritosResult,
} from './FavoritosProvider';
export { FavoritosScreen } from './FavoritosScreen';
export { EditModeButton, EditModeProvider, useEditMode } from './EditMode';
export { FavoritoRow, type FavoritoRowProps } from './FavoritoRow';
export { AliasSheet, clampAlias, type AliasSheetProps } from './AliasSheet';
export { filterFavoritos, SEARCH_THRESHOLD } from './search';
