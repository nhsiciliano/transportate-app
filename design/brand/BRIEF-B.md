# Brief: set completo de marca a partir de la alternativa B (tarea F3-IMG-C)

> Escrito por el coordinador el 2026-11-02. Mismas reglas que `alternativas/BRIEF.md`: trabajá solo en este worktree (branch `nhsiciliano/Dev-Images`), sin push, sin credenciales ni datos personales en archivos ni metadatos, español rioplatense. No uses el CLI `orca` y **no intentes commitear**: el coordinador commitea por vos. Al terminar escribí `LISTO` y la lista de archivos en la terminal.

## Decisión

El usuario eligió la **alternativa B ("Subte conectado")**: frente de subte con parabrisas en V y faros, más la línea de recorrido amarilla con estación, sobre `#1d3343`. Reemplaza al Obelisco con franja como marca de Transportate. Partí de `design/brand/alternativas/mark-b.svg` **sin cambiar el dibujo** (solo lo que haga falta para la zona segura de Android y las variantes monocromas).

## Qué producir (todo en `design/brand/`, reemplazando los archivos actuales)

Mismos nombres, medidas y reglas que en el brief original (`design/brand/BRIEF.md`, sección "Qué producir"):
1. `mark.svg`: la geometría de B como fuente canónica, viewBox 0 0 1024 1024, **sin el rectángulo de fondo** (el fondo lo ponen el ícono iOS y el adaptativo), clases `.mark` (blanco) y `.accent` (amarillo) con comentarios de cita de paleta; si necesitás recortes interiores en color de fondo, usá una clase `.primary` como hacía el mark anterior.
2. `icon-ios-1024.png`: 1024×1024, sin alfa, sin esquinas redondeadas, fondo `#1d3343`. Debe ser **idéntico píxel a píxel** a `alternativas/icon-ios-1024-b.png` o, si cambiás la escala, explicá por qué en el README.
3. `adaptive-foreground-1024.png`: 1024×1024 RGBA, marca blanca + amarillo sobre transparente, **todos los píxeles visibles dentro del círculo central de 66 %** (diámetro 675,84 px). Reescalá la marca lo que haga falta.
4. `adaptive-background.txt`: `#1d3343` (ya existe; dejalo igual).
5. `adaptive-monochrome-1024.png`: silueta en **blanco puro** sobre transparente, misma posición y escala que el foreground. Blanco y amarillo se unifican; los recortes en `.primary` se vuelven transparentes. Verificá que el subte siga leyéndose (parabrisas, faros).
6. `splash-icon-1024.png`, `splash-icon-light-1024.png` (marca en `#1d3343`, para fondo blanco) y `splash-icon-dark-1024.png` (marca en blanco, para fondo `#1d3343`): RGBA, marca centrada ocupando ~60 % del lienzo. En las splash la marca es **monocroma** (sin amarillo) para que el contraste no dependa del acento; si preferís conservar el amarillo del recorrido, hacelo en las dos variantes y justificalo en una línea. `splash-icon-1024.png` idéntico a la light.
7. `notification-icon-96.png`: 96×96 RGBA, silueta blanca sobre transparente (misma máscara que el monocromo, reducida).
8. `generate.py`: actualizado para rasterizar el nuevo `mark.svg` con todas sus primitivas (podés tomar el rasterizador de `alternativas/generate.py`) y con `--check` que valide todo lo que validaba el anterior (dimensiones, CRC, sin metadatos, iOS sin alfa y esquinas opacas, monocromo blanco puro, círculo seguro Android, splash default == light, peso < 1 MB).
9. `README.md` de `design/brand/`: reescribí la sección de concepto para B (3–5 líneas), mantené la paleta con citas, la tabla de archivos, la sección "Regeneración y verificación" y la sección "Dónde se copian para Expo" tal como está (los nombres de destino no cambian). Agregá una línea: la alternativa B fue elegida por el usuario el 2026-11-02 entre las tres de `alternativas/`, que quedan como registro.
10. `alternativas/README.md`: agregá al principio una línea que diga que el usuario eligió B y que la marca vigente está en `design/brand/`.

Borrá `design/brand/BRIEF.md` (el brief del Obelisco, ya cumplido) y este `BRIEF-B.md` cuando termines; el historial queda en Git.

## Restricciones

- No toques nada fuera de `design/brand/` (ni `apps/`, ni `docs/`, ni `DESIGN.md`): el coordinador copia los PNG a `apps/mobile/assets/images/` y actualiza la documentación.
- Sin metadatos personales en los PNG (solo `IHDR`, `IDAT`, `IEND`). Verificá con `sips -g pixelWidth -g pixelHeight -g hasAlpha design/brand/*.png` y con `python3 design/brand/generate.py --check`.
- Mirá cada PNG generado (en particular el monocromo y el adaptativo a 48 px) antes de dar por terminado.

## Aceptación

Los 8 entregables del set existen con las medidas y reglas indicadas, `generate.py --check` pasa, el iOS coincide con la alternativa B, el README está actualizado y los briefs cumplidos fueron borrados. Al terminar: `LISTO` y la lista de archivos.
