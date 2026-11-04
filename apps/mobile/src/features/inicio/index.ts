// API pública de la feature de Inicio (README.md).
export {
  elegirLider,
  FAVORITOS_EN_INICIO,
  hrefDeFavorito,
  InicioScreen,
  resumenSubte,
  SIN_FAVORITOS,
  SUBTE_NORMAL,
  type ResumenSubte,
} from './InicioScreen';

// Movidas a `features/favoritos` (fuente de verdad del favorito); se re-exportan por compatibilidad.
export { mensajeDeFavorito, modeloBanda } from '@/features/favoritos';
