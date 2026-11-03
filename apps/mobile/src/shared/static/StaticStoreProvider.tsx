// Store de la "última versión conocida" por contexto: en la app, MMKV (default); en los tests,
// `createLastKnownStore(new MemoryKeyValueStore())`.
import { createContext, useContext, type ReactNode } from 'react';

import { getDefaultKeyValueStore } from '../storage/kv';
import { createLastKnownStore, type LastKnownStore } from './lastKnown';

const StaticStoreContext = createContext<LastKnownStore | null>(null);

let defaultStore: LastKnownStore | undefined;

/** El de la app, sobre la instancia MMKV compartida (se crea al primer uso). */
export function getDefaultLastKnownStore(): LastKnownStore {
  defaultStore ??= createLastKnownStore(getDefaultKeyValueStore());
  return defaultStore;
}

export function StaticStoreProvider({
  store,
  children,
}: {
  store: LastKnownStore;
  children: ReactNode;
}) {
  return <StaticStoreContext.Provider value={store}>{children}</StaticStoreContext.Provider>;
}

/** Sin provider, el de la app (igual que `useApiClient`). */
export function useLastKnownStore(): LastKnownStore {
  return useContext(StaticStoreContext) ?? getDefaultLastKnownStore();
}
