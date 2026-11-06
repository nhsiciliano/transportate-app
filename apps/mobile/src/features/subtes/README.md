# features/subtes

Subtes: estado por línea, alertas, estaciones y arribos por sentido (Fase 4, tareas 4.1, 4.2, 4.11 y 4.12). Brief de diseño: [`docs/briefs/03-subtes.md`](../../../../../docs/briefs/03-subtes.md). Rutas finas en `src/app/(tabs)/subtes/`; el mapa (`subtes/mapa.tsx`, tarea 4.3) es de otra tarea.

## Brief operativo F5 («Señalética de terminal», F5-HIGH-B)

Contrato de dirección: [`.impeccable/surfaces/src-features-subtes-subtesscreen-tsx.md`](../../../.impeccable/surfaces/src-features-subtes-subtesscreen-tsx.md) (hereda el mundo de Inicio). Subtes es el **tablero de estado de la red** y la estación es el **cartel de andén**. El mundo aporta tipografía (Fira Sans), paleta Obelisco v2 intacta, densidad y el fundido de `SignBand`; header, large title, gesto de volver y controles son los nativos. Fondo de las tres pantallas: `bg.elevated` en claro, `bg.base` en oscuro (`useFondo()`), 12 pt entre bloques.

**Raíz** (`SubtesScreen`): `SearchInput` «Buscá una estación» arriba; las 7 líneas, **una placa por línea** (`Board layout="cards"`, `testID="subtes-lineas"`; pedido del usuario del 2026-11-06: placas del mismo material a 8 pt, sin sombra ni chips; el skeleton también va en placas sueltas; orden fijo A, B, C, D, E, H, Premetro). Cada fila (`Board.Row`, `linea-<key>`): disco `LineBadge` de 32 (borde decidido contra `bg.card`), título «Línea B» / «Premetro» 17/600, cabeceras 13 `text.secondary`, el `resumen` de la alerta más severa como nota (warning/danger según el estado) y, a la derecha, `Board.Status` (`EstadoBoard`): «Normal» en `text.secondary`, «Con demoras» con cuadrado ámbar, «Interrumpida» con cuadrado rojo, «Sin información» atenuado. Flecha `irA` al borde: cada fila abre `/subtes/[linea]`. Debajo, `FreshnessLabel` y una placa de una fila «Mapa de la red» (`Pictogram mapa` tono placa, flecha) → `/subtes/mapa`; el botón «Ver mapa» de arriba ya no está. Con texto en la búsqueda, los resultados van en una placa (`subtes-resultados`): disco de 24, estación, «Línea B» y flecha; sin resultados, el `EmptyState` de siempre.

**Línea** (`LineaScreen`): título nativo «Línea B»/«Premetro» y la estrella (`FavoriteToggle`, 44×44) en `headerRight`. Primera pieza, una `SignBand` `lead` **fija** (sin `onPress`, sin flecha: ya estás ahí), `linea-banda`: pictograma `subtes`, «Línea B · Leandro N. Alem – Juan Manuel de Rosas», valor = estado en escala texto («Normal», «Con demoras») y, si hay problema, el cuadrado ámbar/rojo con «N alertas» (o el estado si no hay alertas). `transitionKey` = estado: si cambia, la banda cruza en fundido. Después «Alertas» (rótulo 13/600) con un `Alert` por alerta o «Sin novedades informadas», su frescura, y la placa «Estaciones» con el **trazo de recorrido**: a la izquierda de cada fila un riel de 24 pt con el trazo del color de la línea (dato GTFS) a todo el alto y el punto de la estación; el separador arranca después del riel (`separatorInset` 48) para que el trazo siga continuo. Fila: nombre, «Ramal Centro Cívico» como subtítulo en la primera estación de cada ramal del Premetro, «Con novedades» (warning) si la estación figura en una alerta, flecha → estación.

**Estación** (`EstacionScreen`): título nativo con el nombre (sin la letra) y la estrella en `headerRight`. Debajo, una fila de contexto (`estacion-contexto`, ≥ 44 pt): disco de 32 y «Línea B · Leandro N. Alem – Juan Manuel de Rosas» en 15 `text.secondary`; toca → la línea. La alerta resumida de la línea como antes (toca → línea). Después, **una `SignBand` `lead` fija por sentido** (`agruparArribos`, `bloque-<cabecera>`): pictograma `estacion`, «Hacia Leandro N. Alem», «Próximo», el primer arribo a 56 pt («4 min», «Llegando») y como estado muted «Después 7 y 12 min» (o «Único informado»). Sin arribos en un sentido: «Sin trenes informados» (escala texto). Con dato de más de 10 min (S30): «Dato de hace N min» (escala texto) y estado «Puede no reflejar la situación actual». `transitionKey` = `${cabecera}:${primer arribo}`: cuando cambia el próximo tren, la banda se vuelve a señalizar con el fundido (corte seco con Reducir movimiento). `FreshnessLabel` al pie.

**Mapa de la red:** sin cambios (los controles ya usan `Icon` y componentes compartidos; la tipografía es Fira Sans por el tema).

| Estado          | Raíz                                                                                | Línea                                                     | Estación                                                                 |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Carga sin caché | `Board.Skeleton` de 7 filas                                                          | Silueta: banda `lead` + placa de 6 filas                  | `SignBand.Skeleton` `lead` por sentido                                   |
| Vacío           | Búsqueda sin resultados: `EmptyState`                                                | Línea inexistente: `EmptyState`                           | Estación inexistente: `EmptyState`; sentido sin trenes: «Sin trenes informados» |
| Error sin datos | Las 7 filas con «Sin información» + `ErrorState` con reintento (F4-subtes-4)         | `ErrorState` en alertas; banda con «Sin información»       | `ErrorState` en lugar de las bandas (sin reintento si es 404)            |
| Error con datos | Alert en línea «No pudimos actualizar…» + «Reintentar»                               | ídem                                                      | ídem                                                                     |
| Dato viejo      | `FreshnessLabel` en warning                                                          | ídem en alertas                                           | > 10 min: la banda dice «Dato de hace N min» + aviso (S30)                |
| Sin conexión    | `OfflineBanner` global + lo persistido                                               | ídem                                                      | ídem                                                                     |
| Sin permiso     | — (Subtes nunca pide ubicación; el mapa centra solo con el permiso ya dado)          | —                                                         | —                                                                        |

### Contraste (F5)

Calculado con la función `ratio` de `tools/contraste/contraste.py`. Las bandas usan los pares ya verificados en `features/inicio/README.md` (lead `#035c80` / `#67a5cd`).

| Esquema | Par                                                         | Primer plano | Fondo     | Ratio   | Mínimo | Cumple |
| ------- | ----------------------------------------------------------- | ------------ | --------- | ------- | ------ | :----: |
| claro   | título de fila (`text.primary`) / placa                     | `#08202f`    | `#ffffff` | 16,69:1 | 4,5    |   ✅   |
| claro   | cabeceras / subtítulo (`text.secondary`) / placa            | `#4a5766`    | `#ffffff` | 7,38:1  | 4,5    |   ✅   |
| claro   | nota warning / danger / placa                               | `#a25c00` / `#cb3232` | `#ffffff` | 5,16 / 5,20:1 | 4,5 | ✅ |
| claro   | flecha (`text.secondary`) / placa                           | `#4a5766`    | `#ffffff` | 7,38:1  | 3      |   ✅   |
| claro   | borde del cuadrado de estado (`text.primary`) / placa       | `#08202f`    | `#ffffff` | 16,69:1 | 3      |   ✅   |
| claro   | `Pictogram` placa (`primary.base`) / placa; ícono / cuadrado | `#1d3343` / `#ffffff` | `#ffffff` / `#1d3343` | 13,07:1 | 3 | ✅ |
| claro   | subtítulo presionado (`bg.pressed`)                         | `#4a5766`    | `#d6e4f6` | 5,72:1  | 4,5    |   ✅   |
| claro   | contexto de estación (`text.secondary`) / fondo             | `#4a5766`    | `#edf4ff` | 6,67:1  | 4,5    |   ✅   |
| oscuro  | título / placa                                              | `#edf4ff`    | `#1b2836` | 13,53:1 | 4,5    |   ✅   |
| oscuro  | subtítulo / placa                                           | `#c7d4e6`    | `#1b2836` | 9,97:1  | 4,5    |   ✅   |
| oscuro  | nota warning / danger / placa                               | `#ffa341` / `#ff7266` | `#1b2836` | 7,53 / 5,59:1 | 4,5 | ✅ |
| oscuro  | borde del cuadrado de estado / placa                        | `#edf4ff`    | `#1b2836` | 13,53:1 | 3      |   ✅   |
| oscuro  | `Pictogram` placa / placa; ícono / cuadrado                 | `#a4d9ff` / `#08202f` | `#1b2836` / `#a4d9ff` | 9,94 / 11,09:1 | 3 | ✅ |
| oscuro  | contexto de estación / fondo                                | `#c7d4e6`    | `#000b18` | 13,18:1 | 4,5    |   ✅   |

- El ámbar solo da 2,66:1 contra la placa blanca: por eso el cuadrado de estado lleva borde `text.primary` (y siempre texto al lado).
- El hairline `border.subtle` (1,29:1) es decorativo: las filas se separan también por su contenido y su área táctil.
- Los discos y el trazo usan los colores GTFS como datos; el disco decide su borde contra `bg.card` (WCAG 1.4.11, `LineBadge`).

### Suposiciones nuevas (Fase 5)

1. **F5-subtes-1** — `FilaTocable` y `Seccion` siguen exportados porque Colectivos todavía los usa (lo rehace mid-dev en paralelo); Subtes ya no los usa.
2. **F5-subtes-2** — En la banda de la línea, el cuadrado de estado lleva «N alertas» (o el estado si no hay alertas cargadas) en vez de repetir el valor: el color nunca va solo y la banda suma información.
3. **F5-subtes-3** — El sentido sin trenes se muestra igual como banda («Sin trenes informados»): con el feed congelado, es lo normal y la estructura del andén no cambia. Reemplaza el `EmptyState` «No hay próximos trenes…» de la Fase 4.
4. **F5-subtes-4** — Con dato de más de 10 min, todas las bandas del andén dicen «Dato de hace N min» y no se muestran tiempos (S30, como en la Fase 4).
5. **F5-subtes-5** — El ramal del Premetro se nombra como subtítulo de la primera estación de cada ramal (antes era un rótulo suelto entre filas): dentro de una placa no hay encabezados intermedios.
6. **F5-subtes-6** — Las estaciones afectadas por una alerta llevan la nota «Con novedades» (warning) en lugar del ícono de alerta a la derecha.
7. **F5-subtes-7** — La estación ya no repite la letra en el título (`Medrano`, no `Medrano (B)`): la línea va en la fila de contexto.

## Brief operativo F4 (tarea 4.1, historial)

**Raíz "Subtes"** (`SubtesScreen`): 7 filas en orden fijo A, B, C, D, E, H, Premetro. Cada fila es un solo botón: `LineBadge`, cabeceras ("Plaza de Mayo – San Pedrito"), `StatusChip` y el `resumen` de la alerta más severa en 1 línea. Arriba: `SearchInput` "Buscá una estación" y botón "Ver mapa". Abajo de las filas: `FreshnessLabel` del estado.

**Línea** (`LineaScreen`, `/subtes/[linea]`): `LineBadge` grande, cabeceras, `StatusChip`, `FavoriteToggle`. Alertas de la línea completas (una `Alert` por alerta, con "Desde las 14:05" si hay período) o "Sin novedades informadas". Estaciones en orden de recorrido con un trazo vertical del color de la línea; cada estación abre su detalle.

**Estación** (`EstacionScreen`, `/subtes/estacion/[id]`): nombre, `LineBadge`, `FavoriteToggle`, alerta resumida de la línea (toca → línea), un bloque "Hacia <cabecera>" por sentido con hasta 3 arribos ("Llegando", "2 min"; el primero grande) y `FreshnessLabel`.

| Estado          | Raíz                                                                             | Línea                            | Estación                                                                                                          |
| --------------- | -------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Carga sin caché | Skeleton de 7 filas                                                              | Skeleton de encabezado y filas   | Nombre y línea ya visibles (estático) + skeleton de 2 bloques de 3 filas                                          |
| Vacío           | Búsqueda: "No encontramos «X». Probá con otro nombre de estación."               | "Sin novedades informadas"       | "No hay próximos trenes informados para esta estación."                                                           |
| Error sin datos | Filas con "Sin información" + `ErrorState` con `userMessage()`                   | ídem en el chip y en las alertas | `ErrorState` en arribos; con `retryable: false`: "Los próximos arribos no están disponibles por ahora", sin botón |
| Error con datos | `Alert` "No pudimos actualizar. Mostramos lo último que sabemos." + "Reintentar" | ídem                             | ídem                                                                                                              |
| Dato viejo      | `FreshnessLabel` en warning                                                      | ídem                             | > 10 min: los tiempos se reemplazan por "Dato de hace X min" atenuado (S30)                                       |
| Sin conexión    | `OfflineBanner` global (montado en `src/app/_layout.tsx`) + lo persistido        | ídem                             | ídem                                                                                                              |

Pull to refresh nativo en las tres pantallas (refresca estado, alertas y arribos; el estático no).

### Suposiciones nuevas

1. **F4-subtes-1** — Premetro es una sola fila (S8) con clave de app `PM` (ruta `/subtes/PM`, favorito `linea_subte:PM`). Su estado es el más severo de `PM-C` y `PM-S`; sus alertas, la unión de las de los dos ramales. Sus estaciones van en el orden del ramal General Savio y después las dos exclusivas del ramal Centro Cívico, marcadas "Ramal Centro Cívico".
2. **F4-subtes-2** — Las cabeceras se arman con el nombre normalizado de la primera y la última estación del recorrido ("Plaza de Mayo – San Pedrito"), no con `nombre` del GTFS (que trae guion y nombres cortos). Premetro: "Intendente Saguier – General Savio / Centro Cívico".
3. **F4-subtes-3** — Los arribos se agrupan por sentido comparando `destino` (sin tildes ni mayúsculas) con la cabecera del sentido o con el nombre de su última estación. Un destino que no coincide con ningún sentido arma su propio bloque "Hacia <destino>". En una estación terminal se muestra solo el sentido que sale.
4. **F4-subtes-4** — Con el estado caído y sin caché, la raíz igual lista las 7 líneas (con "Sin información") arriba de un `ErrorState`: el estático sigue sirviendo para buscar y navegar.
5. **F4-subtes-5** — La búsqueda ignora tildes, mayúsculas y signos de puntuación; busca en el nombre normalizado y en el del GTFS. Los resultados reemplazan a la lista de líneas mientras hay texto.
6. **F4-subtes-6** — "Llegando" para < 30 s (S30); el resto se redondea hacia arriba en minutos ("1 min" desde 30 s). El umbral de 10 min de S30 se mide con `sourceTimestamp` del feed.
7. **F4-subtes-7** — La alerta resumida en la estación es la más severa de la línea (la del `resumen` del estado); `Alert` `system` danger si la línea está interrumpida, warning si no.

## Lo que quedó

| Archivo                                                       | Qué hace                                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model.ts`                                                    | Funciones puras: `buildRed` (7 líneas + 108 estaciones, Premetro unificado), `estadoDeLinea`, `alertasDeLinea`, `periodoAlerta`, `buscarEstaciones`, `agruparArribos`, `formatArribo` |
| `hooks.ts`                                                    | `useRedSubte`, `useLineasSubte`, `useEstacionesSubte`, `useLineasConEstado`, `useLineaDetalle`, `usePullToRefresh`                                                                    |
| `components.tsx`                                              | `EstadoChip` (StatusChip con `Icon`), `LineaBadge`, `AvisoAlert`, `RefreshErrorAlert`, `ScreenScroll` (scroll + `RefreshControl`), `FilaTocable`, `Seccion`                           |
| `SubtesScreen.tsx` / `LineaScreen.tsx` / `EstacionScreen.tsx` | Las tres pantallas; cada una pone su título con `Stack.Screen options`                                                                                                                |

- **Datos:** el estático sale de `useStaticArchivo` (`src/shared/static`); el tiempo real, solo de los hooks de `shared/api`. Los colores de línea son los únicos que no vienen del tema: llegan como datos del estático.
- **Arribos:** se recalculan con `horaEstimada` contra un reloj que avanza cada 15 s, así un dato de la caché no muestra "2 min" de hace un rato. Se descartan los que pasaron hace más de 30 s, igual que el proxy.
- **Mapa de la red (4.3):** hecho, en `MapaRedScreen.tsx` (ruta `subtes/mapa.tsx`; ver `shared/map/README.md`).
- **Pendiente para otras tareas:** combinaciones ("Combinás con D"), porque el estático no trae `transfers.txt`; "El servicio no está funcionando a esta hora", porque el estático no trae horarios.
- **Tests:** `test/subtes/` (pantallas y `useStaticArchivo`) y `__tests__/model.test.ts`.
