// Paquete estático versionado en la app (README.md).
export {
  createLastKnownStore,
  lastKnownKey,
  type ArchivoData,
  type LastKnown,
  type LastKnownStore,
} from './lastKnown';
export {
  getDefaultLastKnownStore,
  StaticStoreProvider,
  useLastKnownStore,
} from './StaticStoreProvider';
export {
  staticKeys,
  useStaticArchivo,
  versionFromManifest,
  type StaticQuery,
} from './useStaticArchivo';
