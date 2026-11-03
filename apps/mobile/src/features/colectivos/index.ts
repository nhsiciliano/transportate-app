// API pública de la feature de Colectivos (README.md). El detalle de línea (`LineaScreen`, mapa)
// es de la tarea 4.6.
export {
  ColectivosScreen,
  ERROR_INDICE,
  FUERA_DE_CABA,
  PERMISO_TEXTO,
  PREPARANDO,
} from './ColectivosScreen';
export { ARCHIVOS_COLECTIVOS, useIndiceColectivos, type IndiceColectivosQuery } from './hooks';
export * from './model';
export { PARAM_PARADA, useAbrirLinea } from './navigation';
export { ParadaScreen } from './ParadaScreen';
export {
  createRecientesStore,
  MAX_RECIENTES,
  RECIENTES_KEY,
  RecientesProvider,
  useRecientes,
  type Reciente,
  type RecientesStore,
} from './recientes';
export { useUbicacionCercana, type UbicacionStatus } from './useUbicacionCercana';
