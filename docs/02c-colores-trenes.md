# 02c — Colores de las líneas de tren

> Fase 6, tarea 6.2. Fecha de verificación: **2026-11-05**.
> Estado: **provisorio en las seis líneas.** No se encontró una fuente oficial con códigos hex: ni Trenes Argentinos ni el Ministerio de Transporte publican un manual de identidad con colores por línea. Los valores salen de una fuente comunitaria (Wikipedia) y el coordinador los confirma en la tarea 6.6 contra la señalética y los mapas oficiales.
> Esta tabla es la **fuente de verdad** que copian `apps/proxy/src/adapters/trenes/lineas.ts` y `tools/gtfs/src/config.ts`. Si cambia un color, se cambia acá primero.

## 1. Tabla final

Los contrastes se calcularon con `tools/contraste/contraste.py` (función `ratio`, fórmula de luminancia relativa de WCAG 2.x) el 2026-11-05.

| Línea | `slug` | `idGerencia` | Color de fondo | Color de texto | Contraste texto/fondo | Estado |
|---|---|---:|---|---|---:|---|
| Roca | `roca` | 11 | `#FAB700` | `#000000` | 11,84:1 | provisorio |
| Sarmiento | `sarmiento` | 1 | `#B766C2` | `#000000` | 5,69:1 | provisorio |
| Mitre | `mitre` | 5 | `#8FBE00` | `#000000` | 9,53:1 | provisorio |
| San Martín | `san-martin` | 31 | `#6495ED` | `#000000` | 7,06:1 | provisorio |
| Belgrano Sur | `belgrano-sur` | 21 | `#F85900` | `#000000` | 6,42:1 | provisorio |
| Tren de la Costa | `tren-de-la-costa` | 41 | `#002D9A` | `#FFFFFF` | 11,40:1 | provisorio |

Todos los pares texto/fondo pasan AA (≥ 4,5:1). El color de texto no es el que usa la fuente: en Sarmiento, Wikipedia pone texto blanco sobre `#B766C2`, que da 3,69:1 y **no pasa**; se usa negro.

## 2. Fuente de cada color

Una sola fuente para las seis, **no oficial**:

| Línea | Color | De dónde sale |
|---|---|---|
| Roca | `#FAB700` | Cajas de ramales «Línea General Roca» de [Trenes metropolitanos de Buenos Aires](https://es.wikipedia.org/wiki/Trenes_metropolitanos_de_Buenos_Aires), `background:#FAB700` (consultada el 2026-11-05) |
| Sarmiento | `#B766C2` | Ídem, cajas de «Línea Sarmiento», `background:#B766C2` |
| Mitre | `#8FBE00` | Ídem, cajas de «Línea Mitre», `background:#8FBE00` |
| San Martín | `#6495ED` | Ídem, caja de «Línea San Martín», `background:cornflowerblue`. Es un **color con nombre** de CSS, no un hex elegido por una persona: el valor `#6495ED` es el que define CSS para `cornflowerblue` |
| Belgrano Sur | `#F85900` | Ídem, cajas de «Línea Belgrano Sur», `background:#F85900` |
| Tren de la Costa | `#002D9A` | Ídem, caja de «Tren de la Costa», `background:#002D9A` |

Dato aparte: en la misma tabla Wikipedia usa `#D8001D` (Urquiza) y `#870099` (Belgrano Norte), que **no** usamos porque esas líneas no están en la fuente (`01d-api-trenes-sofse.md` §3).

Qué se buscó y no sirvió, para no repetirlo:

- **Sitio oficial:** `argentina.gob.ar/transporte/trenes-argentinos` y las páginas de cada línea (`…/horarios-tarifas-y-recorridos/areametropolitana/<línea>`), consultadas el 2026-11-05: no traen colores por línea (solo el color del sitio, `#242C4F`).
- **Fichas de Wikipedia de cada línea** (`Línea Roca`, `Línea Sarmiento`, etc.): el campo `color_fondo` de las siete es el mismo genérico `#3E6AEE`, no un color de línea.
- **GTFS de trenes del GCBA** (`trenes-gtfs.zip`): de 2020 y sin `route_color`.
- **API de SOFSE** (`01d-api-trenes-sofse.md`): el campo `estado.color` de `gerencias` es el color del *estado* (`#435a6c` en las 7 líneas), no el de la línea.
- **OpenStreetMap** (etiquetas `colour` en las relaciones de ruta): no se pudo consultar; el servicio Overpass respondió 502 en los intentos del 2026-11-05. Es la siguiente fuente a probar.

**Qué falta para dejar de decir «provisorio»:** que alguien compare estos seis colores con la señalética real o con el mapa oficial de la red (por ejemplo, el plano que publica Trenes Argentinos) y los confirme o los reemplace. Sospecha propia, sin evidencia: Wikipedia asigna colores por convención gráfica propia y no tiene por qué coincidir con los de los carteles.

## 3. Reglas de uso (para la ola 2)

- **La insignia siempre lleva las siglas dentro**: R, S, M, SM, BS, TC. El color nunca es el único canal (WCAG 1.4.1; `PRODUCT.md`).
- **Texto de la insignia: el de la tabla.** No se calcula en la app.
- **Borde de 1–2 px en la insignia** cuando el fondo contra el que se apoya da menos de 3:1 (WCAG 1.4.11). Contraste de cada color contra las superficies de la app (tokens de `02-obelisco-tokens.md`):

| Línea | Fondo claro `#edf4ff` | Placa clara `#ffffff` | Fondo oscuro `#000b18` | Placa oscura `#1b2836` | Borde necesario |
|---|---:|---:|---:|---:|---|
| Roca | 1,60:1 | 1,77:1 | 11,16:1 | 8,44:1 | en claro |
| Sarmiento | 3,33:1 | 3,69:1 | 5,37:1 | 4,06:1 | no |
| Mitre | 1,99:1 | 2,20:1 | 8,98:1 | 6,79:1 | en claro |
| San Martín | 2,69:1 | 2,97:1 | 6,66:1 | 5,03:1 | en claro (la placa blanca queda en 2,97:1) |
| Belgrano Sur | 2,96:1 | 3,27:1 | 6,05:1 | 4,57:1 | sobre el fondo celeste (2,96:1); sobre la placa blanca pasa |
| Tren de la Costa | 10,31:1 | 11,40:1 | 1,74:1 | 1,31:1 | **en oscuro** |

- **El trazo de recorrido** (estaciones de un ramal) usa el color de fondo de la línea con el mismo criterio; en Tren de la Costa sobre oscuro se sube al color de texto del tema o se le agrega contorno, como pasó con C y E en el subte (`02b-colores-subte.md` §3).
- **Los valores no se hardcodean en la app:** salen del paquete estático (`trenes-lineas.json`), generado por `tools/gtfs` desde esta tabla. Si cambian, cambia el paquete.

## 4. Cuando se confirmen

Al cerrar la tarea 6.6, el coordinador actualiza esta tabla: la columna «Estado» pasa a «oficial» con la URL de la fuente y la fecha, o se reemplaza el hex. Después se repiten los contrastes (con `tools/contraste`) y se regenera el paquete estático.
