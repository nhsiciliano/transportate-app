# site — sitio público de Transportate

Tres páginas estáticas que App Store pide como URLs públicas, más un 404:

| Ruta | Archivo | Qué es |
|---|---|---|
| `/` | `public/index.html` | Qué es Transportate, que no es oficial, de dónde salen los datos y sus atribuciones |
| `/privacidad` | `public/privacidad.html` | Política de privacidad (URL de privacidad de App Store) |
| `/soporte` | `public/soporte.html` | Preguntas frecuentes y contacto (URL de soporte de App Store) |
| cualquier otra | `public/404.html` | «No encontramos esta página» |

URL de producción: `https://transportate-site.nhsiciliano.workers.dev` (la app la enlaza desde Ajustes → Acerca de).

Es un **Worker de Cloudflare solo de static assets** (`wrangler.jsonc`, sin `main`, sin bindings, sin observabilidad) en la misma cuenta que el proxy. HTML y CSS a mano, sin framework, sin build y **sin JavaScript**; sin cookies ni fuentes, imágenes o scripts de terceros, coherente con «No recopilamos datos» de la ficha de App Privacy. `public/_headers` agrega `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` y una CSP que solo permite estilos e imágenes propios.

Diseño en modo lectura: una columna de ≈ 65 caracteres, tipografía del sistema, cuerpo de 17 px y los colores de Obelisco v2 de la app (claro y oscuro con `prefers-color-scheme`; los contrastes están en el encabezado de `estilos.css`). El ícono (`icono.png`, 180 px) y el favicon (32 px) salen de `design/brand/icon-ios-1024.png` con `sips -Z`.

## Probar en local

Desde la raíz del repo (wrangler viene con el proxy):

```sh
pnpm --filter transportate-proxy exec wrangler dev -c ../../site/wrangler.jsonc --port 8790
# en otra terminal:
for p in / /privacidad /soporte /estilos.css /no-existe; do curl -s -o /dev/null -w "%{http_code} $p\n" http://localhost:8790$p; done
```

`/privacidad` sirve `privacidad.html` (`html_handling` por defecto, `auto-trailing-slash`) y `/privacidad.html` redirige a `/privacidad`.

## Validar y desplegar

```sh
pnpm --filter transportate-proxy exec wrangler deploy --dry-run -c ../../site/wrangler.jsonc
```

El deploy (lo hace el coordinador o el usuario, con `wrangler login`) es el mismo comando sin `--dry-run`.

## Editar

- La política se edita en `public/privacidad.html` y tiene que seguir siendo coherente con [`docs/05-privacidad.md`](../docs/05-privacidad.md) y con lo que hace el código (no se promete nada que no se pueda verificar en el repo). Si cambia algo de fondo, actualizá también la fecha de vigencia.
- El mail de contacto aparece **solo** en `privacidad.html` y `soporte.html` (decisión del usuario).
- Formato: `pnpm exec prettier --write site`.
