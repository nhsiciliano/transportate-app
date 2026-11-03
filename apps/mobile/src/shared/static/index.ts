// Paquete estático versionado en la app (README.md).
export {
  createLastKnownStore,
  lastKnownKey,
  type ArchivoData,
  type LastKnown,
  type LastKnownStore,
} from './lastKnown';
export {
  getDefaultLargeFileManager,
  getDefaultLastKnownStore,
  StaticStoreProvider,
  useLargeFileManager,
  useLastKnownStore,
} from './StaticStoreProvider';
export {
  staticKeys,
  useStaticArchivo,
  versionFromManifest,
  type StaticQuery,
} from './useStaticArchivo';
export {
  createXhrDownloader,
  DOWNLOAD_TIMEOUT_MS,
  STATIC_FILE_ROUTE,
  type DownloadOptions,
  type StaticDownloader,
} from './downloader';
export { LargeFileManager, largeFileKeys, type LargeFileState } from './largeFiles';
export {
  useStaticArchivoGrande,
  useStaticDownloadProgress,
  type StaticArchivoGrandeQuery,
} from './useStaticArchivoGrande';
