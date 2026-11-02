// Intervalo de refresco elegido por la persona (S17: 15, 20, 30 o 60 s; default 20 s). Mismo
// patrón que la preferencia de tema: un store inyectable (Ajustes lo implementa sobre el
// `KeyValueStore`), en memoria por defecto, leído con `useSyncExternalStore`.
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export const REFRESH_INTERVALS = [15, 20, 30, 60] as const;
export type RefreshIntervalSeconds = (typeof REFRESH_INTERVALS)[number];
export const DEFAULT_REFRESH_INTERVAL: RefreshIntervalSeconds = 20;

export function isRefreshInterval(value: unknown): value is RefreshIntervalSeconds {
  return REFRESH_INTERVALS.some((v) => v === value);
}

export interface RefreshIntervalStore {
  get(): RefreshIntervalSeconds;
  set(seconds: RefreshIntervalSeconds): void;
  /** Avisa cambios hechos desde afuera. Devuelve la desuscripción. */
  subscribe?(listener: () => void): () => void;
}

export function createMemoryRefreshIntervalStore(
  initial: RefreshIntervalSeconds = DEFAULT_REFRESH_INTERVAL,
): RefreshIntervalStore {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

interface RefreshIntervalValue {
  seconds: RefreshIntervalSeconds;
  setSeconds(seconds: RefreshIntervalSeconds): void;
}

const RefreshIntervalContext = createContext<RefreshIntervalValue | null>(null);

/** Igual que en ThemeProvider: notifica los `set` propios aunque el store no tenga `subscribe`. */
function observable(store: RefreshIntervalStore) {
  const listeners = new Set<() => void>();
  return {
    get: () => store.get(),
    set: (next: RefreshIntervalSeconds) => {
      store.set(next);
      for (const l of listeners) l();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      const off = store.subscribe?.(listener);
      return () => {
        listeners.delete(listener);
        off?.();
      };
    },
  };
}

export function RefreshIntervalProvider({
  children,
  store,
}: {
  children: ReactNode;
  store?: RefreshIntervalStore;
}) {
  const [fallback] = useState(() => createMemoryRefreshIntervalStore());
  const obs = useMemo(() => observable(store ?? fallback), [store, fallback]);
  const seconds = useSyncExternalStore(obs.subscribe, obs.get, obs.get);
  const value = useMemo(() => ({ seconds, setSeconds: obs.set }), [seconds, obs]);
  return (
    <RefreshIntervalContext.Provider value={value}>{children}</RefreshIntervalContext.Provider>
  );
}

/** Intervalo vigente; fuera de un provider, el default (20 s). */
export function useRefreshInterval(): RefreshIntervalValue {
  return (
    useContext(RefreshIntervalContext) ?? {
      seconds: DEFAULT_REFRESH_INTERVAL,
      setSeconds: () => undefined,
    }
  );
}
