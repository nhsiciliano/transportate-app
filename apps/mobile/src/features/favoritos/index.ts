// API pública de la feature de favoritos (solo lógica; las pantallas llegan en la Fase 4).
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
