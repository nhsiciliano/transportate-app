import type { ErrorV1 } from '@transportate/contracts';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ApiError } from '../adapters/types';

function errorResponse(
  c: Context,
  status: ContentfulStatusCode,
  error: ErrorV1['error'],
): Response {
  if (error.retryAfterSeconds !== undefined) {
    c.header('Retry-After', String(error.retryAfterSeconds));
  }
  c.header('Cache-Control', 'no-store');
  const body: ErrorV1 = { error };
  return c.json(body, status);
}

function codeForStatus(status: number): ErrorV1['error']['code'] {
  if (status === 400) return 'bad_request';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status === 502 || status === 503 || status === 504) return 'upstream_unavailable';
  return 'internal';
}

/**
 * Manejador global: responde siempre el sobre `ErrorV1`. Nunca devuelve stack,
 * mensajes internos ni URLs upstream (llevan el secret en la query). Solo loguea
 * el tipo de error, sin datos de la request.
 */
export const onError: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) {
    const error: ErrorV1['error'] = { code: err.code, message: err.message };
    if (err.retryAfterSeconds !== undefined) error.retryAfterSeconds = err.retryAfterSeconds;
    return errorResponse(c, err.status as ContentfulStatusCode, error);
  }
  if (err instanceof HTTPException) {
    const status = err.status;
    return errorResponse(c, status, { code: codeForStatus(status), message: 'Pedido inválido' });
  }
  console.error(JSON.stringify({ event: 'unhandled_error', name: err.name }));
  return errorResponse(c, 500, { code: 'internal', message: 'Error interno' });
};

export const notFound: NotFoundHandler = (c) =>
  errorResponse(c, 404, { code: 'not_found', message: 'Recurso inexistente' });
