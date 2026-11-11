# 10 — Despliegue del proxy

Cómo publicar `transportate-proxy` (Cloudflare Workers + R2) y operarlo sin exponer datos personales.

- **Versiones verificadas:** wrangler **4.156.1**; `cloudflare/wrangler-action` **v4** (última v4.1.3, 2026-09-24).
- **Comprobado en la versión instalada** con `pnpm --filter transportate-proxy exec wrangler <cmd> --help` (2026-11-01): `login`, `whoami`, `deploy`, `r2 bucket create|list`, `r2 object put`, `secret put|list|delete`, `tail`, `rollback`, `versions list|upload|deploy` y `deployments list`.
- **Fuentes:** documentación de Cloudflare (Workers, R2, Wrangler) vía Context7.

> En todo este documento, `wrangler` es una abreviatura de `pnpm --filter transportate-proxy exec wrangler`: se usa la versión fijada en el proyecto, nunca una global. Los ejemplos se corren desde la raíz del repo.

## 1. Requisitos

| Qué | Detalle |
|---|---|
| Cuenta de Cloudflare | El plan **Free** alcanza para empezar: 100.000 requests por día, ≈ 1.100 usuarios activos según `docs/04-escalabilidad.md` §4. R2 tiene capa gratuita: 10 GB-mes, 1 M operaciones clase A y 10 M clase B por mes, y egress gratis |
| Sesión de wrangler | `wrangler login` es interactivo (abre el navegador), así que lo corre la persona, no un agente. Desde Claude Code: `! pnpm --filter transportate-proxy exec wrangler login` (o `! npx wrangler login`). Verificación: `wrangler whoami` |
| Credenciales de la API GCBA | `GCBA_CLIENT_ID` y `GCBA_CLIENT_SECRET`. Se cargan como **secrets** de Workers y nunca van al repo ni a `wrangler.jsonc` |
| Toolchain | Node 24 y pnpm 12.14.0 (`packageManager` del `package.json` raíz). `pnpm install` en la raíz |

## 2. Primer despliegue, paso a paso

Los entornos están definidos en `apps/proxy/wrangler.jsonc` (ver §5). Cada `--env` despliega un Worker distinto: `transportate-proxy-preview` y `transportate-proxy-production`.

```sh
# 0. Sesión
pnpm --filter transportate-proxy exec wrangler whoami

# 1. Buckets R2 (una sola vez por cuenta)
pnpm --filter transportate-proxy exec wrangler r2 bucket create transportate-static
pnpm --filter transportate-proxy exec wrangler r2 bucket create transportate-static-preview
pnpm --filter transportate-proxy exec wrangler r2 bucket list

# 2. Secrets por entorno (los pide por consola; no quedan en el historial del shell)
pnpm --filter transportate-proxy exec wrangler secret put GCBA_CLIENT_ID --env production
pnpm --filter transportate-proxy exec wrangler secret put GCBA_CLIENT_SECRET --env production
pnpm --filter transportate-proxy exec wrangler secret list --env production   # muestra nombres, no valores

# 3. Checks y despliegue
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter transportate-proxy exec wrangler deploy --dry-run --env production   # valida la config sin subir
pnpm --filter transportate-proxy run deploy --env production
```

> **Ojo con dos trampas de pnpm 12** (verificadas):
> - `pnpm --filter transportate-proxy deploy` (sin `run`) ejecuta el comando **nativo** `pnpm deploy`, no el script.
> - `run deploy -- --env …` le pasa el `--` literal a wrangler, que ignora lo que sigue y despliega la configuración **raíz** (`ENVIRONMENT=dev`).
>
> La forma correcta es `pnpm --filter transportate-proxy run deploy --env <entorno>`. Siempre con `--env`: sin él, wrangler avisa que hay varios entornos y usa la raíz.

- Los secrets **no se heredan** entre entornos: hay que cargarlos en `preview` y en `production` por separado.
- Los secrets se cargan **antes** del primer deploy del Worker de ese entorno. Si el Worker todavía no existe, `secret put` lo crea con un script vacío y el deploy siguiente lo reemplaza.
- También funciona al revés (deploy y después secrets): así se hizo el primer despliegue de `production`, el 2026-11-10. Mientras el Worker no existe, `secret list` falla con «not found»; entre el deploy y los secrets, los endpoints del GCBA responden con error.
- Si alguna vez hace falta pasar un secret sin prompt (por ejemplo, para rotarlo), se canaliza por stdin para que no quede en el historial: `printf '%s' "$VALOR" | wrangler secret put GCBA_CLIENT_SECRET --env production`.

**Verificación** (`production` responde en `https://api.transportate.ar` desde el 2026-11-11 y, durante la transición de §4, también en `https://transportate-proxy-production.nhsiciliano.workers.dev`):

```sh
BASE=https://api.transportate.ar
curl -s "$BASE/v1/health"                  # {"ok":true,"version":"…","environment":"production"}
curl -s -D - -o /dev/null "$BASE/v1/subtes/estado" | grep -i -E '^HTTP|cache-control|etag|x-transportate'
curl -s "$BASE/v1/transito/cortes"         # 503 upstream_unavailable (diferido, es lo esperado)
```

`/v1/subtes/estado` responde 200 con el sobre `{ meta, data }` cuando los adaptadores reales están desplegados. Mientras siga el placeholder de `src/adapters/index.ts`, responde 503 "Adaptador no implementado todavía".

## 3. Subida del paquete estático (R2)

El paquete estático tiene paradas BA, estaciones, líneas, equivalencias `stop_id → parada` y recorridos.

1. `tools/gtfs` lo genera en `tools/gtfs/out/` (fuera del control de versiones, porque `tools/gtfs/out/` está en `.gitignore`): un directorio por versión, con el **hash del contenido** como nombre, más `manifest.json` (`ManifestV1`).
2. `tools/gtfs/upload-r2.sh` (lo escribe otro worker) sube, en este orden:
   1. cada archivo a `transportate-static/<version>/<archivo>`;
   2. **al final**, `latest/manifest.json`.

   El orden importa: la app nunca ve un manifiesto que apunta a archivos que todavía no están. Internamente usa `wrangler r2 object put <bucket>/<clave> --file <ruta> --remote`, con `--content-type application/json` o `application/geo+json`.
3. El Worker sirve:
   - `/v1/static/manifest`, con 5 min de caché;
   - `/v1/static/<version>/<archivo>`, inmutable y con un año de caché.

   La app baja el manifiesto, compara `version` y descarga solo si cambió.
4. Para `preview` se usa el bucket `transportate-static-preview`. Para probar en local con `wrangler dev`, se sube con `--local` en lugar de `--remote`.

Las versiones viejas se pueden borrar de R2 después de un tiempo prudencial (por ejemplo, dos versiones atrás). Las apps con un manifiesto viejo vuelven a pedir `latest/manifest.json` cuando vence el caché.

## 4. Dominio propio (necesario para que funcione el caché en producción)

> **Estado (2026-11-11):** `production` responde en **`https://api.transportate.ar`** (dominio `transportate.ar`, registrado en nic.ar y delegado a Cloudflare; pasos 1 a 4 de la transición hechos). `https://transportate-proxy-production.nhsiciliano.workers.dev` sigue activa porque el build 1.0.0 (3) de TestFlight la lleva embebida. Faltan los pasos 5 a 7.
>
> **Medido ese día, y distinto de lo que dice el «Por qué» de abajo:** la Cache API **sí guardó en `workers.dev`**. `/v1/static/manifest` volvió con `CF-Cache-Status: HIT` y `Age` creciente en los dos hosts, y la entrada venció a los 300 s en ambos. El párrafo de abajo se escribió con la documentación de Cloudflare de ese momento; la página actual de la [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) solo asegura que funciona en dominios propios y no dice nada de `workers.dev`. El dominio sigue siendo el camino soportado.
>
> **Ojo con la zona:** en un dominio propio, el *Browser Cache TTL* de la zona (4 horas por defecto) reescribe el `Cache-Control` de lo que devuelve `cache.match` cuando su `max-age` es menor: el manifiesto salía con `max-age=14400` en vez de 300 (en el borde seguía venciendo a los 300 s; lo que cambiaba era lo que veía el cliente). Desde el commit `55d175d` la ruta estática arma sus propios headers y no reenvía los de la caché. Los feeds no pasan por ahí y no se vieron afectados.

**Por qué:** la Cache API (`caches.default`) **no tiene efecto en `*.workers.dev`**, ni en previews ni en el editor del dashboard. En esos casos, `cache.put` no guarda nada y `cache.match` siempre falla. Fuente: [R2 + Cache API](https://developers.cloudflare.com/r2/examples/cache-api/). Sin dominio propio:
- cada request de `/v1/static/*` lee R2 (operación clase B);
- la capa A del proxy (caché por colo de los feeds, `docs/04-escalabilidad.md` §2) **no protege al upstream**. Cada request de la app termina en una request a la API GCBA, salvo el coalescing dentro del isolate.

**Cómo:** el dominio tiene que estar como zona activa en la cuenta de Cloudflare (DNS en Cloudflare). Después, en `apps/proxy/wrangler.jsonc`, dentro de `env.production`:

```jsonc
"workers_dev": true,   // se mantiene durante la transición
"routes": [{ "pattern": "api.<dominio>", "custom_domain": true }]
```

- Con `custom_domain: true`, wrangler crea el registro DNS y el certificado al desplegar. La otra opción es una **ruta** sobre una zona existente: `{ "pattern": "example.com/api/*", "zone_name": "example.com" }`.
- `routes` **no se hereda**: va dentro de cada entorno.
- El token de CI necesita además el permiso de zona **Workers Routes: Edit** (§9).

**Procedimiento de transición (con la app ya publicada en `workers.dev`).** Los builds que ya están en manos de testers o usuarios llevan la URL de `workers.dev` embebida: no se pueden redirigir, así que el Worker responde en las dos URLs hasta que se retiren.

1. **Dominio activo.** El dominio como zona de Cloudflare, con DNS en Cloudflare.
2. **Agregar la ruta, sin sacar `workers_dev`.** En `env.production`, `routes: [{ "pattern": "api.<dominio>", "custom_domain": true }]` y `workers_dev: true` (los builds viejos siguen llegando).
3. **Redeploy:** `pnpm --filter transportate-proxy run deploy --env production`. Verificar con `curl https://api.<dominio>/v1/health`, y que la Cache API hace efecto con `curl -s -D - -o /dev/null https://api.<dominio>/v1/static/manifest` repetido: `Cache-Control: public, max-age=300` siempre, y un `ETag` estable. (`X-Transportate-Generated-At` **no sirve** para esto: es la hora de cada respuesta y cambia en cada pedido aunque el feed venga de la caché. Hasta el commit `55d175d` el segundo pedido mostraba además `CF-Cache-Status: HIT` y `Age`; ya no se reenvían.)
4. **URL nueva en la app.** `build.<perfil>.env.EXPO_PUBLIC_API_URL` de `apps/mobile/eas.json` en `preview`, `preview-simulator` y `production` (§5).
5. **Build nuevo → TestFlight → release.** Probar contra el dominio ([`12-publicacion.md`](12-publicacion.md) §4) y recién entonces liberar la versión.
6. **Sitio de privacidad y soporte.** Pasa al dominio ([`§10`](#10-sitio-estático-transportate-site)); las URLs de Acerca de, de la ficha y de App Privacy cambian con ese build.
7. **Retirar `workers.dev`.** Cuando el build viejo deje de usarse (revisar el tráfico del dashboard y el estado de las versiones en App Store Connect), `workers_dev: false` y redeploy.
8. **Anotarlo en `bitacora.md`.**

**Impacto en costos:**
- El dominio en sí no cuesta nada en Cloudflare más allá del registro del nombre.
- La Cache API **no reduce las requests facturadas del Worker**: cada hit invoca igual al Worker (`docs/04-escalabilidad.md` §1). Lo que sí baja es la carga sobre el upstream y la CPU por request, porque un hit no decodifica protobuf. También deja las lecturas de R2 prácticamente en cero.
- Por eso, el dominio propio es **requisito antes de abrir la app a usuarios reales**, aunque se siga en el plan Free.

## 5. Entornos

| Entorno | Cómo se corre | Worker | Bucket `STATIC` | `RATE_LIMITER` | `vars.ENVIRONMENT` | Secrets |
|---|---|---|---|---|---|---|
| `dev` (local) | `pnpm --filter transportate-proxy dev` → `http://localhost:8787` | — (workerd local) | R2 simulado local (vacío al empezar) | simulado | `dev` | `apps/proxy/.dev.vars` (copiado de `.dev.vars.example`; gitignored) |
| `preview` | `pnpm --filter transportate-proxy run deploy --env preview` o el workflow (§9). Hoy no está desplegado: los perfiles `preview` de EAS apuntan a `production` | `transportate-proxy-preview` (`*.workers.dev`) | `transportate-static-preview` | namespace `1002` | `preview` | `wrangler secret put … --env preview` |
| `production` | `pnpm --filter transportate-proxy run deploy --env production` o el workflow | `transportate-proxy-production` | `transportate-static` | namespace `1003` | `production` | `wrangler secret put … --env production` |

- En `wrangler.jsonc`, los **bindings y las vars no se heredan** de la raíz: por eso `env.preview` y `env.production` repiten `ratelimits`, `r2_buckets` y `vars`. Si agregás un binding, va en la raíz **y** en cada entorno. Después corré `pnpm --filter transportate-proxy types`.
- **Vars de trenes** (no son secrets: van en `vars` de la raíz, de `env.preview` y de `env.production`):

  | Var | Valor | Para qué |
  |---|---|---|
  | `TRENES_UPSTREAM_BASE` | `https://ariedro.dev/api-trenes` | Base de la API comunitaria de SOFSE |
  | `TRENES_ENABLED` | `"true"` | Kill-switch: con otro valor, `/v1/trenes/estado` responde `sin_datos` y `/alertas` y `/arribos` 503, sin llamar a la fuente |
  | `TRENES_TTL_SECONDS` | `"30"` | TTL de arribos |
  | `TRENES_ESTADO_TTL_SECONDS` | `"60"` | TTL de estado y alertas |

  Para apagar trenes en un entorno sin tocar el código: cambiar `TRENES_ENABLED` en ese entorno de `wrangler.jsonc` y redesplegar. En local se prueba con `pnpm exec wrangler dev --var TRENES_ENABLED:false`.
- `/v1/health` devuelve `environment`, así se ve contra qué entorno está hablando la app.
- **App:** la URL base del proxy se inyecta en build con la variable pública de Expo **`EXPO_PUBLIC_API_URL`** (la URL base no es un secreto). De dónde sale depende del perfil de EAS (`apps/mobile/eas.json`):

  | Perfil | Para qué | De dónde sale `EXPO_PUBLIC_API_URL` |
  |---|---|---|
  | `development` | Dev client en dispositivo | `apps/mobile/.env` local, con la IP de la LAN (`http://<IP-de-tu-máquina>:8787`) |
  | `development-simulator` | Dev client en simulador | `.env` local |
  | `preview` | Build interno de prueba | `env.EXPO_PUBLIC_API_URL` en `eas.json`: URL `https://` del Worker de **producción** (no se despliega `preview`) |
  | `preview-simulator` | Release para simulador, sin dev menu (capturas) | Igual que `preview` |
  | `production` | TestFlight y App Store | Igual que `preview`; `autoIncrement` del número de build |

  Los perfiles `preview`, `preview-simulator` y `production` **fallan al leer `app.config.ts`** si no tienen una URL `https://`. EAS evalúa `app.config.ts` con las `env` del perfil elegido y las setea también en el builder (`EAS_BUILD_PROFILE` solo existe en el builder, no al evaluar localmente). Guía operativa: [`12-publicacion.md`](12-publicacion.md).

## 6. Observabilidad sin datos personales

Qué se registra (configuración en `wrangler.jsonc`, política en `docs/05-privacidad.md` §6):

- `observability.enabled = true` con `head_sampling_rate = 0.1`: solo se registra el 10 % de las invocaciones.
- `observability.logs.invocation_logs = false`: **no** se guardan los metadatos de cada request (URL, cabeceras, IP).
- Nuestro código solo escribe eventos sin datos de la request. Por ejemplo, `{"event":"unhandled_error","name":"TypeError"}`. Nunca escribe la URL upstream, que lleva el secret en la query.

Ver logs en vivo:

```sh
pnpm --filter transportate-proxy exec wrangler tail --env production --format pretty --status error
pnpm --filter transportate-proxy exec wrangler tail --env production --sampling-rate 0.05 --search unhandled_error
```

- `wrangler tail` muestra en vivo los eventos de invocación: método, URL y cabeceras de cada request, además de los `console.*`. **No lo dejes corriendo, no lo redirijas a archivos ni lo pegues en issues**, porque incluye datos de la request (por ejemplo, la IP que agrega Cloudflare). Usalo para diagnosticar un problema puntual con un filtro (`--status error`, `--search`) y cortalo.
- No uses `--ip` con IPs de terceros. `--ip self` sirve para ver solo tus propias requests.

**Métricas del dashboard** (Workers & Pages → el Worker → Metrics / Observability): requests, errores, CPU por invocación y uso de subrequests. Son agregadas y anónimas, y alcanzan para seguir los umbrales de `docs/04-escalabilidad.md` §8 (requests/día frente al límite Free, CPU p50/p99).

## 7. Rollback, rotación de secrets y cambios en la API GCBA

**Rollback:**

```sh
pnpm --filter transportate-proxy exec wrangler deployments list --env production   # despliegues recientes
pnpm --filter transportate-proxy exec wrangler versions list --env production      # versiones subidas
pnpm --filter transportate-proxy exec wrangler rollback --env production --message "error 5xx tras deploy"
pnpm --filter transportate-proxy exec wrangler rollback <version-id> --env production --message "…"
```

- Sin `version-id`, vuelve a la versión anterior.
- El rollback cambia el código, pero **no los secrets ni el contenido de R2**. Si el problema fue un paquete estático, se vuelve a subir el `latest/manifest.json` anterior (las versiones viejas siguen en el bucket).
- Para despliegues graduales se puede usar `wrangler versions upload` + `wrangler versions deploy`, con porcentaje por versión. No hace falta para el MVP.

**Rotación de secrets** (por ejemplo, si una credencial se filtró o el GCBA la renueva):
1. Pedir la credencial nueva.
2. `wrangler secret put GCBA_CLIENT_SECRET --env production`, y lo mismo para el ID si cambió. El cambio se aplica al instante, sin redeploy.
3. Repetirlo en `preview` y en `.dev.vars` local.
4. Revocar la credencial vieja.
5. Anotarlo en `docs/bitacora.md`, sin el valor.

**Si la API GCBA cambia o se cae** (riesgo 1 del plan; el portal la declaró "en revisión y corrección"):
1. El proxy ya degrada solo: sirve el último dato bueno con `meta.stale = true` y `X-Transportate-Stale: 1`, o responde 503 `upstream_unavailable`. La app lo muestra como "servicio no disponible".
2. Para diagnosticar se usa `tools/api-probe`, que muestra qué responde hoy cada endpoint.
3. Con el resultado:
   - se actualiza `docs/01-api-transporte.md`;
   - se regeneran las fixtures (`docs/09-testing.md` §4);
   - se ajusta **solo el adaptador** afectado (`apps/proxy/src/adapters/<servicio>/`). Un test con fixtures nuevas que falla marca exactamente qué cambió.
4. El contrato v1 no cambia. Si hiciera falta un cambio incompatible, se crea `/v2` (`docs/03-arquitectura.md` §5).

## 8. Checklist de privacidad antes de cada despliegue

Tomado de `docs/05-privacidad.md` (§6 y checklist final), aplicado al proxy:

- [ ] `wrangler.jsonc` mantiene `observability.logs.invocation_logs = false` y `head_sampling_rate` bajo (≤ 0,1), en la raíz (los entornos lo heredan; si un entorno define `observability`, revisarlo).
- [ ] Ningún `console.*` nuevo incluye URL, query, cabeceras, IP, User-Agent, cuerpo de request ni la URL upstream (`git grep -n "console\." apps/proxy/src`).
- [ ] El rate limit sigue usando el **hash** de la IP y no la persiste (`src/middleware/rate-limit.ts`).
- [ ] Los secrets existen solo como `wrangler secret` (`secret list` muestra los nombres). No aparecen en el repo (`git grep` con el valor, en local), ni en `wrangler.jsonc`, ni en fixtures o logs de CI.
- [ ] Las respuestas de error no reflejan mensajes internos: los tests de `test/errors.test.ts` están en verde.
- [ ] No se agregaron cookies, `Set-Cookie`, identificadores de sesión ni analytics.
- [ ] Si cambió algo de observabilidad, se revisó contra `docs/05-privacidad.md` §6 y se anotó en `docs/bitacora.md`.

## 9. Despliegue desde GitHub Actions

Workflow `.github/workflows/deploy-proxy.yml`:
- **Manual** (`workflow_dispatch`): no corre solo en push.
- Recibe el input `environment`: `preview` o `production`.
- Instala con pnpm, corre `lint`, `typecheck` y `test`, y despliega con `cloudflare/wrangler-action@v4`.
- Usa el wrangler del proyecto (`packageManager: pnpm`, `workingDirectory: apps/proxy`) y ejecuta `deploy --env <entorno>`.

**Secrets de GitHub** (Settings → Secrets and variables → Actions):

| Secret | Valor |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Account ID (dashboard → Workers & Pages → panel derecho, o `wrangler whoami`) |
| `CLOUDFLARE_API_TOKEN` | Token con permisos mínimos (abajo) |

Opcionalmente se pueden crear los *environments* de GitHub `preview` y `production` y exigir aprobación manual para `production`. El workflow ya declara `environment: ${{ inputs.environment }}`.

**Cómo crear el token con permisos mínimos** (dashboard → My Profile → API Tokens → Create Token → **Custom token**; no uses la plantilla "Edit Cloudflare Workers", que agrega KV, Tail y más):

| Tipo | Permiso | Nivel | Para qué |
|---|---|---|---|
| Account | **Workers Scripts** | Edit | Subir y desplegar el Worker y sus versiones |
| Account | **Workers R2 Storage** | Edit | Validar y asociar el binding `STATIC` (y subir el paquete estático si se automatiza) |
| Account | Account Settings | Read | Resolver la cuenta (lo piden algunos comandos de wrangler) |
| Zone (solo la zona del dominio) | Workers Routes | Edit | **Solo cuando haya dominio propio** (§4) |

Restringí *Account Resources* a tu cuenta y, si se puede, *Client IP Address Filtering* no aplica a runners de GitHub (IPs variables). Poné una fecha de expiración y rotá el token como un secret más.

Los secrets del Worker (`GCBA_*`) **no** pasan por GitHub. Se cargan una vez con `wrangler secret put` (§2) y persisten entre despliegues.

## 10. Sitio estático (`transportate-site`)

Sitio público de Transportate: la **landing** (`/`) y las páginas de **privacidad** y **soporte** que App Store Connect exige como URLs (la app las enlaza desde Acerca de), más un 404. Se construye con **Astro** (sitio estático, sin adaptador; paquete `transportate-site` del workspace) y se sirve con un Worker de solo assets (sin `main`) en la misma cuenta de Cloudflare. Detalle en [`site/README.md`](../site/README.md).

| Qué | Dónde |
|---|---|
| Código | `site/src/` (páginas Astro, componentes, estilos, el único script) y `site/public/` (`_headers`, íconos, `og.png`, `robots.txt`, `sitemap.xml`) |
| Config del Worker | `site/wrangler.jsonc` (nombre `transportate-site`; `assets.directory` apunta a **`dist/`**, la salida de `astro build`) |
| URLs | `https://transportate.ar/`, `/privacidad` y `/soporte` (dominio propio, desplegado el 2026-11-11); `https://transportate-site.nhsiciliano.workers.dev` sigue viva durante la transición |

**El build va antes del deploy:** `dist/` no se versiona y wrangler publica lo que haya ahí. Desde la raíz del repo:

```sh
pnpm --filter transportate-site test        # astro build + verificación de dist/
pnpm --filter transportate-site run deploy  # astro build + wrangler deploy (usa el wrangler de apps/proxy)
```

`run deploy` es necesario: `pnpm deploy` a secas es un comando propio de pnpm (copia un paquete), no el script. El script equivale a `astro build` seguido de `pnpm --filter transportate-proxy exec wrangler deploy -c ../../site/wrangler.jsonc`. Para validar sin publicar, después del build: `pnpm --filter transportate-proxy exec wrangler deploy --dry-run -c ../../site/wrangler.jsonc`.

- Es un Worker aparte del proxy: no comparte secrets, R2 ni rate limit, y se despliega a mano (no está en el workflow de §9). CI sí construye y verifica el sitio (`pnpm test` recursivo).
- El mail de contacto vive **solo** en las páginas de privacidad y soporte del sitio; no va en la app ni en estos docs. `pnpm test` falla si aparece en otra página.
- Dominio propio: ver §4, paso 6. `routes` y `workers_dev` de `site/wrangler.jsonc` no cambian con Astro.
