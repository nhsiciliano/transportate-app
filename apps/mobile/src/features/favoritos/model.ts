// Modelo persistido de favoritos (tarea 3.10), validado con Zod 4 al leer de disco.
//
// Se guardan `nombre` y `subtitulo` además del `refId` porque los ids del upstream pueden cambiar
// (`docs/01-api-transporte.md`, riesgos): si un id deja de existir, el favorito se sigue
// mostrando con su nombre y la feature decide cómo avisarlo.
import { z } from 'zod';

export const FAVORITO_TIPOS = [
  'linea_colectivo',
  'parada_colectivo',
  'linea_subte',
  'estacion_subte',
  // Fase 6 (aditivo: `FAVORITOS_SCHEMA_VERSION` sigue en 1). En trenes se guarda el ramal o la
  // estación, nunca la línea (S37).
  'ramal_tren',
  'estacion_tren',
] as const;

/** Tope del alias (suposición S16 de `docs/briefs/README.md`). */
export const ALIAS_MAX_LENGTH = 30;

export const FavoritoTipoSchema = z.enum(FAVORITO_TIPOS);
export type FavoritoTipo = z.infer<typeof FavoritoTipoSchema>;

export const FavoritoV1Schema = z.object({
  /** `${tipo}:${refId}`: un mismo destino no se puede guardar dos veces. */
  id: z.string().min(1),
  tipo: FavoritoTipoSchema,
  /** Id del destino en el contrato v1 (línea, parada, estación o ramal de tren). */
  refId: z.string().min(1),
  nombre: z.string().min(1),
  subtitulo: z.string().optional(),
  /** Nombre propio que pone el usuario. No sale del teléfono (`docs/05-privacidad.md`). */
  alias: z.string().min(1).max(ALIAS_MAX_LENGTH).optional(),
  /** Posición en la lista (0 = primero). */
  orden: z.number().int().nonnegative(),
  creadoEn: z.iso.datetime(),
});
export type FavoritoV1 = z.infer<typeof FavoritoV1Schema>;

export const FAVORITOS_SCHEMA_VERSION = 1;

export const FavoritosDocV1Schema = z.object({
  schemaVersion: z.literal(FAVORITOS_SCHEMA_VERSION),
  items: z.array(FavoritoV1Schema),
});
export type FavoritosDocV1 = z.infer<typeof FavoritosDocV1Schema>;

/** Lo que pide `add()`: el resto (id, orden, creadoEn) lo completa el repositorio. */
export interface NuevoFavorito {
  tipo: FavoritoTipo;
  refId: string;
  nombre: string;
  subtitulo?: string;
  alias?: string;
}

export function favoritoId(tipo: FavoritoTipo, refId: string): string {
  return `${tipo}:${refId}`;
}
