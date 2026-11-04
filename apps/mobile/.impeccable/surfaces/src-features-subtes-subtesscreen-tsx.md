---
version: 1
slug: "src-features-subtes-subtesscreen-tsx"
primary_target: "src/features/subtes/SubtesScreen.tsx"
related_targets: ["src/features/subtes/LineaScreen.tsx","src/features/subtes/EstacionScreen.tsx","src/features/subtes/MapaRedScreen.tsx","src/features/subtes/components.tsx"]
---

# Subtes — brief de superficie

Modo **Operate**. Tab Subtes: raíz (`src/features/subtes/SubtesScreen.tsx`), línea (`LineaScreen.tsx`), estación (`EstacionScreen.tsx`) y mapa de la red (`MapaRedScreen.tsx`). Audiencia: la misma de Inicio, en el andén o yendo a la estación. Tarea: saber si la línea funciona y cuándo viene el próximo tren por sentido. Contenido real: estado de las 7 líneas con el resumen de la alerta más severa, alertas completas, 108 estaciones con su recorrido, arribos por sentido (feed congelado para algunas líneas: dato viejo como estado normal). Restricciones: las de Inicio (paleta Obelisco v2 intacta, Material Symbols, estados obligatorios, voseo, nunca pedir ubicación) más el orden fijo A, B, C, D, E, H, Premetro (S8) y el mapa MapLibre tal como está.

## Direction contract

THESIS: Subtes es el tablero de estado de la red y la estación es el cartel de andén. La raíz lista las siete líneas en **una sola placa blanca** con el estado alineado a la derecha, para leer de arriba abajo como un tablero de salidas; la estación responde «¿cuándo viene?» con una banda por sentido y el minuto monumental. Se rechaza la lista de tarjetas sueltas con chips de colores y el detalle como ficha de datos.

OWN-WORLD: hereda el de Inicio (`src-features-inicio-inicioscreen-tsx.md`): fondo `#edf4ff`, placas blancas con outline `#d6e4f6` y radio 6, bandas azul `#035c80` (decisión en curso) y navy `#1d3343` (siguientes), pictograma blanco en cuadrado `#08202f`, flecha al borde solo donde hay destino, Fira Sans 400/600/700, discos de línea GTFS con letra, cuadrados ámbar/rojo de estado solo con texto al lado. Nuevo acá: la **placa de tablero** (filas de 56 pt separadas por hairline `#d6e4f6` dentro de una placa) y el **trazo de recorrido** del color de la línea con las estaciones como filas.

STORY: la persona abre, recorre la columna de estados y ve en una línea si su línea tiene problema; entra a la estación y lee el minuto grande de su sentido. Cree que la app es el cartel del andén en su mano.

FIRST VIEWPORT (390×844, raíz): large title «Subtes»; `SearchInput` «Buscá una estación»; placa de tablero con las 7 filas: disco de 32 con la letra, «Línea B» en 17/600 y las cabeceras en 13 `text.secondary` debajo, a la derecha el estado en 15/600 («Normal» en `text.secondary`; «Con demoras» con cuadrado ámbar; «Interrumpida» con cuadrado rojo), flecha al borde a 12 pt; si hay resumen de alerta, una tercera línea en 13 del color del estado; debajo, la fila meta con `FreshnessLabel` y una placa de una fila «Mapa de la red» (pictograma `mapa`, flecha). La acción primaria es tocar una línea. **Línea:** banda `lead` fija arriba (sin flecha: ya estás ahí) con pictograma `subtes`, «Línea B · Leandro N. Alem – J. M. de Rosas», valor = estado («Normal»/«Con demoras», escala texto) y cuadrado de estado; estrella de favorito en el header nativo; alertas como `Alert`; estaciones en placa con el trazo vertical del color de la línea. **Estación:** título nativo con el nombre, disco de la línea y estrella en el header; alerta resumida si hay; una banda `lead` **por sentido**, fija (sin flecha): «Hacia Leandro N. Alem», «Próximo», «4 min» a 56 pt, y como estado muted «Después 7 y 12 min»; con dato viejo > 10 min el valor pasa a «Dato de hace N min» en escala texto; `FreshnessLabel` al pie.

FORM: «Señalética de terminal» extendida (misma dirección que Inicio, catálogo `wayfinding-cartography-signage-terminal-yellow-wayfinding`), decidida por el usuario el 2026-11-04 tras validar el piloto en el iPhone. Interacción firma: la banda de cada sentido se vuelve a señalizar sola (fundido de 200 ms al cambiar el próximo arribo; corte seco con Reducir movimiento), y la decisión seguida desde Inicio aparece arriba del detalle con la misma forma de banda: la continuidad es por construcción, no por animación compartida. seed:2db0aa292d67ea2e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones abiertas

- Si el mapa de la red cambia algo más que la tipografía de sus controles: no en esta ronda (el mapa es MapLibre con estilo externo).
- Combinaciones entre líneas: siguen fuera (el estático no trae `transfers.txt`).
