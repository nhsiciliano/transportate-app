// Mapa compartido (ADR-0002). API y decisiones en README.md.
export { boundsOf, pointCollection, pressedProperty } from './geojson';
export {
  CAMERA_ANIMATION_MS,
  EDGE_GESTURE_GUTTER,
  MapView,
  USER_ZOOM,
  type MapViewHandle,
  type MapViewProps,
} from './MapView';
export { staticFileKey, useStaticGeoJson, useStaticJson, type StaticResource } from './staticData';
export { CABA_BOUNDS, MAP_ATTRIBUTION, MAP_FONT, MAP_STYLE_URLS, mapStyleFor } from './styles';
export { useLocationGranted } from './useLocationGranted';
