---
version: 1
slug: "src-features-inicio-inicioscreen-tsx"
primary_target: "src/features/inicio/InicioScreen.tsx"
related_targets: ["src/app/(tabs)/inicio/index.tsx"]
---

# Inicio — brief de superficie

Modo **Operate**. Pantalla raíz del tab Inicio (`src/features/inicio/InicioScreen.tsx`). Audiencia: residentes y visitantes de CABA, en la calle, con una mano y sol en la pantalla. Tarea: saber en segundos cuándo viene su colectivo o subte y si funciona. Contenido real: estado de las 7 líneas de subte, favoritos con dato vivo, frescura. Restricciones: paleta Obelisco v2 fijada por el usuario (2026-11-03), Material Symbols fijos, tipografía libre, estados obligatorios (carga, vacío, error, viejo, offline, sin permiso), voseo, sin cuentas ni tracking.

## Direction contract

THESIS: Inicio es una cadena de decisiones: cada favorito es una banda de señal que responde una sola pregunta («¿cuándo viene?») con los minutos en escala monumental y una flecha que lleva al detalle. Se rechaza la lista uniforme de tarjetas blancas con insignia, que es el arreglo por defecto de la categoría.

OWN-WORLD: fondo elevado `#edf4ff`; bandas de señal con radio 6 y sin sombra: azul `#035c80` para la próxima decisión, navy `#1d3343` para las siguientes; pictograma blanco (Material Symbols) en un cuadrado `#08202f` de 40 pt a la izquierda; flecha blanca clavada al borde derecho de la banda; **Fira Sans** 400/600/700 en caja de oración, minutos en 700; discos de línea con los colores GTFS y su letra; ámbar y rojo de Obelisco solo donde cargan estado; tira «Subte ahora» blanca con outline `#d6e4f6`. Con todo el contenido quitado, se reconoce por la banda azul con el cuadrado negro y la flecha al borde.

STORY: la persona abre, lee el minuto grande de su decisión más cercana y sale; de paso ve si alguna línea de subte está demorada y qué tan fresco es el dato. Cree que la app le dice lo justo y a tiempo.

FIRST VIEWPORT: (390×844) barra de estado; large title «Inicio» con engranaje a la derecha; tira «Subte ahora» (7 discos de 28 pt en fila y una línea de estado en `#a25c00` si hay demora); banda líder de 148 pt en azul: pictograma, mensaje «Parada 60 · Cabildo y Juramento», «Próximo» y «4 min» a 56 pt, flecha abajo a la derecha; tres bandas navy de 72 pt con el minuto a 24 pt y, si corresponde, cuadrado ámbar + «Con demoras»; «Actualizado hace 12 s» y «Ver todos los favoritos (6)»; tabs nativas. La acción primaria es tocar la banda líder.

FORM: «Señalética de terminal», retadora del catálogo (`wayfinding-cartography-signage-terminal-yellow-wayfinding`), elegida por el usuario en la página de decisión del 2026-11-03 sobre la asignada («Boleto y SUBE», posición 5 de la lista propia). Traducción obligada: el amarillo Schiphol pasa al azul y navy de Obelisco porque la paleta está fijada; sobreviven la flecha al borde, el pictograma en cuadrado, una decisión por banda y los minutos monumentales. Interacción firma: la banda líder «se vuelve a señalizar» sola: cuando cambia el favorito más cercano o su próximo arribo, el contenido de la banda cruza en fundido (corte seco con Reducir movimiento) y la decisión seguida se mantiene resaltada de pantalla en pantalla (Inicio → detalle). seed:2db0aa292d67ea2e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones abiertas

- Alcance del rediseño fuera de Inicio: **resuelto el 2026-11-04**. El usuario validó el piloto en el iPhone y pidió extender la dirección a toda la app; cada tab tiene su brief de superficie en esta carpeta (Subtes, Colectivos, Favoritos, Ajustes).
- DESIGN.md se reescribe al final de la construcción (documenter), no antes.
