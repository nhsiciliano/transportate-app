---
version: 1
slug: "src-features-colectivos-colectivosscreen-tsx"
primary_target: "src/features/colectivos/ColectivosScreen.tsx"
related_targets: ["src/features/colectivos/ParadaScreen.tsx","src/features/colectivos/LineaScreen.tsx","src/features/colectivos/VehiculosSheet.tsx","src/features/colectivos/MapaLinea.tsx","src/features/ubicacion/PermisoUbicacionBloque.tsx"]
---

# Colectivos — brief de superficie

Modo **Operate**. Tab Colectivos: raíz (`src/features/colectivos/ColectivosScreen.tsx`), parada (`ParadaScreen.tsx`), línea con mapa (`LineaScreen.tsx`, `MapaLinea.tsx`, `VehiculosSheet.tsx`) y el bloque de permiso de ubicación (`src/features/ubicacion/PermisoUbicacionBloque.tsx`). Audiencia: en la parada o buscando cuál tomar. Tarea: encontrar la línea o la parada, saber cuántos colectivos hay en servicio y dónde están. Contenido real: índice local de líneas y paradas (búsqueda sin red), paradas cercanas con distancia, líneas recientes, favoritos de colectivo con dato vivo, posiciones GPS por línea; las paradas no traen arribos (N4). Restricciones: las de Inicio; permiso de ubicación pedido solo en contexto (S32); el mapa MapLibre y el panel inferior de tres alturas quedan como están en comportamiento.

## Direction contract

THESIS: Colectivos es el buscador y el cartel de parada: la raíz encuentra (buscar, cerca, reciente) y solo los favoritos son decisiones vivas; la línea responde «¿cuántos hay y dónde?» con un número monumental sobre el mapa. Se rechaza la raíz como feed de tarjetas iguales y el panel del mapa como ficha técnica.

OWN-WORLD: hereda el de Inicio y el de Subtes (placa de tablero, bandas, cuadrado del pictograma, flecha al borde solo con destino, Fira Sans). Nuevo acá: la **insignia de línea de colectivo** neutra (número en 700 sobre `#1d3343`/`on`, radio 4) como pictograma de las paradas; la **distancia** alineada a la derecha en 15/600 («a 120 m») en las paradas cercanas; el **panel sobre el mapa** blanco con esquinas superiores de hoja nativa, sin sombra dura, y la banda `lead` fija como primer bloque.

STORY: la persona escribe «60» o mira qué paradas tiene cerca, abre la línea y lee el número grande de colectivos en servicio mientras los ve moverse en el mapa. Cree que la app sabe dónde están ahora.

FIRST VIEWPORT (390×844, raíz): large title «Colectivos»; `SearchInput` «Buscá una línea o parada»; «Paradas cercanas» como etiqueta de sección (13/600 `text.secondary`) y una placa de tablero con 10 filas: pictograma `parada` en cuadrado, «Cabildo 2000» 17/600, debajo las insignias de las líneas que paran, a la derecha «a 120 m», flecha al borde; «Ver más» como fila final; sin permiso, la placa muestra el bloque de permiso (pictograma `paradasCercanas`, copy actual, botones actuales). Debajo, «Recientes» como placa de filas con la insignia de la línea y la cabecera; y «Tus líneas» como bandas `next` navy con el valor vivo («18 en servicio»). La acción primaria es buscar. **Parada:** título nativo con calle y altura, barrio en 15 `text.secondary`, estrella en el header; placa de tablero con una fila por línea (insignia, ramal y cabecera, flecha → la línea con la cámara en la parada); si hay arribos, el primero en 24/700 a la derecha de la fila; `FreshnessLabel` solo si hay dato vivo. **Línea con mapa:** mapa casi completo; panel inferior colapsado = banda `lead` fija: insignia como pictograma, «Línea 152 · Ramal A», rótulo «En servicio», valor «18» a 56 pt, estado muted con la frescura; estrella y «Actualizar» en la fila siguiente; medio = `Chip`s de ramal y nota de sentido; expandido = lista de vehículos como filas de placa («Interno 1404 · a 350 m de vos» y «hace 25 s» a la derecha). Al tocar un vehículo la banda se vuelve a señalizar con «Interno 1404 · actualizado hace 25 s» y el botón «Seguir».

FORM: «Señalética de terminal» extendida (misma dirección que Inicio), decidida por el usuario el 2026-11-04. Interacción firma: la banda del panel cruza en fundido cuando cambia el conteo o el vehículo seguido (corte seco con Reducir movimiento). seed:2db0aa292d67ea2e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones abiertas

- Arribos por parada (N4): la fila los muestra si la respuesta los trae; sin banda en Parada porque no hay valor vivo que señalizar.
- Clustering, flecha de rumbo y gestos del mapa: sin cambios de comportamiento en esta ronda.
