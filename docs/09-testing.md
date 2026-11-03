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

## 8. App (`apps/mobile`)

### Herramientas

- **jest-expo 58.0.13 + Jest 30.5.2 + @testing-library/react-native 14.1.0.**
  - En RNTL 14 la API es **asíncrona**: `await render(…)`, `await renderHook(…)`, `await act(…)` y `await userEvent.setup().press(…)`.
  - Matchers integrados: `toBeOnTheScreen`, `toHaveTextContent`, `toHaveStyle`, `toBeSelected`, `toBeDisabled`, `toBeBusy`, `toBeExpanded` y `toBeCollapsed`.
  - `fireEvent` y `unmount` también son asíncronos: sin `await`, el `act` queda solapado y los tests siguientes fallan con "overlapping act() calls".
- **Rutas:** `renderRouter` de `expo-router/testing-library` con un sistema de archivos en memoria (layouts y pantallas reales) y el matcher `toHavePathname`.
- **`jest.config.js`:**
  - `transformIgnorePatterns` de la doc de Expo para pnpm (incluye `.pnpm`), más `standard-navigation` (ESM) y `@material-symbols/*`.
  - Alias `@/` en `moduleNameMapper`.
- **SVG mockeado:** `test/mocks/svg-transformer.js` reemplaza cada `.svg` por un `View` con `testID="svg:<archivo>"` y las mismas props. Así se verifica qué ícono, tamaño y color se usa sin parsear XML.
- **Nitro/MMKV:**
  - `react-native-mmkv` 4 usa su propio mock en memoria cuando detecta Jest.
  - Pero `react-native-nitro-modules` busca el TurboModule nativo al importarse y tira, así que `jest.setup.ts` lo reemplaza por un stub.
  - Los tests de lógica usan `MemoryKeyValueStore`.
- **Fuentes:** jest-expo mockea el módulo nativo de `expo-font`, pero los `.ttf` no quedan en el registro de assets y `loadAsync` rechaza.
  - Eso prueba el camino de error real: el splash se oculta igual.
  - El camino de éxito se prueba mockeando `useFonts`.
- **Hápticos y splash:** se mockean con `jest.mock` (`expo-haptics`, `expo-splash-screen`) donde el test verifica la llamada.

### Mocks nativos y helpers (primera ola de la Fase 4)

Los registra `jest.setup.ts`; `test/mocks/setup-after-env.ts` (`setupFilesAfterEnv`) vuelve los que tienen estado a cero antes de cada test.

| Pieza | Qué hace |
|---|---|
| `test/mocks/maplibre.tsx` | `@maplibre/maplibre-react-native` v11 no publica mock. Cada componente (`Map`, `Camera`, `GeoJSONSource`, `Layer`, `UserLocation`) es un `View` con `testID` y **todas** sus props; los refs imperativos son `jest.fn` (`mapLibreMock.camera` / `.map`) |
| `test/mocks/expo-location.ts` | `expo-location` con estado: `locationMock.setPermission('granted' \| 'denied' \| 'undetermined', { canAskAgain })`, `setRequestAnswer`, `setPosition`, `emitPosition` (a cada `watchPositionAsync`), `activeWatchers`. Los métodos de segundo plano y geofencing tiran: un test falla si la app los pidiera |
| Reanimated 4 y Worklets | `jest.setup.ts` hace `setUpTests()` de Reanimated y usa el mock de `react-native-worklets`. `test/mocks/resolver.js` compone el resolver de Reanimated con el de `jest-expo` (con pnpm la carpeta de Reanimated contiene el nombre de Worklets y el resolver los confundía) |
| Gesture Handler | `jest.setup.ts` carga su `jestSetup.js` oficial |
| `test/mocks/native-deps.test.tsx` | Humo de todo lo anterior y de `app.config.ts` (ubicación solo "mientras se usa") |
| `test/helpers/ajustes.tsx` | `renderWithApp(ui, { fetch, favoritos, online })`: tema, `QueryClient`, cliente del proxy, intervalo y favoritos sobre un `MemoryKeyValueStore`. Lo usan Ajustes y la navegación de Inicio |
| `test/subtes/fixtures.tsx` | Estático mínimo de las 7 líneas, respuestas del proxy (`estado`, `alertas`, `arribos`, `posiciones`), `createHarness(routes)` con todos los providers y `renderSubtes(url)`. Lo reutilizan Favoritos, Inicio y los datos vivos |
| `test/map/{fixtures,harness}.ts*` | Lo mismo para las pantallas con mapa |

**Patrón del cliente mockeado por ruta:** `createFetch(routes)` recibe `{ '/v1/subtes/estado': () => jsonResponse(estado()) }` y responde según el `pathname`. Una ruta que devuelve `undefined` queda pendiente (estado de carga) y una que no está declarada da 404 `not_found`. El `QueryClient` de los tests usa `retry: false` y `gcTime: Infinity` para no dejar timers. Para armar errores: `jsonResponse(errorBody('upstream_unavailable'), 503)`. Nada toca la red.

**Pantallas con permisos o diálogos:** `jest.spyOn(Alert, 'alert')` para los diálogos nativos, `jest.spyOn(Linking, 'openURL' | 'openSettings')` para los enlaces. Ojo con `mockClear()` al espiar `Linking.openSettings`: el mock de React Native conserva las llamadas entre tests.

### Cómo correr

```sh
pnpm --filter @transportate/mobile test             # jest --ci
cd apps/mobile && npx jest --ci test/integracion.test.tsx   # un archivo
cd apps/mobile && npx jest --ci --coverage          # cobertura (informativa; borrá coverage/ después)
```

### Qué cubren (mobile: 561 tests en 55 archivos, 2026-11-03, tras la reconciliación F4-MID-D)

Totales por paquete en esa fecha: **mobile 561 tests en 55 suites** (`jest --ci` completo en una corrida, unos 28 s; también en verde con `--randomize` en tres corridas con semillas distintas), **proxy 86 + 1 skipped en 11 archivos** y **contracts 76 en 3 archivos**.

| Archivo | Cubre |
|---|---|
| `test/inicio.test.tsx`, `test/navegacion.test.tsx` | Inicio renderiza su título; stack Inicio → Ajustes → Acerca de; ruta inexistente → "no encontrado" |
| `test/layout.test.tsx`, `test/fonts.test.tsx` | Splash oculto al cargar o fallar las fuentes; los 6 pesos exactos |
| `test/app-config.test.ts` | `app.config.ts`: cada imagen de ícono, adaptativo y splash existe y es PNG; ícono de 1024×1024 sin alfa; fondo del adaptativo igual a `design/brand/adaptive-background.txt` |
| `test/icons.test.tsx` | Mapa curado y `Icon` (tamaño, color, accesibilidad) |
| `test/storage.test.ts` | `KeyValueStore` (memoria y mock oficial de MMKV) y persister de TanStack Query |
| `test/api/*`, `src/shared/query/__tests__/*` | Cliente API (validación Zod, ETag/304, errores tipados), hooks (polling solo en primer plano, reintentos, último dato bueno), `QueryClient` (AppState, NetInfo, jitter) y persistencia en MMKV, todo con `fetch` mockeado |
| `test/favoritos.test.tsx` | Repositorio: alta y duplicados, alias (trunca a 30), reorden, borrado + restore, `clear`, persistencia entre instancias, JSON corrupto, migración ficticia 0 → 1, `useFavoritos` |
| `test/preferences.test.tsx` | Stores de tema e intervalo: defaults, persistencia, validación, suscripción, `usePreference` |
| `test/integracion.test.tsx` | La app arranca con `ThemeProvider` + `FavoritosProvider` y tabs nativas en Inicio; cambio de tema → `useTheme().scheme` + persistencia; favoritos de punta a punta; `FreshnessLabel` viejo en warning oscuro; `OfflineBanner` |
| `src/features/ajustes/__tests__/*` | Ajustes (tema e intervalo persisten, fila del índice en datos/carga/error/sin conexión, limpiar datos, borrar favoritos con diálogo y Deshacer, fila Ubicación según el permiso), Acerca de (versión, enlaces, 150–250 palabras) y Licencias |
| `src/features/ubicacion/__tests__/*` | `usePermisoUbicacion` / `useUbicacion` con el mock de ubicación (permiso, `request` solo en contexto, posición en memoria, `watch` que se suelta al desmontar y en segundo plano), `isInsideCaba`, `distanceMeters` y `PermisoUbicacionBloque` |
| `src/features/favoritos/__tests__/*` | Pantalla Favoritos (lista, vacío, edición, quitar con Deshacer, alias de 30 caracteres, búsqueda, acciones de accesibilidad), colores de subte y huérfanos con el estático mockeado, datos vivos (ok, carga, error, solo filas visibles), `FreshnessLabel` global y pull to refresh |
| `src/features/subtes/__tests__/*`, `test/subtes/*` | Modelo de la red, pantallas de Subtes, línea y estación, y `useStaticArchivo` |
| `test/inicio.test.tsx` | Inicio: 7 filas fijas, Alert destacada (una, varias, las 7), skeleton, `ErrorState` dentro del bloque con favoritos visibles, Alert de actualización fallida, sin favoritos, 5 + "Ver todos (N)" |
| `src/features/colectivos/__tests__/model.test.ts` | Índice de colectivos, búsqueda con ranking, paradas cercanas con filtro por rectángulo (grilla de 7.027 paradas) |
| `test/colectivos/*` | `LargeFileManager` y `useStaticArchivoGrande` (progreso, MMKV por archivo, versión nueva, errores, `.geojson`); raíz de Colectivos (índice descargando, error, búsqueda, cercanas con y sin permiso, fuera de CABA, recientes), parada con y sin arribos, favorito de parada huérfano |
| `src/features/favoritos/__tests__/FavoritoLiveData.test.tsx` | Dato vivo por tipo (datos, carga, error, viejo) y huérfano con el criterio único |
| `src/shared/ui/__tests__/Snackbar.test.tsx` | `Snackbar` y `SnackbarProvider` con timers falsos (5 s / 8 s, acción, reemplazo) |
| `src/shared/map/__tests__/*`, `test/map/*` | `MapView` compartido y mapa de la red de subte contra el mock de MapLibre |
| `test/clear-query-cache.test.ts` | `clearPersistedQueryCache` borra solo la caché de consultas |
| `src/shared/theme/__tests__/*` | Contrastes de DESIGN.md §2 en claro y oscuro; `ThemeProvider` |
| `src/shared/ui/__tests__/*` | Componentes: Alert, Button, FreshnessLabel, SearchInput, StatusChip, vitrina en los dos esquemas, y (`Estados.test.tsx`) Chip, SegmentedControl, ErrorState, EmptyState, LineBadge, OfflineBanner y Skeleton |

**Cobertura** (`jest --coverage`, informativa y sin umbral; medida el 2026-11-02, antes de la Fase 4): **93,2 % statements, 88,2 % branches, 86,9 % funciones, 94,8 % líneas**.

**Tests dependientes del timing (corregidos en F4-MID-D):** dos tests afirmaban `isPending`/`loading` en la primera lectura con un `fetch` mockeado que responde enseguida, y fallaban según el orden de las suites (`--randomize`). Ahora la carga se prueba con una respuesta que nunca llega (`() => undefined` en el harness de `test/subtes/fixtures.tsx`). Los umbrales de tiempo (cercanas sobre 7.027 paradas) son holgados a propósito.

**Hallazgo: timeouts bajo carga.** Con la máquina cargada (varios agentes compilando, load average de 25 a 70) `pnpm test` desde la raíz corre los tres paquetes en paralelo y fallan por tiempo algunos tests que miden asíncronos (en el proxy, `health` y `edge-cached`; en la app, `integracion`, `navegacion` y las pantallas que montan el router real). Sueltos y **por paquete pasan**. Cuando la raíz da timeouts: `cd apps/mobile && pnpm test`, después `apps/proxy` y `packages/contracts`, y anotarlo en el reporte. Los tests que montan el router real llevan `jest.setTimeout(30_000)`.

**Después de traer cambios de `packages/contracts`:** el `dist` del paquete lo genera `prepare` (`tsc -p tsconfig.build.json`) y `pnpm install` no lo regenera si nada cambió en el lockfile. Si aparecen suites que fallan sin ningún test en rojo (`Cannot find module` / esquemas que no existen), corré `pnpm exec tsc -p tsconfig.build.json` en `packages/contracts`.

**Pendiente:**
- **Dev build en dispositivo o simulador:** nada de la app se corrió todavía en un dev client. Falta confirmar MMKV con Nitro, NetInfo, el 304 con `NSURLCache` en iOS y `NativeTabs` (Fase 4, primer build).
- **Pruebas E2E** (flujos completos sobre el binario, por ejemplo con Maestro): no hay ninguna.
- No se testean en Jest las tabs nativas en profundidad, MapLibre ni los módulos nativos reales. Eso se verifica en el dev client y en el `audit` de la Fase 5.

Los tests del cliente API y del `QueryClient` (tarea 3.9) ya existen: `test/api/` y `src/shared/query/__tests__/`, con `fetch` mockeado, `ErrorV1`, ETag/304, polling en primer plano, reintentos, último dato bueno y persistencia.
