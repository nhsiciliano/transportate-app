# features/colectivos

Colectivos: búsqueda local de líneas y paradas, paradas cercanas y detalle de parada (Fase 4, tareas 4.1, 4.5, 4.7, 4.11 y 4.12). Brief de diseño: [`docs/briefs/02-colectivos.md`](../../../../../docs/briefs/02-colectivos.md). El detalle de línea con el mapa (`LineaScreen`, tarea 4.6) es de otra tarea.

**Desde la Fase 5 (F5-MID-B)** Colectivos usa la dirección «Señalética de terminal» extendida desde el piloto de Inicio. Contrato: [`apps/mobile/.impeccable/surfaces/src-features-colectivos-colectivosscreen-tsx.md`](../../../.impeccable/surfaces/src-features-colectivos-colectivosscreen-tsx.md). La forma vigente está en «Brief operativo F5» (más abajo); las secciones de la Fase 4 siguen describiendo el comportamiento, los datos y las suposiciones `F4-*`, que no cambian.

**Para el detalle de línea (tarea 4.6):** la ruta es `/colectivos/[linea]`, con `linea` = `lineaId` (el `route_id` del proxy). Desde una parada se suma el query param **`parada`** (constante `PARAM_PARADA` de `navigation.ts`, exportada en `@/features/colectivos`) con el id de la parada BA, para centrar la cámara ahí: `/colectivos/601?parada=p749f7ff366`.

## Brief operativo F5 (F5-MID-B)

Modo **Operate**: tabs nativas, large title, header, gesto de volver y controles del sistema quedan como estaban. La dirección aporta tipografía (Fira Sans), la paleta Obelisco v2 sin cambios, densidad y un movimiento firma (el fundido de `SignBand`, ya resuelto en `shared/ui`). Una banda es una decisión viva; lo demás va en placas de tablero (`Board`).

**Raíz** (`ColectivosScreen`, fondo `bg.elevated` en claro y `bg.base` en oscuro, 12 pt entre bloques):

| Bloque                       | Forma                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Búsqueda                     | `SearchInput` «Buscá una línea o parada», como antes                                                                                                                                                                                                                                                                                                          |
| Paradas cercanas             | `Board` con etiqueta: hasta 10 filas (`Pictogram parada` 32, calle y altura, **líneas que paran** «60 · 152 · 168», distancia «a 120 m» a la derecha en 15/600, flecha → parada) y fila final «Ver más» (hasta 30). Sin permiso, dentro de la placa va `PermisoUbicacionBloque inset`. Fuera de CABA y sin cercanas: `EmptyState` compacto dentro de la placa |
| Recientes                    | `Board` con etiqueta «Recientes»: `LineBadge`, «Línea 152», «Ramal A · a Olivos», flecha → línea                                                                                                                                                                                                                                                              |
| Tus favoritos                | `SignBand` `next` con el mismo contenido que en Inicio (`modeloBanda` y `hrefDeFavorito` de `@/features/inicio`); una por favorito de colectivo (línea o parada)                                                                                                                                                                                              |
| Búsqueda activa              | Una sola placa con líneas (`LineBadge`, «Línea 60», ramal y cabecera) y paradas (`Pictogram parada`, líneas que paran) mezcladas; `EmptyState` si no hay resultados                                                                                                                                                                                           |
| Índice sin descargar / error | `ProgresoIndice` dentro de una placa / `ErrorState`                                                                                                                                                                                                                                                                                                           |

**Parada** (`ParadaScreen`): título nativo con calle y altura; `FavoriteToggle` (44×44) en el `headerRight`; barrio en 15 `text.secondary` debajo del header; `Board` «Líneas que paran» con una fila por línea (`LineBadge`, «Línea 60», ramal y cabecera). Si hay arribos, el primero va a la derecha de su fila en 24/700 y los siguientes (hasta 3 en total) debajo en 13 `text.secondary`; la flecha lleva a `/colectivos/[linea]?parada=<id>`. `FreshnessLabel` solo si hay arribos (N4). **No hay banda**: la parada no tiene un valor vivo que señalizar.

**Línea con mapa** (`LineaScreen`, `VehiculosSheet`): el comportamiento del mapa, el panel de tres alturas, los gestos, el clustering y el seguimiento no cambian. Cambia la forma del panel (fondo `bg.card` con borde superior de 1 px `border.subtle` y el radio de la hoja, que son de `BottomPanel`):

- **Colapsado:** primera pieza, una `SignBand` **fija** (`lead`, sin `onPress`, sin flecha): pictograma «colectivos», «Línea 152 · Ramal A» (sin ramal, la cabecera), rótulo «En servicio», el **conteo a escala monumental** y como estado muted la antigüedad del dato («hace 25 s»). Debajo, en una fila: `FreshnessLabel`, `FavoriteToggle` y «Actualizar». La manija y su botón («Ver más» / «Ver menos») siguen igual.
- **Vehículo elegido:** la banda se vuelve a señalizar (fundido): «Interno 1404», «Actualizado», «hace 25 s» y, si hay ubicación, «a 350 m de vos». Una fila más con «Cerrar» y «Seguir» / «Dejar de seguir». Al cerrar vuelve al conteo, también con fundido.
- **Medio:** `Chip`s de ramal y la nota de sentido, sin cambios de componente.
- **Expandido:** la lista de vehículos como placa. Con ubicación, el rótulo es «Colectivos a menos de 3 km» con «N de M en servicio» al lado y solo entran los que están a ≤ 3.000 m (F5-colectivos-12); sin ubicación, «Colectivos en servicio» con la lista completa. Cada fila: `Pictogram colectivos` 32, «Interno 1404», «a 350 m de vos» (o el ramal si no hay ubicación) y «hace 25 s» en 15 `text.secondary`. Seleccionar no navega, así que las filas son botones **sin flecha** (`arrow={false}`).
- **Tab bar:** el panel deja abajo el lugar de la tab bar nativa (F5-colectivos-13): el encabezado entero —banda y fila de acciones— queda por encima de ella en colapsado y la lista llega a su último vehículo en expandido.
- **Movimiento:** el fundido de la banda y el de las filas de la lista al entrar o salir de los 3 km (200 ms) (`transitionKey` = conteo o `interno-<id>`) y, en la lista, el fundido de entrada, salida y reacomodo de las filas (`FadeIn`/`FadeOut`/`LinearTransition` de Reanimated, `FILA_FUNDIDO_MS`); con Reducir movimiento, corte seco. Del skeleton al primer valor no hay fundido.

### Estados F5

| Estado          | Raíz                                                                                                  | Parada                                                                 | Línea (panel)                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carga           | Índice: progreso dentro de una placa. Cercanas: tres filas de skeleton dentro de la placa             | `Board.Skeleton` (3 filas) o progreso del índice                       | Sin línea: `SignBand.Skeleton` lead + una línea. Con línea y sin posiciones: banda con el valor en skeleton                                           |
| Vacío           | Sin resultados / sin cercanas / fuera de CABA: `EmptyState` dentro de la placa con el copy de siempre | «No encontramos esta parada» dentro de una placa                       | Banda con «Sin colectivos con GPS ahora» (la etiqueta hablada suma «No hay colectivos de esta línea con GPS activo ahora.»)                           |
| Error           | `ErrorState` «No pudimos descargar las líneas y paradas» + reintento                                  | ídem                                                                   | Banda con «Sin datos» + `ErrorState` con reintento (o «Las posiciones de colectivos no están disponibles por ahora», sin reintento)                   |
| Error con datos | —                                                                                                     | Alert «No pudimos actualizar…» + «Reintentar» (solo si ya hay arribos) | Alert «No pudimos actualizar. Mostramos lo último que sabemos.» + «Reintentar»; marcadores atenuados                                                  |
| Dato viejo      | —                                                                                                     | `FreshnessLabel` (warning > 3·R, aviso > 10 min)                       | Más de 10 min: estado **warning** «Las posiciones pueden no ser actuales» en la banda (cuadrado ámbar con texto); vehículo con más de 5 min, atenuado |
| Sin conexión    | `OfflineBanner` global; búsqueda y cercanas son locales                                               | Información estática                                                   | Últimas posiciones atenuadas; `OfflineBanner` global                                                                                                  |
| Sin permiso     | `PermisoUbicacionBloque inset` dentro de la placa «Paradas cercanas» (S32)                            | —                                                                      | «Centrar en mi ubicación» pide el permiso en contexto; sin permiso no hay distancias                                                                  |

### Contraste (`tools/contraste/contraste.py`, función `ratio`)

Mínimo: 4,5:1 texto, 3:1 elementos gráficos. Los pares de las bandas (`lead` sobre el panel incluido) son los de la tabla de [Inicio](../inicio/README.md#contraste-de-la-banda-toolscontrastecontrastepy-fórmula-wcag-2x); la banda `lead` contra el fondo del panel (`bg.card`) da 7,38:1 en claro (`#035c80` / `#ffffff`) y 5,59:1 en oscuro (`#67a5cd` / `#1b2836`). Pares nuevos de las placas:

| Esquema | Par                                                                                 | Primer plano          | Fondo                 |           Ratio | Cumple |
| ------- | ----------------------------------------------------------------------------------- | --------------------- | --------------------- | --------------: | :----: |
| claro   | `text.primary` en filas (título 17/600, distancia, 1.er arribo 24/700) / `bg.card`  | `#08202f`             | `#ffffff`             |         16,69:1 |   ✅   |
| claro   | `text.secondary` en filas (subtítulo, «hace 25 s», detalle del permiso) / `bg.card` | `#4a5766`             | `#ffffff`             |          7,38:1 |   ✅   |
| claro   | `text.secondary` (etiqueta de placa 13/600, barrio 15) / `bg.elevated`              | `#4a5766`             | `#edf4ff`             |          6,67:1 |   ✅   |
| claro   | `text.primary` / `bg.pressed` (vehículo elegido)                                    | `#08202f`             | `#d6e4f6`             |         12,95:1 |   ✅   |
| claro   | `text.secondary` / `bg.pressed` (vehículo elegido)                                  | `#4a5766`             | `#d6e4f6`             |          5,72:1 |   ✅   |
| claro   | `Pictogram board`: ícono / cuadrado                                                 | `#ffffff`             | `#1d3343`             |         13,07:1 |   ✅   |
| claro   | `Pictogram board`: cuadrado / `bg.card` — y / `bg.pressed`                          | `#1d3343`             | `#ffffff` — `#d6e4f6` | 13,07 — 10,14:1 |   ✅   |
| claro   | Flecha (`text.secondary`) / `bg.card` — y / `bg.pressed`                            | `#4a5766`             | `#ffffff` — `#d6e4f6` |   7,38 — 5,72:1 |   ✅   |
| oscuro  | `text.primary` en filas / `bg.card`                                                 | `#edf4ff`             | `#1b2836`             |         13,53:1 |   ✅   |
| oscuro  | `text.secondary` en filas / `bg.card`                                               | `#c7d4e6`             | `#1b2836`             |          9,97:1 |   ✅   |
| oscuro  | `text.secondary` (etiqueta, barrio) / `bg.elevated`                                 | `#c7d4e6`             | `#121f2c`             |         11,12:1 |   ✅   |
| oscuro  | `text.primary` — `text.secondary` / `bg.pressed`                                    | `#edf4ff` — `#c7d4e6` | `#253240`             |  11,80 — 8,69:1 |   ✅   |
| oscuro  | `Pictogram board`: ícono / cuadrado                                                 | `#08202f`             | `#a4d9ff`             |         11,09:1 |   ✅   |
| oscuro  | `Pictogram board`: cuadrado / `bg.card` — y / `bg.pressed`                          | `#a4d9ff`             | `#1b2836` — `#253240` |   9,94 — 8,67:1 |   ✅   |
| oscuro  | Flecha (`text.secondary`) / `bg.card` — y / `bg.pressed`                            | `#c7d4e6`             | `#1b2836` — `#253240` |   9,97 — 8,69:1 |   ✅   |

El outline y los separadores de las placas (`border.subtle`) son decorativos (DESIGN.md §7): la información no depende de ellos. El cuadrado de estado de la banda (ámbar «Las posiciones pueden no ser actuales») lleva el borde de 1 pt en el color `on` de la banda y el texto al lado: el color nunca es el único canal.

### Accesibilidad

- Cada fila y cada banda es **un solo elemento accesible** con etiqueta compuesta: «Parada Av. Corrientes 1000. a 120 m. Líneas 10, 60, 152», «Línea 60. Ramal A · a Constitución. Próximo en 2 minutos, después en 10 minutos y en 15 minutos», «Interno 1404, actualizado hace 25 segundos, a 350 metros de vos, Seleccionado».
- Áreas táctiles ≥ 44 (filas de ≥ 56 pt, estrella de 44×44). Con Dynamic Type al tope las filas crecen en alto; el título de una fila llega a 2 líneas y el valor y el estado de una banda nunca se truncan (el valor grande se achica antes de cortarse).

### Suposiciones F5

1. **F5-colectivos-1** — Parada no lleva banda: no hay un valor vivo que señalizar (las paradas no traen arribos hoy, N4). Cuando haya arribos, siguen siendo un dato de la fila de su línea y no una banda.
2. **F5-colectivos-2** — En el panel de la línea, «Cerrar» y «Seguir» / «Dejar de seguir» van en una fila propia debajo de la de frescura / estrella / «Actualizar», que no cambia con el vehículo elegido: así «Actualizar» sigue a mano y la fila de acciones del vehículo aparece solo cuando hay uno.
3. **F5-colectivos-3** — El «hace 25 s» de la banda es la antigüedad del dato **más viejo** entre los vehículos (no el `sourceTimestamp` del feed, que ya muestra `FreshnessLabel`). Se calcula con el reloj de la pantalla (cada 5 s) y no es una región viva: el lector no lo re-anuncia.
4. **F5-colectivos-4** — El vacío de la línea lo dice la banda («Sin colectivos con GPS ahora»); se saca el `EmptyState` del panel para no repetirlo y ocupar menos mapa. La frase completa de antes sigue en la etiqueta hablada. Con error sin datos la banda dice «Sin datos» y debajo va el `ErrorState`.
5. **F5-colectivos-5** — El aviso de feed viejo vive como estado warning de la banda (ya no es una `Alert` aparte) y **manda sobre** la antigüedad y sobre la distancia. La `Alert` de actualización fallida (con «Reintentar») se conserva.
6. **F5-colectivos-6** — `Board.Row` no tiene un modo «elegido», así que la fila del vehículo seleccionado se envuelve en una `View` con `bg.pressed` y el lector oye «Seleccionado» al final de su etiqueta; los vehículos con más de 5 min (S31) se atenúan al 70 % en la misma envoltura. Si más pantallas necesitan filas elegidas, conviene un prop `selected` en `Board.Row` (high-dev).
7. **F5-colectivos-7** — Subtítulo de un vehículo: la distancia si hay ubicación; si no, el ramal («Ramal A»); si la línea no tiene ramal, sin subtítulo.
8. **F5-colectivos-8** — «Tus favoritos» conserva su título y sus dos tipos (línea y parada de colectivo): las paradas favoritas viven acá y no hay otro lugar donde verlas con su dato vivo. El título de «Recientes» sustituye a «Líneas recientes» (contrato de dirección). Las bandas usan `modeloBanda` y `hrefDeFavorito` de `@/features/inicio` (misma banda que en Inicio, sin la variante líder).
9. **F5-colectivos-9** — El subtítulo de una parada nombra hasta 6 líneas; con más, 3 y «y N más» (`textoDeLineas`). El detalle completo está en la parada.
10. **F5-colectivos-10** — En la parada, la placa suma una fila por cada línea que trae arribos aunque no figure entre las que paran (sin destino ni flecha), para no perder un dato; una línea sin ramal en el listado tampoco lleva flecha ni es botón (la flecha promete un destino). La sección «Próximos arribos» desaparece: los tiempos viven en la fila de su línea.
11. **F5-colectivos-11** — La estrella de la parada va en el `headerRight` nativo (44×44); mientras la parada no se resolvió, el header no muestra nada a la derecha.
12. **F5-colectivos-12** — **La lista de vehículos del panel muestra solo los que están a ≤ 3 km** (`RADIO_LISTA_METROS = 3000`, `filtrarCercanos` en `lineaModel.ts`), pedido del usuario: «el resto no sería necesario; que vayan apareciendo a medida que estén más cerca». Detalles:
    - Rige solo **con ubicación** (permiso dado y posición conocida). Sin ubicación, lista completa ordenada por dato reciente y rótulo «Colectivos en servicio», como antes.
    - Las posiciones se refrescan cada R segundos, así que un colectivo entra o sale cuando cruza los 3 km; las filas lo hacen con un fundido de 200 ms (seco con Reducir movimiento).
    - El vehículo **elegido o seguido se queda** aunque se aleje: no se lo saca de abajo del dedo. Al cerrar la selección, sale. Cuenta en el «N» de «N de M».
    - «N de M en servicio»: N = filas de la lista, M = colectivos de la línea con GPS. Si ninguno está a menos de 3 km: «Ningún colectivo a menos de 3 km. Hay 7 en servicio más lejos.» (singular «Hay 1 en servicio más lejos.»), dentro de una placa compacta y **sin botón**.
    - **La banda sigue diciendo el total** (es el dato de la línea) y **el mapa no se filtra**: muestra todos los vehículos.
    - **Resuelto por el usuario el 2026-11-04 («el mapa dejalo así por ahora»): el mapa no se filtra.** No se había hecho porque el recorrido y los colectivos lejanos ayudan a entender por dónde viene la línea, y un mapa que cambia de contenido al moverse confunde; si se quiere, es un filtro en `vehiculosCollection` con el mismo `filtrarCercanos`.
13. **F5-colectivos-13** — **Lugar para la tab bar.** `NativeTabs` (`expo-router/native-tabs`) no es el navegador de `@react-navigation/bottom-tabs` (no es dependencia): **no existe `useBottomTabBarHeight`**. Se mide con `usePanelBottomInset()` (`shared/map/BottomPanel.tsx`): en iOS es `useSafeAreaInsets().bottom` leído dentro de la tab, porque `NativeTabs` envuelve cada pantalla en su propio `SafeAreaProvider` y el `UITabBarController` incluye la tab bar en el safe area de abajo (tab bar + indicador de inicio); en Android es 0, porque `NativeTabs` mete el contenido en un `SafeAreaView` que ya lo deja arriba de la tab bar (sumar el inset de sistema dejaría un hueco doble). `panelHeights(available, headerHeight, bottomInset)` suma el inset al colapsado y `BottomPanel` lo agrega como `paddingBottom` del cuerpo; medio y expandido son 50 % y 90 % del alto disponible y lo contienen. El cuerpo se oculta (`opacity: 0`) en colapsado para que la lista no asome bajo la tab bar translúcida. Los controles del mapa suben el mismo alto (`bottomOffset`). **A confirmar en el iPhone**: el alto exacto depende de lo que el sistema informe para la tab bar (con iOS 26 la tab bar flotante).

## Brief operativo (tarea 4.1, Fase 4)

**Raíz "Colectivos"** (`ColectivosScreen`):

1. `SearchInput` "Buscá una línea o parada". Los resultados mezclan líneas (insignia con el número + ramal y cabecera) y paradas (calle y altura + insignias de las líneas que paran). Vacío: "No encontramos «608». Probá con el número de línea o el nombre de una calle."
2. **Paradas cercanas:** con permiso, las 10 más cercanas ("a 120 m") y "Ver más" hasta 30.
   - Sin permiso: "Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono." con "Activar" y "Buscar a mano". Si ya se negó: "Abrir configuración".
   - Fuera de CABA: "No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires."
3. **Líneas recientes** (las últimas 5 abiertas) y **favoritos de colectivo**, con su dato vivo.

**Parada** (`ParadaScreen`, `/colectivos/parada/[id]`): calle y altura, barrio, `FavoriteToggle` y líneas que paran (insignias tocables → `/colectivos/[linea]?parada=<id>`). "Próximos arribos" **solo si la respuesta trae arribos**: por línea hasta 3 tiempos, con `FreshnessLabel`. Si viene vacía, la sección no existe (N4).

| Estado                                      | Raíz                                                                                                    | Parada                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Índice sin descargar                        | "Preparando el listado de líneas y paradas…" con barra de progreso; la búsqueda se habilita al terminar | Skeleton                                                                       |
| Error de descarga                           | `ErrorState` "No pudimos descargar las líneas y paradas" + "Volver a intentar"                          | ídem                                                                           |
| Vacío                                       | Búsqueda sin resultados (copy de arriba); sin cercanas en 1,5 km: "No encontramos paradas cerca."       | Parada que no está: "No encontramos esta parada"                               |
| Arribos con error y datos                   | —                                                                                                       | Alert "No pudimos actualizar. Mostramos lo último que sabemos." + "Reintentar" |
| Arribos sin datos (vacío, cargando o error) | —                                                                                                       | Sin sección                                                                    |
| Sin conexión                                | `OfflineBanner` global; búsqueda y cercanas siguen andando (son locales)                                | Información estática                                                           |

### Suposiciones nuevas

1. **F4-colectivos-1** — El índice se arma con `lineas-colectivos.json` + `paradas.json` del paquete estático. Cuando `/v1/colectivos/lineas` (proxy, `route_id` vigentes) tiene dato, sus líneas reemplazan a las del archivo: el archivo es una semilla y los `route_id` se reasignan. `indice-colectivos.json` es para el proxy; la app no lo usa.
2. **F4-colectivos-2** — Búsqueda sin tildes ni mayúsculas. Ranking de líneas: número exacto, nombre exacto ("60 a"), número que empieza igual, y después ramal, cabecera o empresa. Las paradas se buscan desde 3 caracteres, por calle y altura. Hasta 20 de cada una.
3. **F4-colectivos-3** — Tocar un número de línea en una parada abre su primer ramal en CABA; el detalle de línea ofrece cambiar de ramal.
4. **F4-colectivos-4** — Cercanas en un radio de 1,5 km. La posición se pide una vez al mostrar la raíz con permiso (precisión `Balanced`) y vive solo en memoria.
5. **F4-colectivos-5** — "Líneas recientes" se guardan al abrir una línea desde esta feature (búsqueda, parada o reciente): las últimas 5, en MMKV (`transportate.colectivos.recientes.v1`).
6. **F4-colectivos-6** — Detalle de línea: la ruta es `/colectivos/[linea]` con `linea` = `lineaId` (el `route_id` del proxy). Desde una parada se suma el query param `parada=<paradaId>` para centrar la cámara.
7. **F4-colectivos-7** — Arribos de parada: si fallan sin datos, no se muestra nada (igual que la lista vacía, N4).

## Línea y mapa (tarea 4.6)

Ruta `/colectivos/[linea]` (`linea` = `lineaId`, el `route_id` del proxy; opcional `?parada=<paradaId>`, F4-colectivos-6) que monta `LineaScreen.tsx`. Brief: `docs/briefs/02-colectivos.md` §3, §5 y §6 (S10, S24, S29, S31).

**Qué se ve:**

- Mapa casi a pantalla completa (`MapaLinea.tsx`):
  - recorrido aproximado del número (punteado);
  - paradas del número desde zoom 14;
  - punto de la persona si ya dio permiso;
  - vehículos: círculo con el número encima, hit box de 44 pt.
- Panel abajo con tres alturas (`BottomPanel` de `shared/map`, contenido en `VehiculosSheet.tsx`):
  - **Colapsado:** la banda fija de señal (ver «Brief operativo F5»), `FreshnessLabel`, `FavoriteToggle` y "Actualizar" (en lugar de pull to refresh).
  - **Medio:** ramales (`Chip`s) y la nota del sentido.
  - **Expandido:** la lista de vehículos ("Interno 1404", "a 600 m de vos", "hace 25 s"). La distancia aparece solo con permiso.
- Tocar un vehículo, en el mapa o en la lista, lo resalta y la banda del panel se vuelve a señalizar con él; aparece "Seguir". Seguir mueve la cámara con él en cada actualización, con háptico de selección; con Reducir movimiento, salta.
- **Controles:** "Centrar en mi ubicación" pide el permiso en contexto con `useUbicacion().request()`. También están "Norte arriba", la franja de iOS para el gesto de volver y las áreas seguras.
- **Polling:** `usePosicionesLinea(lineaId, { enabled: useIsFocused() })`, solo con la pantalla a la vista.

| Estado                             | Qué se ve                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Carga                              | Mapa al instante (CABA y después encuadre); en el panel, skeleton del encabezado y "Buscando colectivos…" |
| Normal                             | Marcadores y la banda con el conteo y la antigüedad del dato, con frescura                                |
| 0 vehículos                        | Banda «Sin colectivos con GPS ahora» + frescura (vacío real, F5-colectivos-4)                             |
| Vehículo con más de 5 min          | Su marcador atenuado; la lista dice su edad (S31)                                                         |
| Feed con más de 10 min             | Todos atenuados + estado warning "Las posiciones pueden no ser actuales" en la banda (F5-colectivos-5)    |
| Actualización fallida con datos    | Todos atenuados + Alert "No pudimos actualizar. Mostramos lo último que sabemos." con "Reintentar"        |
| Error sin datos                    | Mapa sin marcadores + `ErrorState` en el panel con `error.userMessage()` y "Volver a intentar"            |
| No disponible (`retryable: false`) | "Las posiciones de colectivos no están disponibles por ahora", sin reintento                              |
| Sin conexión                       | Últimas posiciones atenuadas, con su antigüedad; el `OfflineBanner` es global                             |

**Suposiciones nuevas:**

1. **F4-colectivos-mapa-1.** El panel vive dentro de la pantalla (`BottomPanel`), no es la `formSheet` nativa. La `formSheet` es una ruta modal: un gesto la cierra y el "volver" choca con el stack. Este panel tiene que quedar siempre, al menos colapsado. La `formSheet` sigue siendo la opción para detalles pasajeros sobre un mapa (`shared/map/README.md`).
2. **F4-colectivos-mapa-2.** "Interno" es el `id` del vehículo del feed (`VehiculoV1.id`). El contrato no trae `label` aparte, y la patente no se muestra nunca.
3. **F4-colectivos-mapa-3.** Clustering: con más de 80 vehículos, `cluster` del `GeoJSONSource` hasta zoom 13, con radio de 40. Tocar un grupo acerca la cámara a zoom 14.
4. **F4-colectivos-mapa-4.** El feed no informa el sentido. Se muestran todos los vehículos del ramal y la nota lo dice: "El GPS de los colectivos no informa el sentido: ves los de las dos direcciones." El selector es de ramal: los `lineaId` del mismo número, del índice.
5. **F4-colectivos-mapa-5.** La flecha ▲ (glifo de `Noto Sans Regular`, rotado por `rumbo` con `text-rotation-alignment: map`) se dibuja solo si el vehículo trae `rumbo`. Hoy el proxy manda `rumbo: null`: no se inventa una dirección.
6. **F4-colectivos-mapa-6.** Sin crossfade (S29): MapLibre no anima un `setData` de un `GeoJSONSource`, así que el marcador salta a la posición nueva. Es lo mismo que pide Reducir movimiento.
7. **F4-colectivos-mapa-7.** El contrato v1 no trae alertas de colectivos: el nivel medio no muestra alertas, en vez de mostrar un vacío.
8. **F4-colectivos-mapa-8.** El recorrido es el del número (`recorridos-colectivos.geojson` trae uno por número, aproximado), no el del ramal. Por eso va punteado.
9. **F4-colectivos-mapa-9.** Las paradas son las del número en los dos sentidos (`paradasDeNumero`). Aparecen recién desde zoom 14 para no tapar los vehículos.
10. **F4-colectivos-mapa-10.** La cámara se encuadra una sola vez: la parada de `?parada=` (zoom 16); si no hay, el recorrido; si no hay, los vehículos. Después solo la mueven la persona y "Seguir". Al cambiar de ramal se vuelve a encuadrar.
11. **F4-colectivos-mapa-11.** Con permiso de ubicación, la lista ordena por cercanía a la persona (el más cercano primero; `metros` en `VehiculoVista`). Sin permiso o sin posición, por el dato más reciente y después por interno. (Corregido tras la validación en el iPhone del 2026-11-03: antes ordenaba siempre por dato reciente.)

**Datos:**

- **Índice:** línea, ramales y paradas salen de `useIndiceColectivos()` (archivos grandes).
- **Recorrido:** sale de `useStaticArchivoGrande('recorridos-colectivos.geojson')`, guardado en MMKV fuera de la caché de TanStack.
- **Posiciones:** vienen de `usePosicionesLinea`.

**Tests:**

- `test/colectivos/pantallas.test.tsx` cubre la raíz y la parada con la forma F5: placas, filas, flechas, «Ver más», recientes, favoritos como bandas y arribos en la fila.
- `test/colectivos/linea.test.tsx` cubre fuentes y capas, el polling solo de la línea abierta, 0 vehículos, el agrupamiento, la atenuación por vehículo y por feed, el error con reintento, el feed no disponible, seguir un vehículo, la lista, los grupos, el cambio de ramal, la apertura desde una parada, "Centrar en mí" con permiso en contexto y la distancia, "Actualizar" y el botón del panel.
- `__tests__/lineaModel.test.ts` cubre las funciones puras, incluida `bandaDelPanel` (contenido de la banda por estado); `__tests__/model.test.ts`, `textoDeLineas`.
