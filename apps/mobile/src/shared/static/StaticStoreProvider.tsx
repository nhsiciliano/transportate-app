// Stores del estático por contexto: la "última versión conocida" de los archivos chicos y el
// administrador de archivos grandes. En la app, MMKV + descarga por XHR (defaults); en los tests,
// `createLastKnownStore(new MemoryKeyValueStore())` y un `LargeFileManager` con un descargador
// falso.
import { createContext, useContext, type ReactNode } from 'react';

import { getDefaultKeyValueStore } from '../storage/kv';
import { createXhrDownloader } from './downloader';
import { LargeFileManager } from './largeFiles';
import { createLastKnownStore, type LastKnownStore } from './lastKnown';

const StaticStoreContext = createContext<LastKnownStore | null>(null);
const LargeFilesContext = createContext<LargeFileManager | null>(null);

let defaultStore: LastKnownStore | undefined;
let defaultLargeFiles: LargeFileManager | undefined;

/** El de la app, sobre la instancia MMKV compartida (se crea al primer uso). */
export function getDefaultLastKnownStore(): LastKnownStore {
  defaultStore ??= createLastKnownStore(getDefaultKeyValueStore());
  return defaultStore;
}

/** El de la app: MMKV + `XMLHttpRequest` contra el proxy. */
export function getDefaultLargeFileManager(): LargeFileManager {
  defaultLargeFiles ??= new LargeFileManager(getDefaultKeyValueStore(), createXhrDownloader());
  return defaultLargeFiles;
}

export function StaticStoreProvider({
  store,
  largeFiles,
  children,
}: {
  store?: LastKnownStore;
  largeFiles?: LargeFileManager;
  children: ReactNode;
}) {
  const inner =
    largeFiles === undefined ? (
      children
    ) : (
      <LargeFilesContext.Provider value={largeFiles}>{children}</LargeFilesContext.Provider>
    );
  return store === undefined ? (
    inner
  ) : (
    <StaticStoreContext.Provider value={store}>{inner}</StaticStoreContext.Provider>
  );
}

/** Sin provider, el de la app (igual que `useApiClient`). */
export function useLastKnownStore(): LastKnownStore {
  return useContext(StaticStoreContext) ?? getDefaultLastKnownStore();
}

export function useLargeFileManager(): LargeFileManager {
  return useContext(LargeFilesContext) ?? getDefaultLargeFileManager();
}
