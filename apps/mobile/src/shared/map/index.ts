// Mapa compartido (ADR-0002). API y decisiones en README.md.
export {
  BottomPanel,
  nearestIndex,
  PANEL_ANIMATION_MS,
  PANEL_HANDLE_HEIGHT,
  PANEL_LABELS,
  panelHeights,
  usePanelBottomInset,
  type BottomPanelProps,
  type PanelIndex,
} from './BottomPanel';
export { boundsOf, pointCollection, pressedProperty } from './geojson';
export {
  CAMERA_ANIMATION_MS,
  EDGE_GESTURE_GUTTER,
  MapView,
  USER_ZOOM,
  type MapLocationControl,
  type MapViewHandle,
  type MapViewProps,
} from './MapView';
export {
  geoJsonVersion,
  useStaticGeoJson,
  type GeoJsonData,
  type StaticGeoJsonQuery,
} from './staticData';
export { CABA_BOUNDS, MAP_ATTRIBUTION, MAP_FONT, MAP_STYLE_URLS, mapStyleFor } from './styles';
export { useLocationGranted } from './useLocationGranted';
