// API pública de la feature de ubicación (README.md).
export { CABA_BBOX, distanceMeters, isInsideCaba, type LatLon } from './geo';
export {
  PERMISO_BLOCKED_MESSAGE,
  PERMISO_DETAIL,
  PERMISO_MESSAGE,
  PERMISO_TITLE,
  PermisoUbicacionBloque,
  type PermisoUbicacionBloqueProps,
} from './PermisoUbicacionBloque';
export {
  toPermiso,
  usePermisoUbicacion,
  useUbicacion,
  WATCH_DISTANCE_INTERVAL_M,
  WATCH_TIME_INTERVAL_MS,
  type PermisoUbicacion,
  type PosicionUsuario,
  type UsePermisoUbicacion,
  type UseUbicacion,
  type UseUbicacionOptions,
} from './useUbicacion';
