// API pública de la feature de Trenes (README.md).
export { LineaTrenBadge } from './components';
export { EstacionTrenScreen } from './EstacionTrenScreen';
export {
  type LineaTrenConEstado,
  type RedTrenesQuery,
  useEstacionTrenDetalle,
  useLineasTrenConEstado,
  useLineaTrenDetalle,
  useRamalDetalle,
  useRedTrenes,
} from './hooks';
export { LineaTrenScreen } from './LineaTrenScreen';
export {
  agruparArribosTren,
  alertasDeEstacion,
  alertasDeLinea,
  alertasDeRamal,
  arribosTrenVigentes,
  buildRedTrenes,
  buscarEstacionesTren,
  demoraDe,
  estadoDeEstacionTren,
  estadoDeLineaTren,
  estadoDeRamal,
  formatArriboTren,
  isLineaTrenId,
  LINEA_TREN_IDS,
  nombreLinea,
  siglasLinea,
  type BloqueTren,
  type LineaTren,
  type RamalTren,
  type RedTrenes,
} from './model';
export { RamalScreen } from './RamalScreen';
export { TrenesScreen } from './TrenesScreen';
