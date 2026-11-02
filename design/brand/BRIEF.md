# Brief: assets de marca de Transportate (tarea F3-IMG-A)

> Escrito por el coordinador el 2026-11-02. Reglas generales: trabajá solo en este worktree y branch, commits convencionales, sin push, sin credenciales ni datos personales en archivos ni metadatos. Documentación en español rioplatense. No uses el CLI `orca` (no funciona en este sandbox): al terminar, commiteá y escribí `LISTO <hash>` en la terminal.

## Archivos que te pertenecen
Solo la carpeta nueva `design/brand/` (raíz del repo). No toques `apps/`, `docs/`, `packages/` ni `tools/`. Otro worker va a enchufar estos archivos en la configuración de Expo después.

## Qué producir
Marca visual simple y geométrica para **Transportate** (transporte público de la Ciudad de Buenos Aires: colectivos y subte), alineada a la identidad Obelisco v2 del GCBA: primary `#1d3343` (azul muy oscuro), secondary `#035c80`, tertiary `#009688`, blanco `#ffffff`, y como acento opcional `#ffcd02` (amarillo de la rampa Obelisco). Sin texto dentro del ícono, sin degradados complejos ni sombras, legible a 48 px. Motivo sugerido: silueta estilizada del Obelisco porteño combinada con un trazo de movimiento o una "T" geométrica; evitá clichés como un colectivo detallado. Debe funcionar sobre fondo claro y oscuro.
Entregables (PNG sin metadatos personales, cada uno < 1 MB; además el **SVG fuente** de la marca):
1. `icon-ios-1024.png`: 1024×1024, **sin transparencia** y **sin esquinas redondeadas** (iOS las aplica), fondo `#1d3343`, marca en blanco (y acento opcional).
2. `adaptive-foreground-1024.png`: 1024×1024 con transparencia; la marca ocupa solo el **círculo central de 66 %** (zona segura de Android), sin fondo.
3. `adaptive-background.txt`: una línea con el color de fondo del adaptativo (`#1d3343`).
4. `adaptive-monochrome-1024.png`: 1024×1024, silueta de la marca en **blanco** sobre transparente (Android 13 themed icons), misma zona segura.
5. `splash-icon-1024.png`: 1024×1024 con transparencia, marca centrada ocupando ~60 % (Expo la muestra a 200 px lógicos sobre fondo `#ffffff` en claro y `#1d3343` en oscuro): entregá dos variantes si hace falta contraste, `splash-icon-light-1024.png` (marca en `#1d3343`) y `splash-icon-dark-1024.png` (marca en blanco).
6. `notification-icon-96.png`: 96×96, blanco sobre transparente (reserva para el futuro).
7. `mark.svg`: fuente vectorial de la marca, con los colores como variables/clases.
8. `README.md`: concepto en 3–5 líneas, paleta usada, tabla de archivos con tamaño en px y para qué sirve cada uno, cómo regenerar los PNG desde el SVG (comando reproducible, por ejemplo con `rsvg-convert`, `sharp` o el script que uses), y una línea de licencia: obra original creada para el proyecto, sin material de terceros ni logos oficiales del GCBA (no uses el escudo ni el logo "BA" del Gobierno).

## Restricciones
- Trabajá con las herramientas de imagen que tenga tu sesión; si generás con un modelo de imágenes, limpiá fondos y recortes a mano o por script para cumplir las medidas exactas, y verificalas (`sips -g pixelWidth -g pixelHeight <archivo>` o `python3 -c` con Pillow). Confirmá que el PNG iOS no tiene canal alfa.
- Si un script necesita dependencias, instalalas fuera del repo (`~/.cache/transportate/`) o en `design/brand/tools/` con su propio `package.json` sin `node_modules` commiteados.
- Sin nombres de personas ni emails en metadatos.
- Commiteá en tu branch con `feat(brand): assets de marca iniciales`.

## Aceptación
Los 8 entregables existen con las medidas exactas, el iOS sin alfa, cada PNG < 1 MB, el README describe cómo regenerarlos, y en el `worker_done` incluís la ruta de cada archivo.
