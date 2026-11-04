// API pública de la feature de favoritos: modelo, repositorio, provider, `FavoriteToggle` y pantalla.
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
export {
  FavoriteToggle,
  REMOVED_ANNOUNCEMENT,
  SAVED_ANNOUNCEMENT,
  type FavoriteToggleProps,
} from './FavoriteToggle';
export { FavoritosScreen } from './FavoritosScreen';
export { EditModeButton, EditModeProvider, useEditMode } from './EditMode';
export { FavoritoRow, type FavoritoRowProps } from './FavoritoRow';
export { AliasSheet, clampAlias, type AliasSheetProps } from './AliasSheet';
export { filterFavoritos, SEARCH_THRESHOLD } from './search';
export { FavoritoLiveData, LiveDataView, type FavoritoLiveDataProps } from './FavoritoLiveData';
export {
  HUERFANO,
  HUERFANO_CORTO,
  SIN_ARRIBOS,
  SIN_ARRIBOS_CORTO,
  SIN_INFORMACION,
  useFavoritoLiveData,
  useNow,
  type FavoritoLiveDataResult,
  type LiveDataStatus,
} from './useFavoritoLiveData';
export {
  descripcionDeFavorito,
  mensajeDeFavorito,
  modeloBanda,
  TIPO_LECTOR,
  type ModeloBanda,
} from './banda';
export { TIPO_ICON } from './describe';
