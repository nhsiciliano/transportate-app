# features/favoritos

Lógica de favoritos (tarea 3.10). Las pantallas llegan en la Fase 4, con las rutas en `src/app/(tabs)/favoritos/`. Todo se importa desde `@/features/favoritos`.

| Archivo | Qué hay |
|---|---|
| `model.ts` | Esquemas Zod 4: `FavoritoV1`, `FavoritosDocV1 = { schemaVersion: 1, items }`, los tipos de favorito y `ALIAS_MAX_LENGTH` (30, suposición S16) |
| `repository.ts` | Interfaz `FavoritosRepository` + `MmkvFavoritosRepository(store)` sobre un `KeyValueStore`, con la clave `transportate.favoritos.v1` |
| `migrations.ts` | Migraciones `schemaVersion` N → N + 1. Hoy están vacías, porque la v1 es la primera versión |
| `FavoritosProvider.tsx` | `FavoritosProvider` (recibe el repositorio por prop, default MMKV), `useFavoritos()` y `useFavoritosRepository()` |

## Reglas

- **Id = `${tipo}:${refId}`.**
  - Agregar algo que ya existe devuelve el existente, sin duplicar.
  - `has(tipo, refId)` sirve para el estado del botón ☆/★.
- **Se guardan `nombre` y `subtitulo`:** los ids del upstream pueden cambiar (`docs/01-api-transporte.md`), y así el favorito se puede seguir mostrando.
- **Alias** (*suposición*): opcional. Se recorta y, si supera 30 caracteres (contados como caracteres, no como unidades UTF-16), se trunca. `null` o un texto vacío lo quita. El límite visible con contador lo pone la UI (brief de Favoritos).
- **Orden:** `orden` va de 0 a n−1 y se renumera en cada escritura.
  - `add` agrega al final.
  - `reorder(ids)` ignora los ids desconocidos y deja al final los que falten.
- **Deshacer** (S19):
  - `remove(id)` devuelve el favorito quitado y `restore(fav)` lo vuelve a poner en su posición original.
  - Para "Borrar todos", la UI guarda `list()` antes de `clear()`.
- **Escritura atómica:** cada operación hace un solo `set` con el documento completo.
- **Lectura defensiva:**
  - JSON roto, un documento que no valida con Zod o una versión sin migrador dejan la lista **vacía**. Esto se loguea solo en `__DEV__`.
  - El dato malo se pisa en la próxima escritura.
- **Reactividad:**
  - `list()` devuelve la misma referencia mientras no cambie el texto guardado, como pide `useSyncExternalStore`.
  - `subscribe` avisa los cambios propios y los de otra instancia sobre el mismo store, a través de `onChange`.

## Agregar una migración

1. Subí `FAVORITOS_SCHEMA_VERSION` y definí el esquema nuevo en `model.ts`.
2. En `migrations.ts`, agregá `[versiónVieja]: (doc) => docEnLaVersiónSiguiente`.
3. Sumá un test con un documento real de la versión vieja (ver la migración ficticia 0 → 1 en `test/favoritos.test.tsx`).

## Montaje

`FavoritosProvider` todavía **no** está montado en `src/app/_layout.tsx`: lo hace la tarea de integración 3.11, junto con el ThemeProvider y el QueryClient.
