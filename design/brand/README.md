# Marca de Transportate

El Obelisco se reduce a una silueta de cinco vértices, reconocible a 48 px.
Una franja diagonal ascendente representa el movimiento del transporte por la Ciudad.
La geometría funciona también como una sola silueta, sin depender del acento amarillo.
No lleva texto, degradados, sombras, escudos ni logos oficiales.

## Paleta

| Uso | Color | Cita |
| --- | --- | --- |
| Fondo del ícono / marca sobre claro | `#1d3343` | [`docs/02-obelisco-tokens.md`](../../docs/02-obelisco-tokens.md) §1.2, primary (`colors:135`, `dist:32`) |
| Marca sobre oscuro / monocromo | `#ffffff` | Mismo documento, §1.3, text-white (`typo:170`) |
| Franja de movimiento en el ícono a color | `#ffcd02` | Mismo documento, §1.1, yellow-200 (`colors:5`) |

`#035c80` y `#009688` siguen siendo los colores secondary y tertiary del producto (§1.2); esta marca usa tres colores para conservar legibilidad a tamaños chicos. El SVG define los colores con las clases `.primary`, `.mark` y `.motion`, cada una con su cita de origen.

## Archivos

| Archivo | Tamaño | Uso |
| --- | --- | --- |
| `icon-ios-1024.png` | 1024 × 1024 px, RGB | Ícono iOS: fondo primary opaco, marca blanca y franja amarilla; sin canal alfa ni esquinas redondeadas. |
| `adaptive-foreground-1024.png` | 1024 × 1024 px, RGBA | Primer plano Android: marca blanca y franja amarilla sobre transparente. |
| `adaptive-background.txt` | No aplica | Una línea: `#1d3343`, fondo del ícono adaptativo. |
| `adaptive-monochrome-1024.png` | 1024 × 1024 px, RGBA | Silueta completamente blanca sobre transparente para íconos temáticos Android 13+. |
| `splash-icon-1024.png` | 1024 × 1024 px, RGBA | Variante predeterminada para fondo claro; idéntica a `splash-icon-light-1024.png`. |
| `splash-icon-light-1024.png` | 1024 × 1024 px, RGBA | Silueta primary sobre transparente para fondo blanco. |
| `splash-icon-dark-1024.png` | 1024 × 1024 px, RGBA | Silueta blanca sobre transparente para fondo primary. |
| `notification-icon-96.png` | 96 × 96 px, RGBA | Silueta blanca sobre transparente, reservada para notificaciones futuras. |
| `mark.svg` | viewBox 1024 × 1024 | Fuente vectorial: geometría y colores canónicos, sin fondo. |
| `generate.py` | No aplica | Generación y validación reproducibles con la biblioteca estándar de Python 3. |

En los dos adaptativos, **todos los píxeles visibles**, incluyendo el suavizado, quedan dentro del círculo centrado de diámetro 675,84 px (66 % del lienzo). Comparten posición y máscara alfa. La caja visible es `(240, 242)–(784, 782)`.

En los splash la marca ocupa 616 × 610 px: aproximadamente el 60 % del lienzo, centrada por su caja geométrica. Elegí la variante light sobre `#ffffff` y dark sobre `#1d3343`; la variante predeterminada corresponde al modo claro. Los PNG están preparados para que otro paquete los conecte a la configuración de la app.

## Regeneración y verificación

Desde la raíz del repo, con Python 3.9 o superior, sin instalar paquetes ni acceder a la red:

```sh
python3 design/brand/generate.py
python3 design/brand/generate.py --check
```

El script lee los polígonos y colores de `mark.svg`; no duplica su geometría. Admite exclusivamente polígonos sin transformaciones ni atributos extra: si cambiás la fuente a curvas u otras primitivas, necesitás adaptar el rasterizador. Calcula cobertura de 4 × 4 muestras por píxel y compone los polígonos en el orden del SVG. Los splash y el ícono iOS usan una escala centrada de 1,13; los adaptativos y la notificación usan la escala base.

La generación es determinista para una misma versión de Python/zlib. Cada PNG contiene únicamente `IHDR`, `IDAT` e `IEND`: no incluye fechas, nombres, emails, EXIF ni otros metadatos. Cada archivo pesa menos de 1 MB. `--check` inspecciona dimensiones, CRC, píxeles descomprimidos, colores monocromos, transparencia, opacidad de las esquinas iOS, límite de peso y círculo seguro Android. También confirma que el splash predeterminado sea idéntico al claro. Para una comprobación adicional en macOS:

```sh
sips -g pixelWidth -g pixelHeight -g hasAlpha design/brand/*.png
```

Licencia: obra original creada para el proyecto Transportate, sin material de terceros ni logos oficiales del GCBA.
