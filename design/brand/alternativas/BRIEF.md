# Brief: tres alternativas de ícono para Transportate (tarea F3-IMG-B)

> Escrito por el coordinador el 2026-11-02. Reglas generales: trabajá solo en este worktree (`~/orca/workspaces/Transportate/Dev-Images`, branch `nhsiciliano/Dev-Images`), sin push, sin credenciales ni datos personales en archivos ni metadatos, documentación en español rioplatense. No uses el CLI `orca` (no funciona en este sandbox) y **no intentes commitear** (el índice de Git tampoco es escribible desde tu sandbox): el coordinador commitea por vos. Al terminar escribí en la terminal la línea `LISTO` seguida de la lista de archivos producidos.

## Contexto

El usuario revisó `design/brand/icon-ios-1024.png` (Obelisco de cinco vértices con franja diagonal amarilla) y **no quedó convencido**. Quiere elegir entre **tres alternativas más modernas**, más acordes a lo que hace la app, y que incluyan de forma reconocible un **colectivo, un tren o un subte** (al menos uno por alternativa; pueden combinarse). Después de elegir, se generará el set completo (adaptativo Android, monocromo, splash, notificación) a partir de la ganadora, así que ahora solo hace falta el ícono iOS y la fuente vectorial de cada una.

Qué hace la app: muestra arribos en tiempo real de colectivos y subtes de la Ciudad de Buenos Aires, con favoritos y mapa de posición de colectivos. Es una app utilitaria, rápida, de consulta en la calle. Identidad visual: Obelisco v2 del GCBA, primary `#1d3343` (azul muy oscuro), secondary `#035c80`, tertiary `#009688`, blanco `#ffffff`, acento opcional `#ffcd02`. Leé `design/brand/README.md` y `DESIGN.md` (raíz) para la paleta y el tono.

## Dirección de diseño

- **Moderno**: formas geométricas limpias, trazos de grosor uniforme, esquinas redondeadas consistentes, mucho aire. Estilo "ícono de sistema" actual (pensá en los íconos de apps de transporte de 2024–2026: silueta frontal simplificada de un vehículo, no una ilustración). Sin texto, sin degradados complejos, sin sombras, sin relieves, sin escudos ni logos oficiales del GCBA.
- **Reconocible a 48 px** y sin perder lectura a 180 px (tamaño real en el home de iPhone). Probalo.
- **Un vehículo protagonista por alternativa**, en vista frontal o lateral muy sintetizada: colectivo (frente con parabrisas y dos faros), subte (frente de formación con faros y la "cola de pez" de las ventanas) o tren. Podés sumar un elemento secundario de movimiento, recorrido o ubicación (pin, línea de recorrido con un punto, señal de "en vivo").
- **Las tres tienen que ser realmente distintas entre sí** (no tres variantes del mismo dibujo): por ejemplo, A = frente de colectivo; B = frente de subte con línea de recorrido; C = composición colectivo + subte (dos vehículos superpuestos o un vehículo híbrido) o tren con señal de tiempo real. Explicá en una línea el concepto de cada una.
- **Color**: fondo opaco. Al menos dos de las tres sobre `#1d3343`; podés proponer una sobre `#035c80` o `#009688` si mejora la lectura. Marca en blanco con un acento (`#ffcd02` o `#009688`), máximo tres colores por ícono. Tiene que funcionar también como silueta monocroma (lo vamos a necesitar para Android 13), así que la forma debe ser legible sin el color.

## Entregables (todos dentro de `design/brand/alternativas/`)

Por cada alternativa `a`, `b` y `c`:
1. `mark-<letra>.svg`: fuente vectorial, viewBox 0 0 1024 1024, colores como clases (`.bg`, `.mark`, `.accent`) con un comentario con su cita de paleta.
2. `icon-ios-1024-<letra>.png`: 1024×1024, **sin canal alfa**, **sin esquinas redondeadas** (iOS las aplica), fondo opaco, < 1 MB.
3. `preview-<letra>.png`: el ícono con esquinas redondeadas al estilo iOS (radio ~22 %) a 180 px y a 48 px, sobre fondo claro `#f5f5f5` y oscuro `#111111`, en una sola imagen de hasta 800 px de ancho, para que el usuario lo vea como en un home real.

Además:
4. `contact-sheet.png`: las tres alternativas lado a lado a 256 px con esquinas redondeadas, sobre fondo claro, rotuladas A/B/C. Y la actual (`../icon-ios-1024.png`) a la izquierda como referencia rotulada "Actual".
5. `README.md`: concepto de cada alternativa en 1–2 líneas, paleta usada, tabla de archivos y comando reproducible para regenerar los PNG desde los SVG (podés reutilizar y extender `../generate.py`, que solo entiende polígonos sin transformaciones; si necesitás curvas o `rect` con esquinas redondeadas, usá Pillow instalado fuera del repo, por ejemplo `python3 -m venv ~/.cache/transportate/venv`, o `rsvg-convert` si está disponible, y documentá qué usaste). Una línea de licencia: obra original creada para el proyecto, sin material de terceros.

## Restricciones

- Sin metadatos personales en los PNG (solo `IHDR`, `IDAT`, `IEND`, o al menos sin EXIF, nombres ni emails). Verificá medidas y alfa: `sips -g pixelWidth -g pixelHeight -g hasAlpha design/brand/alternativas/*.png`.
- No toques nada fuera de `design/brand/alternativas/` (ni los assets actuales de `design/brand/`, ni `apps/`, ni `docs/`).
- No hay red garantizada: no dependas de descargas; si una herramienta no está, usá la biblioteca estándar de Python.

## Aceptación

Existen los 11 archivos (3 SVG, 3 PNG iOS sin alfa, 3 previews, contact sheet, README), las tres alternativas son conceptualmente distintas y cada una incluye un colectivo, tren o subte reconocible a 48 px. Al terminar, escribí `LISTO` y la lista de archivos en la terminal.
