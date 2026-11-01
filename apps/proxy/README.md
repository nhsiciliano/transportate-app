# transportate-proxy

Proxy/BFF de Transportate sobre Cloudflare Workers con Hono 4. Arquitectura: `docs/03-arquitectura.md`; contrato JSON: `packages/contracts`.

```sh
cp ../../.dev.vars.example .dev.vars   # completar con las credenciales (nunca se commitea)
pnpm --filter transportate-proxy dev    # wrangler dev → http://localhost:8787/v1
pnpm --filter transportate-proxy test   # Vitest dentro de workerd (@cloudflare/vitest-plugin)
pnpm --filter transportate-proxy types  # regenera worker-configuration.d.ts tras tocar wrangler.jsonc
```

## Rutas v1 (todas GET)

| Ruta | Respuesta | Caché |
|---|---|---|
| `/v1` | Índice con las rutas disponibles | `max-age=3600` |
| `/v1/health` | `HealthV1` | `no-store`; sin rate limit |
| `/v1/subtes/estado` | `EnvelopeV1<EstadoLineasV1>` | feed (ver abajo) |
| `/v1/subtes/alertas` | `EnvelopeV1<AlertasV1>` | feed |
| `/v1/subtes/estaciones/:estacionId/arribos` | `EnvelopeV1<ArribosEstacionV1>` | feed |
| `/v1/colectivos/lineas` | `EnvelopeV1<LineasColectivoV1>` | feed |
| `/v1/colectivos/lineas/:lineaId/posiciones` | `EnvelopeV1<PosicionesLineaV1>` | feed |
| `/v1/colectivos/paradas/:paradaId/arribos` | `EnvelopeV1<ArribosParadaV1>` | feed |
| `/v1/transito/cortes` | **Diferido**: siempre 503 `upstream_unavailable` (tarea 2.7; tab Tránsito oculto) | `no-store` |
| `/v1/static/manifest` | `ManifestV1` (`latest/manifest.json` del bucket R2 `STATIC`) | `max-age=300` + ETag; sin rate limit |
| `/v1/static/:version/:archivo` | Objeto `<version>/<archivo>` (`.json` o `.geojson`) | `max-age=31536000, immutable` + ETag de R2; sin rate limit |

- Los ids de ruta (`estacionId`, `paradaId`, `lineaId`, `version`) cumplen `^[A-Za-z0-9_-]{1,64}$`. Si no cumplen, la respuesta es **400 `bad_request`**. La query desconocida se ignora.
- Todo error responde el sobre `ErrorV1` con `Cache-Control: no-store`. El manejador global nunca refleja el mensaje de errores que no sean `ApiError`: no hay stack, URLs upstream ni secrets.

### Headers de los feeds (`src/middleware/envelope.ts`)

- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: public, max-age=<meta.ttlSeconds>, stale-while-revalidate=<2×ttl>`
- `ETag` débil (`W/"<sha1 del cuerpo>"`) y **304** sin cuerpo si coincide `If-None-Match` (comparación débil; acepta listas y `*`)
- `X-Transportate-Generated-At: <meta.generatedAt>` y `X-Transportate-Stale: 1` cuando el proxy sirvió el último dato bueno

**Compresión:** no se usa `hono/compress`. El runtime de Workers aplica gzip o brotli automáticamente a la respuesta según el `Accept-Encoding` del cliente, y Cloudflare comprime por defecto los tipos de contenido JSON. Fuentes: [Fetch API, "How the Accept-Encoding header is handled"](https://developers.cloudflare.com/workers/runtime-apis/fetch/#how-the-accept-encoding-header-is-handled) y [Compression Rules](https://developers.cloudflare.com/rules/compression-rules/). Comprimir en el Worker gastaría CPU sin beneficio. En `wrangler dev` no hay compresión.

## Composición (`src/app.ts`, `src/container.ts`)

`createApp({ adapters, now? })` recibe los adaptadores de dos formas:
- **Fijos** `{ subtes, colectivos, transito }`, para tests.
- **Una fábrica `(env, ctx?) => Adapters`**, que se llama una vez por request (sin estado global que dependa del `env` de otra request).

`src/index.ts` usa `createAdapters` de `src/adapters/index.ts`. Hoy es un **placeholder**: subtes y colectivos responden 503 "Adaptador no implementado todavía" hasta que estén las implementaciones reales. Los secrets llegan a los adaptadores solo por `env`.

## Rate limiting (`src/middleware/rate-limit.ts`)

- Binding nativo `RATE_LIMITER` (60 consultas / 60 s, `wrangler.jsonc`). Se aplica a `/v1/*` salvo `/v1/health` y `/v1/static/*`.
- Si se supera: **429 `rate_limited`** con `Retry-After: 60`.
- **Clave:** hash SHA-256 truncado de `cf-connecting-ip` (o `anon` si falta). La IP no se loguea, no se persiste y no le llega en claro al limitador; los contadores son en memoria y por colo.
- Cloudflare desaconseja usar la IP como clave, porque muchos usuarios móviles comparten IP (CGNAT). Se eligió igual porque la app no tiene cuentas ni identificadores. Si aparecen falsos positivos, la alternativa es subir el límite o usar la ruta como parte de la clave.

## Paquete estático desde R2 (`src/static/`, `src/routes/static.ts`)

Lo genera `tools/gtfs` y se sube así:

```sh
wrangler r2 object put transportate-static/<version>/<archivo> --file out/<archivo> --remote
wrangler r2 object put transportate-static/latest/manifest.json --file out/manifest.json --remote
```

- El Worker lee de R2 a través de la **Cache API** (`caches.default`, clave = origen + path) y guarda en caché en segundo plano con `ctx.waitUntil`. El manifiesto se valida con `ManifestV1`; si es inválido, responde 503.
- La Cache API **no tiene efecto en `*.workers.dev` ni en previews**: en producción hace falta una ruta o dominio propio. En local, `wrangler dev` usa un R2 simulado vacío, así que `/v1/static/manifest` responde 404 hasta que se cargue algo con `wrangler r2 object put … --local`.

## Secrets

- **Local:** `apps/proxy/.dev.vars` (copiado de `.dev.vars.example`; está en `.gitignore`).
- **Preview / producción:** se cargan **por entorno**, porque los secrets no se heredan:
  ```sh
  pnpm --filter transportate-proxy exec wrangler secret put GCBA_CLIENT_ID --env production
  pnpm --filter transportate-proxy exec wrangler secret put GCBA_CLIENT_SECRET --env production
  ```
- Nunca se loguean ni se devuelven. Las URLs upstream llevan el secret en la query, así que **no se loguean**. Hay un test que fuerza un error con el secret en el mensaje y verifica que no aparece en la respuesta.

## Despliegue

Guía completa: [`docs/10-deploy.md`](../../docs/10-deploy.md) (buckets, secrets, dominio propio, entornos, logs sin datos personales, rollback y checklist de privacidad).

- **Entornos** (`wrangler.jsonc`):

  | Entorno | Worker | Bucket R2 |
  |---|---|---|
  | `env.preview` | `transportate-proxy-preview` | `transportate-static-preview` |
  | `env.production` | `transportate-proxy-production` | `transportate-static` |

  Bindings y vars se repiten en cada entorno porque no se heredan. Si agregás uno, regenerá los tipos con `pnpm --filter transportate-proxy types`.
- **Manual:**
  ```sh
  pnpm lint && pnpm typecheck && pnpm test
  pnpm --filter transportate-proxy run deploy --env preview      # o --env production
  ```
  Usá `run deploy`, no `deploy` (que es un comando nativo de pnpm), y no pongas `--` antes de `--env`: pnpm 12 se lo pasa literal a wrangler, que entonces despliega la configuración raíz.
- **CI:** `.github/workflows/deploy-proxy.yml`. Es manual (`workflow_dispatch` con `environment`), corre lint/typecheck/test y despliega con `cloudflare/wrangler-action@v4`. Necesita `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en los secrets de GitHub.
- **Verificación:** `curl -s $BASE/v1/health` devuelve el `environment` desplegado.
- **Rollback:** `pnpm --filter transportate-proxy exec wrangler rollback --env production --message "<motivo>"`.
- **Antes de abrir a usuarios:** asignar un **dominio propio** (`routes` con `custom_domain: true`), porque la Cache API no funciona en `*.workers.dev`.

## Tests (`test/`)

- `helpers.ts` define adaptadores falsos y `testEnv()`: los bindings reales del plugin (R2 local) más secrets ficticios y un `RATE_LIMITER` inyectado.
- El binding `ratelimit` existe en el entorno local, pero sus contadores son compartidos y dependen del reloj. Para que los tests sean deterministas, `RATE_LIMITER` se reemplaza por un `{ limit }` falso.
- Los tests de estáticos escriben en el R2 local (`env.STATIC.put`) y usan un host distinto por caso, porque la Cache API es real.

## Carpetas

| Carpeta | Qué va |
|---|---|
| `src/routes/` | Una ruta por servicio (`/v1/<servicio>`). Valida parámetros y delega |
| `src/adapters/` | Traducción upstream → contrato v1 (`types.ts` define las interfaces; `transito/` es el stub diferido) |
| `src/sources/` | Acceso al upstream con caché (`FeedSource`) |
| `src/cache/` | Utilidades de Cache API, claves y coalescing |
| `src/static/` | Lectura del paquete estático desde R2 con Cache API |
| `src/middleware/` | Errores, headers de sobre + ETag, rate limit, inyección de dependencias |
| `src/lib/` | Utilidades sin dependencias de Hono (hash, http, params, versión) |

Privacidad: el Worker no loguea requests ni URLs upstream y no persiste IPs (`docs/05-privacidad.md`).
