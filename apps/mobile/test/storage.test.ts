import { createMMKV } from 'react-native-mmkv';

import { MemoryKeyValueStore, MmkvKeyValueStore } from '@/shared/storage/kv';
import {
  QUERY_CACHE_KEY,
  createQueryPersister,
  toAsyncStorage,
} from '@/shared/storage/queryPersister';

describe('KeyValueStore', () => {
  it.each([
    ['MemoryKeyValueStore', () => new MemoryKeyValueStore()],
    // En Jest, createMMKV() devuelve el mock en memoria de react-native-mmkv 4.
    ['MmkvKeyValueStore (mock oficial)', () => new MmkvKeyValueStore(createMMKV({ id: 'test' }))],
  ])('%s: set, getString, remove y onChange', (_name, create) => {
    const store = create();
    const changes: string[] = [];
    const off = store.onChange((key) => changes.push(key));

    expect(store.getString('k')).toBeUndefined();
    store.set('k', 'v');
    expect(store.getString('k')).toBe('v');
    store.remove('k');
    expect(store.getString('k')).toBeUndefined();
    expect(changes).toEqual(['k', 'k']);

    off();
    store.set('k', 'otra');
    expect(changes).toHaveLength(2);
  });
});

describe('persister de TanStack Query', () => {
  it('el adaptador devuelve null cuando no hay dato', () => {
    const storage = toAsyncStorage(new MemoryKeyValueStore());
    expect(storage.getItem('nada')).toBeNull();
    storage.setItem('a', '1');
    expect(storage.getItem('a')).toBe('1');
    storage.removeItem('a');
    expect(storage.getItem('a')).toBeNull();
  });

  it('guarda y restaura el cliente con la clave versionada', async () => {
    const store = new MemoryKeyValueStore();
    const persister = createQueryPersister(store);
    const client = {
      timestamp: 1,
      buster: '',
      clientState: { mutations: [], queries: [] },
    };
    await persister.persistClient(client);
    // throttleTime de 1 s: la escritura llega al cerrar la ventana.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(store.getString(QUERY_CACHE_KEY)).toBeDefined();
    await expect(persister.restoreClient()).resolves.toEqual(client);
    await persister.removeClient();
    expect(store.getString(QUERY_CACHE_KEY)).toBeUndefined();
  });
});
