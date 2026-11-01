import { z } from 'zod';

/** Fecha-hora ISO 8601 (con `Z` u offset, por ejemplo `-03:00`). */
export const IsoDateTime = z.iso.datetime({ offset: true });

/** Metadatos de frescura que acompañan a toda respuesta de datos. */
export const MetaV1 = z.object({
  /** Cuándo el proxy armó la respuesta. */
  generatedAt: IsoDateTime,
  /** Timestamp del dato upstream (por ejemplo `max(vehicle.timestamp)`), o `null` si no se conoce. */
  sourceTimestamp: IsoDateTime.nullable(),
  /** Segundos que la respuesta puede reutilizarse. */
  ttlSeconds: z.number().int().nonnegative(),
  /** `true` si el proxy sirvió el último dato bueno porque el upstream falló. */
  stale: z.boolean(),
  /** Edad del dato upstream (segundos) al momento de generar la respuesta. */
  ageSeconds: z.number().nonnegative().nullable(),
});
export type MetaV1 = z.infer<typeof MetaV1>;

/** Sobre genérico `{ meta, data }`. */
export function envelope<T extends z.ZodType>(data: T) {
  return z.object({ meta: MetaV1, data });
}
export interface EnvelopeV1<T> {
  meta: MetaV1;
  data: T;
}

export const ErrorCodeV1 = z.enum([
  'upstream_unavailable',
  'not_found',
  'bad_request',
  'rate_limited',
  'internal',
]);
export type ErrorCodeV1 = z.infer<typeof ErrorCodeV1>;

/** Sobre de error. Nunca incluye stack ni URLs upstream. */
export const ErrorV1 = z.object({
  error: z.object({
    code: ErrorCodeV1,
    message: z.string(),
    retryAfterSeconds: z.number().int().nonnegative().optional(),
  }),
});
export type ErrorV1 = z.infer<typeof ErrorV1>;

/** Respuesta de `GET /v1/health`. */
export const HealthV1 = z.object({
  ok: z.literal(true),
  version: z.string(),
  environment: z.string(),
});
export type HealthV1 = z.infer<typeof HealthV1>;

/** Color hexadecimal `#RRGGBB`. */
export const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
