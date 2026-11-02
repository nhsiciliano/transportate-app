// Repositorio de favoritos (tarea 3.10). La UI depende de la interfaz `FavoritosRepository`;
// la implementación guarda un único documento JSON versionado en un `KeyValueStore` (MMKV en la
// app, memoria en los tests). Cada operación hace UNA sola escritura (`set` del documento
// completo), así que nunca queda un estado a medio escribir.
import { getDefaultKeyValueStore, type KeyValueStore } from '@/shared/storage/kv';

import { favoritosMigrations, migrateFavoritosDoc, type Migrations } from './migrations';
import {
  ALIAS_MAX_LENGTH,
  FAVORITOS_SCHEMA_VERSION,
  FavoritosDocV1Schema,
  favoritoId,
  type FavoritosDocV1,
  type FavoritoTipo,
  type FavoritoV1,
  type NuevoFavorito,
} from './model';

export interface FavoritosRepository {
  /** Favoritos ordenados por `orden`. Devuelve la misma referencia mientras no haya cambios. */
  list(): readonly FavoritoV1[];
  get(id: string): FavoritoV1 | undefined;
  /** Agrega al final. Si ya existe (mismo tipo y refId), devuelve el existente sin duplicar. */
  add(input: NuevoFavorito): FavoritoV1;
  /** `null` o texto vacío quita el alias; si pasa de 30 caracteres, se trunca (S16). */
  setAlias(id: string, alias: string | null): FavoritoV1 | undefined;
  /** Reordena según `idsEnOrden`. Los ids desconocidos se ignoran; los que falten van al final. */
  reorder(idsEnOrden: readonly string[]): void;
  /** Quita y devuelve el favorito para poder ofrecer "Deshacer" (S19). */
  remove(id: string): FavoritoV1 | undefined;
  /** Vuelve a insertar un favorito quitado, en su posición original. */
  restore(fav: FavoritoV1): void;
  clear(): void;
  /** Avisa cada cambio (propio o de otra instancia sobre el mismo store). */
  subscribe(callback: () => void): () => void;
  has(tipo: FavoritoTipo, refId: string): boolean;
}

export const FAVORITOS_STORAGE_KEY = 'transportate.favoritos.v1';

export interface MmkvFavoritosRepositoryOptions {
  migrations?: Migrations;
  /** Reloj inyectable para `creadoEn` (tests). */
  now?: () => Date;
}

const EMPTY: readonly FavoritoV1[] = Object.freeze([]);

function devWarn(message: string): void {
  if (__DEV__) console.warn(`[favoritos] ${message}`);
}

/** Corta en puntos de código (no parte emojis ni letras con tilde compuestas por surrogates). */
function normalizeAlias(alias: string | null): string | undefined {
  const trimmed = alias?.trim() ?? '';
  if (trimmed === '') return undefined;
  return Array.from(trimmed).slice(0, ALIAS_MAX_LENGTH).join('').trim();
}

/** Renumera `orden` 0..n-1 respetando el orden del arreglo. */
function renumber(items: readonly FavoritoV1[]): FavoritoV1[] {
  return items.map((item, index) => (item.orden === index ? item : { ...item, orden: index }));
}

export class MmkvFavoritosRepository implements FavoritosRepository {
  private readonly migrations: Migrations;
  private readonly now: () => Date;
  private readonly listeners = new Set<() => void>();
  /** Último texto leído/escrito y su lista parseada: evita reparsear y estabiliza `list()`. */
  private cachedRaw: string | undefined;
  private cachedItems: readonly FavoritoV1[] = EMPTY;
  private hasCache = false;

  constructor(
    private readonly store: KeyValueStore,
    options: MmkvFavoritosRepositoryOptions = {},
  ) {
    this.migrations = options.migrations ?? favoritosMigrations;
    this.now = options.now ?? (() => new Date());
  }

  list(): readonly FavoritoV1[] {
    const raw = this.store.getString(FAVORITOS_STORAGE_KEY);
    if (this.hasCache && raw === this.cachedRaw) return this.cachedItems;
    this.cachedRaw = raw;
    this.cachedItems = this.parse(raw);
    this.hasCache = true;
    return this.cachedItems;
  }

  get(id: string): FavoritoV1 | undefined {
    return this.list().find((item) => item.id === id);
  }

  has(tipo: FavoritoTipo, refId: string): boolean {
    return this.get(favoritoId(tipo, refId)) !== undefined;
  }

  add(input: NuevoFavorito): FavoritoV1 {
    const id = favoritoId(input.tipo, input.refId);
    const items = this.list();
    const existing = items.find((item) => item.id === id);
    if (existing) return existing;
    const alias = normalizeAlias(input.alias ?? null);
    const created: FavoritoV1 = {
      id,
      tipo: input.tipo,
      refId: input.refId,
      nombre: input.nombre,
      ...(input.subtitulo !== undefined ? { subtitulo: input.subtitulo } : {}),
      ...(alias !== undefined ? { alias } : {}),
      orden: items.length,
      creadoEn: this.now().toISOString(),
    };
    this.write([...items, created]);
    return created;
  }

  setAlias(id: string, alias: string | null): FavoritoV1 | undefined {
    const items = this.list();
    const current = items.find((item) => item.id === id);
    if (!current) return undefined;
    const normalized = normalizeAlias(alias);
    if (normalized === current.alias) return current;
    const updated: FavoritoV1 = { ...current };
    if (normalized === undefined) delete updated.alias;
    else updated.alias = normalized;
    this.write(items.map((item) => (item.id === id ? updated : item)));
    return updated;
  }

  reorder(idsEnOrden: readonly string[]): void {
    const items = this.list();
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered: FavoritoV1[] = [];
    for (const id of idsEnOrden) {
      const item = byId.get(id);
      if (item) {
        ordered.push(item);
        byId.delete(id);
      }
    }
    // Los que no vinieron en `idsEnOrden` quedan al final, en su orden actual.
    ordered.push(...items.filter((item) => byId.has(item.id)));
    this.write(ordered);
  }

  remove(id: string): FavoritoV1 | undefined {
    const items = this.list();
    const removed = items.find((item) => item.id === id);
    if (!removed) return undefined;
    this.write(items.filter((item) => item.id !== id));
    return removed;
  }

  restore(fav: FavoritoV1): void {
    const items = this.list();
    if (items.some((item) => item.id === fav.id)) return;
    const position = Math.min(fav.orden, items.length);
    this.write([...items.slice(0, position), fav, ...items.slice(position)]);
  }

  clear(): void {
    if (this.list().length === 0) return;
    this.write([]);
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    // Cambios hechos por otra instancia sobre el mismo store (si el store lo soporta).
    const off = this.store.onChange?.((key) => {
      if (key === FAVORITOS_STORAGE_KEY) callback();
    });
    return () => {
      this.listeners.delete(callback);
      off?.();
    };
  }

  private write(items: readonly FavoritoV1[]): void {
    const doc: FavoritosDocV1 = {
      schemaVersion: FAVORITOS_SCHEMA_VERSION,
      items: renumber(items),
    };
    const raw = JSON.stringify(doc);
    this.cachedRaw = raw;
    this.cachedItems = Object.freeze(doc.items);
    this.hasCache = true;
    this.store.set(FAVORITOS_STORAGE_KEY, raw);
    // Si el store avisa cambios, los suscriptores ya se enteraron por `onChange`.
    if (!this.store.onChange) for (const listener of this.listeners) listener();
  }

  private parse(raw: string | undefined): readonly FavoritoV1[] {
    if (raw === undefined) return EMPTY;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      devWarn('JSON corrupto: se empieza con la lista vacía.');
      return EMPTY;
    }
    const migrated = migrateFavoritosDoc(json, this.migrations);
    if (!migrated.ok) {
      devWarn(`documento no migrable (${migrated.reason}): se empieza con la lista vacía.`);
      return EMPTY;
    }
    const parsed = FavoritosDocV1Schema.safeParse(migrated.doc);
    if (!parsed.success) {
      devWarn('documento inválido: se empieza con la lista vacía.');
      return EMPTY;
    }
    const sorted = [...parsed.data.items].sort((a, b) => a.orden - b.orden);
    return Object.freeze(sorted);
  }
}

let defaultRepository: FavoritosRepository | undefined;

/** Repositorio de la app sobre la instancia MMKV `transportate`, creado a demanda. */
export function getDefaultFavoritosRepository(): FavoritosRepository {
  defaultRepository ??= new MmkvFavoritosRepository(getDefaultKeyValueStore());
  return defaultRepository;
}
