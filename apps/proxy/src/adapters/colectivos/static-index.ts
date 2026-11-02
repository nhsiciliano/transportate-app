// Índice estático de colectivos desde el paquete de tools/gtfs en R2 (`latest/manifest.json` →
// `<version>/<archivo>`). Solo lectura.
//
// - CPU (plan Free = 10 ms por request): el índice completo (paradas.json + equivalencias +
//   líneas, validados con Zod) costaba ~27 ms en frío en workerd. Ahora el proxy usa
//   `indice-colectivos.json` (compacto, generado por tools/gtfs) y `lineas-colectivos.json`, y en
//   runtime NO valida con Zod: JSON.parse + chequeo estructural mínimo. La validación completa
//   contra los contratos la hace tools/gtfs al generar el paquete (sha256 en el manifiesto).
//   Cifras antes/después: src/adapters/README.md.
// - Regla de workerd (src/cache/README.md): a nivel de módulo se guardan solo DATOS ya parseados,
//   nunca promesas de I/O de otra request. Dos requests concurrentes en frío cargan cada una lo
//   suyo (duplicado solo en frío).
import type {
  IndiceColectivosArchivoV1,
  LineaColectivoEstaticaV1,
  LineasColectivoArchivoV1,
  ManifestV1,
} from '@transportate/contracts';
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
      // loadManifest ya valida con ManifestV1 (archivo chico).
      const r = await notFoundToNull(
        loadManifest(bucket, `${INTERNAL_ORIGIN}/v1/static/manifest`, ctx),
      );
      return r ? (JSON.parse(decoder.decode(r.body)) as ManifestV1) : null;
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
}

export interface ParadaIndexada {
  /** `stop_id` del tiempo real que apuntan a esta parada (equivalencias). */
  stopIds: string[];
  /** `lineaId` que la sirven, vía los números de línea del dataset BA (intercalados por número). */
  lineaIds: string[];
}

export interface ParadasIndex {
  /** `paradaId` → stopIds y lineaIds (se resuelve al pedirla, no al cargar). */
  get(paradaId: string): ParadaIndexada | undefined;
  /** `stop_id` → `paradaId`. */
  paradaDeStop: Map<string, string>;
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
  for (let i = 0; i < max; i++) {
    for (const l of lists) {
      const v = l[i];
      if (v !== undefined) out.push(v);
    }
  }
  return out;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const invalid = (): ApiError =>
  new ApiError('upstream_unavailable', 'Datos estáticos inválidos', 503);

/** Chequeo estructural mínimo de `lineas-colectivos.json` (sin Zod: ver encabezado). */
export function parseLineas(text: string): LineasColectivoArchivoV1 {
  const j: unknown = JSON.parse(text);
  if (!isRecord(j) || j.version !== 1 || !Array.isArray(j.lineas)) throw invalid();
  return j as LineasColectivoArchivoV1;
}

/** Chequeo estructural mínimo de `indice-colectivos.json` (sin Zod: ver encabezado). */
export function parseIndice(text: string): IndiceColectivosArchivoV1 {
  const j: unknown = JSON.parse(text);
  if (!isRecord(j) || j.version !== 1 || !isRecord(j.paradas) || !isRecord(j.lineasPorNumero)) {
    throw invalid();
  }
  return j as IndiceColectivosArchivoV1;
}

export function buildLineasIndex(file: LineasColectivoArchivoV1): LineasIndex {
  const idx: LineasIndex = { porId: new Map(), porNumeroEmpresa: new Map() };
  for (const l of file.lineas) {
    idx.porId.set(l.lineaId, l);
    if (l.numero !== null)
      push(idx.porNumeroEmpresa, `${l.numero}|${normEmpresa(l.empresa)}`, l.lineaId);
  }
  return idx;
}

export function buildParadasIndex(file: IndiceColectivosArchivoV1): ParadasIndex {
  const paradaDeStop = new Map<string, string>();
  for (const [paradaId, [stopIds]] of Object.entries(file.paradas)) {
    for (const s of stopIds) paradaDeStop.set(s, paradaId);
  }
  return {
    paradaDeStop,
    get(paradaId) {
      const p = Object.hasOwn(file.paradas, paradaId) ? file.paradas[paradaId] : undefined;
      if (!p) return undefined;
      const [stopIds, numeros] = p;
      const lineaIds = interleave(numeros.map((n) => file.lineasPorNumero[String(n)] ?? []));
      return { stopIds, lineaIds };
    },
  };
}

export interface StaticSnapshot {
  version: string;
  generatedAt: string;
  lineas(): Promise<LineasIndex>;
  paradas(): Promise<ParadasIndex>;
}

interface Loaded {
  version: string;
  generatedAt: string;
  manifest: ManifestV1;
  checkedAt: number;
  lineas?: LineasIndex;
  paradas?: ParadasIndex;
}

// Estado por isolate: SOLO datos ya parseados (nunca promesas de I/O de otra request).
let current: Loaded | null = null;

/** Solo para tests. */
export function resetStaticIndex(): void {
  current = null;
}

async function readText(
  store: StaticStore,
  manifest: ManifestV1,
  archivo: string,
): Promise<string> {
  const key = manifest.archivos[archivo]?.url ?? `${manifest.version}/${archivo}`;
  const text = await store.file(key);
  if (text === null) throw new ApiError('upstream_unavailable', 'Datos estáticos incompletos', 503);
  return text;
}

/**
 * Snapshot del paquete vigente. Revisa el manifiesto como máximo cada `ttlSeconds`; si cambió la
 * versión, descarta los índices anteriores. Cada archivo se carga recién cuando hace falta.
 */
export async function getStaticSnapshot(
  store: StaticStore,
  ttlSeconds: number,
  now: number,
): Promise<StaticSnapshot> {
  if (!current || now - current.checkedAt >= ttlSeconds * 1000) {
    const manifest = await store.manifest();
    if (!manifest) throw new ApiError('upstream_unavailable', 'Datos estáticos no cargados', 503);
    current =
      current?.version === manifest.version
        ? { ...current, checkedAt: now }
        : {
            version: manifest.version,
            generatedAt: manifest.generatedAt,
            manifest,
            checkedAt: now,
          };
  }
  const loaded = current;
  return {
    version: loaded.version,
    generatedAt: loaded.generatedAt,
    async lineas() {
      if (loaded.lineas) return loaded.lineas;
      const idx = buildLineasIndex(
        parseLineas(await readText(store, loaded.manifest, 'lineas-colectivos.json')),
      );
      loaded.lineas = idx;
      return idx;
    },
    async paradas() {
      if (loaded.paradas) return loaded.paradas;
      const idx = buildParadasIndex(
        parseIndice(await readText(store, loaded.manifest, 'indice-colectivos.json')),
      );
      loaded.paradas = idx;
      return idx;
    },
  };
}
