# Design

<!-- impeccable:design-schema 1 -->

> **Cómo se armó este archivo.** El skill **Impeccable** (`extract` / `document`) **no estaba disponible** en la sesión que lo generó (tarea 3.6, 2026-11-02), así que se escribió **a mano** con el esquema que pidió el plan: mismas secciones, citas a la fuente de cada valor y la marca **(suposición)** en todo lo que no sale de un documento del repo. No hay código de componentes todavía (la Fase 3 recién empieza), por lo que `extract` no tendría qué leer más allá de los tokens: la fuente de verdad de los valores es [`docs/02-obelisco-tokens.md`](docs/02-obelisco-tokens.md) (abreviado `tokens §x`) y la de las pantallas son los briefs de [`docs/briefs/`](docs/briefs/README.md). Cuando exista `shared/theme/tokens.ts` (tarea 3.3), este archivo se regenera con `extract` y se revisa contra el código. `PRODUCT.md` (qué es el producto y para quién) está en [`PRODUCT.md`](PRODUCT.md).

## Idea rectora _(suposición)_

Una herramienta pública, sobria y legible al sol: la app se parece más a una señalética de la Ciudad que a una app de consumo. Mucho contraste, pocas decoraciones, color con significado (rol de la acción, estado del servicio, línea de subte) y nunca como adorno. Es el modo **Operate** de `PRODUCT.md`: la persona viene a resolver una pregunta en segundos y con una mano; la marca vive en detalles precisos (color, tipografía, tono), no en el espectáculo.

## 1. Identidad y referencias

- **Sistema base: Obelisco v2** del GCBA, identidad **vigente** (la que publica el repo), adaptada a nativo. Repo: <https://github.com/gcba/Obelisco-v2>, commit `c85a37ef0521ff3473798beb68971bb0f231b544` (2026-10-25). Es un sistema **web** basado en Bootstrap 5.3.3: los valores (color, tipografía, espaciado, radios) se toman tal cual; los componentes se reinterpretan para React Native (`tokens §4`).
- **Confirmado por el usuario (2026-11-01):** colores de la identidad vigente — primary `#1d3343`, secondary `#035c80`, tertiary `#009688` (`tokens`, tabla "Discrepancia").
- **Desvío consciente de tipografía:** el Obelisco vigente usa **Archivo** para títulos; el brief del proyecto fija **Nunito** (títulos) + **Open Sans** (texto). Se respeta el brief (`docs/00-plan.md:13`; `PRODUCT.md`, Brand Commitments). La paleta histórica (`#336ACC`, export viejo `app/out`) **no se usa**.
- **Modo claro y oscuro de primera clase.** Obelisco no define modo oscuro: la paleta oscura está **derivada** de las mismas rampas (`tokens §6`) y verificada.
- **Adaptive:** navegación, gestos y controles son los de cada sistema (HIG en iOS, Material 3 en Android). Obelisco aporta color, tipografía y tono. Los controles del sistema (switches, segmentados, menús) conservan su tipografía nativa (S23).
- **Ícono-sistema:** Material Symbols Rounded, FILL 1 (ver §6).
- Referencias de plataforma (no se copian, se respetan): Human Interface Guidelines y Material Design 3 (`PRODUCT.md`, "Platform").

## 2. Color

Todos los valores salen de `docs/02-obelisco-tokens.md`; la columna "Cita" indica la sección o el `archivo:línea` del repo de Obelisco que ese documento registra. En código, cada token lleva un comentario con esa cita (tarea 3.3).

### 2.1 Roles de superficie y texto

| Rol                                | Claro                                                                       | Oscuro                                          | Cita                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `bg.base`                          | `#ffffff`                                                                   | `#000b18`                                       | claro: `dist:85` (`tokens §1.3`); oscuro: `tokens §6` (slate-950)                                                                            |
| `bg.elevated`                      | `#edf4ff` _(suposición: rol `light`)_                                       | `#121f2c`                                       | claro: `colors:142` (`tokens §1.2`); oscuro: `tokens §6` (slate-900)                                                                         |
| `bg.card`                          | `#ffffff` con outline 2 px `#d6e4f6`                                        | `#1b2836`                                       | claro: `colors:219` (`tokens §1.3`, `§3.3`); oscuro: `tokens §6` (única no primitiva: mezcla 50 % slate-900/slate-800)                       |
| `bg.pressed`                       | `#d6e4f6` _(suposición)_                                                    | `#253240`                                       | claro: slate-100 (`tokens §1.1`); oscuro: `tokens §6` (slate-800)                                                                            |
| `bg.disabled`                      | `#d6e4f6`                                                                   | `#253240` _(suposición)_                        | claro: `colors:208` (marcado "VER - REVISAR" en origen); oscuro: slate-800                                                                   |
| `text.primary`                     | `#08202f`                                                                   | `#edf4ff`                                       | claro: `colors:180` (`tokens §1.3`); oscuro: `tokens §6`                                                                                     |
| `text.secondary`                   | `#4a5766` _(suposición: slate-700)_                                         | `#c7d4e6`                                       | claro: Obelisco define `$body-secondary-color` `#000b18` (`colors:181`), más oscuro que el cuerpo; se usa slate-700 (7,38:1 verificado §7)   |
| `text.tertiary`                    | `#626e7e` _(suposición: slate-600)_                                         | `#92a0b1`                                       | oscuro: `tokens §6`; claro: slate-600 (5,18:1 sobre blanco, mismo par que la badge primaria default)                                         |
| `text.placeholder`                 | `#4a5766`                                                                   | `#92a0b1` _(suposición)_                        | claro: `colors:224`, `typo:166` (`tokens §1.3`)                                                                                              |
| `text.disabled`                    | `#92a0b1`                                                                   | `#626e7e`                                       | claro: `colors:207`, `typo:167`; oscuro: `tokens §6` (exento de contraste)                                                                   |
| `text.link`                        | `#035c80`                                                                   | `#82bfe8`                                       | claro: `colors:212`; oscuro: `tokens §6` (blue-300)                                                                                          |
| `text.inverse`                     | `#ffffff`                                                                   | `#08202f` _(suposición: `on-primary` oscuro)_   | claro: `typo:170`                                                                                                                            |
| `border.subtle` (solo decorativo)  | `#d6e4f6`                                                                   | `#253240`                                       | claro: `colors:216` (1,29:1, **no apto para controles**); oscuro: `tokens §6`                                                                |
| `border.strong` (controles)        | `#08202f`                                                                   | `#7a8697`                                       | claro: outline del input `c/form-text:215-226`; oscuro: `tokens §6` (slate-500)                                                              |
| `focus` (anillo de foco / teclado) | `#003832`, 4 px                                                             | `#73e6d5`, 4 px                                 | claro: `colors:191-192`; oscuro: `tokens §6` (cyan-200)                                                                                      |

### 2.2 Roles de acción y de estado

Cada rol tiene color de relleno, color del contenido encima (`on-*`) y, en los de estado, un contenedor suave para Alert y Badge.

| Rol                    | Claro: base / on                                  | Oscuro: base / on                | Contenedor claro (fondo / texto) | Contenedor oscuro (fondo / texto) | Cita                                                              |
| ---------------------- | ------------------------------------------------- | -------------------------------- | -------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| **primary**            | `#1d3343` / `#ffffff`                             | `#a4d9ff` / `#08202f`            | —                                | —                                 | `colors:135`, `c/button:24`; oscuro `tokens §6`                   |
| **secondary**          | `#035c80` / `#ffffff`                             | `#67a5cd` / `#000b15`            | —                                | —                                 | `colors:136`, `c/button:25`; oscuro `tokens §6`                   |
| **tertiary**           | `#009688` / `#08202f`                             | `#55cabb` / `#000d0a`            | —                                | —                                 | `colors:137`, `c/button:19,26`; oscuro `tokens §6`                |
| **danger**             | `#cb3232` / `#ffffff`                             | `#ff7266` / `#1b0200`            | `#fff0ee` / `#08202f`            | `#450200` / `#ffc5bd`             | `colors:141`, `colors:172-177`; oscuro `tokens §6`                |
| **success**            | `#00642f` / `#ffffff`                             | `#5bce80` / `#000d00`            | `#d0ffda` / `#08202f`            | `#002509` / `#87faa9`             | `colors:140`, `colors:172-177`; oscuro `tokens §6`                |
| **warning**            | `#e88700` / `#1d3343` (**texto: `#a25c00`**)      | `#ffa341` / `#120700`            | `#fff1e6` / `#08202f`            | `#2f1900` / `#ffc898`             | `colors:139`, `c/alert:85-98`; texto `c/badge:7-41`; `tokens §7`  |
| **info**               | `#00769a` / `#ffffff`                             | `#1ec6ff` / `#000c13`            | `#e7f6ff` / `#08202f`            | `#002230` / `#98dcff`             | `colors:138`, `colors:172-177`; oscuro `tokens §6`                |

Notas de uso (resuelven fallas de contraste de Obelisco, `tokens §7`):

- **Warning como texto** sobre blanco: `#a25c00` (orange-600), no `#c47100` (3,68:1). **Warning como relleno**: texto `primary` encima (4,91:1), nunca blanco (2,66:1).
- **Tertiary** lleva texto oscuro `#08202f` (4,55:1), no blanco.
- Los **bordes de control** usan `border.strong`; `border.subtle` es solo separador decorativo.

### 2.3 Líneas de subte

Los colores salen del GTFS oficial (`routes.txt`); siempre se muestra la **letra** de la línea sobre el color, y el texto usa el `route_text_color` del GTFS (`docs/02b-colores-subte.md`).

| Línea       | `route_color` | `route_text_color` | Observación                                                                                                                 |
| ----------- | ------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| A           | `#A5C8FF`     | `#000000`          | Celeste pastel del GTFS (la señalética es `#08B0E1`/`#00AEDC`). Para **trazos en mapa**, decisión abierta N2 (Fase 4).      |
| B           | `#FF0000`     | `#000000`          |                                                                                                                             |
| C           | `#0000FF`     | `#FFFFFF`          |                                                                                                                             |
| D           | `#00AC67`     | `#000000`          |                                                                                                                             |
| E           | `#8300BB`     | `#FFFFFF`          |                                                                                                                             |
| H           | `#FFF300`     | `#000000`          |                                                                                                                             |
| Premetro    | `#FFBD33`     | `#000000`          | Una sola fila aunque el GTFS tenga dos rutas (`PM-Civico`, `PM-Savio`) con el mismo color (S8).                             |

Las **líneas de colectivo** no tienen color oficial: insignia neutra con el número (S11).

## 3. Tipografía

- **Títulos y headlines: Nunito.** **Texto: Open Sans.** Pesos 400 / 600 / 700 (`PRODUCT.md`, Brand Commitments; `docs/versiones.md`, Fase 3).
- En React Native no hay cascada de familias ni `font-weight` sobre una familia cargada: hay **un `fontFamily` por peso**. Los nombres exactos, verificados en `@expo-google-fonts` 0.4.2:

| Peso | Nunito (títulos)     | Open Sans (texto)      |
| ---- | -------------------- | ---------------------- |
| 400  | `Nunito_400Regular`  | `OpenSans_400Regular`  |
| 600  | `Nunito_600SemiBold` | `OpenSans_600SemiBold` |
| 700  | `Nunito_700Bold`     | `OpenSans_700Bold`     |

- Sin itálicas, sin otros pesos y sin letter-spacing (Obelisco no define ninguno: `tokens §2`). Las fuentes se empaquetan en el binario; **ninguna se descarga en ejecución** (`docs/05-privacidad.md`).
- Base `1rem` = 16 px con line-height 24 (`typo:154-155`).

### 3.1 Escala (px / line-height px) — `tokens §2`

| Token                          | Tamaño (móvil) | Line-height | Peso | Familia  | Cita                              |
| ------------------------------ | -------------- | ----------- | ---- | -------- | --------------------------------- |
| `h1`                           | 38 (40 en tablet) | 48       | 700  | Nunito   | `typo:4,10,15,23`                 |
| `h2`                           | 34 (36)        | 44          | 600  | Nunito   | `typo:5,11,16,24`                 |
| `h3`                           | 30 (32)        | 44          | 600  | Nunito   | `typo:6,12,17,25`                 |
| `h4`                           | 28             | 36          | 600  | Nunito   | `typo:7,18,26`                    |
| `h5`                           | 24             | 32          | 600  | Nunito   | `typo:8,19,27`                    |
| `h6`                           | 20             | 28          | 600  | Nunito   | `typo:9,20,28`                    |
| `headline-lg`                  | 20             | 24          | 700  | Nunito   | `typo:70,75,80`                   |
| `headline-md`                  | 18             | 24          | 600  | Nunito   | `typo:71,76,81`                   |
| `headline-sm`                  | 16             | 20          | 600  | Nunito   | `typo:72,77,82`                   |
| `text-xl`                      | 20             | 28          | 400  | Open Sans | `typo:104,112,119`               |
| `text-lg`                      | 18             | 28          | 400  | Open Sans | `typo:105,113,120`               |
| `text-md` (cuerpo)             | 16             | 24          | 400  | Open Sans | `typo:107,114,121`               |
| `text-sm`                      | 14             | 20          | 400  | Open Sans | `typo:108,115,122`               |
| `text-xs`                      | 12             | 16          | 400  | Open Sans | `typo:109,116,123`               |

Para énfasis dentro de texto corrido se usan Open Sans 600 y 700 _(suposición: Obelisco usa peso 600/700 de la familia de texto en componentes, p. ej. botón `headline-md` a 700, `c/button:122-123`)_.

### 3.2 Escala de fuente del sistema

- Dynamic Type (iOS) y escala de fuente (Android) **activados** (`allowFontScaling`), con tope por `maxFontSizeMultiplier`: **1,3 en texto corrido y 1,2 en títulos y etiquetas de tab** _(suposición; el plan, tarea 3.4, pide un valor "razonable")_.
- A tamaños grandes las filas **crecen en alto**; nunca se trunca el estado de servicio ni la frescura del dato (`docs/briefs/README.md`).
- Los títulos de pantalla usan la escala móvil de Obelisco (h1 = 38 px, no 40) hasta ≥ 768 px (`bp:3`).

## 4. Espaciado y forma

### 4.1 Espaciado

Escala de **4 px**: `0, 4, 8, 16, 24, 48` (`space-units(n)` = n × 4 px, `mixins:1-5`; spacers de Bootstrap, `dist:8080-8101`). Gutter de pantalla **16 px** por lado (`bp:16`). Valores de componentes (`tokens §3.1`): botón 8×16 (md), 4×8 (sm), 12×20 (lg); card 24; alert 16; badge 4×8; input 12×16; nav-link 8×16.

### 4.2 Radios — `tokens §3.2`

| Token | px  | Dónde                                                               |
| ----- | --- | ------------------------------------------------------------------- |
| `md`  | 4   |                                                                     |
| `lg`  | 6   | Badge, Alert (`c/badge:3`, `c/alert:52-58`)                          |
| `xl`  | 8   | Badges estáticas (`c/badge:80,88`)                                  |
| `3xl` | 16  | Card en nativo _(suposición: el 32 px de la card web, `c/cards:63-70`, es excesivo en una pantalla de 360 pt; el brief deja el valor "a definir en Fase 3")_ |
| `pill` | 9999 | Botones, inputs, nav-links (`borders:14`)                          |

### 4.3 Sin sombras: outlines de 2 px

Obelisco **no usa sombras de elevación**: separa superficies con un outline de **2 px** (`$outline-border` `0.125rem solid $slate-100`, `colors:219`; card sin sombra, `c/cards:63-70`). En nativo:

- Superficies en claro: borde de 2 px `border.subtle` (decorativo) y fondo `bg.card`.
- Controles interactivos: outline de 2 px `border.strong` (input, botón outline: `c/button:206-207`, `c/form-text:215-226`).
- En oscuro la elevación se expresa por **luminosidad del fondo** (`bg.base` → `bg.elevated` → `bg.card`), no por sombra (`tokens §6`, criterio 4).
- Foco: anillo de **4 px** (`colors:192`); el anillo "sutil" de badges es de 2 px (`colors:193`).

### 4.4 Alturas y áreas táctiles

Botón: sm 32, md 40, **lg 48** (`c/button:129,142,152`); input 48 (`c/form-text:176`); nav-link 40/48. Todo lo tocable mide **al menos 44×44 pt (iOS) y 48×48 dp (Android)**, también con `hitSlop` en insignias y marcadores del mapa.

## 5. Movimiento

- Solo para **comunicar estado**: 150–250 ms, ease estándar _(suposición sobre la curva; la duración viene del plan y de `docs/briefs/README.md`, "Interacción común")_. Obelisco usa 50 ms en botones (`c/button:208`): se acepta como transición de pulsado.
- **Reduce Motion / Remove animations** respetado en todo: crossfade o corte.
- El **refresco automático no anima** ni vibra. Los marcadores de colectivos no se interpolan: saltan con un crossfade breve (S29). La FreshnessLabel solo cambia el número.
- El Skeleton puede pulsar suavemente _(suposición)_; con Reduce Motion queda estático.
- **Haptics** (`expo-haptics`): selección al cambiar segmento y al marcar favorito, éxito al guardar favorito; nada más (S25). Se respeta la configuración del sistema.

## 6. Iconografía

- **Material Symbols Rounded, FILL 1**, como SVG estático de `@material-symbols/svg-400` 0.48.2 (Apache-2.0), dibujados con `react-native-svg` (ADR-0004). No se usa la fuente variable ni SF Symbols.
- Tamaños: 24 px por defecto, 20 px dentro de Badge/Chip, 24 px en Alert (`c/badge:238`, `c/alert`); el ícono-botón mide ≥ 44×44 de área táctil.
- El color se hereda del token del rol (claro/oscuro); nunca se hardcodea.
- Mapa curado con verificación de cada archivo: [`docs/08-design-system.md`](docs/08-design-system.md), sección "Íconos (mapa curado)". Única excepción a FILL 1: la estrella de "no es favorito" (contorno) para que el estado no dependa solo del color.
- Cada ícono lleva etiqueta de accesibilidad en voseo o se oculta si es decorativo; **estado = ícono + texto**, nunca solo color.

## 7. Componentes

Se construyen una sola vez en `shared/ui` (tarea 3.7) y se usan igual en todas las pantallas; ninguna pantalla inventa su variante (`docs/briefs/README.md`, "Patrones compartidos"). La base es el componente de Obelisco indicado (`tokens §4`).

| Componente                               | Base Obelisco                                     | Uso y reglas                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                 | Button (pill, `headline-md` a 700)                | Primary / secondary / tertiary / danger / outline; alto lg 48 o md 40 con área ≥ 44. **No existe variante warning** (Obelisco no la estiliza).         |
| `Card`                                   | Card (outline 2 px, sin sombra)                   | Resúmenes de Inicio y filas de favoritos. Radio nativo 16 _(suposición)_.                                                                            |
| `Alert`                                  | Alert estándar y `system`                         | Alertas de servicio y avisos de dato viejo o servicio caído; contenedor suave + ícono + texto.                                                        |
| `Badge`                                  | Badge secundaria/primaria                         | Etiquetas pequeñas; alto 24 (sm 20).                                                                                                                  |
| `Chip`                                   | _No existe en Obelisco_ → badge secundaria tocable | Filtros; alto ≥ 32 con área táctil 44 (`tokens §4`, "Chip"). Reservado para cuando vuelva Tránsito.                                                  |
| `LineBadge`                              | Badge, con colores del GTFS                       | Subte: letra sobre `route_color` y `route_text_color`; colectivo: número sobre neutro (S11).                                                          |
| `StatusChip`                             | Badge secundaria + ícono                          | "Normal", "Con demoras", "Interrumpida", "Sin información". **Siempre ícono + texto.**                                                               |
| `FavoriteToggle`                         | Button de ícono (estrella)                        | En detalle de línea, parada y estación. Estrella llena / contorno, con haptics y etiqueta "Agregar a favoritos" / "Quitar de favoritos".               |
| `SearchInput`                            | Input de búsqueda (pill, lupa, reset)             | Colectivos, Subtes (estaciones) y Favoritos si hay muchos.                                                                                            |
| `SegmentedControl` / `Tabs`              | Tabs tipo pill                                    | Andén/sentido en Estación. Los controles nativos del sistema (switches, menús) conservan su estilo.                                                   |
| `Skeleton`                               | —                                                 | Primera carga sin datos, con la forma real del contenido; nunca un spinner centrado.                                                                  |
| `EmptyState`                             | —                                                 | Ícono + frase que explica el vacío + acción. Distingue "vacío real" de "sin datos".                                                                   |
| `ErrorState`                             | —                                                 | Solo cuando no hay nada que mostrar; título llano + causa + "Volver a intentar". Con caché, se usa Alert en línea.                                    |
| `FreshnessLabel`                         | —                                                 | "Actualizado hace 12 s"; fresco ≤ 3×R, viejo hasta 10 min (color warning + ícono), muy viejo > 10 min (Alert). Se anuncia sin re-leerse cada segundo. |
| `OfflineBanner`                          | —                                                 | "Sin conexión. Mostramos lo último guardado." Fijo bajo la barra de navegación, respeta safe area.                                                    |
| `MapView`                                | — (MapLibre, ADR-0002)                            | Fase 4. Estilo claro/oscuro propio. Un solo recorrido por vez (S10).                                                                                  |
| Tab bar / navegación                     | Nav-link activo `#035c80` con texto blanco (`c/nav:122-123`) | **4 tabs**: Inicio, Colectivos, Subtes, Favoritos (Tránsito oculto). Ajustes y Acerca de se abren como stack desde Inicio. Usa la barra nativa de cada sistema con color e íconos de marca _(suposición: el nav-link pill de Obelisco es web; en nativo se conserva solo el color activo `#035c80`)_. |

Estados que todo componente de datos contempla: **carga, vacío, error con reintento, dato viejo (stale), sin conexión y sin permiso de ubicación** (`PRODUCT.md`, "Capabilities and Constraints").

## 8. Voz y copy

- **Español rioplatense con voseo** en todo: "tocá", "elegí", "volvé a intentar". Nunca "usted" ni "tú" (`PRODUCT.md`, "Capabilities and Constraints"; `docs/briefs/README.md`, "Interacción común").
- **Sobrio, directo, breve.** Se lee de pie y en movimiento. Sin humor en errores del servicio (S20); el error del servicio nunca se presenta como culpa de la persona.
- **Terminología fija:** _línea_ (colectivo y subte), _parada_ (colectivo), _estación_ y _andén_ (subte), _ramal_, _corte_, _frescura_ ("hace 12 s").
- **Formatos argentinos:** hora en 24 h ("14:05"), tiempos de arribo relativos ("2 min", "Llegando"); nombres de estaciones normalizados con tildes (S21, S22).
- **Ejemplos aprobados en los briefs:**
  - "Actualizado hace 12 s" · "Dato de hace 4 min" · "Este dato puede no reflejar la situación actual".
  - "Sin conexión. Mostramos lo último guardado." · "Conexión restablecida".
  - "No pudimos actualizar. Mostramos lo último que sabemos." · "El servicio de la Ciudad no responde en este momento." · "Algo falló de nuestro lado." · "Esta información no está disponible por ahora."
  - "Todavía no guardaste favoritos. Tocá la estrella en una línea, parada o estación."
- "Transportate no es una app oficial del Gobierno de la Ciudad" en Acerca de (S27).

## 9. Accesibilidad

- **Objetivo: WCAG 2.2 AA** _(suposición de `PRODUCT.md`, alineada con el plan)_: texto ≥ 4,5:1; texto grande y UI ≥ 3:1, en claro y en oscuro.
- **Contraste verificado** con [`tools/contraste/contraste.py`](tools/contraste/contraste.py) (fórmula de luminancia relativa W3C), resultados en `docs/02-obelisco-tokens.md` §7. Corrida del 2026-11-02 (`python3 tools/contraste/contraste.py --check`, sale con 0): **paleta oscura derivada, 0 fallas; paleta clara de Obelisco, 5 pares que no cumplen**, resueltos en §2.2 (texto warning `#a25c00`, borde de alerta warning, badge primaria warning con texto oscuro, borde neutro solo decorativo, sin botón warning); la paleta histórica (referencia) no se usa. Ese script es el que hay que volver a correr si cambia un token.
- **Áreas táctiles:** 44×44 pt / 48×48 dp, con una mano y con pulgar.
- **Dynamic Type / escala de fuente** con tope (§3.2).
- **El color nunca es el único canal:** línea de subte con su letra; estados con ícono + texto; favorito con forma distinta.
- **Lectores de pantalla** (VoiceOver, TalkBack): etiquetas en castellano rioplatense, orden de lectura lógico; la frescura se anuncia como "Actualizado hace 12 segundos" sin re-anunciarse cada segundo.
- **Reduce Motion / Remove animations**, **modo claro y oscuro**, **uso al sol** (alto contraste: texto cuerpo 16,69:1 sobre blanco).
- Foco visible: anillo de 4 px con el color `focus` de cada tema (13,03:1 claro, 13,20:1 oscuro).

## 10. Qué no hacer

- ❌ **Sombras** de elevación (`box-shadow`/`elevation`). Se separa con outline de 2 px y, en oscuro, con luminosidad.
- ❌ **Colores fuera de los tokens**, ni la paleta histórica (`#336ACC`, `#101E37`, los 12 pasteles "detalle"). Ningún hex suelto en un componente.
- ❌ **Archivo** como tipografía de títulos (es del Obelisco vigente; el proyecto usa Nunito), itálicas, pesos distintos de 400/600/700, ni fuentes descargadas por red (`@expo-google-fonts/dev`).
- ❌ **Texto blanco sobre warning** (`#e88700`, 2,66:1) ni texto `#c47100` sobre blanco (3,68:1). **Botón warning** (Obelisco no lo estiliza).
- ❌ **Bordes `#d6e4f6` en controles** (1,29:1): son decorativos.
- ❌ **Color como único canal** de un estado o de una línea.
- ❌ **Spinner centrado** en la primera carga; se usa Skeleton. **ErrorState que reemplaza datos en caché**; con caché se muestra lo último bueno + Alert.
- ❌ **Mostrar un dato viejo como si fuera actual**, o confundir "sin datos" con "vacío".
- ❌ **Animar el refresco automático**, interpolar marcadores de colectivos, o vibrar en cada actualización.
- ❌ **SF Symbols o íconos de otro set** mezclados con Material Symbols; fuente variable de íconos.
- ❌ **"Usted" / "tú"**, humor en errores del servicio, jerga técnica, culpar a la persona.
- ❌ **Diálogos modales para confirmar borrados** (se usa deshacer, S19), salvo "Borrar todos los favoritos".
- ❌ **Pedir ubicación al abrir la app** (S32), analytics, cuentas, identificadores (`docs/05-privacidad.md`).
- ❌ **Inventar** usuarios, métricas o competidores en el copy (`PRODUCT.md`, "Evidence on Hand").
