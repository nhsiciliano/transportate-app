export { ApiClientProvider, getDefaultApiClient, useApiClient } from './ApiClientProvider';
export {
  createApiClient,
  DEFAULT_ETAG_CACHE_SIZE,
  DEFAULT_TIMEOUT_MS,
  type ApiClient,
  type ApiClientOptions,
  type ApiResult,
  type ArchivoEstatico,
  type FeedResult,
  type RequestOptions,
} from './client';
export { DEFAULT_API_URL, getApiBaseUrl, normalizeBaseUrl } from './config';
export {
  AbortedError,
  ContractError,
  HttpError,
  isApiError,
  NetworkError,
  TimeoutError,
  toApiError,
  type ApiError,
  type ApiErrorKind,
  type UserMessage,
} from './errors';
export {
  DEFAULT_STALE_TIME_MS,
  MANIFEST_STALE_TIME_MS,
  useAlertasSubtes,
  useAlertasTrenes,
  useArribosEstacion,
  useArribosEstacionTren,
  useArribosParada,
  useEstadoSubtes,
  useEstadoTrenes,
  useLineasColectivo,
  useManifest,
  usePosicionesLinea,
  type FeedQuery,
  type ResourceQuery,
} from './hooks';
export {
  invalidateColectivos,
  invalidateRealtime,
  invalidateSubtes,
  invalidateTrenes,
  queryKeys,
} from './keys';
