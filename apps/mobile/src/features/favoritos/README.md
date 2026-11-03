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

## Datos vivos (tarea 4.4)

`useFavoritoLiveData(favorito, { enabled })` y `<FavoritoLiveData favorito={…} />` muestran el dato vivo de un favorito en Inicio y en la pantalla de Favoritos. Reutilizan las queries de cada feature (misma query key y mismo polling en primer plano): no hay endpoints nuevos ni otro polling.

| Tipo | Dato | Query |
|---|---|---|
| `linea_subte` | `StatusChip` del estado (Premetro: el más severo de sus dos ramales) | `useEstadoSubtes` |
| `estacion_subte` | Próximo arribo por sentido, el más cercano primero: "→ Leandro N. Alem 2 min · → Juan Manuel de Rosas 5 min". Sin arribos o con dato de más de 10 min: "Sin arribos informados" + antigüedad | `useArribosEstacion(refId)` |
| `linea_colectivo` | "N en servicio" (vehículos del feed). El contrato no trae alertas de colectivos: no se muestra "con alertas" | `usePosicionesLinea(refId)` |
| `parada_colectivo` | Solo el `subtitulo` guardado. El índice de paradas (`paradas.json`, 1,7 MB) llega con la tarea 4.5 | — |

- **Resultado:** `{ status, text, spoken, tone, sourceTimestamp, estado?, ageText? }`.
  - `status`: `loading`, `ok`, `stale`, `error`, `static` o `none`.
  - `spoken` es para la etiqueta de la fila ("Trabajo. Estación Medrano, Línea B. Hacia Leandro N. Alem en 2 minutos.").
- **Estados:**
  - Carga: skeleton chico.
  - Error: "Sin información" atenuado.
  - Dato viejo (más de 3 × intervalo, S6): atenuado + "hace 6 min".
- **Solo lo visible:** con `enabled: false` no se pide nada. La lista de Favoritos pasa `enabled` según la visibilidad de la fila (o monta solo lo visible con `FlatList`).
- **Accesibilidad:** `FavoritoLiveData` se oculta al lector, porque la fila arma su etiqueta con `spoken`. Para no calcular dos veces, la fila puede llamar al hook y pasarle el resultado con `live={…}`.

**Cómo se conecta en `FavoritoRow`** (slot `liveData?: ReactNode`):

```tsx
const live = useFavoritoLiveData(favorito, { enabled: visible });
<FavoritoRow
  favorito={favorito}
  accessibilityLabel={`${titulo}. ${live.spoken}.`}
  liveData={<FavoritoLiveData favorito={favorito} live={live} />}
/>
```
