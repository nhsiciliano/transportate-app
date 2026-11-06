# 02c — Colores de las líneas de tren

> Fase 6, tarea 6.2. Fecha de verificación: **2026-11-06**.
> Estado: **confirmados por el usuario** contra el plano de la red que aportó el 2026-11-06 (`mapa-red-trenes-buenos-aires.pdf`, «Red de ferrocarriles metropolitanos de Buenos Aires», estado de la red a julio de 2022). Ese plano **no es un mapa oficial** (lo dice su propio pie), pero es el que el usuario eligió como referencia y reemplaza a los valores provisorios de Wikipedia del 2026-11-05 (quedan en §2 como historial).
> Esta tabla es la **fuente de verdad** que copian `apps/proxy/src/adapters/trenes/lineas.ts` y `tools/gtfs/src/config.ts`. Si cambia un color, se cambia acá primero.

## 1. Tabla final

Los contrastes se calcularon con `tools/contraste/contraste.py` (función `ratio`, fórmula de luminancia relativa de WCAG 2.x) el 2026-11-06.

| Línea | `slug` | `idGerencia` | Color de fondo | Color de texto | Contraste texto/fondo | Estado |
|---|---|---:|---|---|---:|---|
| Roca | `roca` | 11 | `#F07D2B` | `#000000` | 7,67:1 | confirmado (plano de la red) |
| Sarmiento | `sarmiento` | 1 | `#B8237A` | `#FFFFFF` | 5,90:1 | confirmado (plano de la red) |
| Mitre | `mitre` | 5 | `#42B874` | `#000000` | 8,34:1 | confirmado (plano de la red) |
| San Martín | `san-martin` | 31 | `#6438C4` | `#FFFFFF` | 7,23:1 | confirmado (plano de la red) |
| Belgrano Sur | `belgrano-sur` | 21 | `#5C4858` | `#FFFFFF` | 8,32:1 | confirmado (plano de la red) |
| Tren de la Costa | `tren-de-la-costa` | 41 | `#A020B8` | `#FFFFFF` | 6,19:1 | confirmado (plano de la red) |

Todos los pares texto/fondo pasan AA (≥ 4,5:1). El texto es negro o blanco según cuál contrasta más: con los colores nuevos, Sarmiento (3,56:1 con negro), San Martín (2,90:1) y Belgrano Sur (2,52:1) pasan a texto blanco.

## 2. Fuente de cada color

**Plano de la red** aportado por el usuario el 2026-11-06 (`mapa-red-trenes-buenos-aires.pdf`, una página, imagen JPEG de 1080 × 963 px; autoría «holgaporta 2022», con la leyenda «No es un mapa oficial»). Cómo se midió: se extrajo el JPEG del PDF y se tomó el color **del núcleo del trazo** de cada línea sobre tramos rectos del plano (el plano dibuja cada trazo con un tono oscuro y un realce claro; se tomó el oscuro, que es el mismo del recuadro de siglas de la leyenda). Los valores se redondearon al hex más cercano del tono medido:

| Línea | Color | Qué se midió en el plano |
|---|---|---|
| Roca | `#F07D2B` | Trazo Temperley – Ezeiza (ramal 1) y recuadro «RO». El plano pinta **cada ramal del Roca de un tono distinto** (del naranja al amarillo: La Plata va en amarillo `#F0C848`); se toma el naranja del tronco y del recuadro como color de la línea |
| Sarmiento | `#B8237A` | Trazo Once – Moreno (`#AE1E72` medido) y recuadro «SA» |
| Mitre | `#42B874` | Trazo Retiro – Tigre y Suárez – Mitre (`#44B474` medido) y recuadro «MI» |
| San Martín | `#6438C4` | Trazo Retiro – Pilar (`#6438C4` medido) y recuadro «SM» |
| Belgrano Sur | `#5C4858` | Trazo Sáenz – González Catán (`#5C4858` medido) y recuadro «BS» |
| Tren de la Costa | `#A020B8` | Trazo Maipú – Delta (`#A014B8` medido) y recuadro «TC» |

El plano también trae Belgrano Norte (marrón, `#3C280C`) y Urquiza (bordó, `#941040`), que **no** usamos porque esas líneas no están en la fuente de datos (`01d-api-trenes-sofse.md` §3).

### Historial: valores provisorios del 2026-11-05

Antes de este plano se usaron los de [Trenes metropolitanos de Buenos Aires](https://es.wikipedia.org/wiki/Trenes_metropolitanos_de_Buenos_Aires) en Wikipedia: Roca `#FAB700`, Sarmiento `#B766C2`, Mitre `#8FBE00`, San Martín `#6495ED` (`cornflowerblue`), Belgrano Sur `#F85900`, Tren de la Costa `#002D9A`. Se reemplazaron porque el usuario prefirió el plano. Qué se buscó y no sirvió, para no repetirlo:

- **Sitio oficial:** `argentina.gob.ar/transporte/trenes-argentinos` y las páginas de cada línea (`…/horarios-tarifas-y-recorridos/areametropolitana/<línea>`), consultadas el 2026-11-05: no traen colores por línea (solo el color del sitio, `#242C4F`).
- **Fichas de Wikipedia de cada línea** (`Línea Roca`, `Línea Sarmiento`, etc.): el campo `color_fondo` de las siete es el mismo genérico `#3E6AEE`, no un color de línea.
- **GTFS de trenes del GCBA** (`trenes-gtfs.zip`): de 2020 y sin `route_color`.
- **API de SOFSE** (`01d-api-trenes-sofse.md`): el campo `estado.color` de `gerencias` es el color del *estado* (`#435a6c` en las 7 líneas), no el de la línea.
- **OpenStreetMap** (etiquetas `colour` en las relaciones de ruta): el servicio Overpass respondió 502 en los intentos del 2026-11-05.

## 3. Reglas de uso (para la ola 2)

- **La insignia siempre lleva las siglas dentro**: R, S, M, SM, BS, TC. El color nunca es el único canal (WCAG 1.4.1; `PRODUCT.md`).
- **Texto de la insignia: el de la tabla.** No se calcula en la app.
- **Borde de 1–2 px en la insignia** cuando el fondo contra el que se apoya da menos de 3:1 (WCAG 1.4.11). Contraste de cada color contra las superficies de la app (tokens de `02-obelisco-tokens.md`):

| Línea | Fondo claro `#edf4ff` | Placa clara `#ffffff` | Fondo oscuro `#000b18` | Placa oscura `#1b2836` | Borde necesario |
|---|---:|---:|---:|---:|---|
| Roca | 2,47:1 | 2,74:1 | 7,23:1 | 5,47:1 | en claro |
| Sarmiento | 5,33:1 | 5,90:1 | 3,35:1 | 2,54:1 | sobre la placa oscura (2,54:1); sobre el fondo oscuro pasa |
| Mitre | 2,28:1 | 2,52:1 | 7,86:1 | 5,94:1 | en claro |
| San Martín | 6,54:1 | 7,23:1 | 2,74:1 | 2,07:1 | **en oscuro** |
| Belgrano Sur | 7,53:1 | 8,32:1 | 2,38:1 | 1,80:1 | **en oscuro** |
| Tren de la Costa | 5,59:1 | 6,19:1 | 3,20:1 | 2,42:1 | sobre la placa oscura (2,42:1); sobre el fondo oscuro pasa |

- **El trazo de recorrido** (estaciones de un ramal) usa el color de fondo de la línea con el mismo criterio; en San Martín y Belgrano Sur sobre oscuro se sube al color de texto del tema o se le agrega contorno, como pasó con C y E en el subte (`02b-colores-subte.md` §3).
- **Los valores no se hardcodean en la app:** salen del paquete estático (`trenes-lineas.json`), generado por `tools/gtfs` desde esta tabla. Si cambian, cambia el paquete.

## 4. Si vuelven a cambiar

Si aparece una fuente oficial con códigos (manual de identidad de Trenes Argentinos o plano oficial), se repite el procedimiento de §2 con esa fuente: se actualiza esta tabla, se recalculan los contrastes con `tools/contraste`, se copian los valores a `lineas.ts` y `config.ts`, se regenera el paquete estático (`tools/gtfs`, paso `trenes`) y se sube a R2.
