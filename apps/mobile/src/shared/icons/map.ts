// Mapa curado de íconos (tarea 3.5, `docs/08-design-system.md` → "Íconos (mapa curado)").
//
// Material Symbols Rounded FILL 1 del paquete `@material-symbols/svg-400` 0.48.2 (Apache-2.0),
// ADR-0004. Cada SVG se importa de forma explícita: Metro empaqueta solo los que figuran acá.
// La clave es el nombre de uso en la app (camelCase); el comentario, el uso y el glifo.
// Sumar un ícono = una fila acá + una fila en `docs/08-design-system.md`.
//
// Únicas excepciones a FILL 1: `favoritoOff` usa `star.svg` (contorno) para que "no es favorito"
// no dependa solo del color (`docs/08-design-system.md`, nota 1).
// Nombres repetidos a propósito: `favoritos`/`favoritoOn` (estrella llena), `acercaDe`/`info`
// (info), `subtes`/`estacion` (subway) y `sentidoHacia`/`irA` (arrow_forward) comparten glifo pero
// son usos distintos.
import HomeFillSvg from '@material-symbols/svg-400/rounded/home-fill.svg';
import DirectionsBusFillSvg from '@material-symbols/svg-400/rounded/directions_bus-fill.svg';
import SubwayFillSvg from '@material-symbols/svg-400/rounded/subway-fill.svg';
import StarFillSvg from '@material-symbols/svg-400/rounded/star-fill.svg';
import TrafficFillSvg from '@material-symbols/svg-400/rounded/traffic-fill.svg';
import SettingsFillSvg from '@material-symbols/svg-400/rounded/settings-fill.svg';
import InfoFillSvg from '@material-symbols/svg-400/rounded/info-fill.svg';
import ArrowBackFillSvg from '@material-symbols/svg-400/rounded/arrow_back-fill.svg';
import CloseFillSvg from '@material-symbols/svg-400/rounded/close-fill.svg';
import ChevronRightFillSvg from '@material-symbols/svg-400/rounded/chevron_right-fill.svg';
import OpenInNewFillSvg from '@material-symbols/svg-400/rounded/open_in_new-fill.svg';
import SearchFillSvg from '@material-symbols/svg-400/rounded/search-fill.svg';
import CancelFillSvg from '@material-symbols/svg-400/rounded/cancel-fill.svg';
import StarSvg from '@material-symbols/svg-400/rounded/star.svg';
import DragHandleFillSvg from '@material-symbols/svg-400/rounded/drag_handle-fill.svg';
import EditFillSvg from '@material-symbols/svg-400/rounded/edit-fill.svg';
import DeleteFillSvg from '@material-symbols/svg-400/rounded/delete-fill.svg';
import UndoFillSvg from '@material-symbols/svg-400/rounded/undo-fill.svg';
import NearMeFillSvg from '@material-symbols/svg-400/rounded/near_me-fill.svg';
import MyLocationFillSvg from '@material-symbols/svg-400/rounded/my_location-fill.svg';
import LocationOffFillSvg from '@material-symbols/svg-400/rounded/location_off-fill.svg';
import LocationOnFillSvg from '@material-symbols/svg-400/rounded/location_on-fill.svg';
import MapFillSvg from '@material-symbols/svg-400/rounded/map-fill.svg';
import ListFillSvg from '@material-symbols/svg-400/rounded/list-fill.svg';
import DepartureBoardFillSvg from '@material-symbols/svg-400/rounded/departure_board-fill.svg';
import TransferWithinAStationFillSvg from '@material-symbols/svg-400/rounded/transfer_within_a_station-fill.svg';
import SwapHorizFillSvg from '@material-symbols/svg-400/rounded/swap_horiz-fill.svg';
import ArrowForwardFillSvg from '@material-symbols/svg-400/rounded/arrow_forward-fill.svg';
import RefreshFillSvg from '@material-symbols/svg-400/rounded/refresh-fill.svg';
import WarningFillSvg from '@material-symbols/svg-400/rounded/warning-fill.svg';
import ErrorFillSvg from '@material-symbols/svg-400/rounded/error-fill.svg';
import CheckCircleFillSvg from '@material-symbols/svg-400/rounded/check_circle-fill.svg';
import ScheduleFillSvg from '@material-symbols/svg-400/rounded/schedule-fill.svg';
import BlockFillSvg from '@material-symbols/svg-400/rounded/block-fill.svg';
import HelpFillSvg from '@material-symbols/svg-400/rounded/help-fill.svg';
import WifiOffFillSvg from '@material-symbols/svg-400/rounded/wifi_off-fill.svg';
import HistoryFillSvg from '@material-symbols/svg-400/rounded/history-fill.svg';
import LightModeFillSvg from '@material-symbols/svg-400/rounded/light_mode-fill.svg';
import DarkModeFillSvg from '@material-symbols/svg-400/rounded/dark_mode-fill.svg';
import BrightnessAutoFillSvg from '@material-symbols/svg-400/rounded/brightness_auto-fill.svg';
import TimerFillSvg from '@material-symbols/svg-400/rounded/timer-fill.svg';
import PrivacyTipFillSvg from '@material-symbols/svg-400/rounded/privacy_tip-fill.svg';
import TrainFillSvg from '@material-symbols/svg-400/rounded/train-fill.svg';

export const iconMap = {
  inicio: HomeFillSvg, // Tab Inicio
  colectivos: DirectionsBusFillSvg, // Tab Colectivos
  subtes: SubwayFillSvg, // Tab Subtes
  favoritos: StarFillSvg, // Tab Favoritos
  transito: TrafficFillSvg, // Tab Tránsito (oculto en el MVP, N3)
  ajustes: SettingsFillSvg, // Ajustes (barra superior de Inicio)
  acercaDe: InfoFillSvg, // Acerca de
  atras: ArrowBackFillSvg, // Atrás
  cerrar: CloseFillSvg, // Cerrar (sheet, aviso, modal)
  chevron: ChevronRightFillSvg, // Flecha de navegación en filas
  enlaceExterno: OpenInNewFillSvg, // Enlace externo
  buscar: SearchFillSvg, // Buscar
  limpiarBusqueda: CancelFillSvg, // Limpiar búsqueda (reset del campo)
  favoritoOn: StarFillSvg, // Favorito activado (estrella llena)
  favoritoOff: StarSvg, // Favorito desactivado (estrella con contorno): excepción FILL 0
  reordenar: DragHandleFillSvg, // Reordenar favoritos (S33)
  editar: EditFillSvg, // Editar alias (S16)
  borrar: DeleteFillSvg, // Borrar
  deshacer: UndoFillSvg, // Deshacer (snackbar de S19)
  paradasCercanas: NearMeFillSvg, // Paradas cercanas
  centrarUbicacion: MyLocationFillSvg, // Centrar el mapa en mi ubicación
  sinUbicacion: LocationOffFillSvg, // Sin permiso de ubicación
  marcador: LocationOnFillSvg, // Marcador / punto en el mapa
  mapa: MapFillSvg, // Vista de mapa
  lista: ListFillSvg, // Vista de lista
  parada: DepartureBoardFillSvg, // Parada de colectivo
  estacion: SubwayFillSvg, // Estación de subte
  tren: TrainFillSvg, // Trenes (línea y ramal; pictograma de banda y favorito de ramal)
  estacionTren: TrainFillSvg, // Estación de tren (banda por destino y favorito de estación)
  anden: TransferWithinAStationFillSvg, // Andén (arribos por andén)
  sentidoAlternar: SwapHorizFillSvg, // Sentido: alternar
  sentidoHacia: ArrowForwardFillSvg, // Sentido: hacia la cabecera
  irA: ArrowForwardFillSvg, // Ir al detalle: flecha al borde de la banda de señal (SignBand, Inicio)
  refrescar: RefreshFillSvg, // Refrescar
  alerta: WarningFillSvg, // Alerta / advertencia
  info: InfoFillSvg, // Información (Alert info, "Con novedades")
  error: ErrorFillSvg, // Error
  ok: CheckCircleFillSvg, // OK / normal
  demoras: ScheduleFillSvg, // Demoras
  interrumpida: BlockFillSvg, // Interrumpida
  sinInformacion: HelpFillSvg, // Sin información
  sinConexion: WifiOffFillSvg, // Sin conexión
  frescura: HistoryFillSvg, // Frescura del dato (dato viejo)
  temaClaro: LightModeFillSvg, // Tema claro
  temaOscuro: DarkModeFillSvg, // Tema oscuro
  temaSistema: BrightnessAutoFillSvg, // Tema del sistema
  intervalo: TimerFillSvg, // Intervalo de refresco
  privacidad: PrivacyTipFillSvg, // Privacidad (Acerca de)
} as const;

export type IconName = keyof typeof iconMap;
