// URLs upstream (sin credenciales: las agrega la fuente al hacer el fetch) y armado de `meta`.
import type { MetaV1 } from '@transportate/contracts';
import type { FeedResult } from './types';

export const UPSTREAM_BASE = 'https://apitransporte.buenosaires.gob.ar';

/**
 * URL upstream sin credenciales. `base` puede traer un path (`https://ariedro.dev/api-trenes`):
 * `path` se agrega a continuación, no lo reemplaza.
 */
export function upstreamUrl(
  path: string,
  params: Record<string, string> = {},
  base: string = UPSTREAM_BASE,
): URL {
  const b = new URL(base);
  const url = new URL(`${b.pathname.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`, b.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

/** `ttlSeconds` de `env.FEED_TTL_SECONDS` (string en wrangler.jsonc), con default 20. */
export function feedTtl(raw: string | undefined, fallback = 20): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

export interface MetaInput {
  now: number;
  ttlSeconds: number;
  /** Timestamp del dato upstream en ms (no el de la respuesta), o `null` si no se conoce. */
  sourceTimestampMs: number | null;
  /** Resultado(s) de la fuente: `stale` si alguno lo es. */
  results?: readonly Pick<FeedResult, 'stale'>[];
  /** Fuerza `stale` (por ejemplo, dato upstream congelado o una línea que falló). */
  stale?: boolean;
}

export function buildMeta(i: MetaInput): MetaV1 {
  const age =
    i.sourceTimestampMs === null
      ? null
      : Math.max(0, Math.round((i.now - i.sourceTimestampMs) / 1000));
  return {
    generatedAt: new Date(i.now).toISOString(),
    sourceTimestamp:
      i.sourceTimestampMs === null ? null : new Date(i.sourceTimestampMs).toISOString(),
    ttlSeconds: i.ttlSeconds,
    stale: Boolean(i.stale) || (i.results ?? []).some((r) => r.stale),
    ageSeconds: age,
  };
}
