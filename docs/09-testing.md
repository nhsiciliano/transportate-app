# 09 — Testing

Qué se testea en cada pieza del monorepo, con qué herramienta, cómo se corre y qué queda fuera a propósito.

Versiones fijadas (Fase 2): Vitest **5.0.5**, `@cloudflare/vitest-plugin` **1.4.12**, wrangler 4.156.1, Zod 4.6.7, TypeScript 6.0.3.

`@cloudflare/vitest-plugin` es el nombre actual del antiguo `@cloudflare/vitest-pool-workers`, que está deprecado. Los tests importan `env` y `exports` desde `cloudflare:workers`, no `SELF` desde `cloudflare:test`.

## 1. Pirámide y alcance

| Capa | Dónde | Herramienta | Qué cubre |
|---|---|---|---|
| Contratos | `packages/contracts/test/` | Vitest (Node) | Cada esquema v1 acepta un ejemplo válido y rechaza uno inválido. `envelope()` arma el sobre. Los esquemas **upstream** laxos aceptan las fixtures reales |
| Proxy: rutas y middlewares | `apps/proxy/test/*.test.ts` | Vitest dentro de **workerd** (`@cloudflare/vitest-plugin`) | Rutas `/v1` con adaptadores falsos, ETag/304, `Cache-Control`, rate limit, errores sin fuga de secrets, estáticos desde R2 local con Cache API real |
| Proxy: adaptadores y fuentes | `apps/proxy/test/` (los agrega quien implementa `src/adapters/**`, `src/sources/**` y `src/cache/**`) | Vitest en workerd + **fixtures reales** | Traducción upstream → v1 con `test/fixtures/**`, caché, coalescing, último dato bueno, reintentos |
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
| `tools/gtfs` (preprocesado) | Su propio README: el paquete generado en `out/` tiene que validar con `ManifestV1` y con los esquemas estáticos (`ParadaV1`, `EstacionSubteV1`, `EquivalenciaParadaV1`) antes de subirse a R2 | `out/<version>/*` + `manifest.json` |
| `tools/contraste` | `python3 tools/contraste/contraste.py --check` (sale con 1 si falla un par de la paleta oscura) | Tablas de contraste de `docs/02-obelisco-tokens.md` |

## 6. Convenciones

- Archivos `*.test.ts` en la carpeta `test/` de cada paquete. Un archivo por área (`routes`, `rate-limit`, `static`, `errors`, y uno por adaptador: `adapters-subtes`, `adapters-colectivos`…). Los helpers compartidos van en `test/helpers.ts`.
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
- **Rendimiento y carga** en la suite unitaria. La prueba de carga (`autocannon`, tarea 2.12) se corre aparte contra `wrangler dev` y se documenta en `06-proxy.md`.

## 8. Fase 3: la app

- **Jest + React Native Testing Library** en `apps/mobile` (`jest-expo`; versiones a verificar con Context7 al inicio de la Fase 3 y anotar en `versiones.md`).
- **`FavoritosRepository`:** tests de alta, alias, reorden, borrado con deshacer y migración de esquema, contra una implementación en memoria y contra MMKV mockeado (plan, tarea 3.10).
- **Cliente API (`shared/api`):** parseo con los mismos esquemas de `@transportate/contracts`, manejo de `ErrorV1`, uso de `ETag`/304 y de `X-Transportate-Stale`. El `fetch` se mockea con respuestas armadas con los ejemplos de los tests de contratos.
- **Componentes y estados:** skeleton, vacío, error con reintento, dato viejo, sin conexión (briefs de `docs/briefs/`). Accesibilidad básica: roles, labels y áreas táctiles.
- No se testea MapLibre ni módulos nativos en Jest: se mockean. Lo nativo se verifica en dev client y en el `audit` de Fase 5.
