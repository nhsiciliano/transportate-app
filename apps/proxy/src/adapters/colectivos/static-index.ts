// Índice estático de colectivos: líneas, paradas y equivalencias stop_id → parada del paquete de
// tools/gtfs en R2 (`latest/manifest.json` → `<version>/<archivo>`). Solo lectura.
//
// - Se cachea en memoria del isolate por `version` y el manifiesto se revisa como máximo cada
//   `STATIC_TTL_SECONDS`.
// - Cada archivo se carga recién cuando hace falta: `lineas()` y `posiciones()` no pagan el parseo
//   de paradas.json (1,7 MB), que solo usa `arribos()`. Importa por el límite de CPU del plan Free
//   (docs/04-escalabilidad.md §9): el primer request de cada isolate paga el parseo una vez.
import {
  EquivalenciasArchivoV1,
  LineasColectivoArchivoV1,
  ManifestV1,
  ParadasArchivoV1,
  type LineaColectivoEstaticaV1,
  type ParadaV1,
} from '@transportate/contracts';
import type { z } from 'zod';
import { contentTypeFor, loadFile, loadManifest } from '../../static/r2';
import { ApiError } from '../types';

/** Acceso de solo lectura al paquete estático (R2 en producción, falso en tests). */
export interface StaticStore {
  manifest(): Promise<ManifestV1 | null>;
  /** Texto de `<version>/<archivo>`, o `null` si no existe. */
  file(key: string): Promise<string | null>;
}

/** Origen ficticio para las claves de Cache API de los helpers de src/static/r2.ts. */
const INTERNAL_ORIGIN = 'https://static.transportate.internal';

const decoder = new TextDecoder();

/** StaticStore sobre el bucket `STATIC`, reutilizando loadManifest/loadFile (Cache API delante). */
export function r2Store(bucket: R2Bucket, ctx?: ExecutionContext): StaticStore {
  const notFoundToNull = async <T>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  };
  return {
    async manifest() {
      const r = await notFoundToNull(
        loadManifest(bucket, `${INTERNAL_ORIGIN}/v1/static/manifest`, ctx),
      );
      return r ? ManifestV1.parse(JSON.parse(decoder.decode(r.body))) : null;
    },
    async file(key) {
      const ct = contentTypeFor(key) ?? 'application/json; charset=utf-8';
      const r = await notFoundToNull(
        loadFile(bucket, key, ct, `${INTERNAL_ORIGIN}/v1/static/${key}`, ctx),
      );
      return r ? decoder.decode(r.body) : null;
    },
  };
}

export interface LineasIndex {
  /** `lineaId` (= `route_id` del tiempo real) → línea. */
  porId: Map<string, LineaColectivoEstaticaV1>;
  /** `numero|empresa normalizada` → lineaIds (para unir por nombre, nunca por route_id 2021). */
  porNumeroEmpresa: Map<string, string[]>;
  /** número → lineaIds con vehículos en CABA (para las líneas de una parada BA). */
  porNumeroCaba: Map<number, string[]>;
}

export interface ParadaIndexada {
  parada: ParadaV1;
  /** `stop_id` del tiempo real que apuntan a esta parada (inversa de las equivalencias). */
  stopIds: string[];
  /** `lineaId` que la sirven, vía el número de línea del dataset BA (intercalados por número). */
  lineaIds: string[];
}

export interface StaticSnapshot {
  version: string;
  generatedAt: string;
  lineas(): Promise<LineasIndex>;
  /** `stop_id` → `paradaId`. */
  equivalencias(): Promise<Map<string, string>>;
  paradas(): Promise<Map<string, ParadaIndexada>>;
}

export const normEmpresa = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

function push<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}

/** Intercala listas (round-robin) para que una línea con muchos ramales no acapare el tope. */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) out.push(l[i] as T);
  return out;
}

async function readJson<S extends z.ZodType>(
  store: StaticStore,
  manifest: ManifestV1,
  archivo: string,
  schema: S,
): Promise<z.infer<S>> {
  const key = manifest.archivos[archivo]?.url ?? `${manifest.version}/${archivo}`;
  const text = await store.file(key);
  if (text === null) throw new ApiError('upstream_unavailable', 'Datos estáticos incompletos', 503);
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new ApiError('upstream_unavailable', 'Datos estáticos inválidos', 503);
  return parsed.data;
}

function buildSnapshot(store: StaticStore, manifest: ManifestV1): StaticSnapshot {
  // Memoiza la promesa; si falla, se descarta para reintentar en el próximo request.
  const lazy = <T>(load: () => Promise<T>): (() => Promise<T>) => {
    let p: Promise<T> | null = null;
    return () => {
      p ??= load().catch((err: unknown) => {
        p = null;
        throw err;
      });
      return p;
    };
  };

  const lineas = lazy(async (): Promise<LineasIndex> => {
    const file = await readJson(
      store,
      manifest,
      'lineas-colectivos.json',
      LineasColectivoArchivoV1,
    );
    const idx: LineasIndex = {
      porId: new Map(),
      porNumeroEmpresa: new Map(),
      porNumeroCaba: new Map(),
    };
    for (const l of file.lineas) {
      idx.porId.set(l.lineaId, l);
      if (l.numero === null) continue;
      push(idx.porNumeroEmpresa, `${l.numero}|${normEmpresa(l.empresa)}`, l.lineaId);
      if (l.enCaba) push(idx.porNumeroCaba, l.numero, l.lineaId);
    }
    return idx;
  });

  const equivalenciasArchivo = lazy(() =>
    readJson(store, manifest, 'equivalencias-paradas.json', EquivalenciasArchivoV1),
  );

  const equivalencias = lazy(async () => {
    const file = await equivalenciasArchivo();
    return new Map(file.equivalencias.map((e) => [e.stopId, e.paradaId]));
  });

  const paradas = lazy(async (): Promise<Map<string, ParadaIndexada>> => {
    const [file, eq, li] = await Promise.all([
      readJson(store, manifest, 'paradas.json', ParadasArchivoV1),
      equivalenciasArchivo(),
      lineas(),
    ]);
    const stopsByParada = new Map<string, string[]>();
    for (const e of eq.equivalencias) push(stopsByParada, e.paradaId, e.stopId);
    const out = new Map<string, ParadaIndexada>();
    for (const p of file.paradas) {
      const numeros = [
        ...new Set(p.lineas.map((l) => l.numero).filter((x): x is number => x !== null)),
      ];
      const lineaIds = interleave(numeros.map((n) => [...(li.porNumeroCaba.get(n) ?? [])].sort()));
      out.set(p.id, { parada: p, stopIds: (stopsByParada.get(p.id) ?? []).sort(), lineaIds });
    }
    return out;
  });

  return {
    version: manifest.version,
    generatedAt: manifest.generatedAt,
    lineas,
    equivalencias,
    paradas,
  };
}

// Cache por isolate: una sola versión vigente.
let current: { snapshot: StaticSnapshot; checkedAt: number } | null = null;

/** Solo para tests. */
export function resetStaticIndex(): void {
  current = null;
}

/**
 * Snapshot del paquete vigente. Revisa el manifiesto como máximo cada `ttlSeconds`; si cambió
 * la versión, descarta los índices anteriores.
 */
export async function getStaticSnapshot(
  store: StaticStore,
  ttlSeconds: number,
  now: number,
): Promise<StaticSnapshot> {
  if (current && now - current.checkedAt < ttlSeconds * 1000) return current.snapshot;
  const manifest = await store.manifest();
  if (!manifest) throw new ApiError('upstream_unavailable', 'Datos estáticos no cargados', 503);
  if (current?.snapshot.version === manifest.version) {
    current = { snapshot: current.snapshot, checkedAt: now };
  } else {
    current = { snapshot: buildSnapshot(store, manifest), checkedAt: now };
  }
  return current.snapshot;
}
