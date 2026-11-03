import { MemoryKeyValueStore } from '@/shared/storage/kv';
import { clearPersistedQueryCache, QUERY_CACHE_KEY } from '@/shared/storage/queryPersister';

describe('clearPersistedQueryCache', () => {
  it('borra solo la caché de consultas, no las demás claves', () => {
    const store = new MemoryKeyValueStore({
      [QUERY_CACHE_KEY]: '{"clientState":{}}',
      'transportate.favoritos.v1': '{"schemaVersion":1,"items":[]}',
      'transportate.pref.theme.v1': '"dark"',
    });
    clearPersistedQueryCache(store);
    expect(store.getString(QUERY_CACHE_KEY)).toBeUndefined();
    expect(store.getString('transportate.favoritos.v1')).toBeDefined();
    expect(store.getString('transportate.pref.theme.v1')).toBe('"dark"');
  });

  it('sin nada guardado no tira', () => {
    expect(() => {
      clearPersistedQueryCache(new MemoryKeyValueStore());
    }).not.toThrow();
  });
});
