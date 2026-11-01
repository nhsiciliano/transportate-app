import { z } from 'zod';
import { ApiError } from '../adapters/types';

/** Ids de estación, parada o línea: alfanuméricos, guion y guion bajo, hasta 64 caracteres. */
export const IdParam = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Valida un parámetro de ruta; si no cumple, responde 400 `bad_request` vía `onError`. */
export function parseParam(
  schema: z.ZodType<string>,
  value: string | undefined,
  name: string,
): string {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError('bad_request', `Parámetro inválido: ${name}`, 400);
  }
  return result.data;
}
