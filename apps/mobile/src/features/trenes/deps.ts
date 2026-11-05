// Lo que Trenes reutiliza de Subtes (cross-feature, como Inicio y Favoritos). Un solo punto de
// entrada para que la mudanza a `shared/ui` (tarea 6.8) toque un archivo.
export {
  AvisoAlert,
  EstadoBoard,
  estadoBanda,
  RefreshErrorAlert,
  Rotulo,
  ScreenScroll,
  tonoNota,
  useFondo,
  usePullToRefresh,
} from '@/features/subtes';
export { horaBsAs } from '@/features/subtes/model';
