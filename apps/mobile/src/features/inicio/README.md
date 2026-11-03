# features/inicio

Inicio: estado del subte y favoritos de un vistazo (Fase 4, tareas 4.1, 4.4, 4.11 y 4.12). En la Fase 5 (F5-HIGH-A) es el **piloto de la dirección «Señalética de terminal»**: contrato en [`.impeccable/surfaces/src-features-inicio-inicioscreen-tsx.md`](../../../.impeccable/surfaces/src-features-inicio-inicioscreen-tsx.md), boceto en `.impeccable/mocks/decision/senal-terminal.html`. Brief de diseño: [`docs/briefs/01-inicio.md`](../../../../../docs/briefs/01-inicio.md). Ruta fina: `src/app/(tabs)/inicio/index.tsx`; Ajustes se abre desde el botón del header (`inicio/_layout.tsx`, S2).

## Brief operativo (piloto «Señalética de terminal», F5-HIGH-A)

Inicio es una cadena de decisiones: cada favorito es una **banda de señal** que responde «¿cuándo viene?» con el minuto en escala monumental y una flecha al detalle. La dirección aporta solo tipografía (Fira Sans), paleta (Obelisco v2 intacta), densidad y un movimiento firma; tabs nativas, large title, gesto de volver y controles del sistema quedan como estaban.

**Inicio** (`InicioScreen`), una columna con scroll y pull to refresh sobre `bg.elevated` (`#edf4ff`) en claro y `bg.base` en oscuro, con 12 pt entre bloques:

1. **Header:** large title "Inicio" en iOS y botón de engranaje "Ajustes" (44×44).
2. **Alert destacada** (solo con líneas **interrumpidas**; `Alert` `system` danger), igual que en la Fase 4: una línea → "Línea B interrumpida" + `resumen` + "Ver la línea"; varias → "N líneas con problemas" + "Ver el subte"; las 7 → "El subte no está funcionando". Con demoras no hay Alert.
3. **Tira «Subte ahora»:** tarjeta `bg.card`, outline 1 px `border.subtle`, radio 6, padding 10. Etiqueta (13, 600, `text.secondary`), las 7 `LineBadge` de 28 en orden fijo y una línea de estado de 13 pt (`resumenSubte`):
   - con problemas: «B con demoras · <resumen>», «B y D con demoras», «B interrumpida · …», «B interrumpida · D con demoras» (danger si hay interrumpidas, si no warning);
   - todo normal: «Todas las líneas funcionan con normalidad» (`text.secondary`);
   - sin dato de algunas: «Sin información de H y Premetro».
   Toda la tira es un botón → `/subtes`.
4. **Bandas de favoritos** (`SignBand`, gap 8): los primeros 5 en el orden guardado.
   - **Líder** (`lead`): el favorito **más cercano** si el permiso de ubicación **ya está concedido** (`useUbicacion({ watch: false })`, sin pedirlo, S32). Compiten las estaciones (posición del estático de subte) y las paradas (`paradas.json`, solo se carga si hay una parada entre los visibles); las líneas no. Sin permiso, sin posición o sin candidatos: el primero. Se dibuja primera; el resto sigue en el orden guardado como `next`.
   - **Mensaje:** el alias o el nombre con su contexto (`mensajeDeFavorito`): «Línea B · Medrano hacia Leandro N. Alem» (el sentido sale del tren más próximo), «Línea 152 · Ramal A», «Línea D · Congreso de Tucumán – Catedral», «Parada Cabildo 2000».
   - **Valor** (`primary` de `useFavoritoLiveData`): primer arribo («4 min», «Llegando»), «N en servicio», el estado de la línea de subte («Normal», «Con demoras»), las líneas de una parada, «Sin arribos», «Sin información» o «Ya no figura». Solo los arribos van a escala monumental (56 pt en la líder) con el rótulo «Próximo»; el resto va a 28 pt en la líder y a 24 en las demás (`valueStyle: 'text'`).
   - **Estado:** estación de una línea con demoras → cuadrado ámbar «Con demoras»; interrumpida → cuadrado rojo «Interrumpida»; dato viejo → «hace 6 min» (sin cuadrado, o sumado al estado de la línea).
   - Tocar abre `hrefDeFavorito` (como en la Fase 4). Cada banda es un solo elemento accesible: «Estación Medrano, Línea B, Hacia Leandro N. Alem en 4 minutos, con demoras».
5. **Fila meta:** `FreshnessLabel` con el dato más viejo de lo visible (bandas y tira) y «Ver todos los favoritos (N)» (15, 600, `text.link`, área táctil ≥ 44) → `/favoritos`.
6. **Sin favoritos:** `EmptyState` (copy `SIN_FAVORITOS` + «Explorar subtes») y la frescura de la tira.

**Movimiento firma:** cuando cambia el favorito líder o su valor, el contenido de la banda líder cruza en fundido de 200 ms (`SignBand`, `transitionKey`); con Reducir movimiento, corte seco. Un refresco sin cambio de valor no anima, y del skeleton al primer valor tampoco.

**Orden de lectura:** Alert → tira → bandas → frescura → «Ver todos». Con Dynamic Type al máximo (tope 1.2 en el valor, 1.3 en texto) las bandas crecen en alto; el mensaje trunca con elipsis, el valor y el estado no (el valor monumental se achica antes que cortarse).

| Estado          | Tira «Subte ahora»                                                                         | Bandas de favoritos                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Carga sin caché | Skeleton con la silueta de la tira (etiqueta, 7 discos, línea)                             | Se muestran ya (MMKV) con el mensaje; el valor en skeleton del color de la banda           |
| Vacío           | —                                                                                          | `EmptyState` «Guardá tus líneas, paradas y estaciones para verlas acá.» + «Explorar subtes» |
| Error sin datos | `ErrorState` compacto **dentro de la tira**, con `userMessage()` y reintento si `retryable` | «Sin información» en escala de texto; la banda sigue abriendo el detalle                   |
| Error con datos | Alert en línea «No pudimos actualizar. Mostramos lo último que sabemos.» + «Reintentar»     | —                                                                                         |
| Dato viejo      | Cuenta para la frescura de la fila meta (warning > 3·R, aviso > 10 min)                    | El valor igual + «hace 6 min»; la fila meta en warning                                    |
| Sin conexión    | `OfflineBanner` global + lo persistido                                                     | ídem                                                                                      |
| Sin permiso     | —                                                                                          | La líder es el primer favorito; nunca se pide el permiso acá (S32)                        |
| Huérfano        | —                                                                                          | «Ya no figura»; la banda abre el detalle, que explica el caso                              |

### Contraste de la banda (`tools/contraste/contraste.py`, fórmula WCAG 2.x)

Calculado con la función `ratio` del script (los colores al 80/85 % se mezclan con el fondo de la banda). Mínimo: 4,5:1 texto, 3:1 elementos gráficos.

| Esquema | Banda  | Par                                     | Primer plano | Fondo     | Ratio   | Cumple |
| ------- | ------ | --------------------------------------- | ------------ | --------- | ------- | :----: |
| claro   | lead   | mensaje, valor y flecha (`on`)          | `#ffffff`    | `#035c80` | 7,38:1  |   ✅   |
| claro   | lead   | «Próximo» al 80 %                       | `#cddee6`    | `#035c80` | 5,34:1  |   ✅   |
| claro   | lead   | estado 12 pt al 85 %                    | `#d9e7ec`    | `#035c80` | 5,83:1  |   ✅   |
| claro   | next   | mensaje, valor y flecha (`on`)          | `#ffffff`    | `#1d3343` | 13,07:1 |   ✅   |
| claro   | next   | «Próximo»/estado al 80–85 %             | `#d2d6d9`    | `#1d3343` | 8,94:1  |   ✅   |
| claro   | ambas  | pictograma / cuadrado                   | `#ffffff`    | `#08202f` | 16,69:1 |   ✅   |
| claro   | lead   | cuadrado del pictograma / banda         | `#08202f`    | `#035c80` | 2,26:1  |   ⚠️   |
| claro   | next   | cuadrado del pictograma / banda         | `#08202f`    | `#1d3343` | 1,28:1  |   ⚠️   |
| claro   | ambas  | borde del cuadrado de estado (`on`)     | `#ffffff`    | bandas    | ≥ 7,38:1 |  ✅   |
| oscuro  | lead   | mensaje, valor y flecha (`on`)          | `#000b15`    | `#67a5cd` | 7,41:1  |   ✅   |
| oscuro  | lead   | «Próximo» al 80 %                       | `#152a3a`    | `#67a5cd` | 5,51:1  |   ✅   |
| oscuro  | lead   | estado 12 pt al 85 %                    | `#0f2231`    | `#67a5cd` | 6,06:1  |   ✅   |
| oscuro  | next   | mensaje, valor y flecha (`on`)          | `#08202f`    | `#a4d9ff` | 11,09:1 |   ✅   |
| oscuro  | next   | «Próximo» al 80 %                       | `#274559`    | `#a4d9ff` | 6,70:1  |   ✅   |
| oscuro  | lead   | cuadrado del pictograma / banda         | `#000b18`    | `#67a5cd` | 7,39:1  |   ✅   |
| oscuro  | next   | cuadrado del pictograma / banda         | `#000b18`    | `#a4d9ff` | 13,15:1 |   ✅   |
| oscuro  | ambas  | pictograma / cuadrado                   | `#edf4ff`    | `#000b18` | 17,89:1 |   ✅   |
| oscuro  | ambas  | borde del cuadrado de estado (`on`)     | oscuro       | bandas    | ≥ 7,41:1 |  ✅   |
| claro   | tira   | estado warning / danger / secundario    | `#a25c00` / `#cb3232` / `#4a5766` | `#ffffff` | 5,16 / 5,20 / 7,38:1 | ✅ |
| claro   | meta   | «Ver todos» (`text.link`) / fondo       | `#035c80`    | `#edf4ff` | 6,67:1  |   ✅   |
| oscuro  | tira   | estado warning / danger / secundario    | `#ffa341` / `#ff7266` / `#c7d4e6` | `#1b2836` | 7,53 / 5,59 / 9,97:1 | ✅ |

- **Cuadrado del pictograma en claro (⚠️):** el contrato pide `#08202f` sobre las dos bandas y no llega a 3:1 contra ellas. El pictograma, que es lo que lleva la información, tiene 16,69:1 contra su cuadrado (WCAG 1.4.11 se cumple para el ícono); el cuadrado es un **contenedor decorativo** y no es un elemento accesible aparte (la banda entera es el único). Opción A, confirmada por el coordinador (F5-inicio-7).
- **Cuadrados de estado:** el relleno ámbar o rojo no llega a 3:1 sobre los azules de Obelisco (de 1,00 a 4,91:1); por eso llevan un borde de 1 pt en el color `on` de la banda, que sí llega (≥ 7,38:1). El texto al lado («Con demoras») dice lo mismo: el color nunca es el único canal.

### Suposiciones (Fase 4)

1. **F4-inicio-1** — Sin menú contextual con long press (el brief lo propone): las acciones sobre un favorito viven en el tab Favoritos. Sin reordenar acá.
2. **F4-inicio-2** — Tocar un favorito abre su detalle en el tab correspondiente: línea o estación de subte → `/subtes/…`; línea de colectivo → `/colectivos/[linea]`; parada → `/colectivos/parada/[id]` (S3).
3. **F4-inicio-3** — La Alert destacada usa el `resumen` del estado (`header_text` de la alerta más severa) para no pedir `/v1/subtes/alertas` en Inicio. Premetro cuenta como una línea (S8).
4. **F4-inicio-4** — El nombre corto de cada fila es el de la línea ("Línea B", "Premetro"); las cabeceras viven en Subtes.
5. **F4-inicio-5** — Sin bloque de Tránsito (N3: tab oculto).
6. **F4-inicio-6** — El pull to refresh refresca el estado del subte y las queries de los datos vivos (arribos y posiciones); el estático no.

### Suposiciones nuevas (Fase 5, piloto «Señalética de terminal»)

1. **F5-inicio-1** — Diferido: la parte del contrato «la decisión seguida se mantiene resaltada de pantalla en pantalla (Inicio → detalle)» queda para la extensión de la dirección a las otras pantallas. En el piloto, el movimiento firma es solo el fundido de la banda líder.
2. **F5-inicio-2** — La líder se elige entre los 5 visibles, solo entre estaciones de subte y paradas de colectivo (las líneas no tienen posición propia); la posición se lee una vez (`watch: false`) al montar y al volver a primer plano. Empates: gana el orden guardado.
3. **F5-inicio-3** — El cuadrado de estado de una banda (ámbar/rojo) solo aparece en las **estaciones** de subte, con el estado de su línea. En las bandas de **línea** de subte el valor ya es el estado («Con demoras»): repetirlo al lado sería ruido.
4. **F5-inicio-4** — Las paradas de colectivo muestran como valor las líneas que paran (estático), no arribos: el feed de arribos por parada suele venir vacío (N4) y `useFavoritoLiveData` no lo consulta, para no sumar polling a Inicio.
5. **F5-inicio-5** — Solo los arribos van a escala monumental (56 pt) con «Próximo»; los demás valores («2 en servicio», «Sin información») van a 28 pt en la líder para entrar sin cortarse. El mensaje de las bandas `next` usa 17/22 (como pide el brief) y no 15/20 (como el boceto).
6. **F5-inicio-6** — La frescura de la fila meta toma el dato más viejo de lo visible, **incluida la tira «Subte ahora»** (también es dato vivo en pantalla); sin favoritos se muestra igual, debajo del `EmptyState`. «Ver todos los favoritos (N)» se muestra siempre que haya al menos un favorito (es también el camino para gestionarlos).
7. **F5-inicio-7** — Cuadrado del pictograma en claro: `#08202f` como en el contrato, aunque no llegue a 3:1 contra las bandas (2,26 y 1,28:1). Es un contenedor decorativo: la información la lleva el pictograma blanco (16,69:1 contra el cuadrado, par verificado) y el cuadrado está oculto a la accesibilidad (la banda es el único elemento accesible). Los cuadrados de estado llevan borde `on` de 1 pt para llegar a 3:1. Confirmado por el coordinador (opción A, 2026-11-03).
8. **F5-inicio-8** — Del skeleton al primer valor no hay fundido (es la primera señal, no un cambio), y un refresco con el mismo valor tampoco anima.
