# Marca de Transportate — Subte conectado

Un frente de subte con parabrisas en V, dos faros y rieles identifica el transporte de un vistazo.
Una línea de recorrido amarilla con una estación representa la conexión y el seguimiento del viaje.
Las formas amplias y redondeadas conservan la lectura al reducirlas y al unificar la marca en un solo color.
No lleva texto, degradados, sombras, escudos ni logos oficiales.

La alternativa **B fue elegida por el usuario el 2026-11-02** entre las tres propuestas de [`alternativas/`](alternativas/), que quedan como registro.

## Paleta

| Uso | Color | Cita |
| --- | --- | --- |
| Fondo del ícono / marca sobre claro | `#1d3343` | [`docs/02-obelisco-tokens.md`](../../docs/02-obelisco-tokens.md) §1.2, primary (`colors:135`, `dist:32`) |
| Subte sobre oscuro / monocromo | `#ffffff` | Mismo documento, §1.3, text-white (`typo:170`) |
| Recorrido y estación en el ícono a color | `#ffcd02` | Mismo documento, §1.1, yellow-200 (`colors:5`) |

`#035c80` y `#009688` siguen siendo secondary y tertiary del producto (§1.2). Esta marca usa tres colores. El SVG define `.primary`, `.mark` y `.accent`, cada clase con su cita de origen; no incluye el rectángulo de fondo. Los recortes de parabrisas y faros se dibujan con `.primary` para la vista del SVG y se convierten en transparencia al generar las variantes RGBA.

## Archivos

| Archivo | Tamaño | Uso |
| --- | --- | --- |
| `icon-ios-1024.png` | 1024 × 1024 px, RGB | Ícono iOS: fondo primary opaco, subte blanco y recorrido amarillo; sin canal alfa ni esquinas redondeadas. |
| `adaptive-foreground-1024.png` | 1024 × 1024 px, RGBA | Primer plano Android: subte blanco y recorrido amarillo sobre transparente, con parabrisas y faros perforados. |
| `adaptive-background.txt` | No aplica | Una línea: `#1d3343`, fondo del ícono adaptativo; se mantiene sin cambios. |
| `adaptive-monochrome-1024.png` | 1024 × 1024 px, RGBA | Silueta blanca pura sobre transparente para íconos temáticos Android 13+, con los mismos recortes y máscara del foreground. |
| `splash-icon-1024.png` | 1024 × 1024 px, RGBA | Variante predeterminada para fondo claro, idéntica a `splash-icon-light-1024.png`. |
| `splash-icon-light-1024.png` | 1024 × 1024 px, RGBA | Subte y recorrido en primary sobre transparente para fondo blanco. |
| `splash-icon-dark-1024.png` | 1024 × 1024 px, RGBA | Subte y recorrido blancos sobre transparente para fondo primary. |
| `notification-icon-96.png` | 96 × 96 px, RGBA | Máscara del adaptativo monocromo reducida a 96 px por promedio de área, en blanco puro. Reserva para notificaciones futuras. |
| `mark.svg` | viewBox 0 0 1024 1024 | Fuente vectorial canónica de B, sin rectángulo de fondo. |
| `generate.py` | No aplica | Generación y validación reproducibles con la biblioteca estándar de Python 3. |

El ícono iOS mantiene la escala y posición originales de B: coincide **píxel a píxel** con [`alternativas/icon-ios-1024-b.png`](alternativas/icon-ios-1024-b.png). La geometría de la marca no se redibujó.

Para los dos adaptativos se aplica escala **0,76** alrededor del centro geométrico `(528, 528)`, trasladado al centro del lienzo `(512, 512)`. Esta reducción permite que **todos los píxeles visibles**, incluyendo los bordes suavizados y sus cuatro esquinas, queden dentro del círculo de diámetro **675,84 px (66 %)**. La caja visible de ambos es `(278, 268)–(746, 756)` y sus máscaras alfa son idénticas.

Los splash usan escala **0,96** con el mismo centrado: la caja visible es `(216, 204)–(808, 820)`, de **592 × 616 px**, aproximadamente el 60 % del lienzo. Son monocromos, sin amarillo: primary sobre blanco y blanco sobre primary. Comparten máscara; el predeterminado es la variante clara.

## Regeneración y verificación

Desde la raíz del repo, con Python 3.9 o superior, sin instalar paquetes ni acceder a la red:

```sh
python3 design/brand/generate.py
python3 design/brand/generate.py --check
```

El script lee los colores y toda la geometría de `mark.svg`. Admite `rect` con `rx`, `circle`, `polygon` y `path` de un contorno con comandos absolutos `M/L/H/V/Q/C/Z`, sin trazos ni transformaciones. Convierte las curvas a segmentos cortos y calcula cobertura de **4 × 4 muestras por píxel**, respetando el orden de pintura del SVG. En las salidas transparentes, `.primary` borra cobertura en lugar de pintar un fondo; `.mark` y `.accent` se unifican en las variantes monocromas. La notificación se deriva de la máscara alfa del monocromo de 1024 px con promedio de área exacto, sin alterar sus proporciones.

La salida es determinista para una misma versión de Python/zlib. Cada PNG contiene únicamente `IHDR`, `IDAT` e `IEND`: no incluye fechas, nombres, emails, EXIF ni otros metadatos. Cada archivo pesa menos de 1 MB. `--check` inspecciona dimensiones, CRC, píxeles descomprimidos, canales RGB/RGBA, colores monocromos puros, transparencia de los recortes interiores, presencia del subte y del recorrido, esquinas iOS opacas, límite de peso y círculo seguro Android. También verifica igualdad de máscaras, splash predeterminado idéntico al claro, reducción exacta de la notificación e igualdad del iOS con la alternativa B. Para una comprobación adicional en macOS:

```sh
sips -g pixelWidth -g pixelHeight -g hasAlpha design/brand/*.png
```

Licencia: obra original creada para el proyecto Transportate, sin material de terceros ni logos oficiales del GCBA.

## Dónde se copian para Expo

Esta carpeta es la **fuente**. Expo no lee de acá: usa las copias de [`apps/mobile/assets/images/`](../../apps/mobile/assets/images/) (`icon.png`, `adaptive-icon.png`, `adaptive-icon-monochrome.png`, `splash-icon-light.png`, `splash-icon-dark.png`, `notification-icon.png`), referenciadas en `apps/mobile/app.config.ts`. Si regenerás la marca con `generate.py`, copiá de nuevo los PNG; la tabla de correspondencia está en [`apps/mobile/README.md`](../../apps/mobile/README.md#assets) y `apps/mobile/test/app-config.test.ts` verifica que `adaptive-background.txt` coincida con el fondo del ícono adaptativo.

## Imagen para redes

[`social/og-1200x630.png`](social/og-1200x630.png) es la imagen Open Graph para compartir Transportate: **1200 × 630 px**, RGB opaco, sRGB y menos de 300 KB. Usa el isotipo de `mark.svg` con escala uniforme, fondo navy, textos blancos y una placa azul de radio 6 para Buenos Aires; el contenido está centrado y deja más de 60 px de margen. [`social/og.svg`](social/og.svg) conserva la composición vectorial con textos convertidos a contornos.

Desde la raíz del repo, en macOS con Swift instalado, sin descargar ni instalar paquetes:

```sh
swift design/brand/social/generate_og.swift
swift design/brand/social/generate_og.swift --check
```

El generador carga directamente los TTF locales de `node_modules/.pnpm/@expo-google-fonts+fira-sans@0.4.1/node_modules/@expo-google-fonts/fira-sans/`: **Fira Sans 700** para Transportate, **400** para la descripción y **600** para Buenos Aires, con licencia SIL OFL. Verifica los nombres PostScript (`FiraSans-Bold`, `FiraSans-Regular`, `FiraSans-SemiBold`), imprime sus SHA-256 y comprueba que todos los caracteres tengan glifos antes de convertirlos en contornos y rasterizarlos; no utiliza fuentes de reemplazo. `--check` regenera en memoria y compara los archivos byte a byte (misma versión de macOS/Swift). El PNG solo contiene `IHDR`, `sRGB`, `IDAT` e `IEND`, sin metadatos personales; el SVG no necesita fuentes instaladas.

