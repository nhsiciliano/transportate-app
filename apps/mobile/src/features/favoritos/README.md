# features/favoritos

## Brief operativo de la pantalla (tarea 4.9)

Brief de producto: [`docs/briefs/05-favoritos.md`](../../../../../docs/briefs/05-favoritos.md) (S14–S16, S19, S33). Esta primera parte no tiene datos vivos ni arrastre: los slots están listos para mid-dev (datos) y high-dev (arrastre).

**Qué muestra:** una lista única, en el orden guardado, pintada síncrona desde MMKV (sin skeleton de estructura). Cada fila: ícono del tipo, `LineBadge` en las líneas, alias (o el nombre oficial) como texto principal, el nombre oficial y el subtítulo debajo cuando corresponde, y a la derecha el slot `liveData`. Toda la fila lleva al detalle del tipo. Con más de 15 favoritos aparece la búsqueda.

| Estado                                 | Qué se ve y qué dice                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vacío (0)                              | Estrella + "Todavía no guardaste favoritos." + "Tocá la estrella en una línea, parada o estación para tenerla acá." + botones "Ver subtes" y "Buscar colectivo". El botón Editar no se muestra               |
| Normal                                 | La lista. Lector de pantalla: "Casa. Estación Medrano, línea B."                                                                                                                                             |
| Edición                                | Botón "Listo" en el header. Cada fila: "Cambiar nombre" y "Quitar", más las acciones de accesibilidad "Mover arriba" y "Mover abajo". Hay un lugar para el handle de arrastre (`dragHandle`)                 |
| Quitar                                 | Al instante, sin diálogo. Aviso "Quitaste «Casa». Deshacer" (8 s); "Deshacer" lo devuelve a su lugar                                                                                                         |
| Alias                                  | Sheet con campo de 30 caracteres, contador "12/30", "Guardar" y "Cancelar". Vacío quita el alias                                                                                                             |
| Búsqueda sin resultados                | "No encontramos favoritos con «xyz»."                                                                                                                                                                        |
| Carga, error, dato viejo, sin conexión | **No aplican todavía**: no hay datos vivos. Los resuelve mid-dev dentro del slot `liveData` (skeleton propio, "Sin información", antigüedad) y con la Alert única del servicio. El `OfflineBanner` es global |

**Suposiciones nuevas:**

| #              | Suposición                                                                                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4-favoritos-1 | El modo edición se comparte entre el header y la pantalla con un contexto (`EditModeProvider`, montado en el `_layout.tsx` de la pestaña). Sin favoritos el botón Editar no se muestra, y si la lista queda vacía se sale de la edición. |
| F4-favoritos-2 | **Resuelta.** La línea de subte y la estación usan `LineBadge kind: 'subte'` con `color` y `colorTexto` del estático (`useRedSubte()`). Mientras el estático no cargó (o falló) la insignia es neutra y la fila funciona igual. |
| F4-favoritos-3 | El alias se corta en 30 **caracteres** (puntos de código, igual que el repositorio) mientras se escribe, sin usar `maxLength` del `TextInput` (contaría unidades UTF-16 y rompería los emojis).                                          |
| F4-favoritos-4 | El alias se edita en un `Modal` de React Native con `presentationStyle="formSheet"` (iOS); en Android ocupa la pantalla. No hay ruta nueva.                                                                                              |
| F4-favoritos-5 | El `SnackbarProvider` se monta dentro de la pantalla (igual que Ajustes, F4-ajustes-1): el "Deshacer" vale mientras la persona siga en Favoritos.                                                                                        |
| F4-favoritos-6 | En edición, tocar el texto de la fila también abre el alias (brief §3) además del botón "Cambiar nombre". Fuera de edición no hay long press ni menú contextual (queda para después).                                                    |
| F4-favoritos-7 | **Resuelta para subte.** Un favorito huérfano se detecta contra el estático ya cargado (ver abajo). Los colectivos quedan sin detectar hasta 4.5, cuando exista el índice de colectivos en la app. |
| F4-favoritos-8 | No hay `RefreshControl` ni `FreshnessLabel` global: sin datos vivos no tienen nada que refrescar. Mid-dev los agrega junto con los hooks.                                                                                                |

## Colores de subte y favorito huérfano (tarea F4-LOW-C)

**Qué cambia en la fila:** la línea de subte muestra su letra sobre el color oficial (`PM` en el Premetro) y la estación de subte muestra la insignia de **su línea** en lugar del ícono. Los colores llegan como datos del estático (`route_color` / `route_text_color`), nunca escritos en el código. Se resuelven una sola vez en `FavoritosScreen` (`resolveFavorito` en `subte.ts`) y la fila recibe `subteBadge`.

| Caso | Qué se ve |
|---|---|
| Estático sin cargar o con error | Insignia neutra (la fila anda igual y se pinta síncrona; no hay skeleton) |
| Línea o estación que existe | Insignia con el color de la línea |
| **Huérfano**: el `refId` no existe en el estático cargado | "Esta estación ya no figura en los datos oficiales" (o "Esta línea ya no figura en los datos oficiales"), con ícono de alerta, y la fila **no navega**: tiene un botón "Quitar" siempre visible. Mantiene el alias y el nombre guardados |
| Línea o parada de colectivo | Nunca se marca huérfana todavía: gancho `isOrphan` en `subte.ts`, se completa en 4.5 |

**Suposiciones nuevas:**

| # | Suposición |
|---|---|
| F4-favoritos-9 | El `refId` de una línea de subte es la clave de la app (`A`…`H`, `PM`) y el de una estación, su `id` del estático (`FavoriteToggle` los guarda así). Cualquier otro valor es huérfano. |
| F4-favoritos-10 | Un huérfano de subte no abre el detalle (no existe) y se quita con un botón en la fila, con el mismo aviso "Quitaste «…». Deshacer" que en edición. Se espera a tener el estático cargado para marcarlo: con error de red no se marca nada. |
| F4-favoritos-11 | `FavoritosScreen` importa `useRedSubte` de `@/features/subtes/hooks` (no del índice de la feature) para no crear un ciclo: Subtes ya importa `FavoriteToggle` de acá. |

## Lógica

Lógica de favoritos (tarea 3.10). La pantalla (tarea 4.9) está más arriba; la ruta es `src/app/(tabs)/favoritos/index.tsx`. Todo se importa desde `@/features/favoritos`.

| Archivo                 | Qué hay                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `model.ts`              | Esquemas Zod 4: `FavoritoV1`, `FavoritosDocV1 = { schemaVersion: 1, items }`, los tipos de favorito y `ALIAS_MAX_LENGTH` (30, suposición S16) |
| `repository.ts`         | Interfaz `FavoritosRepository` + `MmkvFavoritosRepository(store)` sobre un `KeyValueStore`, con la clave `transportate.favoritos.v1`          |
| `migrations.ts`         | Migraciones `schemaVersion` N → N + 1. Hoy están vacías, porque la v1 es la primera versión                                                   |
| `FavoritosScreen.tsx` | La pantalla (lista, vacío, búsqueda, edición, quitar con Deshacer y sheet de alias) |
| `FavoritoRow.tsx` | La fila, con los slots `liveData` y `dragHandle` y las acciones de accesibilidad "Mover arriba/abajo" |
| `AliasSheet.tsx` | `Modal` con el campo de alias (30 caracteres, contador) |
| `EditMode.tsx` | `EditModeProvider`, `useEditMode()` y `EditModeButton` (el "Editar"/"Listo" del header) |
| `describe.ts`, `search.ts` | Textos, íconos y rutas por tipo; búsqueda sin tildes |
| `subte.ts` | `resolveFavorito`: color de la insignia de subte y detección de huérfanos contra el estático |
| `FavoritosProvider.tsx` | `FavoritosProvider` (recibe el repositorio por prop, default MMKV), `useFavoritos()` y `useFavoritosRepository()`                             |

## Reglas

- **Id = `${tipo}:${refId}`.**
  - Agregar algo que ya existe devuelve el existente, sin duplicar.
  - `has(tipo, refId)` sirve para el estado del botón ☆/★.
- **Se guardan `nombre` y `subtitulo`:** los ids del upstream pueden cambiar (`docs/01-api-transporte.md`), y así el favorito se puede seguir mostrando.
- **Alias** (_suposición_): opcional. Se recorta y, si supera 30 caracteres (contados como caracteres, no como unidades UTF-16), se trunca. `null` o un texto vacío lo quita. El límite visible con contador lo pone la UI (brief de Favoritos).
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

`FavoritosProvider` está montado en `src/app/_layout.tsx` (tarea 3.11). `EditModeProvider` se monta en `src/app/(tabs)/favoritos/_layout.tsx`, alrededor del `Stack`, para que el botón del header y la pantalla compartan el modo edición.

## Qué falta (otras tareas)

- **Datos vivos (mid-dev):** pasar `liveData` (y `liveDataLabel` para el lector) a `FavoritoRow` desde `FavoritosScreen`. Cada tipo tiene su dato: `StatusChip` en la línea de subte, próximo arribo en la estación, "N en servicio" en la línea de colectivo y las líneas que paran en la parada. También el `FreshnessLabel`, el pull to refresh, la Alert única del servicio y el favorito huérfano.
- **Arrastre (high-dev, `4.9-drag`):** reemplazar el `FlatList` de `FavoritosScreen` y pasar `dragHandle` a `FavoritoRow`. El reorden se persiste con `repository.reorder(idsEnOrden)`. Las acciones "Mover arriba/abajo" ya existen y tienen que seguir funcionando.
- **Color del subte (4.2):** `LineBadge kind: 'subte'` con los colores del estático (`TODO(4.2)` en `FavoritoRow.tsx`).

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
