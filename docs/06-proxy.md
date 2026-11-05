# 06 — Proxy (`transportate-proxy`)

Documento de referencia del Worker (Cloudflare Workers + Hono 4) que traduce la API del GCBA al contrato JSON v1.

| Para… | Ver |
|---|---|
| El porqué de la arquitectura | `03-arquitectura.md` |
| Qué responde hoy el upstream | `01-api-transporte.md` |
| Capacidad y costos | `04-escalabilidad.md` |
| Despliegue | `10-deploy.md` |
| Tests | `09-testing.md` |
| Código | `apps/proxy/` (README por carpeta) |

## 1. Recorrido de una request

```
GET /v1/...
  │  secureHeaders · cors (solo GET)
  ▼
rateLimit (src/middleware/rate-limit.ts)        ← exentos: /v1/health, /v1/static/*
  │  429 rate_limited + Retry-After si el binding RATE_LIMITER rechaza
  ▼
injectDeps → c.var.adapters = createAdapters(env, ctx)      (por request, barato)
  ▼
ruta (src/routes/*.ts) — valida params con Zod → 400 bad_request
  ▼
adaptador (src/adapters/<servicio>/) — upstream → contrato v1, puro salvo la fuente
  │                     └─ índice estático desde R2 (colectivos)
  ▼
FeedSource capa A: EdgeCachedFeedSource (src/sources/edge-cached.ts)
  │  memoria del isolate → caches.default → coalescing por clave → upstream (1 reintento)
  │  último dato bueno hasta 300 s si el upstream falla (meta.stale = true)
  ▼
apitransporte.buenosaires.gob.ar   (credenciales agregadas solo al hacer el fetch)
  ▲
sendEnvelope (src/middleware/envelope.ts) — Cache-Control, ETag estable, 304, X-Transportate-*
onError (src/middleware/errors.ts) — todo error sale como ErrorV1, sin stack ni URLs
```

`createApp({ adapters, now? })` (`src/app.ts`) recibe los adaptadores fijos (tests) o una fábrica `(env, ctx) => Adapters` (producción, `src/index.ts`). Los secrets llegan a los adaptadores solo por `env`.

## 2. Rutas v1 (todas GET)

| Ruta | Respuesta (`@transportate/contracts`) | TTL (`meta.ttlSeconds` → `Cache-Control`) | Upstream / fuente |
|---|---|---|---|
| `/v1` | Índice `{ version, rutas }` | 3600 s | — |
| `/v1/health` | `HealthV1` | `no-store` | — |
| `/v1/subtes/estado` | `EnvelopeV1<EstadoLineasV1>` | `FEED_TTL_SECONDS` (20 s) | `subtes/serviceAlerts?json=1` |
| `/v1/subtes/alertas` | `EnvelopeV1<AlertasV1>` | 20 s | ídem |
| `/v1/subtes/estaciones/:estacionId/arribos` | `EnvelopeV1<ArribosEstacionV1>` | 20 s | `subtes/forecastGTFS` (congelado desde 2026-10-24; responde `stale`) |
| `/v1/trenes/estado` | `EnvelopeV1<EstadoLineasTrenV1>` | `TRENES_ESTADO_TTL_SECONDS` (60 s) | API comunitaria SOFSE: `infraestructura/gerencias` + `infraestructura/ramales` ×6 |
| `/v1/trenes/alertas` | `EnvelopeV1<AlertasTrenV1>` | 60 s | ídem |
| `/v1/trenes/estaciones/:estacionId/arribos` | `EnvelopeV1<ArribosEstacionTrenV1>` | `TRENES_TTL_SECONDS` (30 s) | API comunitaria SOFSE: `arribos/estacion/<id>?cantidad=8` |
| `/v1/colectivos/lineas` | `EnvelopeV1<LineasColectivoV1>` | `STATIC_TTL_SECONDS` (86 400 s) | R2: `lineas-colectivos.json` |
| `/v1/colectivos/lineas/:lineaId/posiciones` | `EnvelopeV1<PosicionesLineaV1>` | 20 s | `colectivos/vehiclePositions?route_id=` + equivalencias (R2) |
| `/v1/colectivos/paradas/:paradaId/arribos` | `EnvelopeV1<ArribosParadaV1>` | 20 s | `colectivos/tripUpdates?route_id=` por línea + paradas y equivalencias (R2) |
| `/v1/transito/cortes` | siempre `ErrorV1` 503 `upstream_unavailable` (diferido, tarea 2.7) | `no-store` | — |
| `/v1/static/manifest` | `ManifestV1` | 300 s + ETag | R2: `latest/manifest.json` (Cache API delante) |
| `/v1/static/:version/:archivo` | archivo del paquete (`.json`, `.geojson`) | 1 año, `immutable`, ETag de R2 | R2: `<version>/<archivo>` |

- **Parámetros:** `estacionId`, `paradaId`, `lineaId` y `version` cumplen `^[A-Za-z0-9_-]{1,64}$`. `archivo` admite además `.`, pero no `..`, y tiene que terminar en `.json` o `.geojson`. Si no cumplen, la respuesta es 400. La query desconocida se ignora.
- **Ids que no existen:** una línea o parada inexistente da 404 `not_found`, sin pedir nada al upstream. Una estación de subte que no está en el forecast da una lista vacía. Una estación de tren inexistente también: la fuente responde igual que para una estación sin trenes.

## 3. Headers

| Header | Valor | Dónde |
|---|---|---|
| `Content-Type` | `application/json; charset=utf-8` (`application/geo+json` para `.geojson`) | feeds y estáticos |
| `Cache-Control` | `public, max-age=<ttl>, stale-while-revalidate=<2×ttl>` en feeds; `no-store` en errores y health | todas |
| `ETag` | Débil: `W/"<sha1>"` | feeds y manifiesto |
| `X-Transportate-Generated-At` | `meta.generatedAt` | feeds |
| `X-Transportate-Stale` | `1` cuando el proxy sirvió el último dato bueno | feeds |
| `Retry-After` | segundos | 429 y 503 con `retryAfterSeconds` |

**ETag estable:** el ETag de un feed se calcula sobre `data` + `meta.sourceTimestamp` + `meta.stale`, **no** sobre `generatedAt` ni `ageSeconds`.
- Esos dos campos cambian en cada request aunque el dato servido desde caché sea el mismo. Si entraran en el hash, el ETag cambiaría siempre y nunca habría 304.
- Con el diseño actual, la app que repite la consulta dentro del TTL con `If-None-Match` recibe **304 sin cuerpo**. Verificado en `wrangler dev` y en `test/etag.test.ts`.
- La app calcula la frescura con `sourceTimestamp`, nunca con `generatedAt`.

**Compresión:** la aplica el runtime de Workers (gzip/brotli según `Accept-Encoding`). No hay `hono/compress`.

## 4. Errores

Sobre único `ErrorV1 = { error: { code, message, retryAfterSeconds? } }`, con `Cache-Control: no-store`.

| `code` | Status | Cuándo |
|---|---:|---|
| `bad_request` | 400 | Parámetro de ruta inválido |
| `not_found` | 404 | Ruta, línea, parada o archivo estático inexistente; manifiesto todavía no publicado |
| `rate_limited` | 429 | El limitador rechazó (`Retry-After: 60`) |
| `upstream_unavailable` | 503 | Upstream caído sin último dato bueno; Tránsito diferido; datos estáticos no cargados; manifiesto inválido |
| `internal` | 500 | Cualquier error que no sea `ApiError`. El mensaje es siempre "Error interno": **nunca** se refleja el mensaje original, que podría traer la URL upstream con el secret |

El log de error solo lleva el tipo (`{"event":"unhandled_error","name":…}`) o, para el upstream, `{"event":"upstream_error","key","status","ms"}`.

## 5. Subtes

Reglas completas en [`apps/proxy/src/adapters/subtes/README.md`](../apps/proxy/src/adapters/subtes/README.md).

- **Estado por línea:** sale de las alertas activas que afectan a la línea (`informed_entity.route_id` → `A…H`, `PM-C`, `PM-S`) y de su severidad (`effect` o palabras clave del texto):
  - `interrumpida`, si alguna alerta es de interrupción;
  - `demorada`, si alguna es de demora;
  - `normal`, si no tiene alertas o solo informativas.

  Si no hay dato, todas las líneas quedan `sin_datos` con `stale: true` y la respuesta es 200, no 503.
- **Siempre `serviceAlerts?json=1`**, porque el protobuf llega corrupto en origen.
- **Arribos:** salen de `forecastGTFS`, que es un JSON propio, no GTFS-RT. Se marcan `stale` si `Header.timestamp` tiene más de 3 min; hoy el feed está congelado.

### Trenes

Reglas completas en [`apps/proxy/src/adapters/trenes/README.md`](../apps/proxy/src/adapters/trenes/README.md).

- **Fuente:** la **instancia pública comunitaria** `https://ariedro.dev/api-trenes` (`TRENES_UPSTREAM_BASE`). No es oficial: es un proxy Express de una persona que reenvía a la API interna de SOFSE (Trenes Argentinos), sin auth, términos ni SLA, con 1–2,5 s por pedido. Va por una segunda `EdgeCachedFeedSource` **sin credenciales**, con su propio 503 («Servicio de trenes no disponible»). Todo lo que conoce la forma y las URLs de la fuente vive en `adapters/trenes/sofse.ts` y `packages/contracts/src/upstream/sofse.ts`.
- **Claves y TTL:** `trenes:gerencias` y `trenes:ramales:<idGerencia>` (60 s), `trenes:arribos:<estacionId>` (30 s). Estado y alertas piden gerencias y los 6 ramales con un plazo único de 5 s y a lo sumo 6 pedidos en vuelo (el límite de conexiones salientes simultáneas de Workers).
- **Estado por línea:** reutiliza las reglas de subtes. Es la máxima severidad entre las alertas vigentes de la línea, las de todos sus ramales y el `estado.mensaje` de la gerencia. Hoy ese mensaje es «Alertas por ramal» en todas las líneas y se toma como informativo. Cada ramal público trae su propio estado. Sin `gerencias`, las 6 líneas quedan `sin_datos` con `stale: true` (200); si falta un `ramales`, esa línea va con `ramales: []` y `stale: true`.
- **Arribos:** destino según el sentido (`1` va a la cabecera final, `2` a la inicial), `enSegundos` a partir de la hora estimada o, si no hay, la programada, andén y `cancelado`. La fuente pesa 65–106 KB por estación; la respuesta, menos de 3 KB.
- **Kill-switch:** con `TRENES_ENABLED` distinto de `"true"`, `/estado` responde `sin_datos` + stale y `/alertas` y `/arribos` responden 503 («Trenes no disponible por ahora»), sin pedir nada a la fuente.

## 6. Colectivos

Detalle en [`apps/proxy/src/adapters/colectivos/README.md`](../apps/proxy/src/adapters/colectivos/README.md) y plan B de paradas en `01b-gtfs-alternativos.md`.

1. **Índice estático desde R2.** Se carga por isolate y por versión: primero el manifiesto (revisado cada `STATIC_TTL_SECONDS`) y después, en forma perezosa, solo el archivo que pide cada ruta:
   - `lineas-colectivos.json` para `lineas()`;
   - más `equivalencias-paradas.json` para `posiciones()`;
   - más `paradas.json` para `arribos()`.

   Las líneas se unen por **empresa + número**, nunca por los `route_id` del GTFS 2021, que fueron reasignados.
2. **Siempre filtrado por `route_id` upstream.** El feed completo (580 KB de posiciones, 3,6 MB de arribos) excede el CPU del plan Free al decodificarlo. Filtrado pesa 0,4–5 KB.
3. **Equivalencias `stop_id` → parada BA** (`equivalencias-paradas.json`):
   - en `posiciones()` agregan `paradaId` a cada vehículo;
   - en `arribos()` deciden qué `stop_time_update` pertenecen a la parada.

   Una parada **sin equivalencia** devuelve una lista vacía sin pedir nada upstream, y la app oculta los arribos.
4. **Fan-out de arribos:** por cada parada se piden hasta 8 líneas en paralelo (`Promise.allSettled`).
   - Si fallan algunas, la respuesta va con `stale: true`; si fallan todas, 503.
   - Un viaje cuenta una sola vez. Se devuelven máximo 10 arribos por línea, ordenados por `enSegundos`.
   - El **deadline del fan-out** (una respuesta parcial antes de que el request se cuelgue) lo está ajustando la tarea en curso de `src/adapters/colectivos`.

## 7. Paquete estático

Lo genera `tools/gtfs` y se sube a R2 con `tools/gtfs/upload-r2.sh`: cada `<version>/<archivo>` primero y `latest/manifest.json` al final (`10-deploy.md` §3).

- **`ManifestV1`:** tiene `version` (hash del contenido) y `generatedAt`. Cada archivo de `archivos` trae `{ url: "<version>/<archivo>", bytes, sha256 }`. Opcionalmente trae `omitidos` y `fuentes` (atribución).
- **Archivos con contrato:** `paradas.json`, `lineas-colectivos.json`, `equivalencias-paradas.json`, `indice-colectivos.json`, `subte-lineas.json` y `subte-estaciones.json` (`ARCHIVOS_ESTATICOS_V1`). Los `.geojson` (`subte-red`, `recorridos-colectivos`) tienen desde la Fase 4 un esquema mínimo de FeatureCollection (`GEOJSON_ESTATICOS_V1`, `SubteRedGeoJsonV1`), que valida la app, no el proxy.
- **Caché:** el Worker lo sirve a través de la Cache API. La app baja el manifiesto, compara `version` y descarga solo si cambió.

## 8. Rate limiting y privacidad

- **Límite:** binding nativo `RATE_LIMITER`, con 60 requests por 60 s por cliente y contadores en memoria por colo. En `wrangler dev` también se aplica (medido: 60 pasan y 40 reciben 429; `tools/carga/README.md`).
- **Clave:** SHA-256 truncado de `cf-connecting-ip`. La IP no se loguea, no se persiste y no le llega en claro al limitador.
- **Observabilidad:** muestreo al 10 % y `invocation_logs: false`. Los únicos logs propios son `upstream_fetch`, `upstream_error` y `unhandled_error`, y ninguno lleva datos de la request (`05-privacidad.md` §6).

## 9. Secrets

- `GCBA_CLIENT_ID` y `GCBA_CLIENT_SECRET` se cargan como `wrangler secret` por entorno (en local, con `.dev.vars`).
- Se agregan a la URL **solo al hacer el fetch** (`src/sources/edge-cached.ts`). Nunca forman parte de claves de caché, errores, logs ni respuestas.
- `test/errors.test.ts` verifica que un error con el secret en el mensaje no lo filtra.
- **Trenes no usa secrets.** Sus cuatro variables son `vars` de `wrangler.jsonc` (en la raíz y repetidas en `env.preview` y `env.production`):

| Var | Valor | Para qué |
|---|---|---|
| `TRENES_UPSTREAM_BASE` | `https://ariedro.dev/api-trenes` | Base de la fuente (puede traer path) |
| `TRENES_ENABLED` | `"true"` | Kill-switch: cualquier otro valor apaga trenes |
| `TRENES_TTL_SECONDS` | `"30"` | TTL de arribos |
| `TRENES_ESTADO_TTL_SECONDS` | `"60"` | TTL de gerencias y ramales (estado y alertas) |

## 10. Límites de CPU y cómo se respetan

- El plan **Free** permite 10 ms de CPU por invocación y el **Paid**, 30 s (`04-escalabilidad.md` §9). El costo grande es decodificar protobuf y parsear JSON grandes.
- **Feeds filtrados por línea** (§6.2): nunca se decodifica el feed completo de colectivos.
- **Caché de lo ya decodificado:**
  - la copia en memoria del isolate y la Cache API guardan el cuerpo upstream;
  - un hit dentro del TTL no vuelve a pedir upstream;
  - los índices estáticos se arman una vez por isolate y versión.
- **Riesgo pendiente de medir:** el primer `arribos()` de cada isolate parsea y valida `paradas.json` (1,7 MB). Puede superar 10 ms en Free. La medición de CPU la está haciendo la tarea en curso de high-dev; si confirma el riesgo, las opciones son partir el archivo, prevalidarlo o pasar a Paid.
- **Upstream lento:** se aplica un timeout por intento (`UPSTREAM_TIMEOUT_MS`, default 5000) y 1 reintento, para no consumir la duración del request.

## 11. Capa B (Fase 5)

El MVP usa la **capa A**: Cache API por colo, más una copia en memoria por isolate, más coalescing por isolate.

**Sus límites:**
- Cada colo y cada isolate frío vuelve a pedir upstream.
- La Cache API no funciona en `*.workers.dev`, así que hace falta dominio propio (`10-deploy.md` §4).
- **El coalescing por isolate comparte una misma promesa entre requests.** En la prueba de carga de 45 s (`tools/carga/README.md`) eso produjo 57 respuestas 500 de 30.435: "Worker's code had hung", porque en workerd el I/O pertenece a la request que lo inició. Está **pendiente de corrección** en `src/cache/` y es otro argumento para la capa B.

**La capa B** es un Durable Object `FeedHub` por feed, con un alarm cada TTL, como único fetcher upstream:
- implementa la misma interfaz `FeedSource`;
- los Workers leen del DO y cachean en el edge;
- precalcula slices por línea.

Así el upstream recibe 1 request por TTL y por feed a nivel global. Está diseñado en ADR-0005 y `04-escalabilidad.md` §3; se implementa en Fase 5 detrás de un flag.

## 12. Cómo agregar un servicio nuevo

1. **Investigar:** probar el endpoint con `tools/api-probe` (`--only=<servicio>`), documentarlo en `01-api-transporte.md` y guardar las fixtures en `apps/proxy/test/fixtures/<servicio>/`. Una fuente que no es la API del GCBA lleva su propio probe (como `tools/sofse-probe` para trenes) y sus fixtures en su propia carpeta (`fixtures/sofse/`).
2. **Contrato v1** en `packages/contracts/src/<servicio>.ts`:
   - esquemas con sufijo `V1`, campos cortos, fechas ISO, ids como string;
   - `envelope()` para la respuesta;
   - tests de un ejemplo válido y uno inválido.

   Un cambio aditivo sube la versión menor; uno incompatible crea `/v2`.
3. **Esquema upstream laxo** en `packages/contracts/src/upstream/` (`looseObject`, `nullish`), con un test contra la fixture real.
4. **Adaptador** en `apps/proxy/src/adapters/<servicio>/`:
   - recibe `{ source, ttlSeconds, now }`. Una fuente que no es la del GCBA usa su propia `EdgeCachedFeedSource` (sin `credentials` y con su `unavailableMessage`), con claves de caché con prefijo propio (`trenes:`) y la base en una var (`upstreamUrl(path, params, base)`);
   - usa `buildMeta()` para `meta`;
   - la clave de caché va sin credenciales;
   - lanza `ApiError` para 404/503;
   - lleva un README con las reglas;
   - se registra en `createAdapters()` y en la interfaz `Adapters` (`src/container.ts`).
5. **Ruta** en `apps/proxy/src/routes/<servicio>.ts`: valida los params con `IdParam`/`parseParam` y responde con `sendEnvelope`. Se monta en `src/app.ts` y se agrega a `V1_ROUTES` (`src/routes/index.ts`).
6. **Tests:**
   - adaptador con fixtures, sin red, usando una `FeedSource` falsa;
   - ruta con adaptadores falsos: headers, 400 y 304;
   - el contrato valida la salida.
7. **Docs:** actualizar este documento (tabla de rutas), `09-testing.md`, `04-escalabilidad.md` (si cambia la cantidad de feeds) y la bitácora.
8. **Carga:** agregar la ruta a `tools/carga` (`--paths`) y verificar 1 fetch upstream por TTL.
