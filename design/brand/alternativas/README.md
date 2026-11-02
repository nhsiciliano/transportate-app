El usuario eligió **B — Subte conectado** el 2026-11-02; la marca vigente está en [`design/brand/`](../). Las alternativas y comparaciones quedan como registro de la elección.

# Tres alternativas para Transportate

Compará las propuestas en [`contact-sheet.png`](contact-sheet.png): de izquierda a derecha, la marca actual y las alternativas A, B y C. Cada [`preview-a.png`](preview-a.png), [`preview-b.png`](preview-b.png) y [`preview-c.png`](preview-c.png) muestra tamaños reales de 180 y 48 px sobre claro y oscuro.

## Conceptos

- **A — Colectivo cercano.** Frente de colectivo con parabrisas amplio, espejos, dos faros y una franja de destino amarilla. La composición simétrica prioriza el reconocimiento inmediato del servicio de colectivos.
- **B — Subte conectado.** Frente de subte con parabrisas en V, faros y rieles, acompañado por una línea de recorrido con una estación. La composición asimétrica representa la red y el seguimiento del viaje.
- **C — Tren en vivo.** Perfil lateral de un tren de nariz inclinada sobre un riel, con una señal de tiempo real. El fondo secondary y la composición horizontal ofrecen una alternativa más dinámica.

Las tres son geometrías originales: rellenos planos, esquinas suaves y detalles amplios para conservar lectura a 48 px. El ícono no contiene texto. El tren de C es una propuesta de marca, no un anuncio de cobertura de trenes en el MVP.

## Paleta

| Uso | Color | Cita de origen |
| --- | --- | --- |
| Fondo A/B y recortes interiores | `#1d3343` | [`docs/02-obelisco-tokens.md`](../../../docs/02-obelisco-tokens.md) §1.2, primary (`colors:135`, `dist:32`) |
| Fondo C y recortes interiores | `#035c80` | Mismo documento, §1.2, secondary (`colors:136`, `dist:33`) |
| Vehículos | `#ffffff` | Mismo documento, §1.3, text-white (`typo:170`) |
| Destino, recorrido y señal | `#ffcd02` | Mismo documento, §1.1, yellow-200 (`colors:5`) |

Cada ícono usa exactamente tres colores base: su fondo, blanco y amarillo; el suavizado de bordes mezcla esos mismos colores. Los SVG definen `.bg`, `.mark` y `.accent` con comentarios que citan los tokens. Los fondos `#f5f5f5` y `#111111` son exclusivos de las comparaciones, según `BRIEF.md`.

En una futura versión monocroma, `.mark` y `.accent` comparten el blanco y los recortes `.bg` se convierten en transparencia; el rectángulo de fondo se excluye de la máscara. Los parabrisas, faros y ventanas conservan la identidad de cada vehículo sin depender del amarillo. En esta tarea solo se entregan las propuestas para elegir: los assets actuales quedan intactos.

## Archivos

| Archivo | Medidas / formato | Para qué sirve |
| --- | --- | --- |
| `mark-a.svg` | viewBox 0 0 1024 1024 | Fuente de A: colectivo frontal. |
| `mark-b.svg` | viewBox 0 0 1024 1024 | Fuente de B: subte y recorrido. |
| `mark-c.svg` | viewBox 0 0 1024 1024 | Fuente de C: tren y señal de tiempo real. |
| `icon-ios-1024-a.png` | 1024 × 1024 px, RGB sin alfa | Ícono iOS de A, con fondo opaco y sin esquinas recortadas. |
| `icon-ios-1024-b.png` | 1024 × 1024 px, RGB sin alfa | Ícono iOS de B, con fondo opaco y sin esquinas recortadas. |
| `icon-ios-1024-c.png` | 1024 × 1024 px, RGB sin alfa | Ícono iOS de C, con fondo opaco y sin esquinas recortadas. |
| `preview-a.png` | 720 × 360 px, RGB sin alfa | A a 180 y 48 px sobre claro y oscuro. |
| `preview-b.png` | 720 × 360 px, RGB sin alfa | B a 180 y 48 px sobre claro y oscuro. |
| `preview-c.png` | 720 × 360 px, RGB sin alfa | C a 180 y 48 px sobre claro y oscuro. |
| `contact-sheet.png` | 1216 × 376 px, RGB sin alfa | Actual, A, B y C lado a lado a 256 px, con sus rótulos. |
| `generate.py` | Python 3.9 o superior | Regenera y valida todos los PNG sin dependencias. |
| `README.md` | Markdown | Conceptos, paleta y reproducción. |

Solo las comparaciones llevan esquinas redondeadas con radio del 22 %, como aproximación visual al recorte de iOS; los PNG de 1024 px son cuadrados completos. Los rótulos de comparación usan un alfabeto monolineal original incluido en el script, sin archivos de fuentes externos.

## Regeneración

Desde la raíz del repo, sin instalar paquetes ni acceder a la red:

```sh
python3 design/brand/alternativas/generate.py
python3 design/brand/alternativas/generate.py --check
sips -g pixelWidth -g pixelHeight -g hasAlpha design/brand/alternativas/*.png
```

`generate.py` lee la geometría y los colores desde los tres SVG, convierte las curvas a segmentos cortos y rasteriza con cobertura de 4 × 4 muestras por píxel. Admite `rect` con `rx`, `circle`, `polygon` y `path` de un contorno con comandos absolutos `M/L/H/V/Q/C/Z`, sin trazos ni transformaciones. Si agregás otras primitivas al SVG, adaptá el rasterizador antes de regenerar. Los íconos de las previews se rasterizan directamente a 180 y 48 px; la referencia Actual se reduce por promedio desde `../icon-ios-1024.png`, que solo se lee.

La salida es determinista para la misma versión de Python/zlib. La verificación inspecciona dimensiones, formato RGB de 8 bits sin alfa, CRC, esquinas opacas, ausencia de metadatos y peso menor a 1 MB para todos los PNG. Cada archivo contiene solamente `IHDR`, `IDAT` e `IEND`, sin EXIF, fechas, nombres ni emails. La revisión visual se hizo a 256, 180 y 48 px, y también unificando blanco y amarillo para comprobar la lectura monocroma.

Licencia: obra original creada para el proyecto Transportate, sin material de terceros ni logos oficiales del GCBA.
