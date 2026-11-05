// Lo único (junto con packages/contracts/src/upstream/sofse.ts) que conoce las URLs y los
// formatos de la fuente de trenes: la API comunitaria https://ariedro.dev/api-trenes, que reenvía
// a la API interna de SOFSE. Cambiar de fuente = reemplazar estos dos archivos y la var
// `TRENES_UPSTREAM_BASE`. Supuestos verificados con las fixtures: README.md de esta carpeta.
import type { FeedResult } from '../../sources/types';
import { upstreamUrl } from '../../sources/upstream';
import { ApiError } from '../types';

/** Base por defecto si `TRENES_UPSTREAM_BASE` no está definida. */
export const SOFSE_BASE_DEFAULT = 'https://ariedro.dev/api-trenes';

/** Empresa de los trenes metropolitanos en `/infraestructura/gerencias`. */
const ID_EMPRESA = '1';

/** URLs de la fuente sobre `base` (puede traer path). */
export function urls(base: string) {
  return {
    gerencias: (): URL =>
      upstreamUrl('/infraestructura/gerencias', { idEmpresa: ID_EMPRESA }, base),
    ramales: (idGerencia: number): URL =>
      upstreamUrl('/infraestructura/ramales', { idGerencia: String(idGerencia) }, base),
    arribos: (estacionId: string, cantidad: number): URL =>
      upstreamUrl(
        `/arribos/estacion/${encodeURIComponent(estacionId)}`,
        { cantidad: String(cantidad) },
        base,
      ),
  };
}

export const MENSAJE_INVALIDA = 'Respuesta inválida de la fuente de trenes';

export function decodeJson(result: FeedResult): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(result.body));
  } catch {
    throw new ApiError('upstream_unavailable', MENSAJE_INVALIDA, 503);
  }
}

const FECHA_SOFSE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * `vigencia_desde`/`vigencia_hasta` (`2026-10-24 12:01:00`, hora de Buenos Aires sin offset) →
 * epoch ms. Buenos Aires está en UTC−3 todo el año (sin horario de verano desde 2009).
 * `null` si no tiene esa forma.
 */
export function parseFechaSofse(s: string | null | undefined): number | null {
  const m = FECHA_SOFSE.exec((s ?? '').trim());
  if (!m) return null;
  const ms = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}-03:00`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * ISO de los arribos (`2026-11-05T12:10:00.000Z`) → epoch ms. Verificado con las fixtures: la `Z`
 * es real (UTC), porque `arribo.segundos` = hora − `timestamp`. Si alguna vez llega sin offset,
 * se interpreta como hora de Buenos Aires. `null` si no se puede leer.
 */
export function parseIsoArribo(s: string | null | undefined): number | null {
  const v = (s ?? '').trim();
  if (!v) return null;
  const conOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(v);
  const ms = Date.parse(conOffset ? v : `${v}-03:00`);
  return Number.isNaN(ms) ? null : ms;
}
