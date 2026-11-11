---
version: 1
slug: "site-src-pages-index-astro"
primary_target: "site/src/pages/index.astro"
related_targets: ["site/src/pages/privacidad.astro","site/src/pages/soporte.astro"]
---

# Landing de transportate.ar — brief de superficie

Modo **Persuade**. Página de inicio del sitio público (`site/src/pages/index.astro`), con Privacidad, Soporte y 404 en el mismo layout. Audiencia: quien llega desde un enlace, la ficha de App Store o una búsqueda y quiere saber en segundos qué hace la app y si es para su viaje. Acción: bajar la app (hoy, enterarse de que está por salir: botones «Próximamente en App Store» / «Próximamente en Google Play»). Prueba: capturas reales de la app (las saca el coordinador) y los textos aprobados para la ficha de App Store. Restricciones: sin terceros, sin cookies, CSP sin `unsafe-inline`, un solo JavaScript propio (el selector de modos), voseo, nada de usuarios, métricas ni testimonios inventados, no se presenta como oficial.

## Direction contract

THESIS: la landing es un cartel de terminal que se recorre de arriba abajo: cada bloque es una placa o una banda de señal que responde una sola pregunta (qué es, cómo se usa, qué tan confiable es el dato, cuándo sale). Rechaza la landing de app de consumo: degradé, mockup flotante con sombra y fila de tres tarjetas iguales.

OWN-WORLD: la de la app, «Señalética de terminal», sobre Obelisco v2: fondo blanco `#ffffff` / `#000b18`; banda navy `#1d3343` para el cartel principal y el cierre, banda azul `#035c80` para la señal líder; pictogramas Material Symbols Rounded relleno en cuadrados `#08202f` con la flecha clavada al borde derecho; placas blancas con contorno de 2 px `#d6e4f6`, radio 6, sin sombras; Fira Sans 400/600/700 en caja de oración; discos de línea con sus colores y su letra; amarillo `#ffcd02` solo como el recorrido de la marca (banda de avance del scroll y trazo del cartel).

STORY: entiende que la app responde «¿cuándo llega?» para subte, colectivo y tren; ve cada pantalla real; cree que no le inventa datos y no lo rastrea; se lleva que sale pronto en App Store.

FIRST VIEWPORT: cabecera blanca con la marca (isotipo en cuadrado navy + «Transportate») y cuatro enlaces, banda amarilla de avance abajo. Debajo, el cartel navy a todo el ancho: fila de tres pictogramas (colectivo, subte, tren) en cuadrados oscuros, titular blanco de 700 a escala de cartel (hasta ~4,5 rem), línea de apoyo, los dos botones de tienda como placas blancas; a la derecha el teléfono con Inicio, cortado por el borde inferior del cartel. Los discos de las líneas de subte y las siglas de trenes corren en una franja al pie del cartel. La acción primaria es el botón de App Store.

FORM: extensión de «Señalética de terminal» (contrato en `apps/mobile/.impeccable/surfaces/src-features-inicio-inicioscreen-tsx.md`), fijada por el brief del coordinador; no se tiró una dirección nueva. Interacción firma: el selector de modos cambia la pantalla del teléfono y el panel con una view transition (la pantalla cruza en fundido y el panel entra desde abajo), y las placas del panel aparecen escalonadas con `@starting-style`. Movimiento: entrada de secciones por scroll y banda de avance; todo detrás de `prefers-reduced-motion: no-preference`. seed: none (dirección fijada por el brief, sin tirada de concept-seed)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones abiertas

- Revisión final (finish review) y DESIGN.md: las hace el coordinador. El brief de LANDING-1 prohíbe escribir `DESIGN.md` y `PRODUCT.md` desde esta tarea.
- Capturas reales de las cinco pantallas, en claro y oscuro: ya están (commit 96de448).

## Accesos a las tiendas (LANDING-2, 2026-11-11)

- Decisión del usuario: hoy, placas propias «Próximamente»; con la app aprobada, la insignia oficial negra de App Store (es-MX) en lugar de la placa de App Store, activada por la URL en `site/src/config/tiendas.ts`. Google Play no tiene insignia (no hay app Android).
- Placas pulidas (`polish`): blancas sobre navy en los dos temas, 52 px de alto y el mismo ancho mínimo (18,5 rem) para que queden parejas al apilarse. Estructura de cartel de andén: destino (el nombre de la tienda, 700) y estado (pastilla «Próximamente» con reloj, o «Descargala» con flecha), como los StatusChip de la app. Sin pictograma de descarga, sin logos y sin la forma de insignia (negro con borde gris y dos líneas).
- Insignia: 52 px de alto, espacio libre de 13 px, foco de 3 px por fuera, sin `.revelar`, sin hover y con `view-transition-name` propio sin animación; crédito de Apple en el pie de la landing solo cuando se muestra. En el cierre, la entrada por scroll va en el pictograma y el texto, solo con fundido.

