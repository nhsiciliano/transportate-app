---
version: 1
slug: "src-features-favoritos-favoritosscreen-tsx"
primary_target: "src/features/favoritos/FavoritosScreen.tsx"
related_targets: ["src/features/favoritos/FavoritoRow.tsx","src/features/favoritos/FavoritoItem.tsx","src/features/favoritos/EditMode.tsx","src/features/favoritos/AliasSheet.tsx"]
---

# Favoritos — brief de superficie

Modo **Operate**. Tab Favoritos: `src/features/favoritos/FavoritosScreen.tsx` con `FavoritoRow.tsx`, `FavoritoItem.tsx`, `EditMode.tsx` y `AliasSheet.tsx`. Audiencia: la persona que ya guardó sus líneas, paradas y estaciones y vuelve todos los días. Tarea: ver todo lo guardado con su dato vivo y gestionarlo (renombrar, quitar, reordenar). Contenido real: hasta decenas de favoritos en el orden fijado, alias de 30 caracteres, dato vivo por tipo, huérfanos, Alert única de servicio caído, búsqueda desde 15. Restricciones: las de Inicio; el arrastre con `react-native-reorderable-list` y los hápticos quedan como están; «Editar/Listo» en el header nativo.

## Direction contract

THESIS: Favoritos es el tablero completo: todas las bandas al **mismo rango** (navy), en el orden que la persona fijó, con su valor vivo a la derecha; la decisión más cercana se señala solo en Inicio. Se rechaza la lista de filas grises con el dato en chico y el modo edición como pantalla aparte.

OWN-WORLD: hereda el de Inicio. Las filas son bandas `next` (72 pt, `#1d3343`, pictograma en cuadrado, mensaje 17/600, valor 24/700, cuadrado de estado, flecha al borde). En edición la banda conserva su forma: a la izquierda entra la manija «Reordenar» (44×44, ícono `reordenar` en `on`) antes del pictograma, la flecha se reemplaza por el botón «Quitar» (`borrar`, 44×44) y tocar el texto abre el alias (ícono `editar` chico junto al mensaje). El huérfano es una banda sin flecha, con cuadrado rojo «Ya no figura» y «Quitar» siempre visible. La búsqueda y la Alert única usan los componentes compartidos sin variante propia.

STORY: la persona abre y recorre su columna de bandas como la de Inicio, pero completa; en edición mueve, renombra y quita sin cambiar de lugar. Cree que Favoritos e Inicio son la misma señal, entera y recortada.

FIRST VIEWPORT (390×844): large title «Favoritos» con «Editar» a la derecha; `FreshnessLabel` del dato más viejo visible; columna de bandas `next` con gap 8: «Casa · Estación Medrano, Línea B» y «4 min» con cuadrado ámbar «Con demoras»; «Línea 152 · Ramal A» y «2 en servicio»; «Parada Cabildo 2000» y las líneas que paran en escala texto; una banda con «Sin información» muted; con más de 15 favoritos, el `SearchInput` arriba. En edición, las mismas bandas con manija y «Quitar». La acción primaria es tocar una banda.

FORM: «Señalética de terminal» extendida (misma dirección que Inicio), decidida por el usuario el 2026-11-04. Interacción firma: al salir de la edición las bandas vuelven a su forma con el mismo fundido de 200 ms (corte seco con Reducir movimiento); la banda que se quita desaparece y el `Snackbar` «Quitaste «Casa». Deshacer» la devuelve a su lugar. seed:2db0aa292d67ea2e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones abiertas

- Menú contextual con long press: sigue fuera (F4-inicio-1).
- El alias se edita en la `formSheet` actual; solo cambia la tipografía.
