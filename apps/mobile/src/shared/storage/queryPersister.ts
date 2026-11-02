// Persister de la caché de TanStack Query sobre el `KeyValueStore` (tarea 3.10; el `QueryClient`
// lo arma la tarea 3.9). Se usa `@tanstack/query-async-storage-persister` porque
// `createSyncStoragePersister` está deprecado (`docs/versiones.md`, decisión 5): su `storage`
// acepta métodos síncronos, así que MMKV entra directo sin promesas.
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';

import { getDefaultKeyValueStore, type KeyValueStore } from './kv';

/** Clave versionada: si cambia el formato de la caché, se sube la versión y la vieja se ignora. */
export const QUERY_CACHE_KEY = 'transportate.query-cache.v1';
/** Como mucho una escritura por segundo (los feeds se refrescan cada ~20 s). */
export const QUERY_CACHE_THROTTLE_MS = 1000;

/** Adaptador `KeyValueStore` → la interfaz tipo AsyncStorage (`getItem` da `null` si no hay dato). */
export function toAsyncStorage(store: KeyValueStore) {
  return {
    getItem: (key: string): string | null => store.getString(key) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(key, value);
    },
    removeItem: (key: string): void => {
      store.remove(key);
    },
  };
}

export function createQueryPersister(store: KeyValueStore = getDefaultKeyValueStore()): Persister {
  return createAsyncStoragePersister({
    storage: toAsyncStorage(store),
    key: QUERY_CACHE_KEY,
    throttleTime: QUERY_CACHE_THROTTLE_MS,
  });
}
