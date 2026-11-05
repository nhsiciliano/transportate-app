// Errores del cliente del proxy. `ApiError` es una unión discriminada por `kind`; cada clase
// deriva `retryable` y el texto para la persona (`userMessage()`, copy de docs/briefs/README.md,
// "ErrorState"). Privacidad: ni `message` ni `userMessage()` llevan la URL completa, el host, los
// ids de la ruta ni el cuerpo crudo de la respuesta: solo la ruta "plantilla"
// (`/v1/colectivos/paradas/:paradaId/arribos`), que no dice nada de la persona.
import type { ErrorCodeV1 } from '@transportate/contracts';

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'contract' | 'aborted';

/** Texto listo para `ErrorState` (`title` + `cause`) o para una `Alert` en línea. */
export interface UserMessage {
  title: string;
  cause: string | null;
}

const SERVICIO_NO_RESPONDE: UserMessage = {
  title: 'Servicio no disponible',
  cause: 'El servicio de la Ciudad no responde en este momento.',
};
const TRENES_NO_RESPONDE: UserMessage = {
  title: 'Servicio no disponible',
  cause: 'El servicio de trenes no responde en este momento.',
};

/**
 * Timeout o 5xx del upstream: el copy nombra a quien no responde. Las rutas de trenes salen de
 * la fuente comunitaria de SOFSE, no de la API de la Ciudad.
 */
function servicioNoResponde(route: string): UserMessage {
  return route.startsWith('/v1/trenes/') ? TRENES_NO_RESPONDE : SERVICIO_NO_RESPONDE;
}
const NO_DISPONIBLE: UserMessage = {
  title: 'Esta información no está disponible por ahora.',
  cause: null,
};
const FALLA_NUESTRA: UserMessage = {
  title: 'Algo falló de nuestro lado.',
  cause: 'No es un problema de tu teléfono ni de tu conexión.',
};

abstract class ApiErrorBase extends Error {
  abstract readonly kind: ApiErrorKind;
  abstract readonly retryable: boolean;
  /** Ruta plantilla, sin host ni ids: `/v1/subtes/estaciones/:estacionId/arribos`. */
  readonly route: string;

  protected constructor(route: string, message: string) {
    super(message);
    this.route = route;
  }

  abstract userMessage(): UserMessage;
}

/** No hubo respuesta (sin red, DNS, conexión cortada). */
export class NetworkError extends ApiErrorBase {
  readonly kind = 'network' as const;
  readonly retryable = true;
  override readonly name = 'NetworkError';

  constructor(route: string) {
    super(route, `Sin respuesta del proxy en ${route}`);
  }

  userMessage(): UserMessage {
    // Con NetInfo offline la app muestra el banner global; esto cubre la red "conectada" que no anda.
    return {
      title: 'No pudimos conectarnos',
      cause: 'Revisá tu conexión y volvé a intentar.',
    };
  }
}

/** El proxy no respondió dentro del tiempo límite (`AbortController`). */
export class TimeoutError extends ApiErrorBase {
  readonly kind = 'timeout' as const;
  readonly retryable = true;
  override readonly name = 'TimeoutError';
  readonly timeoutMs: number;

  constructor(route: string, timeoutMs: number) {
    super(route, `Timeout de ${timeoutMs} ms en ${route}`);
    this.timeoutMs = timeoutMs;
  }

  userMessage(): UserMessage {
    return servicioNoResponde(this.route);
  }
}

/** Status de transporte o de servidor que se reintentan (docs/06-proxy.md §4). */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** El proxy respondió con un status de error (`ErrorV1` si el cuerpo lo cumple). */
export class HttpError extends ApiErrorBase {
  readonly kind = 'http' as const;
  override readonly name = 'HttpError';
  readonly status: number;
  /** `error.code` de `ErrorV1`, o `null` si el cuerpo no era un `ErrorV1`. */
  readonly code: ErrorCodeV1 | null;
  /** De `error.retryAfterSeconds` o del header `Retry-After`. */
  readonly retryAfterSeconds: number | null;
  readonly retryable: boolean;

  constructor(
    route: string,
    status: number,
    code: ErrorCodeV1 | null,
    retryAfterSeconds: number | null,
  ) {
    super(route, `HTTP ${status}${code ? ` (${code})` : ''} en ${route}`);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.retryable = RETRYABLE_STATUS.has(status);
  }

  userMessage(): UserMessage {
    if (this.status === 404) return NO_DISPONIBLE;
    if (this.status === 429) {
      return {
        title: 'Servicio no disponible',
        cause: 'Hicimos muchas consultas seguidas. Volvemos a probar en un rato.',
      };
    }
    // 500 `internal` y 400 `bad_request` son fallas nuestras; el resto de los 5xx, del upstream.
    if (this.status === 500 || this.status === 400) return FALLA_NUESTRA;
    if (this.retryable) return servicioNoResponde(this.route);
    return FALLA_NUESTRA;
  }
}

/** La respuesta no cumple el contrato (JSON inválido o `safeParse` fallido). Nunca se renderiza. */
export class ContractError extends ApiErrorBase {
  readonly kind = 'contract' as const;
  readonly retryable = false;
  override readonly name = 'ContractError';
  /** Rutas de los campos que fallaron (`data.lineas.0.estado`), sin valores. */
  readonly issues: readonly string[];

  constructor(route: string, issues: readonly string[]) {
    super(
      route,
      `Respuesta fuera de contrato en ${route}${issues.length ? `: ${issues.slice(0, 5).join(', ')}` : ''}`,
    );
    this.issues = issues;
  }

  userMessage(): UserMessage {
    return FALLA_NUESTRA;
  }
}

/** La consulta se canceló desde afuera (TanStack la cancela al desmontar o al cambiar la key). */
export class AbortedError extends ApiErrorBase {
  readonly kind = 'aborted' as const;
  readonly retryable = false;
  override readonly name = 'AbortedError';

  constructor(route: string) {
    super(route, `Consulta cancelada en ${route}`);
  }

  userMessage(): UserMessage {
    return { title: 'Se canceló la consulta.', cause: null };
  }
}

export type ApiError = NetworkError | TimeoutError | HttpError | ContractError | AbortedError;

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiErrorBase;
}

/**
 * Normaliza cualquier error a `ApiError`. Lo que no es `ApiError` es un bug nuestro (por ejemplo
 * una excepción en el código de la app), así que se trata como `contract`: no se reintenta y se
 * muestra "Algo falló de nuestro lado".
 */
export function toApiError(error: unknown, route: string): ApiError {
  if (isApiError(error)) return error;
  return new ContractError(route, []);
}
