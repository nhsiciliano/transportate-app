# 09 — Testing

Qué se testea en cada pieza del monorepo, con qué herramienta, cómo se corre y qué queda fuera a propósito.

Versiones fijadas (Fase 2): Vitest **5.0.5**, `@cloudflare/vitest-plugin` **1.4.12**, wrangler 4.156.1, Zod 4.6.7, TypeScript 6.0.3.

`@cloudflare/vitest-plugin` es el nombre actual del antiguo `@cloudflare/vitest-pool-workers`, que está deprecado. Los tests importan `env` y `exports` desde `cloudflare:workers`, no `SELF` desde `cloudflare:test`.

## 1. Pirámide y alcance

| Capa | Dónde | Herramienta | Qué cubre |
|---|---|---|---|
| Contratos | `packages/contracts/test/` | Vitest (Node) | Cada esquema v1 acepta un ejemplo válido y rechaza uno inválido. `envelope()` arma el sobre. Los esquemas **upstream** laxos aceptan las fixtures reales |
| Proxy: rutas y middlewares | `apps/proxy/test/*.test.ts` | Vitest dentro de **workerd** (`@cloudflare/vitest-plugin`) | Rutas `/v1` con adaptadores falsos, ETag/304, `Cache-Control`, rate limit, errores sin fuga de secrets, estáticos desde R2 local con Cache API real |
| Proxy: fuente capa A | `apps/proxy/test/sources/edge-cached.test.ts` | Vitest en workerd, upstream y caché inyectados | Miss → upstream y hit dentro del TTL; coalescing (10 concurrentes → 1 fetch); último dato bueno con `stale`; 503 sin caché; reintento por timeout, red o 5xx, pero no por 4xx; credenciales ausentes de claves y logs |
| Proxy: adaptadores | `apps/proxy/test/adapters/{subtes,colectivos}.test.ts`, `test/lib/gtfs-rt.test.ts` | Vitest en workerd + **fixtures reales**. Las `.pb` se importan inline (`?inline` → data URL → bytes con `test/lib/fixture-bytes.ts`), porque workerd no tiene `fs` | Reglas de estado de subte, alertas, arribos con forecast congelado; colectivos: líneas, posiciones filtradas, arribos por equivalencia, 404, fan-out parcial, decodificación GTFS-RT |
| Proxy: carga | `tools/carga` (fuera de la suite) | autocannon 8.0.0 contra `wrangler dev` | 1 fetch upstream por clave y por TTL bajo carga, y rate limit 429. Ver §5 |
| `tools/gtfs` contra contratos | `tools/gtfs/test/contracts.test.ts` (+ tests por paso) | Vitest (npm, fuera del workspace) | Cada archivo de `out/` valida contra su esquema de `ARCHIVOS_ESTATICOS_V1`, y el manifiesto contra `ManifestV1` |
| Herramientas | `tools/*` | Ejecución manual (scripts standalone con npm, fuera del workspace) | Investigación y preprocesado; ver §5 |
| App (Fase 3) | `apps/mobile` | Jest + React Native Testing Library | Ver §7 |

Todo lo que entra al workspace (`apps/*`, `packages/*`) corre en CI (`.github/workflows/ci.yml`: install `--frozen-lockfile` → lint → typecheck → test) y antes de cada despliegue (`.github/workflows/deploy-proxy.yml`).

## 2. Cómo correr los tests

```sh
pnpm test                                        # todo el workspace (pnpm -r test)
pnpm --filter @transportate/contracts test       # solo contratos
pnpm --filter transportate-proxy test            # solo proxy (levanta workerd vía el plugin)

# modo watch (re-ejecuta al guardar)
pnpm --filter transportate-proxy exec vitest --watch
pnpm --filter @transportate/contracts exec vitest --watch

# un archivo o un caso puntual
pnpm --filter transportate-proxy exec vitest run test/routes.test.ts -t "304"

# el resto de los checks que exige CI
pnpm lint && pnpm typecheck && pnpm format:check
```

- El proxy depende de `@transportate/contracts` compilado (`dist/`). `pnpm install` lo compila solo (script `prepare`). Si cambiás contratos sin reinstalar, corré `pnpm --filter @transportate/contracts build`.
- Al arrancar, el plugin lee `apps/proxy/wrangler.jsonc` (bindings `STATIC` y `RATE_LIMITER`, vars) y, si existe, `apps/proxy/.dev.vars`. Por eso en local aparece "Using secrets defined in .dev.vars". **Los tests no usan esos valores**: `testEnv()` los reemplaza por secrets ficticios. En CI no hay `.dev.vars` y los tests pasan igual.

## 3. Proxy: cómo están armados los tests

- **Composición inyectable.** `createApp({ adapters, now? })` acepta adaptadores fijos. Los tests usan `fakeAdapters()` de `test/helpers.ts`, que devuelve sobres fijos y registra los ids recibidos, y llaman `app.request(path, init, testEnv())`. `/v1/health` y el 404 se prueban contra el Worker real con `exports.default.fetch()`.
- **`testEnv(overrides)`.** Arma el `env` de test:
  - los bindings reales del plugin (R2 local);
  - `GCBA_CLIENT_SECRET` ficticio (`FAKE_SECRET`);
  - un `RATE_LIMITER` falso que deja pasar todo.

  El binding `ratelimit` existe en el entorno local, pero sus contadores son compartidos y dependen del reloj, así que los tests de rate limit inyectan su propio `{ limit }` para decidir el resultado y capturar la clave (que es un hash, nunca la IP).
- **R2 y Cache API reales.** `test/static.test.ts` escribe con `env.STATIC.put(...)` y verifica 200/ETag/304/404. Como `caches.default` también es real y persiste dentro del archivo de test, **cada caso usa un host distinto** (`https://static-N.test`) para no compartir entradas de caché.
- **ETag estable.** `test/etag.test.ts` usa un adaptador falso que devuelve el mismo `data` con `generatedAt` y `ageSeconds` distintos. Verifica tres cosas:
  - el segundo request con `If-None-Match` da **304 sin cuerpo**;
  - el ETag cambia si cambia `data`, `sourceTimestamp` o `stale`;
  - un `sourceTimestamp` nuevo devuelve 200 con otro ETag.
- **Fuga de secrets.** `test/errors.test.ts` fuerza un error cuyo mensaje contiene una URL upstream y el secret, y verifica que la respuesta (cuerpo y headers) no incluye ni el secret ni la URL ni `stack`.
- **Adaptadores (los agrega quien los implementa).** Leen fixtures de `apps/proxy/test/fixtures/<servicio>/` y verifican la salida contra los esquemas v1 (`EstadoLineasResponseV1.parse(...)`, etc.). Para los casos de fallo, se reemplaza la `FeedSource` por una falsa que devuelve fixtures `.error.txt`, el protobuf corrupto (`subtes/serviceAlerts.pb`) o lanza excepciones. No hay `fetch` real en los tests.

## 4. Fixtures reales

- Viven en `apps/proxy/test/fixtures/<servicio>/` y **no se editan a mano** (son la verdad del upstream). Convención: `<endpoint>[.<variante>].<ext>`; las respuestas no-200 van en `.error.txt` con cabecera `#` de metadatos. El índice está en `apps/proxy/test/fixtures/README.md`.
- **Se regeneran** con `tools/api-probe`. Necesita `.env` con credenciales en la raíz y nunca guarda credenciales en las fixtures.
  ```sh
  cd tools/api-probe && npm install --no-package-lock && node probe.mjs --no-download
  ```
  Después de regenerar:
  1. revisar el diff (tamaños, campos nuevos);
  2. correr `pnpm test`: un adaptador que se rompe marca un cambio del upstream;
  3. actualizar `docs/01-api-transporte.md`.
- Límite de tamaño: ningún archivo commiteado puede superar 5 MB. Las más grandes hoy son `tripUpdates.pb` (3,6 MB) y `vehiclePositions.json=1.json` (3,5 MB).

## 5. Herramientas (`tools/*`)

Son paquetes standalone con npm, **fuera del workspace pnpm**. No corren en CI: se ejecutan a mano y su resultado se revisa.

| Herramienta | Cómo se valida | Qué produce |
|---|---|---|
| `tools/api-probe` | `node probe.mjs` (o `--only=subtes`); el `last-run.json` se compara con el anterior | Diagnóstico de la API y fixtures |
| `tools/gtfs-cruce` | `node tools/gtfs-cruce/cruce.mjs` (lee la caché en `~/.cache/transportate/gtfs/`) | `last-run.json` con porcentajes de cruce (`docs/01b-gtfs-alternativos.md`) |
| `tools/captura-posiciones` | `node captura.mjs --once` (un snapshot y termina); `./status.sh` para la captura larga | CSV en `~/.cache/transportate/capturas/` |
| `tools/gtfs` (preprocesado) | `npm run check` y `npm test`: Vitest sobre muestras chicas y, si existe `out/`, validación de cada archivo contra `ARCHIVOS_ESTATICOS_V1` (`ParadasArchivoV1`, `LineasColectivoArchivoV1`, `EquivalenciasArchivoV1`, `SubteLineasArchivoV1`, `SubteEstacionesArchivoV1`) y del manifiesto contra `ManifestV1`. Esquemas vigentes: `ManifestV1.archivos[x].url` = `<version>/<archivo>` relativo a `/v1/static/` (más `omitidos` y `fuentes` opcionales); `ParadaV1` con `altura` y `comuna` **numéricos** (o `null`) y `lineas[]` = `{ linea, numero, sentido: 'ida'\|'vuelta'\|null }`; `EquivalenciaParadaV1` solo con paradas (el origen `gtfs2021` está reservado y no se publica) | `out/<version>/*` + `manifest.json` |
| `tools/carga` | Corre contra `wrangler dev` con el paquete estático en el R2 local (ver su README). Escenario A: 50 conexiones durante 10 o 45 s; cuenta los `upstream_fetch` del log. Escenario B: 100 requests con la misma IP → 429 | `tools/carga/README.md` con p50/p99, req/s, errores y fetches upstream |
| `tools/contraste` | `python3 tools/contraste/contraste.py --check` (sale con 1 si falla un par de la paleta oscura) | Tablas de contraste de `docs/02-obelisco-tokens.md` |

## 6. Convenciones

- Archivos `*.test.ts` en la carpeta `test/` de cada paquete. Un archivo por área (`routes`, `rate-limit`, `static`, `errors`, `etag`), con subcarpetas por capa: `test/sources/`, `test/adapters/<servicio>.test.ts` y `test/lib/`. Los helpers compartidos van en `test/helpers.ts`.
- Nombres de casos en castellano y en forma de comportamiento: `'responde 304 sin cuerpo si If-None-Match coincide'`.
- Las respuestas se validan con los **esquemas de `@transportate/contracts`**, no con objetos copiados a mano: si el contrato cambia, el test lo nota.
- Valores ficticios obvios en datos de prueba (`id-de-prueba`, `secreto-de-prueba-…`, IPs de documentación `203.0.113.0/24`). Nunca datos reales de personas ni credenciales.
- Sin `any`, sin `@ts-ignore`: los tests pasan por el mismo `typecheck` y `lint` estricto que el código.
- Tests deterministas: sin red, sin dormir (`sleep`) y con reloj inyectable (`now`) cuando el resultado depende del tiempo.

## 7. Qué NO se testea (a propósito)

- **Llamadas reales a la API GCBA en CI.** CI no tiene credenciales, y la API es inestable (1–9 % de fallos medidos) y está "en revisión" según el portal. El contacto con el upstream se verifica a mano con `tools/api-probe` y queda congelado en fixtures.
- **Despliegue real ni bindings remotos** (R2 o rate limit de Cloudflare). Se usan los simulados del plugin. La verificación post-deploy es manual (`docs/10-deploy.md` §2).
- **La Cache API en `*.workers.dev`**, que no tiene efecto allí. Se prueba la lógica en local; el comportamiento en producción depende del dominio propio.
- **Compresión gzip/brotli**: la aplica el runtime de Workers, no nuestro código.
- **Rendimiento y carga** en la suite unitaria. La prueba de carga (`tools/carga`, autocannon, tarea 2.12) se corre a mano contra `wrangler dev`, con el upstream real. Resultados en `tools/carga/README.md` y resumen en `docs/06-proxy.md`.
  - Primera medición (2026-11-02): coalescing confirmado, con 30.435 requests → 5 fetches upstream en 45 s, y rate limit con 60 × 200 y 40 × 429.
  - Hubo **57 respuestas 500** ("Worker's code had hung") por el coalescing entre requests. Está pendiente de corrección en `src/cache/` y se re-corre después.

## 8. Fase 3: la app

- **Jest + React Native Testing Library** en `apps/mobile` (`jest-expo`; versiones a verificar con Context7 al inicio de la Fase 3 y anotar en `versiones.md`).
- **`FavoritosRepository`:** tests de alta, alias, reorden, borrado con deshacer y migración de esquema, contra una implementación en memoria y contra MMKV mockeado (plan, tarea 3.10).
- **Cliente API (`shared/api`):** parseo con los mismos esquemas de `@transportate/contracts`, manejo de `ErrorV1`, uso de `ETag`/304 y de `X-Transportate-Stale`. El `fetch` se mockea con respuestas armadas con los ejemplos de los tests de contratos.
- **Componentes y estados:** skeleton, vacío, error con reintento, dato viejo, sin conexión (briefs de `docs/briefs/`). Accesibilidad básica: roles, labels y áreas táctiles.
- No se testea MapLibre ni módulos nativos en Jest: se mockean. Lo nativo se verifica en dev client y en el `audit` de Fase 5.
