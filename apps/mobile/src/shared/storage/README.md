# shared/storage

Persistencia local de la app. Nada de esto sale del teléfono (`docs/05-privacidad.md`).

| Archivo | Qué hay |
|---|---|
| `kv.ts` | Interfaz `KeyValueStore` (`getString`, `set`, `remove` y `onChange` opcional) con dos implementaciones: `MmkvKeyValueStore` (instancia MMKV `transportate`) y `MemoryKeyValueStore` (tests). `getDefaultKeyValueStore()` crea la instancia de la app la primera vez que se pide. |
| `queryPersister.ts` | `createQueryPersister(store?)`: persister de TanStack Query (`createAsyncStoragePersister`) con clave `transportate.query-cache.v1` y `throttleTime` de 1000 ms. El `QueryClient` lo arma la tarea 3.9. |
| `preferences.ts` | `createThemePreferenceStore(kv)` (`transportate.pref.theme.v1`, `system`/`light`/`dark`, default `system`) y `createRefreshIntervalStore(kv)` (`transportate.pref.refreshInterval.v1`, 15/20/30/60 s, default 20). Forma `PreferenceStore<T>` (`get`/`set`/`subscribe`), con validación Zod al leer y al escribir. |

- **MMKV 4** (`react-native-mmkv` 4.3.2 sobre `react-native-nitro-modules` 0.37.1). API: `createMMKV({ id })`, `getString`, `set`, `remove` y `addOnValueChangedListener`. Es síncrona: se puede leer al arrancar, sin pantallas de carga.
- **Sin cifrado:** solo guarda favoritos y la caché de datos públicos de transporte. El archivo queda protegido por el sandbox de cada sistema operativo.
- **Claves:** todas empiezan con `transportate.` y terminan en `.vN`. Si cambia el formato, se sube la versión: el dato viejo se ignora o se migra (ver `features/favoritos/migrations.ts`).
- **Persister asíncrono:** el síncrono (`createSyncStoragePersister`) está deprecado (`docs/versiones.md`, decisión 5). El asíncrono acepta un storage con métodos síncronos, así que MMKV entra directo, con `getItem` devolviendo `null` si no hay dato.
