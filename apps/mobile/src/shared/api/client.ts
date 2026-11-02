// Cliente tipado del proxy (docs/06-proxy.md §2–§4). Cada respuesta se valida con los esquemas
// Zod de `@transportate/contracts` (`safeParse`); si no valida, `ContractError` y la pantalla no
// recibe nada (nunca se renderiza JSON fuera de contrato).
//
// Privacidad (docs/05-privacidad.md): el único header propio es `Accept` (más `If-None-Match`
// con el ETag que mandó el proxy). Sin User-Agent custom, sin ids de dispositivo ni de persona.
import {
  AlertasResponseV1,
  ArribosEstacionResponseV1,
  ArribosParadaResponseV1,
  ARCHIVOS_ESTATICOS_V1,
  ErrorV1,
  EstadoLineasResponseV1,
  HealthV1,
  LineasColectivoResponseV1,
  ManifestV1,
  PosicionesLineaResponseV1,
  type AlertasV1,
  type ArribosEstacionV1,
  type ArribosParadaV1,
  type EstadoLineasV1,
  type LineasColectivoV1,
  type MetaV1,
  type PosicionesLineaV1,
} from '@transportate/contracts';
import type { z } from 'zod';

import {
  AbortedError,
  ContractError,
  HttpError,
  NetworkError,
  TimeoutError,
  type ApiError,
} from './errors';

/** Timeout por request (docs/00-plan.md, tarea 3.9). */
export const DEFAULT_TIMEOUT_MS = 8000;
/** Respuestas con ETag que se recuerdan (una por URL; LRU). */
export const DEFAULT_ETAG_CACHE_SIZE = 64;

export interface ApiClientOptions {
  /** URL base del proxy, sin barra final (`getApiBaseUrl()`). */
  baseUrl: string;
  /** `fetch` inyectable (tests). Default: el global. */
  fetch?: typeof fetch;
  /** Reloj inyectable (tests). Default: `Date.now`. */
  now?: () => number;
  timeoutMs?: number;
  etagCacheSize?: number;
}

export interface RequestOptions {
  /** Señal de cancelación (TanStack Query la pasa en el `queryFn`). */
  signal?: AbortSignal | undefined;
}

/** Resultado de cualquier ruta. */
export interface ApiResult<T> {
  data: T;
  /** `true` si el proxy sirvió el último dato bueno (`X-Transportate-Stale: 1` o `meta.stale`). */
  stale: boolean;
  /** `true` si llegó un 304 y se devolvió el cuerpo validado que ya teníamos. */
  fromCache: boolean;
  /** Cuándo lo recibió la app (reloj del cliente). */
  receivedAt: number;
}

/** Resultado de un feed con sobre `{ meta, data }`, con la frescura lista para `FreshnessLabel`. */
export interface FeedResult<T> extends ApiResult<T> {
  meta: MetaV1;
  /** `meta.sourceTimestamp`: la frescura se calcula con esto, nunca con `generatedAt`. */
  sourceTimestamp: string | null;
  /** Edad del dato upstream al recibirlo, en segundos (o `null` si no se conoce). */
  ageSeconds: number | null;
}

export type ArchivoEstatico = keyof typeof ARCHIVOS_ESTATICOS_V1;

export interface ApiClient {
  health(options?: RequestOptions): Promise<ApiResult<z.infer<typeof HealthV1>>>;
  estadoSubtes(options?: RequestOptions): Promise<FeedResult<EstadoLineasV1>>;
  alertasSubtes(options?: RequestOptions): Promise<FeedResult<AlertasV1>>;
  arribosEstacion(
    estacionId: string,
    options?: RequestOptions,
  ): Promise<FeedResult<ArribosEstacionV1>>;
  lineasColectivo(options?: RequestOptions): Promise<FeedResult<LineasColectivoV1>>;
  posicionesLinea(
    lineaId: string,
    options?: RequestOptions,
  ): Promise<FeedResult<PosicionesLineaV1>>;
  arribosParada(paradaId: string, options?: RequestOptions): Promise<FeedResult<ArribosParadaV1>>;
  manifest(options?: RequestOptions): Promise<ApiResult<ManifestV1>>;
  /** Archivo JSON del paquete estático, validado con su esquema (los `.geojson` llegan en la Fase 4). */
  staticFile<K extends ArchivoEstatico>(
    version: string,
    archivo: K,
    options?: RequestOptions,
  ): Promise<ApiResult<z.infer<(typeof ARCHIVOS_ESTATICOS_V1)[K]>>>;
}

interface CachedBody {
  etag: string;
  body: unknown;
}

/** Map acotado con desalojo del menos usado (el orden de inserción del Map es la recencia). */
class LruCache {
  private readonly entries = new Map<string, CachedBody>();
  constructor(private readonly max: number) {}

  get(key: string): CachedBody | undefined {
    const hit = this.entries.get(key);
    if (hit) {
      this.entries.delete(key);
      this.entries.set(key, hit);
    }
    return hit;
  }

  set(key: string, value: CachedBody): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}

function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.path.map(String).join('.') || '(raíz)');
}

/** `Retry-After` en segundos (el proxy no manda la variante de fecha). */
function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
}

async function readJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const value: unknown = await response.json();
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const etags = new LruCache(options.etagCacheSize ?? DEFAULT_ETAG_CACHE_SIZE);

  /**
   * GET + validación. `route` es la plantilla (para errores, sin ids); `path` la ruta real.
   * Devuelve el cuerpo validado, si vino de un 304 y si el proxy marcó el dato como viejo.
   */
  async function get<S extends z.ZodType>(
    route: string,
    path: string,
    schema: S,
    { signal }: RequestOptions = {},
  ): Promise<{ body: z.infer<S>; fromCache: boolean; staleHeader: boolean }> {
    const url = `${baseUrl}${path}`;
    if (signal?.aborted) throw new AbortedError(route);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => {
      controller.abort();
    };
    signal?.addEventListener('abort', onAbort);
    const abortError = (): ApiError =>
      timedOut ? new TimeoutError(route, timeoutMs) : new AbortedError(route);

    try {
      const cached = etags.get(url);
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (cached) headers['If-None-Match'] = cached.etag;

      let response: Response;
      try {
        response = await doFetch(url, { method: 'GET', headers, signal: controller.signal });
      } catch {
        throw controller.signal.aborted ? abortError() : new NetworkError(route);
      }
      const staleHeader = response.headers.get('X-Transportate-Stale') === '1';

      if (response.status === 304) {
        if (!cached) throw new HttpError(route, 304, null, null);
        // El cuerpo guardado ya pasó el esquema cuando llegó con 200.
        return { body: cached.body as z.infer<S>, fromCache: true, staleHeader };
      }

      const json = await readJson(response);
      if (controller.signal.aborted) throw abortError();

      if (!response.ok) {
        const parsed = json.ok ? ErrorV1.safeParse(json.value) : null;
        const err = parsed?.success ? parsed.data.error : null;
        throw new HttpError(
          route,
          response.status,
          err?.code ?? null,
          err?.retryAfterSeconds ?? parseRetryAfter(response.headers.get('Retry-After')),
        );
      }
      if (!json.ok) throw new ContractError(route, ['(JSON inválido)']);

      const result = schema.safeParse(json.value);
      if (!result.success) {
        etags.delete(url);
        throw new ContractError(route, zodIssues(result.error));
      }
      const etag = response.headers.get('ETag');
      if (etag) etags.set(url, { etag, body: result.data });
      else etags.delete(url);
      return { body: result.data, fromCache: false, staleHeader };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async function plain<S extends z.ZodType>(
    route: string,
    path: string,
    schema: S,
    options?: RequestOptions,
  ): Promise<ApiResult<z.infer<S>>> {
    const { body, fromCache, staleHeader } = await get(route, path, schema, options);
    return { data: body, stale: staleHeader, fromCache, receivedAt: now() };
  }

  async function feed<T>(
    route: string,
    path: string,
    schema: z.ZodType<{ meta: MetaV1; data: T }>,
    options?: RequestOptions,
  ): Promise<FeedResult<T>> {
    const { body, fromCache, staleHeader } = await get(route, path, schema, options);
    const receivedAt = now();
    const { meta, data } = body;
    const source = meta.sourceTimestamp ? Date.parse(meta.sourceTimestamp) : Number.NaN;
    const ageSeconds = Number.isFinite(source)
      ? Math.max(0, Math.round((receivedAt - source) / 1000))
      : meta.ageSeconds;
    return {
      data,
      meta,
      stale: staleHeader || meta.stale,
      fromCache,
      receivedAt,
      sourceTimestamp: meta.sourceTimestamp,
      ageSeconds,
    };
  }

  const id = (value: string) => encodeURIComponent(value);

  return {
    health: (o) => plain('/v1/health', '/v1/health', HealthV1, o),
    estadoSubtes: (o) => feed('/v1/subtes/estado', '/v1/subtes/estado', EstadoLineasResponseV1, o),
    alertasSubtes: (o) => feed('/v1/subtes/alertas', '/v1/subtes/alertas', AlertasResponseV1, o),
    arribosEstacion: (estacionId, o) =>
      feed(
        '/v1/subtes/estaciones/:estacionId/arribos',
        `/v1/subtes/estaciones/${id(estacionId)}/arribos`,
        ArribosEstacionResponseV1,
        o,
      ),
    lineasColectivo: (o) =>
      feed('/v1/colectivos/lineas', '/v1/colectivos/lineas', LineasColectivoResponseV1, o),
    posicionesLinea: (lineaId, o) =>
      feed(
        '/v1/colectivos/lineas/:lineaId/posiciones',
        `/v1/colectivos/lineas/${id(lineaId)}/posiciones`,
        PosicionesLineaResponseV1,
        o,
      ),
    arribosParada: (paradaId, o) =>
      feed(
        '/v1/colectivos/paradas/:paradaId/arribos',
        `/v1/colectivos/paradas/${id(paradaId)}/arribos`,
        ArribosParadaResponseV1,
        o,
      ),
    manifest: (o) => plain('/v1/static/manifest', '/v1/static/manifest', ManifestV1, o),
    staticFile: <K extends ArchivoEstatico>(version: string, archivo: K, o?: RequestOptions) => {
      const schema: z.ZodType = ARCHIVOS_ESTATICOS_V1[archivo];
      // `schema` es el de `K`, pero TS no sigue el tipo a través del índice genérico.
      return plain(
        '/v1/static/:version/:archivo',
        `/v1/static/${id(version)}/${id(archivo)}`,
        schema,
        o,
      ) as Promise<ApiResult<z.infer<(typeof ARCHIVOS_ESTATICOS_V1)[K]>>>;
    },
  };
}
