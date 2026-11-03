// Líneas recientes de Colectivos (F4-colectivos-5): las últimas 5 abiertas, en MMKV con Zod.
// No es un dato personal sensible, pero tampoco sale del teléfono (docs/05-privacidad.md).
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { z } from 'zod';

import { getDefaultKeyValueStore, type KeyValueStore } from '@/shared/storage/kv';

export const RECIENTES_KEY = 'transportate.colectivos.recientes.v1';
export const MAX_RECIENTES = 5;

const RecienteSchema = z.object({
  lineaId: z.string().min(1),
  linea: z.string().min(1),
  numero: z.string().min(1),
  descripcion: z.string(),
});
export type Reciente = z.infer<typeof RecienteSchema>;
const RecientesSchema = z.array(RecienteSchema).max(MAX_RECIENTES);

export interface RecientesStore {
  list(): readonly Reciente[];
  /** La pone primera; si ya estaba, la mueve. */
  add(r: Reciente): void;
  subscribe(cb: () => void): () => void;
}

export function createRecientesStore(kv: KeyValueStore): RecientesStore {
  const listeners = new Set<() => void>();
  let raw: string | undefined;
  let cache: readonly Reciente[] = [];
  const read = (): readonly Reciente[] => {
    const now = kv.getString(RECIENTES_KEY);
    if (now === raw) return cache;
    raw = now;
    try {
      const r = RecientesSchema.safeParse(now === undefined ? [] : JSON.parse(now));
      cache = r.success ? r.data : [];
    } catch {
      cache = [];
    }
    return cache;
  };
  return {
    list: read,
    add(r) {
      const next = [r, ...read().filter((x) => x.lineaId !== r.lineaId)].slice(0, MAX_RECIENTES);
      kv.set(RECIENTES_KEY, JSON.stringify(next));
      for (const l of listeners) l();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

let defaultStore: RecientesStore | undefined;
export function getDefaultRecientesStore(): RecientesStore {
  defaultStore ??= createRecientesStore(getDefaultKeyValueStore());
  return defaultStore;
}

const RecientesContext = createContext<RecientesStore | null>(null);

/** Para los tests (store en memoria); sin provider, el de la app (MMKV). */
export function RecientesProvider({
  store,
  children,
}: {
  store: RecientesStore;
  children: ReactNode;
}) {
  return <RecientesContext.Provider value={store}>{children}</RecientesContext.Provider>;
}

export function useRecientes() {
  const s = useContext(RecientesContext) ?? getDefaultRecientesStore();
  const list = useSyncExternalStore(
    (cb) => s.subscribe(cb),
    () => s.list(),
  );
  return {
    recientes: list,
    add: (r: Reciente) => {
      s.add(r);
    },
  };
}
