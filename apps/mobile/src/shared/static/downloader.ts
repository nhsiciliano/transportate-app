// Descarga de archivos grandes del paquete estático con progreso (tarea 4.5).
//
// `fetch` de React Native no expone el cuerpo como `ReadableStream`, así que no hay forma de
// medir el avance con él. `XMLHttpRequest` sí emite `progress` (`loaded` / `total`) mientras baja
// el cuerpo. Cloudflare suele mandar el JSON comprimido y sin `Content-Length` del cuerpo
// descomprimido: si `total` no se conoce, el que llama usa los `bytes` del manifiesto.
//
// Privacidad (docs/05-privacidad.md): mismo criterio que el cliente del proxy, el único header
// propio es `Accept`. Los errores llevan la ruta plantilla, nunca la URL completa.
import { getApiBaseUrl, HttpError, NetworkError, TimeoutError, AbortedError } from '../api';

export const STATIC_FILE_ROUTE = '/v1/static/:version/:archivo';
/** 1,7 MB con señal mala tarda: 60 s antes de darlo por perdido. */
export const DOWNLOAD_TIMEOUT_MS = 60_000;

export interface DownloadOptions {
  /** `total` es `null` si el servidor no lo informa. */
  onProgress?: (loaded: number, total: number | null) => void;
  signal?: AbortSignal;
}

export interface StaticDownloader {
  /** Devuelve el cuerpo como texto (se valida y se guarda tal cual). */
  download(version: string, archivo: string, options?: DownloadOptions): Promise<string>;
}

/** `XMLHttpRequest` contra `/v1/static/:version/:archivo` del proxy. */
export function createXhrDownloader(
  baseUrl: string = getApiBaseUrl(),
  timeoutMs: number = DOWNLOAD_TIMEOUT_MS,
): StaticDownloader {
  return {
    download(version, archivo, { onProgress, signal } = {}) {
      return new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${baseUrl}/v1/static/${encodeURIComponent(version)}/${encodeURIComponent(archivo)}`;
        xhr.open('GET', url);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.responseType = 'text';
        xhr.timeout = timeoutMs;
        xhr.onprogress = (e) => {
          onProgress?.(e.loaded, e.lengthComputable && e.total > 0 ? e.total : null);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
          else reject(new HttpError(STATIC_FILE_ROUTE, xhr.status, null, null));
        };
        xhr.onerror = () => {
          reject(new NetworkError(STATIC_FILE_ROUTE));
        };
        xhr.ontimeout = () => {
          reject(new TimeoutError(STATIC_FILE_ROUTE, timeoutMs));
        };
        xhr.onabort = () => {
          reject(new AbortedError(STATIC_FILE_ROUTE));
        };
        signal?.addEventListener('abort', () => {
          xhr.abort();
        });
        xhr.send();
      });
    },
  };
}
