# 02 — Design tokens de Obelisco v2 + paleta oscura derivada

> **Fuente:** <https://github.com/gcba/Obelisco-v2>, commit `c85a37ef0521ff3473798beb68971bb0f231b544` (2026-10-25), clon shallow en `~/.cache/transportate/obelisco-v2` (fuera del repo). Paquete npm `@gcba/obelisco-v2` (`package.json:2`), basado en **Bootstrap 5.3.3** (`dist/styles.css:3`).
> Todas las citas son `archivo:línea` relativas a la raíz de ese repo. Abreviaturas:
>
> | Abrev. | Archivo |
> |---|---|
> | `colors` | `src/styles/variables/_colors.scss` |
> | `typo` | `src/styles/variables/_typography.scss` |
> | `fonts` | `src/styles/variables/_fonts.scss` |
> | `borders` | `src/styles/variables/_borders.scss` |
> | `bp` | `src/styles/variables/_breakpoints.scss` |
> | `mixins` | `src/styles/variables/_mixins.scss` |
> | `dist` | `dist/styles.css` (CSS compilado que publica el paquete) |
> | `c/<x>` | `src/styles/components/_<x>.scss` |

## ⚠️ Discrepancia: dos identidades dentro del mismo repo

El plan (`docs/00-plan.md:13`) tomó los valores de `app/out/components/colors.txt` y `typography.txt`. Esos archivos son un **export estático viejo** del sitio de documentación y **no coinciden** con el código vigente:

| Token | **Vigente** (`src/styles`, `dist/`, fuente del sitio `app/src`) | **Histórico** (`app/out/`) |
|---|---|---|
| primary | `#1d3343` (`colors:135` → `$blue-800`, `colors:24`; `dist:32`; `app/src/documents/Colors/constants.ts:5`) | `#336ACC` (`app/out/components/colors.txt:9`) |
| secondary | `#035c80` (`colors:136`; `dist:33`) | `#101E37` |
| tertiary | `#009688` (`colors:137`; `dist:35`) | `#005E7A` |
| success | `#00642f` (`colors:140`; `dist:34`) | `#26874A` |
| danger | `#cb3232` (`colors:141`; `dist:38`) | `#CC3333` |
| warning | `#e88700` (`colors:139`; `dist:37`) | `#FF9500` |
| info | `#00769a` (`colors:138`; `dist:36`) | `#0086AD` |
| light | `#edf4ff` (`colors:142`; `dist:39`) | `#F3F6F9` |
| dark | `#002230` (`colors:143`; `dist:40`). Ojo: el sitio de docs muestra `#002733` (`constants.ts:14`) | `#002733` |
| Títulos | **Archivo** (`fonts:3`; `dist:79`; `app/src/documents/Typography/TypographyDocs.tsx:47,363`) | **Nunito** (`app/out/components/typography.txt:9`) |
| Texto | **Open Sans** (`fonts:4`; `TypographyDocs.tsx:59`) | Open Sans |
| Detalles cromáticos | No existen en `src/styles` | 12 pasteles `#99E8FF`…`#99FFE2` (`colors.txt:9`) |

Prueba de que `app/out` está desactualizado: su CSS (`app/out/_next/static/css/b98925831a142bd6.css`) define `--bs-primary:#336acc` y carga Nunito, mientras que `app/styles/styles.css` (lo que regenera `npm run build-css`, `package.json:15`) define `--bs-primary: #1d3343`.

**Decisión de este doc:** se documenta como base la identidad **vigente** (lo que shippea la librería). La histórica queda como referencia. Consulta abierta al coordinador (`msg_f0037735ee13`); si se elige la histórica, la paleta oscura se re-deriva con el mismo script. Las **escalas tipográficas** (tamaños, line-heights, pesos) son idénticas en ambas, así que no dependen de esta decisión.

---

## 1. Colores

### 1.1 Rampas primitivas (`colors:1-131`)

| Rampa | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 | Líneas |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| yellow | `#fff2da` | `#ffdf97` | `#ffcd02` | `#dfb300` | `#c09a00` | `#a28100` | `#856a00` | `#6a5300` | `#3d2f00` | `#271d00` | `#0f0800` | `colors:3-13` |
| blue | `#e9f5ff` | `#c7e7ff` | `#a4d9ff` | `#82bfe8` | `#67a5cd` | `#4c8cb3` | `#2f7499` | `#035c80` | `#1d3343` | `#08202f` | `#000b15` | `colors:16-26` |
| cyan | `#c5fff5` | `#83f6e5` | `#73e6d5` | `#55cabb` | `#35b0a1` | `#009688` | `#007b6f` | `#006157` | `#003832` | `#00241f` | `#000d0a` | `colors:29-39` |
| sky | `#e7f6ff` | `#c0e8ff` | `#98dcff` | `#1ec6ff` | `#00abde` | `#0090bc` | `#00769a` | `#005d7b` | `#003548` | `#002230` | `#000c13` | `colors:42-52` |
| green | `#d0ffda` | `#87faa9` | `#77ea9a` | `#5bce80` | `#3db368` | `#179950` | `#007e3e` | `#00642f` | `#003a18` | `#002509` | `#000d00` | `colors:55-65` |
| orange | `#fff1e6` | `#ffdcbf` | `#ffc898` | `#ffa341` | `#e88700` | `#c47100` | `#a25c00` | `#814800` | `#4b2800` | `#2f1900` | `#120700` | `colors:68-78` |
| red | `#fff0ee` | `#ffdad5` | `#ffc5bd` | `#ff9e92` | `#ff7266` | `#ea4f48` | `#cb3232` | `#ad0b1e` | `#6a0009` | `#450200` | `#1b0200` | `colors:81-91` |
| purple | `#fbf0ff` | `#f5d9ff` | `#efc4ff` | `#e39eff` | `#d576ff` | `#c447ff` | `#ad00f3` | `#8a00c3` | `#520077` | `#360051` | `#1b0022` | `colors:94-104` |
| slate (neutro azulado, "antes grisulado") | `#edf4ff` | `#d6e4f6` | `#c7d4e6` | `#acb9cb` | `#92a0b1` | `#7a8697` | `#626e7e` | `#4a5766` | `#253240` | `#121f2c` | `#000b18` | `colors:107-117` |
| gray (+ `gray-0` `#ffffff`, `colors:120`) | `#f3f3f3` | `#e2e2e2` | `#d3d3d3` | `#b8b8b8` | `#9e9e9e` | `#858585` | `#6d6d6d` | `#565656` | `#313131` | `#1e1e1e` | `#090909` | `colors:121-131` |

Nota: `app/src/documents/Colors/constants.ts:35` documenta `orange-500` como `#ff9500`, pero el SCSS dice `#c47100` (`colors:73`). Manda el SCSS.

### 1.2 Theme colors (`colors:133-170`)

| Rol | Primitiva | Hex | Cita |
|---|---|---|---|
| primary | `$blue-800` | `#1d3343` | `colors:135`, `dist:32` |
| secondary | `$blue-700` | `#035c80` | `colors:136`, `dist:33` |
| tertiary | `$cyan-500` | `#009688` | `colors:137`, `dist:35` |
| info | `$sky-600` | `#00769a` | `colors:138`, `dist:36` |
| warning | `$orange-400` | `#e88700` | `colors:139`, `dist:37` |
| success | `$green-700` | `#00642f` | `colors:140`, `dist:34` |
| danger | `$red-600` | `#cb3232` | `colors:141`, `dist:38` |
| light | `$slate-50` | `#edf4ff` | `colors:142`, `dist:39` |
| dark | `$sky-900` | `#002230` | `colors:143`, `dist:40` |

**Fondos semánticos claros** (`$semantic-colors-light-bg`, `colors:172-177`): success `$green-50` `#d0ffda`, danger `$red-50` `#fff0ee`, warning `$orange-50` `#fff1e6`, info `$sky-50` `#e7f6ff`.

**"Colores detalle":** no existen en el código vigente. Los 12 pasteles del export viejo (`colors.txt:9`): `#99E8FF #99B5FF #AF99FF #E299FF #FF99E8 #FF99E5 #FFAF99 #FFE299 #E8FF99 #B5FF99 #99FFAF #99FFE2`. No se usan en Transportate (los colores de líneas de subte salen del GTFS, tarea 1.7).

### 1.3 Texto, fondos y bordes

| Token | Valor | Cita |
|---|---|---|
| Texto cuerpo (`$body-color`, `$body-primary`) | `$blue-900` `#08202f` | `colors:180`, `typo:157`, `dist:83` |
| Texto secundario (`$body-secondary-color`) | `$slate-950` `#000b18` | `colors:181`, `typo:158`, `dist:89` |
| Texto terciario (Bootstrap) | `rgba(8,32,47,.5)` | `dist:93` |
| `$text-primary` / `$text-secondary` | `#1d3343` / `#035c80` | `typo:159-160` |
| `$text-tertiary` | `$cyan-950` `#000d0a` | `typo:161` |
| `$text-info` / `$text-warning` | `#00769a` / `$orange-500` `#c47100` | `typo:162-163` |
| `$text-success` / `$text-danger` | `#00642f` / `#cb3232` | `typo:164-165` |
| Placeholder | `$slate-700` `#4a5766` | `colors:224`, `typo:166` |
| Texto deshabilitado | `$slate-400` `#92a0b1` | `colors:207`, `typo:167` |
| `$text-white` / `$text-black` | `#ffffff` / `$gray-950` `#090909` | `typo:170-171` |
| Fondo body | `#ffffff` | `dist:85` |
| Fondo deshabilitado | `$slate-100` `#d6e4f6` (marcado "VER - REVISAR") | `colors:208` |
| Deshabilitado sobre oscuro | `$slate-700` `#4a5766` | `colors:209` |
| Enlace / hover | `$blue-700` `#035c80` / `$blue-500` `#4c8cb3` | `colors:212-213`, `dist:98` |
| Visitado / visitado sobre oscuro | `$purple-700` `#8a00c3` / `$purple-200` `#efc4ff` | `colors:203-204` |
| Borde neutro | `$slate-100` `#d6e4f6`, 1 px | `colors:216`, `dist:106,108` |
| Borde de enlace | `$blue-700` | `colors:217` |
| `$outline-border` (cards) | `0.125rem solid $slate-100` | `colors:219` |

### 1.4 Foco y estados

| Token | Valor | Cita |
|---|---|---|
| Color de foco | `$cyan-800` `#003832` | `colors:191` |
| Anillo de foco | `0 0 0 0.25rem` (4 px) `$focus-color` | `colors:192` |
| Anillo sutil (badges) | `0 0 0 0.125rem` (2 px) | `colors:193` |
| Anillo danger | 4 px `$red-800` `#6a0009` | `colors:194` |
| Anillo tertiary | 4 px `$blue-800` `#1d3343` | `colors:196` |
| Hover genérico | `$blue-700`; outline `0.125rem solid` | `colors:185,187` |
| Hover danger | `$red-500` `#ea4f48` | `colors:186` |
| Active | `$blue-700`; danger `$red-600` | `colors:199-200` |
| Bootstrap focus ring | `0.25rem`, `rgba(29,51,67,.25)` (no lo usan los componentes Obelisco, que usan `$focus-box-shadow`) | `dist:121-123` |

### 1.5 Botones: estados por variante (`c/button`)

| Variante | Fondo | Texto | Hover / focus / active (fondo) | Cita |
|---|---|---|---|---|
| primary | `#1d3343` | blanco | `$blue-950` `#000b15` | `c/button:24,203,213,325` |
| secondary | `#035c80` | blanco | `$blue-900` `#08202f` | `c/button:25` |
| tertiary | `$cyan-500` `#009688` | `$blue-900` `#08202f` | `$cyan-600` `#007b6f`; foco con anillo `$blue-800` | `c/button:19,26,235-237,327-328` |
| danger | `#cb3232` | blanco | `$red-600` (sin cambio); foco anillo `$red-800` | `c/button:28,231-233` |
| success | `#00642f` | blanco | `$green-700` (sin cambio) | `c/button:29` |
| light | `#edf4ff` | `$gray-950` | `$slate-200` `#c7d4e6` | `c/button:27,114-118` |
| link | blanco | `$blue-900` | activo `$slate-100` | `c/button:8-12,30` |
| outline-* | transparente, outline 2 px del color | color del rol; hover → blanco | `c/button:277-316` |
| outline-tertiary | outline `$cyan-900` `#00241f`, texto `$cyan-900` | — | `c/button:337-340` |
| warning, dark | **sin estilos** (`btn-without-styles`) | — | `c/button:272-274,319-321` |
| Deshabilitado | `$disabled-bg` `#d6e4f6`, texto `#92a0b1`, `opacity: 1`; light usa `$disabled-on-dark` | — | `c/button:33-50` |

Transición: `all ease-in-out 50ms` (`c/button:208`). Outline 2 px con `outline-offset: -0.125rem` (`c/button:206-207`).

---

## 2. Tipografía

| Token | Valor | Cita |
|---|---|---|
| Familia base y títulos | `'Archivo', 'Open Sans', system-ui, …` (Archivo para títulos; Open Sans de fallback/texto) | `fonts:2-19`, `dist:79` |
| Familia de títulos | `$font-family-headings = $font-family-base` | `fonts:19`, `c/typography:5,23` |
| Familia de cuerpo (`.text-*`) | `$font-family-sans-serif` | `c/typography:33` |
| Docs: "Archivo" para headings, "Open Sans" para cuerpo | — | `TypographyDocs.tsx:47,59,363-381` |
| Pesos | normal 400, semibold 600, bold 700 (Bootstrap) | `dist:8376-8389` |
| Base | `1rem` / line-height `1.5rem` | `typo:154-155`, `dist:82` |
| Letter-spacing | **no definido** en ningún token | — |

> En RN no hay cascada de familias: hay que cargar **Archivo** (títulos) y **Open Sans** (texto) explícitamente, con un archivo por peso (400/600/700).

### 2.1 Headings (`typo:4-28`)

| Token | Tamaño | Mobile (< md) | Line-height | Peso | Cita |
|---|---|---|---|---|---|
| h1 | 2.5rem (40) | 2.375rem (38) | 3rem (48) | 700 | `typo:4,10,15,23` |
| h2 | 2.25rem (36) | 2.125rem (34) | 2.75rem (44) | 600 | `typo:5,11,16,24` |
| h3 | 2rem (32) | 1.875rem (30) | 2.75rem (44) | 600 | `typo:6,12,17,25` |
| h4 | 1.75rem (28) | — | 2.25rem (36) | 600 | `typo:7,18,26` |
| h5 | 1.5rem (24) | — | 2rem (32) | 600 | `typo:8,19,27` |
| h6 | 1.25rem (20) | — | 1.75rem (28) | 600 | `typo:9,20,28` |

### 2.2 Titulares / headline (`typo:68-100`)

| Token | Tamaño | Line-height | Peso | Cita |
|---|---|---|---|---|
| headline-lg | 1.25rem (20) | 1.5rem (24) | 700 | `typo:70,75,80` |
| headline-md | 1.125rem (18) | 1.5rem (24) | 600 | `typo:71,76,81` |
| headline-sm | 1rem (16) | 1.25rem (20) | 600 | `typo:72,77,82` |

### 2.3 Cuerpo / text (`typo:102-151`), todos peso 400

| Token | Tamaño | Line-height | Cita |
|---|---|---|---|
| text-xl | 1.25rem (20) | 1.75rem (28) | `typo:104,112,119` |
| text-lg | 1.125rem (18) | 1.75rem (28) | `typo:105,113,120` |
| text-md (= `p`) | 1rem (16) | 1.5rem (24) | `typo:107,114,121`; `c/typography:40-42` |
| text-sm (= `small`) | 0.875rem (14) | 1.25rem (20) | `typo:108,115,122`; `c/typography:44-47` |
| text-xs | 0.75rem (12) | 1rem (16) | `typo:109,116,123` |

---

## 3. Espaciado, radios, sombras, breakpoints, z-index

### 3.1 Espaciado

Obelisco **no sobreescribe** `$spacers` de Bootstrap: define `$spacer: 0.25rem` y `space-units($n)` en `mixins:1-5`, pero ese archivo se importa **después** de Bootstrap (`src/styles/main.scss:9,13`), así que solo afecta a sus propios componentes. Escala efectiva de utilidades (Bootstrap 5 por defecto):

| Spacer | Valor | Cita |
|---|---|---|
| 0 | 0 | `dist:8080` |
| 1 | 0.25rem (4) | `dist:8084-8085` |
| 2 | 0.5rem (8) | `dist:8088-8089` |
| 3 | 1rem (16) | `dist:8092-8093` |
| 4 | 1.5rem (24) | `dist:8096-8097` |
| 5 | 3rem (48) | `dist:8100-8101` |
| `space-units(n)` | n × 4 px | `mixins:1-5` |
| Gutter de grilla | 2rem (16 px por lado) | `bp:16` |

Paddings de componentes clave: botón 8×16 (md), 4×8 (sm), 12×20 (lg) (`c/button:2-4`); card body 24 (`c/cards:2,73`); alert 16/24/16/60 desktop, 16/16/16/52 mobile (`c/alert:2-3`); badge 4×8 (`c/badge:199`); input 12×16 (`c/form-text:217`); nav-link 8×16 (`c/nav:6`).

### 3.2 Radios (`borders:2-14`)

| Token | Valor | Cita |
|---|---|---|
| xs / sm / md | 1 / 2 / 4 px | `borders:2-4` |
| lg | 6 px | `borders:5` |
| xl | 8 px | `borders:6` |
| 2xl / 3xl / 4xl / 5xl | 12 / 16 / 20 / 24 px | `borders:7-10` |
| 6xl | 32 px (cards) | `borders:11` |
| 7xl / 8xl | 64 / 128 px | `borders:12-13` |
| pill | 9999 px (botones, inputs, tabs tipo pill) | `borders:14` |

Ojo: `mixins:7` redefine `$border-radius-lg: 30px` pero `borders` se importa después (`main.scss:13,20`) y lo vuelve a 6 px. Los radios de Bootstrap (`--bs-border-radius` 0.375rem, etc., `dist:110-116`) siguen en el CSS pero los componentes Obelisco usan los propios.

### 3.3 Sombras / elevación

Obelisco **no usa sombras de elevación**: separa superficies con outlines de 2 px. Valores:

| Token | Valor | Cita |
|---|---|---|
| `$box-shadow` / `--bs-box-shadow` | `0 0 0 0.125rem #d6e4f6` (anillo, no sombra) | `colors:218`, `dist:117` |
| `--bs-box-shadow-sm` | `0 0.125rem 0.25rem rgba(0,0,0,.075)` | `dist:118` |
| `--bs-box-shadow-lg` | `0 1rem 3rem rgba(0,0,0,.175)` | `dist:119` |
| Card | sin sombra; `outline: 0.125rem solid $slate-100` | `c/cards:63-70`, `colors:219` |

### 3.4 Breakpoints (`bp`, `dist:787-792`)

xs 0 · sm 576 · md 768 · lg 992 · xl 1200 · xxl 1400. Contenedor máx.: sm 540, md 720, lg 720, xl 1140, xxl 1140 (`bp:18-24`). Mobile = < 768 px (`bp:3`). Para la app solo importa "teléfono" vs "tablet" (≥ 768).

### 3.5 z-index (Bootstrap por defecto)

dropdown 1000 (`dist:3390`), offcanvas 1045 (`dist:6270`), modal 1055 (`dist:5451`), tooltip 1080 (`dist:5742`). En RN no aplica salvo para overlays propios.

---

## 4. Tokens por componente

### Button (`c/button`)
- Tipografía `headline-md` (18/24) con peso 700 (`c/button:122-123`).
- Alturas mínimas: sm 32, md 40, lg 48, xs (ícono) 28 (`c/button:129,142,152,163`). **Para la app: usar lg (48) o md con área táctil ≥ 44.**
- Radio pill (`c/button:128`); gap ícono 4 px (`c/button:133`); ícono 18 / 16 (sm) / 20 (lg) (`c/button:137,147,157`).
- Variantes y estados: ver §1.5.

### Badge / etiqueta (`c/badge`)
- Base: alto 24, padding 4×8, radio 6 (`$border-radius-lg`), gap 4, separación 8 (`c/badge:3,191-204`). sm: alto 20, `text-sm`, padding 2×8 (`c/badge:222-228`). lg: `text-lg`, padding 8 (`c/badge:230-235`). Ícono 20 px (`c/badge:238`).
- **Secundaria** (fondo claro): bg / texto / borde por estado — default `slate-100` / cuerpo / cuerpo; info `sky-50` / `sky-600` / `sky-800`; success `green-50` / `green-600` / `green-800`; danger `red-50` / `red-600` / `red-800`; warning `orange-50` / `orange-600` / `orange-800`; highlight `purple-50` / `purple-600` / `purple-800`. Hover → fondos `-100` (`c/badge:7-41`).
- **Primaria** (fondo sólido, texto blanco): default `slate-600`, info `sky-700`, success `green-700`, danger `red-700`, warning `orange-400`, highlight `purple-600`; hover `-800` (default `slate-900`) (`c/badge:47-72,85-89`).
- Estáticas con radio 8 (`c/badge:80,88`).

### Chip
**No existe** componente chip en Obelisco v2 (no hay `_chip.scss` ni documento). Para filtros (p. ej. tipo de corte) se propone reutilizar **badge secundaria clickeable** (borde 1 px, hover `-100`, foco anillo 2 px; `c/badge:92-135`) con alto ≥ 32 y área táctil 44.

### Alert (`c/alert`)
- Padding 16/24/16/60 (desktop), 16/16/16/52 (mobile); ícono 24 a 16/24 del borde; gap 8 (`c/alert:2-12,63-68`).
- Variante "estándar": fondo `$semantic-colors-light-bg` del rol, outline 1 px del color del rol, radio 6, texto `$body-color` (`c/alert:52-58,79-83`).
- Variante `system` (sólida): fondo success `#00642f` / danger `$red-600` / warning `#e88700` / info **`$secondary`** `#035c80`; contenido blanco salvo warning, que usa `$primary` (`c/alert:31-43,85-98`).
- Íconos SVG embebidos con colores de la paleta **vieja** (`#26874A`, `#CC3333`, `#FF9500`, `#0086AD`, `c/alert:22-28`), pero se recolorean por `mask` + `background-color` del rol (`c/alert:45-49`).
- primary/secondary/tertiary/light/dark: sin fondo ni borde (`c/alert:102-109`).

### Card (`c/cards`)
- Sin borde ni sombra: `outline: 0.125rem solid $slate-100`; radio 32 (`6xl`) (`c/cards:63-70`).
- Body padding 24 (`c/cards:2,72-74`). Headline `text-sm` en mayúsculas, margen 16 (`c/cards:76-80`). Título `headline-lg`, 2 líneas máx. (`c/cards:82-86`). Texto `text-md`, 3 líneas máx., margen superior 4 (`c/cards:88-93`).
- Ícono 32 sobre fondo `slate-50`, radio 6 (`c/cards:3,5,127-133`). Hover: texto `$hover-color`, outline `$hover-outline`; foco: anillo 4 px (`c/cards:13-53`).

### Tabs / navegación (`c/tabs`, `c/nav`)
- Nav-link tipo pill: `headline-md`, radio pill, fondo blanco, alto mín. 40 (lg 48, sm 32), padding 8×16 (`c/nav:4-8,18-37`).
- Hover: outline y texto `$hover-color` (`c/nav:72-73`). Activo: fondo `$active-color` `#035c80`, texto blanco (`c/nav:122-123`). Deshabilitado: `$disabled-text` / `$disabled-bg` (`c/nav:49-51`).
- Tabs tipo pestaña: radio superior 8 (`c/tabs:2`), activa = subrayado interno 4 px `$active-color` (`c/tabs:58-62`); variante caja con fondo `slate-100`, activa `slate-50` (`c/tabs:99-111`).

### Input / búsqueda (`c/form-text`)
- `.form-control`: fondo blanco, padding 12×16, radio pill, `outline: 0.125rem solid $body-color` (`c/form-text:215-226`). Placeholder `$slate-700` (`c/form-text:230`).
- Validación: anillo 2 px `green-600` / `red-600` (`c/form-text:253,257`). Deshabilitado: fondo `slate-100`, texto `$disabled-text`, outline `slate-400` (`c/form-text:265-267`).
- Label: `headline-md`, `$blue-900` (`c/form-text:163-165`). Alto de controles 48 (`c/form-text:176,186`).
- Búsqueda: ícono lupa a 16 px del borde izquierdo, padding lateral 50 (`c/form-text:321-327`); ícono `#5C6A7A`, botón reset `#101E37` (`c/form-text:1-5`).

---

## 5. Propuesta de estructura para `shared/theme/tokens.ts`

Solo nombres y agrupación (no es código de producto). Cada hoja llevará en Fase 3 un comentario con la cita de este doc.

```ts
// shared/theme/tokens.ts — ESBOZO
export const primitives = {
  blue: { 50, 100, …, 950 }, cyan: {…}, sky: {…}, green: {…}, orange: {…},
  red: {…}, purple: {…}, yellow: {…}, slate: {…}, gray: { 0, 50, …, 950 },
} as const;

type ColorScheme = {
  bg:     { base, elevated, card, pressed, disabled };
  text:   { primary, secondary, tertiary, disabled, placeholder, link, inverse };
  border: { subtle, strong, focus };
  focusRing: { color, width };                       // 4 px / 2 px (subtle)
  role: Record<'primary'|'secondary'|'tertiary'|'danger'|'success'|'warning'|'info',
               { base, on, hover, container, onContainer }>;
};
export const light: ColorScheme;   // Obelisco tal cual (§1)
export const dark:  ColorScheme;   // derivada (§6)

export const typography = {
  family: { heading: 'Archivo', body: 'OpenSans' },  // un fontFamily por peso en RN
  weight: { regular: '400', semibold: '600', bold: '700' },
  heading:  { h1, h2, h3, h4, h5, h6 },               // { size, lineHeight, weight }
  headline: { lg, md, sm },
  text:     { xl, lg, md, sm, xs },
};
export const space  = { 0: 0, 1: 4, 2: 8, 3: 16, 4: 24, 5: 48, unit: 4 };
export const radius = { xs: 1, sm: 2, md: 4, lg: 6, xl: 8, '2xl': 12, '3xl': 16,
                        '4xl': 20, '5xl': 24, '6xl': 32, pill: 9999 };
export const borderWidth = { hairline: 1, control: 2 };
export const elevation = { none, outline };          // Obelisco no usa sombras
export const component = {
  button: { height: { sm: 32, md: 40, lg: 48 }, paddingX, iconSize, radius: 'pill' },
  badge:  { height: { sm: 20, md: 24 }, paddingX: 8, radius: 6 },
  card:   { padding: 24, radius: 32, outlineWidth: 2 },
  alert:  { padding, iconSize: 24, radius: 6, outlineWidth: 1 },
  input:  { height: 48, paddingX: 16, radius: 'pill', outlineWidth: 2 },
  tab:    { height: { sm: 32, md: 40, lg: 48 }, indicator: 4 },
  hitSlop: 44,
};
```

---

## 6. Paleta oscura derivada

Obelisco no define modo oscuro (el `[data-bs-theme=dark]` de `dist:130-178` es el default de Bootstrap en grises neutros, ajeno a la identidad). Criterios:

1. **Mismo matiz**: todo sale de las rampas primitivas de §1.1; los neutros usan **slate** (gris azulado de Obelisco) para no perder el tinte azul.
2. **Inversión de luminosidad**: roles de acción pasan de tonos 600–800 a 200–400; sus "on-*" pasan a 900–950 de la misma rampa.
3. **Contenedores** (fondos de alertas/badges) en 900 con texto 100–200 de la misma rampa.
4. Elevación por luminosidad del fondo (no sombras), coherente con Obelisco.

| Token | Hex | Origen |
|---|---|---|
| `bg.base` | `#000b18` | `slate-950` |
| `bg.elevated` | `#121f2c` | `slate-900` |
| `bg.card` | `#1b2836` | mezcla 50 % `slate-900`/`slate-800` (única no primitiva) |
| `bg.pressed` | `#253240` | `slate-800` |
| `text.primary` | `#edf4ff` | `slate-50` |
| `text.secondary` | `#c7d4e6` | `slate-200` |
| `text.tertiary` | `#92a0b1` | `slate-400` |
| `text.disabled` | `#626e7e` | `slate-600` |
| `text.link` | `#82bfe8` | `blue-300` |
| `border.subtle` | `#253240` | `slate-800` (decorativo) |
| `border.strong` | `#7a8697` | `slate-500` (controles, ≥ 3:1) |
| `focus` | `#73e6d5`, anillo 4 px | `cyan-200` (mismo matiz que `$focus-color` cyan-800) |
| `primary` / `on-primary` | `#a4d9ff` / `#08202f` | `blue-200` / `blue-900` |
| `secondary` / `on-secondary` | `#67a5cd` / `#000b15` | `blue-400` / `blue-950` |
| `tertiary` / `on-tertiary` | `#55cabb` / `#000d0a` | `cyan-300` / `cyan-950` |
| `danger` / `on-danger` | `#ff7266` / `#1b0200` | `red-400` / `red-950` |
| `success` / `on-success` | `#5bce80` / `#000d00` | `green-300` / `green-950` |
| `warning` / `on-warning` | `#ffa341` / `#120700` | `orange-300` / `orange-950` |
| `info` / `on-info` | `#1ec6ff` / `#000c13` | `sky-300` / `sky-950` |
| `danger.container` / `on` | `#450200` / `#ffc5bd` | `red-900` / `red-200` |
| `success.container` / `on` | `#002509` / `#87faa9` | `green-900` / `green-100` |
| `warning.container` / `on` | `#2f1900` / `#ffc898` | `orange-900` / `orange-200` |
| `info.container` / `on` | `#002230` / `#98dcff` | `sky-900` / `sky-200` |

---

## 7. Contraste WCAG verificado

Calculado con `tools/contraste/contraste.py` (fórmula de luminancia relativa W3C, WCAG 2.1 §1.4.3 y §1.4.11). Para regenerar: `python3 tools/contraste/contraste.py` (`--check` sale con 1 si falla algún par de la paleta oscura). Umbrales: **texto ≥ 4.5:1**, **texto grande y UI ≥ 3:1**; texto deshabilitado y bordes decorativos son exentos (informativos).

#### Paleta clara (Obelisco v2 vigente, tal cual)

| Par | Primer plano | Fondo | Tipo | Ratio | Mínimo | Cumple |
|---|---|---|---|---:|---:|:---:|
| Texto cuerpo / fondo | `#08202f` | `#ffffff` | texto | 16.69:1 | 4.5:1 | ✅ |
| Texto secundario / fondo | `#000b18` | `#ffffff` | texto | 19.79:1 | 4.5:1 | ✅ |
| Texto cuerpo / light | `#08202f` | `#edf4ff` | texto | 15.09:1 | 4.5:1 | ✅ |
| Placeholder / fondo | `#4a5766` | `#ffffff` | texto | 7.38:1 | 4.5:1 | ✅ |
| Enlace / fondo | `#035c80` | `#ffffff` | texto | 7.38:1 | 4.5:1 | ✅ |
| Texto primary / fondo | `#1d3343` | `#ffffff` | texto | 13.07:1 | 4.5:1 | ✅ |
| Texto info / fondo | `#00769a` | `#ffffff` | texto | 5.17:1 | 4.5:1 | ✅ |
| Texto success / fondo | `#00642f` | `#ffffff` | texto | 7.33:1 | 4.5:1 | ✅ |
| Texto danger / fondo | `#cb3232` | `#ffffff` | texto | 5.20:1 | 4.5:1 | ✅ |
| Texto warning ($text-warning) / fondo | `#c47100` | `#ffffff` | texto | 3.68:1 | 4.5:1 | ❌ |
| Btn primary: blanco / primary | `#ffffff` | `#1d3343` | texto | 13.07:1 | 4.5:1 | ✅ |
| Btn primary hover: blanco / blue-950 | `#ffffff` | `#000b15` | texto | 19.84:1 | 4.5:1 | ✅ |
| Btn secondary: blanco / secondary | `#ffffff` | `#035c80` | texto | 7.38:1 | 4.5:1 | ✅ |
| Btn secondary hover: blanco / blue-900 | `#ffffff` | `#08202f` | texto | 16.69:1 | 4.5:1 | ✅ |
| Btn tertiary: blue-900 / tertiary | `#08202f` | `#009688` | texto | 4.55:1 | 4.5:1 | ✅ |
| Btn success: blanco / success | `#ffffff` | `#00642f` | texto | 7.33:1 | 4.5:1 | ✅ |
| Btn danger: blanco / danger | `#ffffff` | `#cb3232` | texto | 5.20:1 | 4.5:1 | ✅ |
| Alert system info: blanco / secondary | `#ffffff` | `#035c80` | texto | 7.38:1 | 4.5:1 | ✅ |
| Alert system warning: primary / warning | `#1d3343` | `#e88700` | texto | 4.91:1 | 4.5:1 | ✅ |
| Alert success: cuerpo / green-50 | `#08202f` | `#d0ffda` | texto | 15.10:1 | 4.5:1 | ✅ |
| Alert danger: cuerpo / red-50 | `#08202f` | `#fff0ee` | texto | 15.06:1 | 4.5:1 | ✅ |
| Alert warning: cuerpo / orange-50 | `#08202f` | `#fff1e6` | texto | 15.09:1 | 4.5:1 | ✅ |
| Alert info: cuerpo / sky-50 | `#08202f` | `#e7f6ff` | texto | 15.12:1 | 4.5:1 | ✅ |
| Alert borde success / green-50 | `#00642f` | `#d0ffda` | ui | 6.63:1 | 3:1 | ✅ |
| Alert borde warning / orange-50 | `#e88700` | `#fff1e6` | ui | 2.40:1 | 3:1 | ❌ |
| Badge sec. info: sky-600 / sky-50 | `#00769a` | `#e7f6ff` | texto | 4.69:1 | 4.5:1 | ✅ |
| Badge sec. success: green-600 / green-50 | `#007e3e` | `#d0ffda` | texto | 4.69:1 | 4.5:1 | ✅ |
| Badge sec. danger: red-600 / red-50 | `#cb3232` | `#fff0ee` | texto | 4.69:1 | 4.5:1 | ✅ |
| Badge sec. warning: orange-600 / orange-50 | `#a25c00` | `#fff1e6` | texto | 4.67:1 | 4.5:1 | ✅ |
| Badge sec. highlight: purple-600 / purple-50 | `#ad00f3` | `#fbf0ff` | texto | 4.67:1 | 4.5:1 | ✅ |
| Badge sec. default: cuerpo / slate-100 | `#08202f` | `#d6e4f6` | texto | 12.95:1 | 4.5:1 | ✅ |
| Badge prim. default: blanco / slate-600 | `#ffffff` | `#626e7e` | texto | 5.18:1 | 4.5:1 | ✅ |
| Badge prim. info: blanco / sky-700 | `#ffffff` | `#005d7b` | texto | 7.36:1 | 4.5:1 | ✅ |
| Badge prim. success: blanco / green-700 | `#ffffff` | `#00642f` | texto | 7.33:1 | 4.5:1 | ✅ |
| Badge prim. danger: blanco / red-700 | `#ffffff` | `#ad0b1e` | texto | 7.39:1 | 4.5:1 | ✅ |
| Badge prim. warning: blanco / orange-400 | `#ffffff` | `#e88700` | texto | 2.66:1 | 4.5:1 | ❌ |
| Anillo de foco cyan-800 / fondo | `#003832` | `#ffffff` | ui | 13.03:1 | 3:1 | ✅ |
| Outline input (cuerpo) / fondo | `#08202f` | `#ffffff` | ui | 16.69:1 | 3:1 | ✅ |
| Borde neutro slate-100 / fondo | `#d6e4f6` | `#ffffff` | ui | 1.29:1 | 3:1 | ❌ |
| Btn tertiary (relleno) / fondo | `#009688` | `#ffffff` | ui | 3.67:1 | 3:1 | ✅ |
| Btn warning (relleno) / fondo | `#e88700` | `#ffffff` | ui | 2.66:1 | 3:1 | ❌ |
| Deshabilitado: slate-400 / slate-100 | `#92a0b1` | `#d6e4f6` | exento | 2.07:1 | — | — (exento) |

**Pares de Obelisco que no cumplen y cómo los resolvemos en la app (modo claro):**
1. `$text-warning` `#c47100` sobre blanco (3.68) → para texto warning usar `orange-600` `#a25c00` (el mismo que usa la badge secundaria; ≥ 4.5 sobre `orange-50`) u `orange-700`.
2. Outline de alerta warning `#e88700` sobre `orange-50` (2.40) → el ícono y el texto llevan la información; usar `orange-600` para el borde si se quiere cumplir 1.4.11.
3. Badge primaria warning (blanco sobre `orange-400`, 2.66) → usar texto `$primary`/`blue-900` sobre `orange-400` (4.91, como hace el alert `system`).
4. Borde neutro `slate-100` (1.29) → solo para separadores decorativos; los controles usan outline `$body-color` (16.69), que sí cumple.
5. Botón warning sin estilos en Obelisco → no usar botones warning.

#### Paleta oscura derivada (propuesta) — 0 fallas

| Par | Primer plano | Fondo | Tipo | Ratio | Mínimo | Cumple |
|---|---|---|---|---:|---:|:---:|
| Texto primario / bg-base | `#edf4ff` | `#000b18` | texto | 17.89:1 | 4.5:1 | ✅ |
| Texto secundario / bg-base | `#c7d4e6` | `#000b18` | texto | 13.18:1 | 4.5:1 | ✅ |
| Texto terciario / bg-base | `#92a0b1` | `#000b18` | texto | 7.43:1 | 4.5:1 | ✅ |
| Enlace / bg-base | `#82bfe8` | `#000b18` | texto | 9.96:1 | 4.5:1 | ✅ |
| Borde fuerte (controles) / bg-base | `#7a8697` | `#000b18` | ui | 5.36:1 | 3:1 | ✅ |
| Anillo de foco / bg-base | `#73e6d5` | `#000b18` | ui | 13.20:1 | 3:1 | ✅ |
| Texto primario / bg-elevated | `#edf4ff` | `#121f2c` | texto | 15.09:1 | 4.5:1 | ✅ |
| Texto secundario / bg-elevated | `#c7d4e6` | `#121f2c` | texto | 11.12:1 | 4.5:1 | ✅ |
| Texto terciario / bg-elevated | `#92a0b1` | `#121f2c` | texto | 6.27:1 | 4.5:1 | ✅ |
| Enlace / bg-elevated | `#82bfe8` | `#121f2c` | texto | 8.40:1 | 4.5:1 | ✅ |
| Borde fuerte (controles) / bg-elevated | `#7a8697` | `#121f2c` | ui | 4.52:1 | 3:1 | ✅ |
| Anillo de foco / bg-elevated | `#73e6d5` | `#121f2c` | ui | 11.13:1 | 3:1 | ✅ |
| Texto primario / bg-card | `#edf4ff` | `#1b2836` | texto | 13.53:1 | 4.5:1 | ✅ |
| Texto secundario / bg-card | `#c7d4e6` | `#1b2836` | texto | 9.97:1 | 4.5:1 | ✅ |
| Texto terciario / bg-card | `#92a0b1` | `#1b2836` | texto | 5.62:1 | 4.5:1 | ✅ |
| Enlace / bg-card | `#82bfe8` | `#1b2836` | texto | 7.53:1 | 4.5:1 | ✅ |
| Borde fuerte (controles) / bg-card | `#7a8697` | `#1b2836` | ui | 4.05:1 | 3:1 | ✅ |
| Anillo de foco / bg-card | `#73e6d5` | `#1b2836` | ui | 9.98:1 | 3:1 | ✅ |
| Texto primario / bg-pressed | `#edf4ff` | `#253240` | texto | 11.80:1 | 4.5:1 | ✅ |
| Texto terciario / bg-pressed | `#92a0b1` | `#253240` | texto | 4.90:1 | 4.5:1 | ✅ |
| on-primary / primary | `#08202f` | `#a4d9ff` | texto | 11.09:1 | 4.5:1 | ✅ |
| primary (texto/ícono) / bg-base | `#a4d9ff` | `#000b18` | texto | 13.15:1 | 4.5:1 | ✅ |
| primary (texto/ícono) / bg-card | `#a4d9ff` | `#1b2836` | texto | 9.94:1 | 4.5:1 | ✅ |
| on-secondary / secondary | `#000b15` | `#67a5cd` | texto | 7.41:1 | 4.5:1 | ✅ |
| secondary (texto/ícono) / bg-base | `#67a5cd` | `#000b18` | texto | 7.39:1 | 4.5:1 | ✅ |
| secondary (texto/ícono) / bg-card | `#67a5cd` | `#1b2836` | texto | 5.59:1 | 4.5:1 | ✅ |
| on-tertiary / tertiary | `#000d0a` | `#55cabb` | texto | 9.94:1 | 4.5:1 | ✅ |
| tertiary (texto/ícono) / bg-base | `#55cabb` | `#000b18` | texto | 9.94:1 | 4.5:1 | ✅ |
| tertiary (texto/ícono) / bg-card | `#55cabb` | `#1b2836` | texto | 7.52:1 | 4.5:1 | ✅ |
| on-danger / danger | `#1b0200` | `#ff7266` | texto | 7.44:1 | 4.5:1 | ✅ |
| danger (texto/ícono) / bg-base | `#ff7266` | `#000b18` | texto | 7.40:1 | 4.5:1 | ✅ |
| danger (texto/ícono) / bg-card | `#ff7266` | `#1b2836` | texto | 5.59:1 | 4.5:1 | ✅ |
| on-success / success | `#000d00` | `#5bce80` | texto | 10.01:1 | 4.5:1 | ✅ |
| success (texto/ícono) / bg-base | `#5bce80` | `#000b18` | texto | 9.98:1 | 4.5:1 | ✅ |
| success (texto/ícono) / bg-card | `#5bce80` | `#1b2836` | texto | 7.54:1 | 4.5:1 | ✅ |
| on-warning / warning | `#120700` | `#ffa341` | texto | 10.01:1 | 4.5:1 | ✅ |
| warning (texto/ícono) / bg-base | `#ffa341` | `#000b18` | texto | 9.96:1 | 4.5:1 | ✅ |
| warning (texto/ícono) / bg-card | `#ffa341` | `#1b2836` | texto | 7.53:1 | 4.5:1 | ✅ |
| on-info / info | `#000c13` | `#1ec6ff` | texto | 9.96:1 | 4.5:1 | ✅ |
| info (texto/ícono) / bg-base | `#1ec6ff` | `#000b18` | texto | 9.97:1 | 4.5:1 | ✅ |
| info (texto/ícono) / bg-card | `#1ec6ff` | `#1b2836` | texto | 7.54:1 | 4.5:1 | ✅ |
| on-danger-container / danger-container | `#ffc5bd` | `#450200` | texto | 11.07:1 | 4.5:1 | ✅ |
| Texto primario / danger-container | `#edf4ff` | `#450200` | texto | 15.05:1 | 4.5:1 | ✅ |
| Borde danger / danger-container | `#ff7266` | `#450200` | ui | 6.22:1 | 3:1 | ✅ |
| on-success-container / success-container | `#87faa9` | `#002509` | texto | 12.83:1 | 4.5:1 | ✅ |
| Texto primario / success-container | `#edf4ff` | `#002509` | texto | 14.97:1 | 4.5:1 | ✅ |
| Borde success / success-container | `#5bce80` | `#002509` | ui | 8.34:1 | 3:1 | ✅ |
| on-warning-container / warning-container | `#ffc898` | `#2f1900` | texto | 11.09:1 | 4.5:1 | ✅ |
| Texto primario / warning-container | `#edf4ff` | `#2f1900` | texto | 15.07:1 | 4.5:1 | ✅ |
| Borde warning / warning-container | `#ffa341` | `#2f1900` | ui | 8.39:1 | 3:1 | ✅ |
| on-info-container / info-container | `#98dcff` | `#002230` | texto | 11.02:1 | 4.5:1 | ✅ |
| Texto primario / info-container | `#edf4ff` | `#002230` | texto | 14.93:1 | 4.5:1 | ✅ |
| Borde info / info-container | `#1ec6ff` | `#002230` | ui | 8.32:1 | 3:1 | ✅ |
| Deshabilitado slate-600 / bg-card | `#626e7e` | `#1b2836` | exento | 2.89:1 | — | — (exento) |
| Borde sutil slate-800 / bg-base (decorativo) | `#253240` | `#000b18` | exento | 1.52:1 | — | — (exento) |

#### Paleta histórica de `app/out` (solo referencia)

| Par | Primer plano | Fondo | Tipo | Ratio | Mínimo | Cumple |
|---|---|---|---|---:|---:|:---:|
| Blanco / primary | `#ffffff` | `#336acc` | texto | 5.15:1 | 4.5:1 | ✅ |
| Blanco / secondary | `#ffffff` | `#101e37` | texto | 16.63:1 | 4.5:1 | ✅ |
| Blanco / tertiary | `#ffffff` | `#005e7a` | texto | 7.29:1 | 4.5:1 | ✅ |
| Blanco / danger | `#ffffff` | `#cc3333` | texto | 5.14:1 | 4.5:1 | ✅ |
| Blanco / success | `#ffffff` | `#26874a` | texto | 4.52:1 | 4.5:1 | ✅ |
| Blanco / warning | `#ffffff` | `#ff9500` | texto | 2.20:1 | 4.5:1 | ❌ |
| Blanco / info | `#ffffff` | `#0086ad` | texto | 4.19:1 | 4.5:1 | ❌ |
| Blanco / dark | `#ffffff` | `#002733` | texto | 15.69:1 | 4.5:1 | ✅ |
| primary (texto) / blanco | `#336acc` | `#ffffff` | texto | 5.15:1 | 4.5:1 | ✅ |
| danger (texto) / blanco | `#cc3333` | `#ffffff` | texto | 5.14:1 | 4.5:1 | ✅ |
| success (texto) / blanco | `#26874a` | `#ffffff` | texto | 4.52:1 | 4.5:1 | ✅ |
| warning (texto) / blanco | `#ff9500` | `#ffffff` | texto | 2.20:1 | 4.5:1 | ❌ |
| info (texto) / blanco | `#0086ad` | `#ffffff` | texto | 4.19:1 | 4.5:1 | ❌ |
| dark / light | `#002733` | `#f3f6f9` | texto | 14.47:1 | 4.5:1 | ✅ |

## Pendientes

- Confirmación del coordinador sobre identidad vigente vs histórica (afecta §1, §2 familia de títulos y §6). Si cambia, actualizar `CLARA`/`OSCURA` en el script y regenerar las tablas.
- Actualizar `docs/00-plan.md:13` (no es archivo de esta tarea): hoy dice primary `#336ACC` y Nunito.
- Validar la paleta oscura sobre el estilo de mapa oscuro (Fase 4) y con los colores oficiales de líneas de subte (tarea 1.7).
