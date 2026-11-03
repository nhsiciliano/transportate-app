// API pública de la feature de Colectivos (README.md). El detalle de línea con mapa (`LineaScreen`,
// `MapaLinea`, `VehiculosSheet`) lo monta la ruta `colectivos/[linea].tsx` directo desde su archivo.
export {
  ColectivosScreen,
  ERROR_INDICE,
  FUERA_DE_CABA,
  SIN_POSICION,
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
