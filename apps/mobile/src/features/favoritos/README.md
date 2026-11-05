# features/favoritos

## Brief operativo F5 («Señalética de terminal», F5-HIGH-B)

Contrato de dirección: [`.impeccable/surfaces/src-features-favoritos-favoritosscreen-tsx.md`](../../../.impeccable/surfaces/src-features-favoritos-favoritosscreen-tsx.md) (hereda el mundo de Inicio). Favoritos es **el tablero completo**: todas las bandas al mismo rango (`next`, navy), en el orden que fijó la persona; la decisión más cercana se señala solo en Inicio. Header, large title, «Editar/Listo», sheet del alias, arrastre, hápticos y persistencia no cambian.

- **Banda por favorito** (`FavoritoRow` → `SignBand` `next`, `favorito-<id>`): el **mismo contenido que en Inicio**, que ahora vive acá (`banda.ts`: `mensajeDeFavorito`, `descripcionDeFavorito`, `modeloBanda`, `TIPO_LECTOR`; `TIPO_ICON` de `describe.ts`). Inicio los importa de `features/favoritos`. Pictograma del tipo en el cuadrado, mensaje (alias o nombre con contexto), valor vivo (`primary` de `useFavoritoLiveData`: «4 min», «2 en servicio», «Normal», las líneas de la parada), cuadrado ámbar/rojo con el estado de la línea en las **estaciones** de subte (el estado del subte se pide solo si hay alguna estación guardada) y «hace 6 min» si el dato está viejo. Toda la banda abre el detalle (flecha al borde). Etiqueta: «Casa. Estación Medrano, Línea B, Hacia Leandro N. Alem en 4 minutos, con demoras».
- **Carga:** valor `null` (skeleton dentro de la banda). **Error:** «Sin información». **Huérfano:** banda sin `onPress` ni flecha, valor «Sin datos oficiales», cuadrado rojo «Ya no figura» y «Quitar» (44×44) siempre visible; el lector lee «… Esta estación ya no figura en los datos oficiales».
- **Edición:** la banda conserva su forma. `leading` = la manija «Reordenar» (44×44, ícono `reordenar` en el `on` de la banda; es el `dragHandle` de `react-native-reorderable-list`, solo sin filtro), `trailing` = «Quitar» (`borrar`, 44×44, en `on`) en lugar de la flecha, y el texto es un botón que abre el alias (pista «Cambiar nombre», ícono `editar` de 16 junto al mensaje) con las acciones del lector «Mover arriba» / «Mover abajo». La banda deja de ser un botón como conjunto: manija, texto y «Quitar» son elementos separados. Se quitó el botón «Cambiar nombre de …» de la Fase 4.
- **Movimiento firma:** al entrar y salir de la edición el contenido de las bandas cruza en fundido de 200 ms (`transitionKey` = modo); corte seco con Reducir movimiento. Quitar: al instante, `Snackbar` «Quitaste «Casa».» + Deshacer, como antes.
- **Lista:** gap 8 entre bandas, fondo `bg.elevated` en claro / `bg.base` en oscuro (también el vacío), `FreshnessLabel` arriba con el dato más viejo visible, `SearchInput` con más de 15, `EmptyState` y Alert única «El servicio de la Ciudad no responde» como antes.
- **`AliasSheet`:** sin cambios de estructura (la tipografía ya es Fira Sans por el tema).

| Estado          | Banda                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| Carga           | Mensaje ya visible (MMKV); valor en skeleton del color de la banda             |
| Vacío           | `EmptyState` «Todavía no guardaste favoritos.» + «Ver subtes» / «Buscar colectivo» |
| Error           | «Sin información»; si fallan todas por un error reintentable, Alert única      |
| Dato viejo      | El valor igual + «hace 6 min»; `FreshnessLabel` en warning                     |
| Sin conexión    | `OfflineBanner` global; todas las bandas visibles y tocables                   |
| Huérfano        | Sin flecha, «Sin datos oficiales», cuadrado rojo «Ya no figura», «Quitar»       |
| Sin permiso     | — (Favoritos no usa ubicación)                                                 |

### Contraste (F5)

Banda `next` (pares de `features/inicio/README.md`): texto `on` 13,07:1 (claro, `#ffffff` / `#1d3343`) y 11,09:1 (oscuro, `#08202f` / `#a4d9ff`); estado al 85 % 9,86:1 / 7,69:1. Nuevos en esta tarea, calculados con `ratio` de `tools/contraste/contraste.py`:

| Esquema | Par                                                          | Primer plano | Fondo     | Ratio   | Mínimo | Cumple |
| ------- | ------------------------------------------------------------ | ------------ | --------- | ------- | ------ | :----: |
| claro   | manija «Reordenar», «Quitar» e ícono `editar` (`on`) / banda | `#ffffff`    | `#1d3343` | 13,07:1 | 3      |   ✅   |
| oscuro  | ídem                                                         | `#08202f`    | `#a4d9ff` | 11,09:1 | 3      |   ✅   |
| claro   | borde del cuadrado rojo del huérfano (`on`) / banda          | `#ffffff`    | `#1d3343` | 13,07:1 | 3      |   ✅   |
| oscuro  | ídem                                                         | `#08202f`    | `#a4d9ff` | 11,09:1 | 3      |   ✅   |
| claro   | `FreshnessLabel` (`text.secondary`) / fondo `bg.elevated`    | `#4a5766`    | `#edf4ff` | 6,67:1  | 4,5    |   ✅   |

### Suposiciones nuevas (Fase 5)

1. **F5-favoritos-1** — `mensajeDeFavorito` y `modeloBanda` pasan a `features/favoritos/banda.ts` (fuente de verdad del favorito); `features/inicio` los re-exporta por compatibilidad.
2. **F5-favoritos-2** — La banda lleva el pictograma del tipo (como Inicio), no el disco con el color GTFS de la línea (F4-favoritos-9 queda sin uso en la pantalla; `resolveFavorito` sigue decidiendo huérfanos de subte).
3. **F5-favoritos-3** — Huérfano: el valor es «Sin datos oficiales» y el estado rojo «Ya no figura», para no repetir el mismo texto dos veces; el mensaje completo lo lee el lector.
4. **F5-favoritos-4** — En edición se quita el botón «Cambiar nombre de …»: el alias se abre tocando el texto de la banda (botón con pista «Cambiar nombre»), como pide el contrato.
5. **F5-favoritos-5** — La etiqueta del lector sigue el formato de Inicio («Casa. Estación Medrano, Línea B, Hacia … en 4 minutos»), en lugar de «… Línea B. Hacia … .» de la Fase 4. En las paradas no se repiten las líneas (subtítulo y dato estático coinciden).
6. **F5-favoritos-6** — El fundido de edición solo cruza el contenido de la banda; la manija y «Quitar» aparecen con la opacidad del contenido entrante y se van en seco al salir.
7. **F5-favoritos-7** — `SignBand` suma `contentAccessibilityActions`/`onContentAccessibilityAction` (shared/ui) para las acciones «Mover arriba/abajo» sobre el texto.

## Brief operativo de la pantalla (tarea 4.9, historial)


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
| F4-favoritos-7 | **Resuelta.** El huérfano se decide en un solo lugar, `useFavoritoLiveData` (`status: 'orphan'`), para los cuatro tipos (ver abajo). `FavoritoItem` lo lee de ahí y `FavoritosScreen` no lo calcula. |
| F4-favoritos-8 | **Resuelta (F4-LOW-C).** Hay `FreshnessLabel` global y pull to refresh. |

## Colores de subte y favorito huérfano (tarea F4-LOW-C)

**Qué cambia en la fila:** la línea de subte muestra su letra sobre el color oficial (`PM` en el Premetro) y la estación de subte muestra la insignia de **su línea** en lugar del ícono. Los colores llegan como datos del estático (`route_color` / `route_text_color`), nunca escritos en el código. Se resuelven una sola vez en `FavoritosScreen` (`resolveFavorito` en `subte.ts`) y la fila recibe `subteBadge`.

| Caso | Qué se ve |
|---|---|
| Estático sin cargar o con error | Insignia neutra (la fila anda igual y se pinta síncrona; no hay skeleton) |
| Línea o estación que existe | Insignia con el color de la línea |
| **Huérfano**: el destino no figura en los datos cargados | "Esta estación ya no figura en los datos oficiales" (o "Esta línea…" / "Esta parada…"), con ícono de alerta, y la fila **no navega**: tiene un botón "Quitar" siempre visible y no pide datos. Mantiene el alias y el nombre guardados |
| Cómo se decide | **Un solo criterio, en `useFavoritoLiveData` (`status: 'orphan'`)**, para los cuatro tipos: línea o estación de subte contra el estático de subte; línea de colectivo contra las líneas vigentes del proxy; parada contra `paradas.json`. Sin el dato cargado no se afirma nada |

**Suposiciones nuevas:**

| # | Suposición |
|---|---|
| F4-favoritos-9 | El `refId` de una línea de subte es la clave de la app (`A`…`H`, `PM`) y el de una estación, su `id` del estático (`FavoriteToggle` los guarda así). Cualquier otro valor es huérfano (`resolveFavorito` en `subte.ts`, que usa el hook). |
| F4-favoritos-10 | Un huérfano de subte no abre el detalle (no existe) y se quita con un botón en la fila, con el mismo aviso "Quitaste «…». Deshacer" que en edición. Se espera a tener el dato cargado para marcarlo: con error de red no se marca nada. |
| F4-favoritos-11 | `FavoritosScreen` importa `useRedSubte` de `@/features/subtes/hooks` (no del índice de la feature) para no crear un ciclo: Subtes ya importa `FavoriteToggle` de acá. |
| F4-favoritos-12 | Solo piden datos las filas visibles. Hasta que la lista informe cuáles se ven, se consideran visibles las primeras 10 (`INITIAL_VISIBLE`). La etiqueta de frescura toma la más vieja de las visibles; sin datos vivos no se muestra. El dato estático de la parada (sus líneas) no se repite como dato vivo. |
| F4-favoritos-13 | **Alert única de servicio caído:** "El servicio de la Ciudad no responde" + "Reintentar" (`invalidateRealtime`) cuando TODAS las filas visibles con dato vivo están en `status: 'error'` por un error reintentable (`ApiError.retryable`: red, timeout, 5xx, 429). Un error de contenido (404) no cuenta, y una sola fila que ande la apaga. `useFavoritoLiveData` no expone el error, así que `FavoritoItem` lo lee del estado de la query de la fila (`servicio.ts › serviceHealth`), sin tocar el hook. Las filas siguen con "Sin información". |

## Favoritos de tren (Fase 6, F6-HIGH-B)

| Tipo | `refId` | Se guarda desde | Dato vivo | Destino |
|---|---|---|---|---|
| `ramal_tren` | Id de ramal de SOFSE (`"1"`) | Estrella del ramal (`nombre` «Once – Moreno», `subtitulo` «Línea Sarmiento») | Estado del ramal (`useEstadoTrenes`, TTL 60 s) | `/trenes/ramal/[id]` |
| `estacion_tren` | Id de estación de SOFSE (`"50"`) | Estrella de la estación (`subtitulo` = sus líneas) | Próximo tren por destino (`useArribosEstacionTren`, `agruparArribosTren`); la banda suma el cuadrado del peor estado de sus ramales | `/trenes/estacion/[id]` |

- **En trenes se guarda el ramal o la estación, nunca la línea** (S37): no hay tipo `linea_tren`.
- La banda lleva el pictograma del tipo (`tren`, `estacionTren`), como el resto (F5-favoritos-2); `resolveFavoritoTren` deja lista la insignia de la línea por si una fila la necesita.
- Huérfano: el ramal o la estación ya no están en `trenes-*.json` → «Este ramal / Esta estación ya no figura en los datos oficiales».
- **Esquema:** los dos tipos son **aditivos** y `FAVORITOS_SCHEMA_VERSION` sigue en **1** (`migrations.ts` no cambia). Consecuencia conocida: si alguien vuelve a una versión de la app anterior a la Fase 6 con favoritos de tren guardados, esa versión no reconoce los tipos nuevos, el documento entero no valida y la lista **arranca vacía** (`repository.ts`, «documento inválido»). Mientras esa versión vieja no guarde nada, volver a la nueva los recupera; si guarda un favorito, sobrescribe el documento y los de antes se pierden.

## Lógica

Lógica de favoritos (tarea 3.10). La pantalla (tarea 4.9) está más arriba; la ruta es `src/app/(tabs)/favoritos/index.tsx`. Todo se importa desde `@/features/favoritos`.

| Archivo                 | Qué hay                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `model.ts`              | Esquemas Zod 4: `FavoritoV1`, `FavoritosDocV1 = { schemaVersion: 1, items }`, los tipos de favorito y `ALIAS_MAX_LENGTH` (30, suposición S16) |
| `repository.ts`         | Interfaz `FavoritosRepository` + `MmkvFavoritosRepository(store)` sobre un `KeyValueStore`, con la clave `transportate.favoritos.v1`          |
| `migrations.ts`         | Migraciones `schemaVersion` N → N + 1. Hoy están vacías, porque la v1 es la primera versión                                                   |
| `FavoritosScreen.tsx` | La pantalla (lista, vacío, búsqueda, edición, quitar con Deshacer y sheet de alias) |
| `FavoritoItem.tsx` | Una fila con su dato vivo conectado (`useFavoritoLiveData`) y el aviso de su `sourceTimestamp` para la frescura global |
| `FavoritoRow.tsx` | La fila, con los slots `liveData` y `dragHandle` y las acciones de accesibilidad "Mover arriba/abajo" |
| `AliasSheet.tsx` | `Modal` con el campo de alias (30 caracteres, contador) |
| `EditMode.tsx` | `EditModeProvider`, `useEditMode()` y `EditModeButton` (el "Editar"/"Listo" del header) |
| `describe.ts`, `search.ts` | Textos, íconos y rutas por tipo; búsqueda sin tildes |
| `servicio.ts` | `serviceHealth` / `isServiceDown`: decide si el servicio está caído para la Alert única |
| `subte.ts` | `resolveFavorito`: color de la insignia de subte y huérfano de subte contra el estático (lo consume `useFavoritoLiveData`), y `orphanMessage` |
| `tren.ts` | `resolveFavoritoTren`: insignia de la línea (siglas y color) y huérfano de un ramal o una estación de tren contra el estático de trenes (lo consume `useFavoritoLiveData`) |
| `useFavoritoLiveData.ts`, `FavoritoLiveData.tsx` | Dato vivo por tipo y su presentación; deciden también el huérfano (mid-dev) |
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

- **Arrastre (high-dev, `4.9-drag`):** reemplazar el `FlatList` de `FavoritosScreen` y pasar `dragHandle` a `FavoritoRow` (a través de `FavoritoItem`). El reorden se persiste con `repository.reorder(idsEnOrden)`. Las acciones "Mover arriba/abajo" ya existen y tienen que seguir funcionando.

## Datos vivos (tarea 4.4)

`useFavoritoLiveData(favorito, { enabled })` y `<FavoritoLiveData favorito={…} />` muestran el dato vivo de un favorito en Inicio y en la pantalla de Favoritos. Reutilizan las queries de cada feature (misma query key y mismo polling en primer plano): no hay endpoints nuevos ni otro polling.

| Tipo | Dato | Query |
|---|---|---|
| `linea_subte` | `StatusChip` del estado (Premetro: el más severo de sus dos ramales) | `useEstadoSubtes` |
| `estacion_subte` | Próximo arribo por sentido, el más cercano primero: "→ Leandro N. Alem 2 min · → Juan Manuel de Rosas 5 min". Sin arribos o con dato de más de 10 min: "Sin arribos informados" + antigüedad | `useArribosEstacion(refId)` |
| `linea_colectivo` | "N en servicio" (vehículos del feed). El contrato no trae alertas de colectivos: no se muestra "con alertas" | `usePosicionesLinea(refId)` |
| `parada_colectivo` | Las líneas que paran (de `paradas.json`, archivo grande de `shared/static`); mientras no está descargado, el `subtitulo` guardado. Si la parada ya no figura: huérfano | `useStaticArchivoGrande` |

- **Resultado:** `{ status, text, spoken, tone, sourceTimestamp, estado?, ageText? }`.
  - `status`: `loading`, `ok`, `stale`, `error`, `static`, `none` u `orphan`.
  - `spoken` es para la etiqueta de la fila ("Trabajo. Estación Medrano, Línea B. Hacia Leandro N. Alem en 2 minutos.").
- **Estados:**
  - Carga: skeleton chico.
  - Error: "Sin información" atenuado. Si fallan todas las filas visibles por un error reintentable, una sola `Alert` de servicio caído arriba de la lista (F4-favoritos-13).
  - Huérfano: el aviso de arriba, sin pedir datos.
  - Dato viejo (más de 3 × intervalo, S6): atenuado + "hace 6 min".
- **Solo lo visible:** con `enabled: false` no se pide nada. La lista de Favoritos pasa `enabled` según la visibilidad de la fila (o monta solo lo visible con `FlatList`).
- **Accesibilidad:** `FavoritoLiveData` se oculta al lector, porque la fila arma su etiqueta con `spoken`. Para no calcular dos veces, la fila puede llamar al hook y pasarle el resultado con `live={…}`.

**Conectado (F4-LOW-C):** `FavoritoItem` hace esto por fila, con `enabled` según la visibilidad (`onViewableItemsChanged`; hasta que la lista informe, las primeras 10). `FavoritosScreen` suma el `FreshnessLabel` con el dato más viejo de las filas visibles y el pull to refresh con `invalidateRealtime`. El dato estático de la parada no se repite en la fila.

**Así se conecta en `FavoritoRow`** (slot `liveData?: ReactNode`):

```tsx
const live = useFavoritoLiveData(favorito, { enabled: visible });
<FavoritoRow
  favorito={favorito}
  accessibilityLabel={`${titulo}. ${live.spoken}.`}
  liveData={<FavoritoLiveData favorito={favorito} live={live} />}
/>
```
