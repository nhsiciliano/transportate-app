# site — sitio público de Transportate

La landing de Transportate y las páginas que App Store pide como URLs públicas, hechas con **Astro 7** como sitio estático (sin adaptador) y servidas por un Worker de Cloudflare de solo assets. Paquete del workspace: `transportate-site` (privado).

URL de producción: **`https://transportate.ar`** (dominio en activación; `https://transportate-site.nhsiciliano.workers.dev` sigue viva durante la transición, porque la enlaza el build 1.0.0 (3) de TestFlight).

| Ruta | Página | Qué es |
|---|---|---|
| `/` | `src/pages/index.astro` | Landing: qué hace la app, sus cuatro pantallas, qué tan confiable es el dato, preguntas, tiendas y atribuciones |
| `/privacidad` | `src/pages/privacidad.astro` | Política de privacidad (URL de privacidad de App Store) |
| `/soporte` | `src/pages/soporte.astro` | Preguntas frecuentes y contacto (URL de soporte de App Store) |
| cualquier otra | `src/pages/404.astro` | «No encontramos esta página» (respuesta 404) |

`/privacidad` y `/soporte` responden en las mismas URLs que el sitio anterior, sin redirigir: `build.format: 'file'` genera `privacidad.html` y `soporte.html`, y Workers static assets los sirve sin la extensión.

## Reglas

- **Sin terceros:** ninguna fuente, script, imagen, hoja de estilo ni analítica de otro origen, y sin cookies. Es coherente con «No recopilamos datos» de la ficha de App Privacy.
- **CSP estricta, sin `unsafe-inline`** (`public/_headers`): el HTML generado no puede tener `<style>`, `<script>` en línea ni atributos `style=""`. Por eso `build.inlineStylesheets: 'never'` y `vite.build.assetsInlineLimit: 0`, sin `<ClientRouter />` ni directivas `transition:*`.
- **JavaScript mínimo, siempre en archivos externos:** `src/scripts/modos.ts` (selector de modos de la landing), `src/scripts/tema.ts` (botón de tema de la cabecera) y `public/tema.js` (aplica el tema guardado en el `<head>`, antes de pintar). Sin JavaScript, los cuatro paneles se ven uno debajo del otro, el botón de tema no aparece y el sitio queda en claro.
- **Tema:** claro por defecto, aunque el sistema esté en oscuro. El botón de la cabecera pone `data-tema="oscuro"` en `<html>` y guarda solo la palabra `oscuro` en `localStorage` (clave `transportate-tema`) de ese navegador; volver a claro borra la clave. No es una cookie y no sale del navegador.
- **El mail de contacto** aparece solo en `privacidad.astro` y `soporte.astro` (decisión del usuario). No lo escribas en otro archivo.
- **Movimiento:** todo lo animado está dentro de `@media (prefers-reduced-motion: no-preference)` y es mejora progresiva; el estado base es el contenido visible y quieto.
- **Copy:** español rioplatense con voseo. Sin usuarios, métricas, testimonios ni comparaciones inventadas; no se presenta como app oficial; sin logos del GCBA ni de Trenes Argentinos; sin insignias oficiales de las tiendas.
- El texto de privacidad y soporte tiene que seguir siendo coherente con [`docs/05-privacidad.md`](../docs/05-privacidad.md) y con lo que hace el código. Si cambia algo de fondo, actualizá también la fecha de vigencia y los fixtures (ver «Probar»).

## Estructura

```
site/
├── astro.config.mjs        # sitio, formato de salida, nada en línea
├── wrangler.jsonc          # Worker solo de assets: publica dist/
├── public/                 # se copia tal cual a dist/
│   ├── _headers            # CSP, nosniff, referrer, frame; caché inmutable en /_astro/*
│   ├── favicon.png, icono.png, og.png (1200×630, de design/brand/social/)
│   ├── tema.js             # aplica el tema guardado antes de pintar (bloqueante, en el <head>)
│   └── robots.txt, sitemap.xml (escritos a mano, tres URLs)
├── src/
│   ├── pages/              # index, privacidad, soporte, 404
│   ├── layouts/Base.astro  # <head> con metadatos y Open Graph, cabecera y pie
│   ├── components/         # Cabecera, Pie, Marca, Icono, Pictograma, BotonTienda, Telefono, Captura
│   ├── config/tiendas.ts   # enlaces a App Store y Google Play (o null)
│   ├── scripts/modos.ts    # selector de modos (pestañas + view transition)
│   ├── scripts/tema.ts     # botón de tema claro/oscuro de la cabecera
│   ├── styles/             # fuentes.css, global.css (tokens y base), landing.css
│   ├── icons/              # pictogramas Material Symbols (SVG)
│   └── assets/             # marca.svg y capturas/ (las procesa astro:assets)
└── scripts/
    ├── verificar-dist.mjs  # corre en `test`
    ├── texto.mjs           # texto visible normalizado de un HTML
    └── fixtures/           # texto de privacidad, soporte y 404 del sitio anterior
```

Diseño: extiende a la web la dirección de la app, «Señalética de terminal», con los tokens de `apps/mobile/src/shared/theme/tokens.ts` (paleta Obelisco v2 y su derivada oscura; claro por defecto y oscuro con el botón de la cabecera, sin seguir `prefers-color-scheme`). Radio 6, contornos de 2 px, sin sombras; bandas de señal azul y navy con el pictograma en un cuadrado oscuro. El contrato de dirección está en `.impeccable/surfaces/site-src-pages-index-astro.md`.

Las cuatro técnicas del pedido, y dónde están:

| Técnica | Dónde | Sin soporte |
|---|---|---|
| Scroll-driven animations | `.revelar` (entrada de secciones y señales), el teléfono del cartel y la banda amarilla de avance (`.avance`), en `landing.css` y `global.css` | Todo visible y quieto; la banda no se muestra |
| View Transitions | Mismo documento: `modos.ts` envuelve el cambio de panel en `document.startViewTransition()`; los nombres (`panel-modo`, `pantalla-modo`) los pone el CSS con `.modos[data-mejorado]`. Entre páginas: `@view-transition { navigation: auto; }`, con la cabecera quieta (`cabecera`) | El panel cambia al instante; navegación normal |
| `<details>` animado | Preguntas: `<details name="preguntas">`, `::details-content` con transición de `block-size`, `interpolate-size: allow-keywords` | Abre y cierra al instante |
| `@starting-style` | Placas de cada panel (escalonadas) y el aviso popover de las tiendas | Aparecen sin animación |

Las scroll-driven animations se escriben con longhands (`animation-name`, `animation-timeline`, …): el minificador de CSS de Vite 8 junta `animation` + `animation-timeline` en un shorthand que Chrome descarta (ver [`docs/versiones.md`](../docs/versiones.md)).

## Desarrollar

Desde la raíz del repo, después de `pnpm install`:

```sh
pnpm --filter transportate-site dev       # http://localhost:4321
```

`astro dev` sirve la página sin la CSP de `_headers`. Para probar con las cabeceras reales, construí y levantá el Worker (puerto 8790; el 8787 es del proxy):

```sh
pnpm --filter transportate-site build
pnpm --filter transportate-proxy exec wrangler dev -c ../../site/wrangler.jsonc --port 8790
# en otra terminal:
for p in / /privacidad /soporte /no-existe; do curl -s -o /dev/null -w "%{http_code} $p\n" http://localhost:8790$p; done
```

Formato: `pnpm format` (Prettier con `prettier-plugin-astro`, desde la raíz). Ojo: el plugin mueve el salto de línea entre un enlace y la puntuación que lo sigue (`</a>` + `.`), y eso agrega un espacio visible; si pasa, escribí ese texto en una sola línea o como cadena con `set:html` (como las atribuciones de la landing).

## Construir y probar

```sh
pnpm --filter transportate-site build      # astro build → dist/
pnpm --filter transportate-site typecheck  # astro check (igual que lint)
pnpm --filter transportate-site test       # astro build + scripts/verificar-dist.mjs
```

`verificar-dist.mjs` falla si en `dist/`:

- falta `index.html`, `privacidad.html`, `soporte.html` o `404.html`;
- algún HTML tiene `<script>` sin `src`, `<style>` o un atributo `style=`;
- algún HTML o CSS carga algo de otro origen (`src`, `srcset`, `href` de hojas y íconos, `url()`, `@import`; los enlaces `<a>` externos sí se permiten);
- aparece una dirección de mail en un HTML que no sea privacidad o soporte;
- el texto visible de `<main>` en privacidad, soporte o 404 difiere de `scripts/fixtures/*.txt` (el mail se compara reemplazado por un marcador, así no queda copiado en los fixtures).

Si cambiás a propósito el texto de una de esas páginas, regenerá su fixture desde el build y revisá el diff:

```sh
cd site && node -e "import('./scripts/texto.mjs').then(({textoPrincipal})=>{const fs=require('fs');for(const n of ['privacidad','soporte','404'])fs.writeFileSync('scripts/fixtures/'+n+'.txt',textoPrincipal(fs.readFileSync('dist/'+n+'.html','utf8')))})"
git diff scripts/fixtures
```

CI (`.github/workflows/ci.yml`) corre `pnpm lint`, `pnpm typecheck` y `pnpm test` recursivos, así que el sitio se construye y se verifica en cada push.

## Desplegar

El deploy lo hace el coordinador o el usuario, con `wrangler login`. **Primero el build**: wrangler publica `dist/`, que no se versiona.

```sh
pnpm --filter transportate-proxy exec wrangler deploy --dry-run -c ../../site/wrangler.jsonc   # validar (después del build)
pnpm --filter transportate-site run deploy   # astro build + wrangler deploy
```

Es `run deploy` y no `deploy`: `pnpm deploy` es un comando propio de pnpm. Ver [`docs/10-deploy.md`](../docs/10-deploy.md) §10.

## Activar los enlaces de las tiendas

`src/config/tiendas.ts` tiene `{ appStore: null, googlePlay: null }`. Con `null`, cada botón dice «Próximamente en App Store» / «Próximamente en Google Play» y abre un aviso (popover declarativo, sin JavaScript). Para activar uno, poné la URL de la ficha (por ejemplo `appStore: 'https://apps.apple.com/ar/app/…/id…'`): el mismo componente (`BotonTienda.astro`) pasa a ser un enlace «Descargala en …», sin insignias oficiales. Revisá también la pregunta «¿Cuándo la puedo descargar?» y el cierre de `index.astro`, que hablan de la publicación.

## Reemplazar las capturas

Las capturas viven en `src/assets/capturas/` con estos nombres exactos, en 1320×2868 (simulador iPhone 18 Pro Max): `inicio`, `subte`, `colectivos`, `trenes` y `favoritos`, cada una en `-claro.png` y `-oscuro.png`. Desde el 2026-11-11 son capturas reales del build `preview-simulator` (las mismas de la ficha, `design/store/ios/6.9/`; procedimiento en [`docs/12-publicacion.md`](../docs/12-publicacion.md) §7). Para cambiarlas, pisá el archivo con el mismo nombre y volvé a construir: `Captura.astro` genera AVIF y WebP en 300, 450, 660 y 990 px para cada tema, en dos `<picture>` (`.captura--claro` y `.captura--oscuro`); el CSS muestra el del tema activo. La oscura siempre carga diferida, así que en claro no se descarga. La clara de Inicio (cartel) carga con prioridad alta; el resto, diferida. El marco del teléfono es CSS (`.telefono`): no hace falta recortar las capturas.

## Licencias

- **Fira Sans**, SIL Open Font License 1.1, desde `@fontsource/fira-sans`; se sirve autoalojada (solo `woff2` latino 400/600/700).
- **Material Symbols Rounded** (Google), Apache License 2.0, de `@material-symbols/svg-400` 0.48.2, el mismo paquete que usa la app; los SVG copiados están en `src/icons/`.
- **Marca** «Subte conectado»: `src/assets/marca.svg` es una copia de `design/brand/mark.svg` con los colores como atributos `fill` (el original usa un `<style>` interno, que no puede ir en línea por la CSP).
- Datos: GCBA bajo CC BY 2.5 AR; trenes de Trenes Argentinos (SOFSE) vía una API comunitaria no oficial; mapa © OpenStreetMap contributors, © OpenMapTiles, tiles de OpenFreeMap (atribuciones en la landing).
