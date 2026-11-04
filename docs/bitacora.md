# Bitácora

Resumen por fase: qué se hizo, decisiones, riesgos y qué queda. Cada fase se cierra acá antes de pasar a la siguiente (el plan exige frenar y validar al final de cada una).

## Fase 1 — Investigación · **completada y validada por el usuario (2026-11-01)**

**Inicio:** 2026-11-01 · **Cierre técnico:** 2026-11-01 · **Alcance:** solo `docs/`, fixtures y contexto de diseño; sin código de producto.

### Cómo se trabajó

Coordinación con Orca (run `run_71a886f27b3e`) desde la sesión `planner`. Las tareas se repartieron por dificultad: 🟢 low-dev (1.1, 1.7, 1.8), 🟡 mid-dev (1.2, 1.5, 1.6, 1.9), 🔴 high-dev (1.3, 1.4). Cada worker trabajó en su worktree y branch (`nhsiciliano/Low-Dev`, `Mid-Dev`, `High-Dev`); el coordinador revisó cada entrega (commits, ausencia de credenciales, tamaño de fixtures) y la integró a `main`. No hubo pedidos de imágenes, así que la sesión Dev Images no se usó.

### Qué se entregó

| Doc | Tarea | Contenido |
|---|---|---|
| `01-api-transporte.md` | 1.3/1.4 | Verificación empírica de 19 endpoints con credenciales reales (4 corridas, 3 con observación de 5 min), tabla por endpoint con status, bytes, latencia, cadencia y calidad; recomendaciones de TTL y de manejo de fallos para el proxy. Script reproducible en `tools/api-probe/`. 32 fixtures reales en `apps/proxy/test/fixtures/`. |
| `01a-api-console.md` | 1.2 | Inventario completo de la spec RAML oficial (descargada de `/console/api/?raml`), incluidos los recursos comentados, tipos GTFS-RT y matriz "MVP vs spec". |
| `02-obelisco-tokens.md` | 1.5/1.6 | Tokens con `archivo:línea`, tokens por componente, propuesta de `tokens.ts`, paleta oscura derivada y tablas de contraste WCAG calculadas con `tools/contraste/contraste.py`. |
| `02b-colores-subte.md` | 1.7 | Colores de línea desde `routes.txt` del GTFS (HTTP 200) cruzados con fuentes públicas; estaciones por línea. |
| `PRODUCT.md`, `briefs/` | 1.8/1.9 | Contexto de producto (Impeccable `init`) y 6 briefs de pantalla (Impeccable `shape`) con estados, rangos y 33 suposiciones + 4 decisiones abiertas consolidadas en `briefs/README.md`. |
| `03`, `04`, `05`, `versiones.md`, ADR-0001…0005 | 1.1 | Arquitectura, escalabilidad con cifras verificadas, privacidad, versiones, decisiones. |

### Hallazgos que cambian el plan

1. **La API responde** pese al aviso de suspensión del portal, pero varios feeds están rotos o viejos (detalle en `01-api-transporte.md`).
2. **Hay arribos de colectivos:** `/colectivos/tripUpdates` existe aunque no esté en el RAML (3.904 viajes, 105 mil predicciones, dato nuevo cada 60 s). El plan los daba por inexistentes.
3. **Arribos de subte bloqueados:** `/subtes/forecastGTFS` está congelado desde 2026-10-24 y solo trae líneas A, B, D y E. Va detrás de un flag con detección de dato viejo.
4. **Alertas de subte solo con `json=1`:** el protobuf llega corrupto (re-codificado como UTF-8).
5. **Cortes de tránsito no existen hoy:** `/transito/v1/cortes` devuelve 500 en todas las variantes. El brief de Tránsito ya contempla el estado "Fuente no disponible"; decisión N3 pendiente (ocultar el tab o mantenerlo).
6. **GTFS estático de colectivos es de 2021:** solo el 32 % de los `route_id` y el 40 % de los `stop_id` del tiempo real existen en él. Para nombres y ubicación de paradas hace falta otra fuente vigente (riesgo para 2.10 y para arribos por parada).
7. **Fiabilidad upstream:** 1–9 % de requests fallan (timeouts/ECONNRESET), sin 429, sin `Cache-Control`/`ETag`/gzip, cadencia real de 60 s en colectivos. El proxy debe absorber fallos (último dato bueno, reintentos, TTL ≥ 20 s) y comprimir.
8. **Obelisco v2 tiene dos identidades:** la vigente (src/dist: `#1d3343`, `#035c80`, `#009688`, Archivo + Open Sans) y la histórica (`app/out`: `#336ACC`, Nunito). Decisión: colores vigentes; tipografía Nunito + Open Sans por mandato del brief (desvío consciente).
9. **Costos:** Free alcanza para ~1.100 usuarios activos con 1 request por tick de 20 s (no 300 como decía el plan); la Cache API protege al upstream pero no reduce requests facturadas.
10. **Sin `bearing`** en ningún feed: el mapa no puede rotar íconos por rumbo real.

### Decisiones tomadas por el coordinador (a confirmar por el usuario)

- Paleta vigente de Obelisco + tipografía Nunito/Open Sans (hallazgo 8).
- Los briefs no prometen arribos de colectivos hasta resolver el estático (hallazgo 6); el punto de entrada queda marcado.
- Tránsito se diseña con "Fuente no disponible" como estado de primera clase.

### Riesgos abiertos que pasan a Fase 2

- Conseguir un GTFS de colectivos vigente (AMBA) o una fuente alternativa de paradas; sin eso, arribos por parada y búsqueda por parada quedan limitados.
- `forecastGTFS` congelado: arribos de subte solo si revive; el proxy debe exponer `sourceTimestamp` y la app marcar el dato como viejo.
- GTFS de subte vence el 2026-12-31.
- El proveedor de tiles (OpenFreeMap) recibe la IP del teléfono: hay que declararlo en privacidad o self-hostear.

### Cierre de Fase 1

- **Fecha de cierre técnico:** 2026-11-01
- **Validado por:** usuario, 2026-11-01. Decisiones: (a) **paleta vigente de Obelisco confirmada** (tipografía Nunito + Open Sans se mantiene); (b) **tab Tránsito oculto por ahora** por falta de fuente de cortes (brief diferido, N3 resuelta); (c) **buscar fuentes alternativas de GTFS** de colectivos → tarea 1.11 (mid-dev) hecha el 2026-11-01: 6 fuentes evaluadas, ninguna vigente; plan B = paradas oficiales BA + tabla de equivalencias aprendida del tiempo real (`01b-gtfs-alternativos.md`, script `tools/gtfs-cruce/`). Pasa a Fase 2: medir cobertura del aprendizaje (24–48 h), ADR-0006 sobre paradas y licencia OSM, y pedir el GTFS vigente a la Secretaría de Transporte.
- **Incidente menor de privacidad del equipo:** durante la tarea 1.11 un worker envió el email del usuario en el `User-Agent` de una consulta a Overpass (OSM). No quedó en el repo. Regla desde ahora: ningún script usa datos personales en headers; `User-Agent` genérico `transportate-tools`.
- **Pendientes de decisión del usuario:** suposiciones S1–S33 y decisiones N1–N4 de `briefs/README.md`; tipografía (Nunito vs Archivo); qué hacer con Tránsito sin cortes; fuente alternativa de GTFS de colectivos.

## Fase 2 — Proxy · **completada y validada por el usuario (2026-11-02)**

**Inicio:** 2026-11-01 · **Cierre técnico:** 2026-11-02 · **Alcance:** `apps/proxy`, `packages/contracts`, `tools/gtfs`, tests, despliegue y documentación del proxy. Sin código de la app.

### Cómo se trabaja

Mismo esquema que en la Fase 1: coordinación con Orca desde `planner`, workers por dificultad en sus worktrees (`nhsiciliano/Low-Dev`, `Mid-Dev`, `High-Dev`) y el coordinador integra a `main`. A `main` ya llegaron el scaffold, los contratos, el esqueleto y las rutas del proxy, los tests, el despliegue, el preprocesado estático y las tareas de low-dev (captura, versiones, ADR-0006, solicitud). Los adaptadores reales, la fuente con caché y las correcciones de la prueba de humo los hizo high-dev; mid-dev hizo rutas, ETag, carga y `06-proxy.md`; low-dev captura, versiones, ADRs y READMEs.

### Hecho hasta ahora

| Qué | Tarea | Dónde |
|---|---|---|
| Scaffold del monorepo pnpm (TS 6.0.3 estricto, ESLint 10, Prettier, `.editorconfig`, CI de lint/typecheck/test) | 2.2 | raíz, `.github/workflows/ci.yml` |
| Contratos Zod v1 (sobre `EnvelopeV1` con `generatedAt`/`sourceTimestamp`, esquemas de subte, colectivos, tránsito, manifiesto estático y esquemas upstream laxos) | 2.3 | `packages/contracts` |
| Esqueleto del Worker con Hono 4, `/v1/health`, errores tipados e interfaces de fuentes y adaptadores | 2.2/2.8 | `apps/proxy` |
| Rutas `/v1/*` con ETag débil y 304, `Cache-Control` con `stale-while-revalidate`, rate limit con el binding nativo (clave = hash de la IP, sin persistirla) y estáticos desde R2 con Cache API; Tránsito como stub que responde 503 | 2.8/2.9 | `apps/proxy`, [`apps/proxy/README.md`](../apps/proxy/README.md) |
| Tests Vitest dentro de workerd (`@cloudflare/vitest-plugin`): rutas, ETag/304, rate limit, estáticos y ausencia de fugas de secrets. Al 2026-11-02: 43 tests en `packages/contracts` y 37 en `apps/proxy`, `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde | 2.11 (parcial) | `docs/09-testing.md` |
| Despliegue: entornos `preview` y `production`, buckets R2 y secrets, workflow manual de GitHub Actions | 2.12 (parcial) | [`10-deploy.md`](10-deploy.md), `.github/workflows/deploy-proxy.yml` |
| Preprocesado estático (paradas BA, líneas, subte, equivalencias `stop_id`, recorridos) a JSON versionado y script de subida a R2 | 2.10 | `tools/gtfs` |
| Captura continua de `vehiclePositions` y muestras de `tripUpdates` (lanzada el 2026-11-01 a las 23:31 UTC; objetivo 24–48 h) | 2.0 | `tools/captura-posiciones` |
| Versiones verificadas con Context7 y npm | 2.1 | [`versiones.md`](versiones.md) |
| Límites de CPU y memoria de Workers (con medición local de decodificación) | 2.1 | [`04-escalabilidad.md`](04-escalabilidad.md) §9 |
| ADR-0006 de paradas de colectivo (**Propuesta**) y borrador de solicitud del GTFS vigente al GCBA (**sin enviar**) | 2.0/2.1 | [`adr/ADR-0006-paradas-colectivos.md`](adr/ADR-0006-paradas-colectivos.md), [`solicitud-gtfs-gcba.md`](solicitud-gtfs-gcba.md) |
| README raíz, índice de `docs/`, README de `tools/` y `.env.example` | 2.12 (parcial) | [`../README.md`](../README.md), [`README.md`](README.md), [`../tools/README.md`](../tools/README.md) |

### Hallazgos y decisiones técnicas

1. **Tests de Workers:** se usa `@cloudflare/vitest-plugin` 1.4.12, que reemplaza al deprecado `@cloudflare/vitest-pool-workers` (0.23.0, con peer `vitest ^4.1.0` y wrangler 4.124.0 desfasado). Versiones fijadas hoy en los `package.json`: Vitest 5.0.5, wrangler 4.156.1, Zod 4.6.7, Hono 4.13.16.
2. **TypeScript 6.0.3**, no la 7.0.2: `typescript-eslint` 8.72.1 declara soporte `<6.1.0`.
3. **`compatibility_date`:** `nodejs_compat` ya viene activado desde 2026-08-04 y `workerd` rechaza el flag con fechas posteriores; no se declara.
4. **CPU en Workers Free:** decodificar `tripUpdates` completo (3,6 MB) costó 14–86 ms en una medición local en Node, contra un límite de 10 ms. El proxy filtra por `route_id` upstream y el feed completo se procesa solo en la capa B o fuera de línea (`04-escalabilidad.md` §9). La medición en `workerd` real sigue pendiente.
5. **La compresión la hace el runtime de Cloudflare**, no el Worker (`hono/compress` queda fuera): evita gastar CPU sin beneficio (`apps/proxy/README.md`).
6. **Paradas de colectivo:** catálogo oficial de BA + tabla de equivalencias aprendida; **sin OSM en el MVP** para no heredar ODbL (ADR-0006, a confirmar por el usuario).
7. **Primer build de `tools/gtfs` con solo ~19 minutos de captura:** de las predicciones de `tripUpdates` ubicadas en CABA, el 74,6 % ya tiene parada BA; el 56,7 % de todas las predicciones sigue sin ubicar. Estas cifras mejoran al rehacer el build con las 24–48 h de captura (`tools/gtfs/README.md`).
8. **Fallos de la captura:** en los primeros 40 minutos fallaron 2 de 35 snapshots de posiciones y 1 de 4 de `tripUpdates` (tras timeout de 20 s y un reintento), coherente con el 1–9 % de la Fase 1.

### Completado al cierre (2026-11-02)

| Qué | Tarea | Dónde |
|---|---|---|
| `EdgeCachedFeedSource` (capa A): Cache API con clave ficticia sin credenciales, copia en memoria del isolate, refresco con lock por timestamp (sin compartir promesas entre requests), último dato bueno ≤ 300 s, timeout 5 s configurable (`UPSTREAM_TIMEOUT_MS`) | 2.4 | `apps/proxy/src/sources/`, `src/cache/` |
| `SubtesAdapter`: estado por línea con reglas documentadas desde `serviceAlerts?json=1`, alertas, arribos desde `forecastGTFS` con detección de feed congelado | 2.5 | `apps/proxy/src/adapters/subtes/` |
| `ColectivosAdapter`: siempre con filtro upstream `route_id` (nunca el feed completo), índice estático compacto desde R2 (`indice-colectivos.json`, ~5 ms de CPU en el primer request), posiciones y arribos por parada con fan-out con presupuesto de 5 s | 2.6 | `apps/proxy/src/adapters/colectivos/` |
| Tránsito como stub 503 (diferido) | 2.7 | `src/adapters/transito/` |
| ETag estable sobre `data` + `sourceTimestamp` + `stale` (304 real), log `upstream_fetch` sin credenciales | 2.8 | `src/middleware/envelope.ts` |
| Tests: 67 en contratos, 87 en el proxy (fuente, adaptadores con fixtures `.pb` reales en workerd, rutas, ETag, rate limit, R2, CPU) y 79 en `tools/gtfs` (incluida validación contra contratos) | 2.11 | `docs/09-testing.md` |
| Prueba de carga `tools/carga` (autocannon): 50 conexiones × 45 s → 29.286 requests, 0 errores, 8 fetches upstream en 2 claves; rate limit 60 × 200 / 40 × 429 con `Retry-After` | 2.12 | `tools/carga/README.md` |
| `docs/06-proxy.md` (referencia del Worker) y READMEs por carpeta | 2.12 | [`06-proxy.md`](06-proxy.md) |
| ADR-0007 (**Propuesta**): dónde corre el aprendizaje de paradas | — | [`adr/ADR-0007-aprendizaje-paradas.md`](adr/ADR-0007-aprendizaje-paradas.md) |

**Verificación del coordinador en `main` (2026-11-02):** `pnpm lint`, `pnpm typecheck`, `pnpm test` en verde; `tools/gtfs` desde cero (`npm ci && npm test && npm run build`) sin ensuciar el árbol; `wrangler dev` con credenciales reales y el paquete estático en el R2 local: `/v1/subtes/estado` (B, C y E demoradas), `/v1/subtes/alertas` (3), `/v1/subtes/estaciones/1059/arribos` (`stale`, forecast congelado), `/v1/colectivos/lineas` (936), `/v1/colectivos/lineas/1858/posiciones` (4 vehículos), `/v1/colectivos/paradas/pfee923c699/arribos` (3 arribos en 0,7 s; 5,0 s `stale` cuando una línea upstream no responde), `/v1/transito/cortes` 503, `If-None-Match` → 304 con 0 bytes; cero credenciales en logs y respuestas.

### Hallazgos adicionales (cierre)

9. **En workerd no se pueden compartir promesas de I/O entre requests:** el coalescing con una `Promise` a nivel de módulo produjo 57 respuestas 500 "Worker's code had hung" bajo carga. Se reemplazó por datos compartidos + flag de refresco; la prueba de carga quedó en 0 errores.
10. **CPU del primer request de colectivos por isolate:** 25–27 ms con Zod sobre `paradas.json` (supera los 10 ms de Free) → `tools/gtfs` publica `indice-colectivos.json` compacto y el proxy no valida con Zod en runtime (el archivo viene firmado por sha256 en el manifest): ~5 ms.
11. **`wrangler types` genera literales** para las vars (`"5000"`): los helpers que leen `env` usan tipos estructurales.
12. **Arribos de colectivos existen y funcionan** vía `tripUpdates?route_id=` (5 KB por línea) con equivalencias `stop_id → parada`; el 1–9 % de fallos upstream se absorbe con presupuesto de 5 s y `stale`.

### Riesgos abiertos que pasan a Fase 3

- La cobertura de arribos por parada depende de la tabla de equivalencias; la captura de 24–48 h sigue corriendo (PID vivo, 74 snapshots al cierre) y hay que rehacer `tools/gtfs` al terminar y actualizar `01b` y el README de la herramienta.
- Nadie desplegó todavía a `preview`: requiere `wrangler login` y `wrangler secret put` del usuario (`10-deploy.md`). La Cache API no actúa en `*.workers.dev`: hace falta dominio propio para la capa A en producción.
- `forecastGTFS` sigue congelado (arribos de subte vacíos con `stale`).
- Dónde corre el aprendizaje de paradas en producción (ADR-0007, Propuesta).

### Pendiente de decisión del usuario

- Confirmar ADR-0006 (paradas BA + equivalencias aprendidas, sin OSM) y ADR-0007 (aprendizaje fuera de Workers para el MVP).
- Enviar (o no) la solicitud del GTFS vigente al GCBA (`solicitud-gtfs-gcba.md`): se manda desde su casilla, con sus datos.
- Licencia del proyecto (el README raíz dice "a definir").
- Siguen abiertas las suposiciones S1–S33 y decisiones N1–N4 de `briefs/README.md`, heredadas de la Fase 1.

## Fase 3 — Base de la app · **completada y validada por el usuario (2026-11-03)**

**Inicio:** 2026-11-02 · **Cierre técnico:** 2026-11-02 · **Run Orca:** `run_d7af602adf06` · **Alcance:** `apps/mobile` (Expo SDK 58 + Expo Router), tema y componentes de `shared/ui`, íconos, fuentes, cliente API tipado, favoritos y preferencias en MMKV, `DESIGN.md` y documentación de la app. Sin features de Fase 4: las pantallas son placeholders.

### Cómo se trabajó

Mismo esquema que en la Fase 2: coordinación con Orca desde `planner` (Run `run_d7af602adf06`), workers por dificultad en sus worktrees (`nhsiciliano/Low-Dev`, `Mid-Dev`, `High-Dev`), cada uno tocando solo sus carpetas. El coordinador integró a `main` corriendo lint, typecheck y tests, y resolvió los conflictos de `package.json` y del lockfile entre ramas. Tres olas:

1. **Ola 1:** low-dev versiones (3.1), `DESIGN.md` (3.6) y la investigación del mapa de íconos; mid-dev scaffold (3.2) y navegación (3.8); high-dev tema (3.3). En paralelo, la sesión Dev Images para los assets de marca (ver abajo).
2. **Ola 2:** low-dev componente `Icon` (3.5); mid-dev fuentes (3.4) y favoritos (3.10).
3. **Ola 3:** high-dev componentes de `shared/ui` (3.7) y después cliente API y `QueryClient` (3.9); mid-dev tests y documentación de la app (3.11).

Los assets de marca (ícono de la app y splash) se demoraron por un problema de herramienta en la sesión Dev Images: la fase cerró primero sin ellos, y después se integraron y se enchufaron en Expo (ver la fila de assets de marca).

### Qué se entregó

| Qué                                                                                                                                                                                                                                       | Tarea  | Commits / dónde                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Versiones de la Fase 3 verificadas con Context7 y npm (Expo SDK 58, MMKV, TanStack Query, tests, lint) y las decisiones que le piden a la fase                                                                                            | 3.1    | `2840b3e` · [`versiones.md`](versiones.md)                                                                                        |
| Scaffold de `apps/mobile`: Expo SDK 58, TypeScript estricto, ESLint, Jest + RNTL 14, `expo-dev-client`, `eas.json` (development, development-simulator, preview, production)                                                              | 3.2    | `ba07191` · [`../apps/mobile/README.md`](../apps/mobile/README.md)                                                                |
| Tokens Obelisco con cita (claro + oscuro derivado, contrastes verificados en tests) y `ThemeProvider` Sistema / Claro / Oscuro                                                                                                            | 3.3    | `49477a6`, `ff2b820` · `apps/mobile/src/shared/theme/`                                                                            |
| Fuentes Nunito y Open Sans (6 pesos) con `useFonts` y splash que se oculta también si falla la carga                                                                                                                                     | 3.4    | `5cc647b` · `apps/mobile/src/shared/fonts/`                                                                                       |
| Mapa curado de 45 usos sobre 42 SVG de `@material-symbols/svg-400` 0.48.2 (verificados con HTTP 200) y componente `Icon` con `react-native-svg-transformer`                                                                               | 3.5    | `90bd1dd`, `39fd932` · `apps/mobile/src/shared/icons/`                                                                            |
| `DESIGN.md` escrito a mano (el skill Impeccable no estaba disponible): color claro/oscuro, tipografía, forma, íconos, componentes, voz y accesibilidad                                                                                    | 3.6    | `063e984` · [`../DESIGN.md`](../DESIGN.md)                                                                                        |
| 15 componentes de `shared/ui` (Alert, Badge, Button, Card, Chip, EmptyState, ErrorState, FreshnessLabel, LineBadge, OfflineBanner, SearchInput, SegmentedControl, Skeleton, StatusChip, Text) con háptica, 44×44 y etiquetas de accesibilidad | 3.7    | `ff2b820`, `76e957f` · `apps/mobile/src/shared/ui/`                                                                               |
| Navegación con Expo Router: 4 tabs nativas (Inicio, Colectivos, Subtes, Favoritos; Tránsito oculto), Ajustes y Acerca de como stack desde Inicio, safe areas y back nativo                                                                | 3.8    | `c6b141a`, `403ff05`, merge `f38f545`                                                                                             |
| Cliente API tipado con Zod y los esquemas de `@transportate/contracts` (ETag/304, timeout, errores tipados), un hook por recurso, `QueryClient` con `focusManager`/`onlineManager`, polling con jitter solo en primer plano y persister   | 3.9    | `0060a54`, `569c1fe`, `1f6228d`, `aa61686` · `apps/mobile/src/shared/api/`, `src/shared/query/`                                   |
| `KeyValueStore` sobre MMKV, `FavoritosRepository` (alta, alias, reorden, borrado + restore, migración de esquema) y stores de tema e intervalo de refresco                                                                                | 3.10   | `b7fa68a`, `62fda41`, `d5a768c` · `apps/mobile/src/shared/storage/`, `src/features/favoritos/`                                   |
| Tests de integración (providers, tema, favoritos, componentes) y documentación: `07-app.md`, `08-design-system.md` completo y la sección de la app en `09-testing.md`                                                                     | 3.11   | `030c116`, `12324c3` · [`07-app.md`](07-app.md), [`08-design-system.md`](08-design-system.md), [`09-testing.md`](09-testing.md)   |
| Assets de marca de la sesión Dev Images (`design/brand/`: ícono iOS, adaptativo Android con monocromo, splash claro/oscuro, notificación, `mark.svg` y `generate.py`) enchufados en Expo: `icon`, `android.adaptiveIcon`, plugin `expo-splash-screen` y copias en `apps/mobile/assets/images/`; test de configuración (`app-config.test.ts`); `expo-doctor` 20/20 y `expo export --platform ios` OK | 3.2 (cierre) | `32da02b` (`design/brand/`) y el commit de la configuración · [`../design/brand/README.md`](../design/brand/README.md), [`../apps/mobile/README.md`](../apps/mobile/README.md#assets) |
| Marca definitiva **Subte conectado** (alternativa B elegida por el usuario entre tres propuestas de Dev Images con colectivo, subte y tren): set completo en `design/brand/` y copias en `apps/mobile/assets/images/`; `alternativas/` queda como registro | 3.2 (marca) | `51a16ff` (alternativas), `deb7989` (set) y el commit de las copias · [`../design/brand/README.md`](../design/brand/README.md), [`../design/brand/alternativas/README.md`](../design/brand/alternativas/README.md) |
| Ajustes transversales: condición `default` en los `exports` de `packages/contracts` para Jest; tope de CPU del proxy robusto ante carga; `OfflineBanner` con rol `alert`                                                                  | varias | `4ecde8f`, `4e86fb6`, `19092c1`                                                                                                   |

### Decisiones técnicas

1. **Tabs nativas (`NativeTabs` de `expo-router/native-tabs`)** en lugar de `Tabs` de JS: la barra nativa de cada plataforma, en línea con la plataforma "adaptive" de `PRODUCT.md`.
2. **Lint de la app:** config raíz con ESLint 10 más `eslint-plugin-react-hooks` 7.1.1. Sin `eslint-plugin-react` ni `eslint-config-expo`: el primero falla bajo ESLint 10 (`getFilename is not a function`, probado el 2026-11-02) y el segundo depende de él ([`versiones.md`](versiones.md)).
3. **Tests con RNTL 14:** asíncrono (`await render`, `await fireEvent`), `test-renderer` en lugar de `react-test-renderer` y matchers integrados (sin `@testing-library/jest-native`, deprecado).
4. **`hoistPattern` sin `@types/jsdom`** en `pnpm-workspace.yaml`: `jest-expo` lo trae y, si se iza, los tipos de Vitest lo encuentran y meten `lib.dom` en el typecheck del proxy, que rompe `caches.default` de Workers.
5. **`useFonts` en lugar del config plugin de `expo-font`:** con el plugin el nombre de familia difiere entre iOS y Android; con `useFonts` es el mismo (`Nunito_700Bold`, …) en iOS, Android y Jest, y coincide con `DESIGN.md` §3.
6. **MMKV 4 con `react-native-nitro-modules` 0.37.1** como dependencia directa (una sola copia). En Jest, MMKV usa su mock en memoria y `jest.setup.ts` reemplaza Nitro por un stub, porque busca el TurboModule nativo al importarse.
7. **Persister asíncrono de TanStack Query con adaptador MMKV:** `createSyncStoragePersister` está deprecado; el asíncrono acepta un storage cuyos métodos son síncronos. Clave `transportate.query-cache.v1`, `buster` `v1`, `maxAge` y `gcTime` de 24 h.
8. **Condición `default` en los `exports` de `@transportate/contracts`:** `jest-expo` resuelve con `require`/`default` y no encontraba el paquete, que solo exportaba `import`. `default` apunta al mismo ESM de `dist`.
9. **Mock global de NetInfo** en `jest.setup.ts` (siempre conectado): el módulo busca su implementación nativa y, sin ella, tira.
10. **`react-native-svg-transformer` 1.5.3** para importar los `.svg` como componentes (SVGR + SVGO); el mapa importa cada archivo de forma explícita, así que Metro empaqueta solo los 42 del mapa. En Jest cada `.svg` se reemplaza por un `View` con `testID`.
11. **`Icon` toma su color del tema** (`colors.text.primary` por default) en lugar de un color fijo. La estrella de "no es favorito" es la única excepción a FILL 1 (`rounded/star.svg`).
12. **Tope de CPU del proxy con el mínimo de 11 corridas** en frío, en lugar de la mediana: la carga de la máquina solo suma tiempo, así que el mínimo estima el CPU propio. No se saltea por `loadavg`, porque corre en workerd y escondería regresiones en CI.
13. **Tema e intervalo de refresco persistidos en MMKV** desde el layout raíz (`aa61686`), con valores guardados inválidos que caen al default (Sistema / 20 s).
14. **Los assets de marca los commiteó el coordinador**, no la sesión que los generó (Dev Images, con Codex): el sandbox de Codex no puede escribir el índice de Git ni correr el CLI de Orca. Por eso el commit `32da02b` lo hizo el coordinador, y esa sesión avisó con `LISTO <hash>` en la terminal en lugar de mandar `worker_done` por Orca (así lo pedía su brief).
15. **`ios.icon` simple:** no se declara el objeto `{ light, dark, tinted }` aunque el SDK 58 lo soporta, porque la marca no trae esas variantes; iOS toma el `icon` de nivel superior.
16. **`@types/node` en `apps/mobile`** (24.9.2, la misma del lockfile) solo para el test de configuración, con autorización del coordinador; no se tocó el `tsconfig.json`.

### Números

| Paquete               | Tests (2026-11-02)                    | Notas                                                                                                                                   |
| --------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`  | 67                                    |                                                                                                                                         |
| `apps/proxy`          | 87 (86 corren, 1 `skipped`)           | Dentro de workerd                                                                                                                       |
| `apps/mobile`         | 278 en 25 suites                      | Jest con `jest-expo` + RNTL 14                                                                                                          |
| **Monorepo** | **432**                               | Más los 79 de `tools/gtfs`, que están fuera del workspace                                                                               |

Cobertura de `apps/mobile` (informativa, sin umbral): 3.11 anotó 93,2 % statements, 88,2 % branches, 86,9 % funciones y 94,8 % líneas; recorrida al cierre con 3.9 integrada: 93,2 / 87,3 / 87,8 / 94,9.

### Riesgos abiertos que pasan a Fase 4

- **Primer dev build de iOS compilado el 2026-11-03** (EAS, perfil `development`, distribución interna, build `ece33dd7`, 5 min, sin errores): confirma que `react-native-mmkv` 4.3.2 con Nitro 0.37.1, NetInfo y `NativeTabs` compilan en RN 0.88. Falta la prueba funcional en el iPhone (MMKV en ejecución, 304 con `NSURLCache`, tabs, fuentes, tema e ícono).
- ~~**`eas login` y proyecto en expo.dev**~~: resuelto el 2026-11-02 (sesión `nhsiciliano`, proyecto `@nhsiciliano/transportate`, repo remoto `github.com/nhsiciliano/transportate-app`). Primer build de iOS en dispositivo hecho el 2026-11-03 (ver riesgos).
- **Las pantallas todavía no consumen los hooks** de `shared/api`: el cliente, los hooks y el polling están probados con `fetch` mockeado, pero ninguna pantalla los usa. La integración real contra el proxy llega con las features.
- **Tests sensibles a la carga de la máquina:** con la máquina muy cargada (load average > 20, otros workers corriendo) se vieron timeouts de 5 s en `apps/proxy` (`health`, `edge-cached`) y en varios tests de UI de `apps/mobile` al correr `pnpm test` desde la raíz con todo en paralelo. Los mismos tests pasan al correr cada paquete solo.
- **`forecastGTFS` sigue congelado:** los arribos de subte llegan vacíos con `stale` hasta que el upstream se descongele.
- Heredados de la Fase 2: sin despliegue a `preview` (requiere `wrangler login` del usuario), Cache API sin efecto en `*.workers.dev` y aprendizaje de paradas pendiente de ADR-0007.

### Pendiente de decisión del usuario

- ~~Identificador nativo `app.transportate.mobile`~~: confirmado por el usuario el 2026-11-02.
- ~~Ícono de la app~~: el usuario descartó el Obelisco con franja, Dev Images produjo tres alternativas (`design/brand/alternativas/`) y el usuario eligió la **B, "Subte conectado"** el 2026-11-02; el set completo reemplazó a la marca anterior en `design/brand/` y en `apps/mobile/assets/images/`.
- Validar [`DESIGN.md`](../DESIGN.md) y sus suposiciones marcadas.
- La estrella de "no es favorito" con el glifo de contorno (FILL 0), excepción a FILL 1.
- Los topes de escala de fuente: 1,3 en texto corrido y 1,2 en títulos y etiquetas de controles.
- Licencia del proyecto (el README raíz dice "a definir").
- ADR-0006 (paradas de colectivo) y ADR-0007 (aprendizaje de paradas), que siguen como **Propuestas**.
- Siguen abiertas las suposiciones S1–S33 y decisiones N1–N4 de `briefs/README.md`.

### Validación del usuario

- **Validado por:** usuario, 2026-11-03, en iPhone con el dev build `ece33dd7` de EAS y Metro + `wrangler dev` en la red local: la app arranca, las tabs nativas y las pantallas placeholder funcionan. Decisiones: id nativo `app.transportate.mobile` confirmado; marca **Subte conectado** (alternativa B) aceptada; sin fallback de MMKV para Expo Go (se prueba siempre con dev build). Pasa a Fase 4.

## Fase 4 — Features · **completada técnicamente, pendiente de validación del usuario**

_Iniciada el 2026-11-03; cierre técnico el 2026-11-03._ Coordinación con Orca (Run `run_6bc551486d73`), mismas sesiones que la Fase 3 (`low-dev`, `mid-dev`, `high-dev`). La tarea 4.1 (Impeccable) se reemplaza por un brief operativo en el README de cada feature, porque el skill no está disponible; la 4.8 (Tránsito) sigue diferida.

### Integrado en `main`

| Qué | Tarea | Worker | Commits / docs |
| --- | --- | --- | --- |
| Dependencias nativas de la fase en un solo commit: `@maplibre/maplibre-react-native` 11.5.1, `expo-location` 58.0.20 (permiso solo "mientras se usa", texto en voseo), `react-native-reanimated` 4.7.1 + `react-native-worklets` 0.13.0, `react-native-gesture-handler` 3.3.0; mocks de Jest; sheet nativa `formSheet` en lugar de `@gorhom/bottom-sheet`; `react-native-reorderable-list` elegida para 4.9 (puro JS, se instala en 4.9) | 4.0 (previa a 4.3/4.6/4.7/4.9) | high-dev | merge de `nhsiciliano/High-Dev` · [`../apps/mobile/src/shared/map/README.md`](../apps/mobile/src/shared/map/README.md), [`versiones.md`](versiones.md) |
| Ajustes (tema, intervalo, índice estático, limpiar datos, borrar favoritos con diálogo nativo y Deshacer), Acerca de (atribución CC-BY-2.5-AR, "no es app oficial", privacidad, mapa, diseño), Licencias de terceros (`scripts/licencias.mjs` → `licencias.json`), `Snackbar`/`SnackbarProvider` compartido, 42 tests | 4.10 | low-dev | merge de `nhsiciliano/Low-Dev` · [`../apps/mobile/src/features/ajustes/README.md`](../apps/mobile/src/features/ajustes/README.md), [`07-app.md`](07-app.md) |
| Subtes completa: raíz (7 líneas, búsqueda de estaciones, "Ver mapa"), línea (alertas completas, diagrama de estaciones), estación (arribos por sentido, S30); `shared/static` con `useStaticArchivo` (versión por manifiesto y última versión conocida en MMKV); `FavoriteToggle` reutilizable; `OfflineBanner` global; suposiciones `F4-subtes-1…7` | 4.2, 4.11, 4.12 | mid-dev | merge de `nhsiciliano/Mid-Dev` · [`../apps/mobile/src/features/subtes/README.md`](../apps/mobile/src/features/subtes/README.md), [`07-app.md`](07-app.md) §14–15 |
| Favoritos base: lista síncrona desde MMKV, modo edición (alias con contador, quitar con Deshacer, Mover arriba/abajo accesible), búsqueda con más de 15, vacío; slots `liveData` y `dragHandle` para mid-dev y high-dev; suposiciones `F4-favoritos-1…8` | 4.9 (base) | low-dev | merge de `nhsiciliano/Low-Dev` · [`07-app.md`](07-app.md) §16 |
| Inicio de producción: large title, Alert destacada (1, varias o las 7 líneas interrumpidas), 7 filas fijas con skeleton y ErrorState dentro del bloque, 5 favoritos con "Ver todos (N)", pull to refresh; `useFavoritoLiveData`/`FavoritoLiveData` por tipo reutilizando las queries de cada feature; suposiciones `F4-inicio-1…6` | 4.4 | mid-dev | merge de `nhsiciliano/Mid-Dev` · [`../apps/mobile/src/features/inicio/README.md`](../apps/mobile/src/features/inicio/README.md), [`07-app.md`](07-app.md) §17 |
| `shared/map` (MapView sobre MapLibre 11 con estilo positron/dark según el tema, atribución, controles de 48 pt, Reducir movimiento, franja para el gesto de volver) y mapa de la red de subte en `/subtes/mapa` (trazos con colores GTFS y contorno del tema, estaciones, navegación); `GestureHandlerRootView` en el layout raíz; esquema GeoJSON mínimo en `@transportate/contracts` y `client.staticGeoJson`; N2 resuelta; suposiciones `F4-mapa-1…7` | 4.3 | high-dev | merge de `nhsiciliano/High-Dev` · [`../apps/mobile/src/shared/map/README.md`](../apps/mobile/src/shared/map/README.md), [`07-app.md`](07-app.md) |
| `features/ubicacion` (`useUbicacion` sobre `expo-location`, posición solo en memoria, `isInsideCaba`, `distanceMeters`, `PermisoUbicacionBloque`), fila Ubicación en Ajustes, colores de subte y favorito huérfano en Favoritos, datos vivos conectados en las filas visibles con `FreshnessLabel` global y pull to refresh; `09-testing.md` al día; suposiciones `F4-ubicacion-1…6`, `F4-favoritos-9…12` | 4.7 (base), 4.9, 4.11 | low-dev | merge de `nhsiciliano/Low-Dev` · [`07-app.md`](07-app.md), [`09-testing.md`](09-testing.md) |
| Colectivos sin mapa: índice grande por archivo en MMKV (`useStaticArchivoGrande`, descarga XHR con progreso, una versión por archivo, también `.geojson`), raíz con "Preparando el listado…" y barra, búsqueda local con ranking, paradas cercanas (bbox + haversine, permiso en contexto, fuera de CABA), líneas recientes, parada con arribos solo si existen, progreso en `IndiceRow`; suposiciones `F4-colectivos-1…7` | 4.5, 4.7 | mid-dev | merge de `nhsiciliano/Mid-Dev` · [`../apps/mobile/src/features/colectivos/README.md`](../apps/mobile/src/features/colectivos/README.md), [`07-app.md`](07-app.md) |
| `headerLargeTitleEnabled` en Subtes (opción vigente), Alert única "El servicio de la Ciudad no responde" en Favoritos cuando todas las filas visibles fallan con error reintentable, guía de prueba manual en dispositivo (`11-prueba-manual.md`); suposición `F4-favoritos-13` | 4.11, 4.12 | low-dev | merge de `nhsiciliano/Low-Dev` · [`11-prueba-manual.md`](11-prueba-manual.md) |
| Reconciliación: Colectivos usa `features/ubicacion` (`useUbicacion({ watch: false })`, `checked`/`positionUnavailable` nuevos), un solo criterio de huérfano en `useFavoritoLiveData` para los cuatro tipos; suite completa de la app en una corrida (561 tests en 55 suites, también con `--randomize`); `07-app.md` §20 "Estado al cierre de la Fase 4", `09-testing.md` y `03-arquitectura.md` §6 al día | 4.12 | mid-dev | merge de `nhsiciliano/Mid-Dev` · [`07-app.md`](07-app.md) |
| Limpieza tras la reconciliación: prop `orphan` muerta e `isOrphanColectivo` eliminados, READMEs de `ajustes`, `favoritos` y `ubicacion` y comentarios viejos al día | 4.12 | low-dev | merge de `nhsiciliano/Low-Dev` |
| Línea de colectivos con mapa en tiempo real (`/colectivos/[linea]`): recorrido aproximado punteado, paradas desde zoom 14, vehículos atenuados por S31 y agrupados con más de 80, `BottomPanel` propio con tres alturas, "Seguir" un vehículo, selector de ramal y lista accesible; `MapView` suma `location`, `bottomOffset` y `centerOn`. Reorden por arrastre en Favoritos con `react-native-reorderable-list` 0.18.3 (JS puro) y su mock de Jest; suposiciones `F4-colectivos-mapa-1…11` | 4.6, 4.9 (arrastre) | high-dev | merge de `nhsiciliano/High-Dev` · [`07-app.md`](07-app.md) §16 y §21, [`../apps/mobile/src/features/colectivos/README.md`](../apps/mobile/src/features/colectivos/README.md) |

### Hallazgos

- Los tipos generados de rutas (`.expo/types/router.d.ts`, gitignored) quedan viejos cuando se agrega una ruta desde otro worktree y rompen `tsc` en el worktree del coordinador: se borran y `expo start` los regenera.
- El `dist` de `@transportate/contracts` lo genera `prepare` (`tsc -p tsconfig.build.json`) y `pnpm install` no lo regenera si el lockfile no cambió. Tras traer esquemas nuevos (GeoJSON) fallaban suites sin ningún test en rojo hasta correr `pnpm exec tsc -p tsconfig.build.json` en `packages/contracts` (anotado en `09-testing.md`).
- Con la máquina muy cargada (load average 25–70 con tres workers corriendo Jest a la vez), `integracion`, `navegacion`, `layout` y las pantallas que montan el router real de `apps/mobile` superan el timeout; pasan solos. Sigue siendo un riesgo de CI (ver Fase 3).
- Tras integrar Colectivos (mid-dev) sobre la Favoritos de low-dev, 1 test de `FavoritosScreen.test.tsx` falló en `main` por los dos criterios de huérfano (`status: 'orphan'` del dato vivo y `isOrphan` de la fila): lo unificó la reconciliación de mid-dev.
- Al cierre, la corrida completa de la app dio un único fallo transitorio en `test/subtes/static.test.tsx` (8 s, con carga moderada); suelto pasa 8/8 y la suite entera pasó 600/600 en la corrida siguiente.
- La bitácora tenía un bloque duplicado (Fases 1 a 3 y una versión vieja de la Fase 4 pegados después de "En curso"), producto de una mala fusión de ediciones desde varios worktrees; se quitó al cerrar la fase y quedó una sola copia de cada sección.

### Decisiones técnicas

1. **Dependencias nativas de toda la fase en un solo commit (tarea 4.0) y un solo rebuild del dev client:** MapLibre 11.5.1, `expo-location` 58.0.20, Reanimated 4.7.1 + Worklets 0.13.0 y Gesture Handler 3.3.0 se instalaron juntas, con las versiones de `bundledNativeModules.json` del SDK 58 (`versiones.md`). Así el dev client del iPhone se reconstruye una vez por ola y no por feature. Sin `babel.config.js`: `babel-preset-expo` agrega el plugin de Worklets solo.
2. **Panel propio en el mapa de línea en lugar de la `formSheet` nativa o `@gorhom/bottom-sheet`:** el plan era la `formSheet` de Expo Router, pero es una ruta modal y su gesto choca con el "volver" del stack (F4-colectivos-mapa-1). El detalle de línea usa `BottomPanel` (`shared/map`, Gesture Handler + Reanimated, tres alturas, botón accesible en la manija) y no suma dependencias. La `formSheet` sigue vigente en el alias de Favoritos (`Modal` `formSheet` de React Native) y como referencia para detalles pasajeros.
3. **Archivos grandes del estático por archivo en MMKV, fuera del persister de TanStack Query:** `paradas.json` (1,7 MB) y `recorridos-colectivos.geojson` (742 KB) no entran en la caché de 24 h. `useStaticArchivoGrande` los baja con XHR y progreso, guarda una versión por archivo y los vuelve a bajar solo si el manifiesto trae otra. Los archivos chicos (`subte-*.json`) siguen en `useStaticArchivo` con "última versión conocida".
4. **Un solo criterio de favorito huérfano:** lo decide `useFavoritoLiveData` (`status: 'orphan'`) para los cuatro tipos (subte contra el estático, línea de colectivo contra las líneas vigentes del proxy, parada contra el índice). La pantalla solo lee ese estado; `resolveFavorito` queda para el color de la insignia y para subte.
5. **Ubicación única y solo en memoria (`features/ubicacion`):** `request()` solo desde una acción de la persona (S32), `watch` solo en primer plano, la posición nunca va a MMKV ni a la caché de consultas. `isInsideCaba` usa el bbox de `01b-gtfs-alternativos.md` (rectángulo, no polígono). Colectivos usa `useUbicacion({ watch: false })`.
6. **Impeccable reemplazado por un brief operativo en el README de cada feature (tarea 4.1):** el skill no estaba disponible. Cada feature tiene qué muestra, estados con copy en voseo y suposiciones numeradas `F4-<feature>-n` antes del código.
7. **`headerLargeTitleEnabled` en lugar de `headerLargeTitle`:** la segunda está marcada `@deprecated` en los tipos de Expo Router 58; Inicio ya usaba la vigente y se corrigió Subtes.
8. **`react-native-reorderable-list` 0.18.3 para el arrastre (4.9):** puro JS (sin rebuild), con peers que cumplen Reanimated 4.7.1 y Gesture Handler 3.3.0. En Jest necesita un mock propio (`test/mocks/reorderable-list.tsx`): llama a `useAnimatedRef()` como función y Reanimated en Jest devuelve un objeto. "Mover arriba/abajo" sigue como vía accesible.
9. **Mapa de subte con los colores del GTFS y contorno del tema (N2 resuelta):** no se usa el celeste de señalética; cada trazo lleva un contorno `text.primary` y la letra de la línea, para que el color no sea la única pista (WCAG 1.4.11). Estilos de OpenFreeMap: `positron` en claro y `dark` en oscuro, con atribución propia siempre visible.
10. **Colectivos sin sentido y con recorrido aproximado:** el feed de posiciones no informa el sentido, así que se muestran los vehículos de todo el ramal con una nota y el selector es de ramal; el recorrido es el del número (punteado) y el "interno" es el `id` del vehículo (la patente no se muestra). Con más de 80 vehículos se agrupan hasta zoom 13.
11. **`OfflineBanner` global arriba del `Stack`:** una sola vez en toda la app; el banner ocupa el margen superior y el `Stack` recibe un `SafeAreaInsetsContext` con `top: 0` para no sumarlo dos veces.
12. **Premetro es una sola fila** con clave `PM` (estado: el más severo de `PM-C` y `PM-S`); sus estaciones exclusivas llevan el ramal.
13. **`Snackbar` compartido con el provider dentro de cada pantalla** (Ajustes, Favoritos): el "Deshacer" vale mientras la persona siga en la pantalla. Superficie inversa con `text.primary`/`text.inverse`, porque no hay token propio.
14. **Alert única de servicio caído en Favoritos:** aparece solo si TODAS las filas visibles con dato vivo fallan por un error reintentable. Como `useFavoritoLiveData` no expone el error, se lee del estado de la query de cada fila (`servicio.ts`) en lugar de modificar el hook.
15. **Tests independientes del orden y del timing:** la suite de la app corre completa y con `--randomize`; los mocks nativos con estado (`locationMock`, refs del mapa) se reinician en `setupFilesAfterEnv`, y los tests que montan el router real llevan `jest.setTimeout(30_000)`.
16. **Licencias de terceros generadas:** `scripts/licencias.mjs` recorre las `dependencies` directas y escribe `licencias.json` (47 KB, determinista); hay que regenerarlo cuando cambian las dependencias. No incluye las transitivas.

### Números

| Paquete | Tests (2026-11-03) | Notas |
| --- | --- | --- |
| `packages/contracts` | 74 (+ 2 `skipped`) en 3 archivos | Suman los esquemas GeoJSON |
| `apps/proxy` | 86 (+ 1 `skipped`) en 11 archivos | Dentro de workerd |
| `apps/mobile` | **600 en 59 suites** | Jest con `jest-expo` + RNTL 14. Corrida completa en verde; en la primera de la tarde hubo un fallo transitorio por tiempo en `test/subtes/static.test.tsx` |
| **Monorepo** | **760 corren** (3 `skipped`) | Más los 79 de `tools/gtfs`, que están fuera del workspace. En la Fase 3 eran 432 |

Corridas por paquete (`pnpm --filter … test` y `pnpm exec jest --ci`), de a una, porque con la máquina cargada la corrida desde la raíz da timeouts. `lint`, `typecheck` y `format:check` están en verde desde la raíz. La cobertura de `apps/mobile` no se volvió a medir (informativa y sin umbral; la última, de la Fase 3, fue 93,2 % statements).

### Riesgos abiertos que pasan a Fase 5

- **Nada de lo nuevo de esta fase se probó en el iPhone:** el panel del mapa de línea contra los gestos del mapa, el "volver" por el borde izquierdo con el mapa, los dos estilos del mapa, el permiso de ubicación pedido en contexto, la `formSheet` del alias, el `Snackbar` sobre la tab bar nativa, el banner offline sin hueco bajo el header, el arrastre con háptico y la descarga del índice con red lenta. Hay un segundo dev build lanzado en EAS (`cabc9c80`) con las dependencias nativas nuevas; el comportamiento se valida con [`11-prueba-manual.md`](11-prueba-manual.md).
- **`forecastGTFS` sigue congelado** (desde 2026-10-24, solo líneas A, B, D y E): la estación muestra "No hay próximos trenes informados" con el dato viejo.
- **El proxy no está desplegado a `preview`** (requiere `wrangler login` del usuario), así que la verificación "contra el Worker desplegado" del plan se hizo contra `wrangler dev` en la red local. Cache API sigue sin efecto en `*.workers.dev`.
- **Tests sensibles a la carga de la máquina:** con la máquina cargada, `pnpm test` desde la raíz da timeouts en el proxy y en las pantallas que montan el router real; por paquete pasan. Es un riesgo de CI (tarea 5.7).
- **Cobertura de equivalencias de paradas:** las paradas de colectivo no muestran arribos (N4); lo que se pueda mostrar depende de la tabla de equivalencias `stop_id` aprendida y de la captura de 24–48 h prevista en ADR-0006/0007, que siguen como Propuestas.
- **Tiles de OpenFreeMap sin SLA:** son un servicio externo gratuito (y ve la IP y la zona, ver `05-privacidad.md`); el plan para autoalojar PMTiles en R2 está en `apps/mobile/src/shared/map/README.md`.
- **`react-native-reorderable-list` como dependencia JS extra** (0.18.3, publicada el 2026-11-01, versión 0.x): si se abandona o rompe con una versión nueva de Reanimated o Gesture Handler, el plan B es una implementación propia con esas dos librerías.
- **Sin audit nativo ni pruebas E2E:** la accesibilidad con VoiceOver/TalkBack, el modo avión y Dynamic Type grande solo se probaron por tests de RNTL; el `audit` de Impeccable y Maestro (o similar) son de la Fase 5.
- Heredados: licencias de terceros solo de dependencias directas; sin menú contextual con long press en Favoritos e Inicio; el "Deshacer" de Ajustes/Favoritos se pierde al salir de la pantalla.

### Correcciones tras la validación en el iPhone (2026-11-03)

El usuario probó la fase en el iPhone con el dev client `cabc9c80` (el primer intento corría todavía el build `ece33dd7`, sin `expo-location` ni MapLibre; se verificó con los logs de EAS y se reinstaló). Tres defectos, corregidos por el coordinador directamente en `main`, con tests primero y sin tocar código nativo (no hace falta rebuild):

| Defecto | Causa | Corrección |
| --- | --- | --- |
| Subtes › Línea: cada alerta repetía el texto (negrita con ícono y de nuevo en chico) | GCBA manda `header_text` y `description_text` iguales y sin período; `AlertaCompleta` descartaba la descripción repetida y rellenaba el mensaje vacío con el título | `message` pasa a opcional en `Alert`/`AvisoAlert`; la alerta muestra el título una sola vez y debajo solo la descripción si agrega algo (comparación con `trim` y sin mayúsculas) y el período. Tests en `LineaEstacion.test.tsx` y `Alert.test.tsx` |
| Colectivos › Línea: "Colectivos en servicio" no ordenaba por cercanía | `ordenarVehiculos` ordenaba a propósito por dato más reciente (F4-colectivos-mapa-11) y `vistaVehiculo` descartaba la distancia que ya calculaba para el texto | `VehiculoVista.metros`; con ubicación ordena por cercanía y desempata por dato reciente e interno; sin ubicación, el orden anterior. F4-colectivos-mapa-11 reescrita; tests en `lineaModel.test.ts` y `linea.test.tsx` |
| Favoritos: el header tapaba el contenido | Único tab raíz sin `headerLargeTitleEnabled`: en iOS 26 el header opaco se extiende sobre el contenido; el estado vacío era un `View` sin inset y la lista iba anidada en `View` → `GestureHandlerRootView` | Large title como en los otros tabs; estado vacío en un `ScrollView` con `contentInsetAdjustmentBehavior`; la lista pasa a ser la raíz de la pantalla (la raíz de RNGH ya está en `app/_layout.tsx`). Verificación en dispositivo (no se reproduce en Jest) |

**Impeccable:** el usuario pidió saber por qué "no estaba disponible". El marketplace `impeccable` (`pbakaus/impeccable` 4.8.0) está registrado y clonado en `~/.claude/plugins/marketplaces/impeccable` desde el 2026-11-01 (y el motor del launcher descargado), pero el **plugin nunca se instaló**: no figura en `installed_plugins.json` ni en `enabledPlugins` de ninguna configuración. Por eso ni el coordinador ni los workers ven `/impeccable`. En la Fase 1 se usó leyendo las referencias directo del clon. Pendiente de decisión del usuario: instalarlo con `/plugin install impeccable@impeccable` (alcance user, para que lo vean también los worktrees de los workers) antes de la Fase 5. Para estas correcciones se leyó `craft-floor.md` desde el clon.

### Pendiente de decisión del usuario

- **Validar la fase en el iPhone** con el dev client siguiendo [`11-prueba-manual.md`](11-prueba-manual.md) y pasar las fallas con el formato del último bloque de esa guía. Primera pasada hecha el 2026-11-03 (ver "Correcciones tras la validación"); falta volver a probar los tres puntos corregidos.
- **Instalar Impeccable** (`/plugin install impeccable@impeccable`, alcance user) antes de la Fase 5, que lo usa en 5.1, 5.2 y 5.4.
- **Aceptar o corregir las suposiciones `F4-*`** de cada feature, que están en el README de cada una:
  - Ajustes y Acerca de: `F4-ajustes-1…9` en [`features/ajustes/README.md`](../apps/mobile/src/features/ajustes/README.md).
  - Favoritos: `F4-favoritos-1…13` en [`features/favoritos/README.md`](../apps/mobile/src/features/favoritos/README.md).
  - Ubicación: `F4-ubicacion-1…6` en [`features/ubicacion/README.md`](../apps/mobile/src/features/ubicacion/README.md).
  - Subtes: `F4-subtes-1…7` en [`features/subtes/README.md`](../apps/mobile/src/features/subtes/README.md).
  - Inicio: `F4-inicio-1…6` en [`features/inicio/README.md`](../apps/mobile/src/features/inicio/README.md).
  - Colectivos: `F4-colectivos-1…7` y `F4-colectivos-mapa-1…11` en [`features/colectivos/README.md`](../apps/mobile/src/features/colectivos/README.md).
  - Mapa: `F4-mapa-1…7` en [`shared/map/README.md`](../apps/mobile/src/shared/map/README.md).
- **`wrangler login`** para desplegar el proxy al entorno `preview` y repetir la verificación contra el Worker desplegado.
- Decisiones abiertas heredadas: la **licencia del proyecto** (el README raíz dice "a definir"), **ADR-0006** (paradas de colectivo) y **ADR-0007** (aprendizaje de paradas), que siguen como Propuestas, y si Acerca de lleva un **contacto** o "reportar un problema" (F4-ajustes-3).
- Siguen abiertas las suposiciones S1–S33 y decisiones N1 y N4 de `briefs/README.md` (N2 y N3 están resueltas).

**Fase 4 completada técnicamente el 2026-11-03; pendiente de validación del usuario.** La tarea 4.8 (Tránsito) sigue diferida por falta de fuente de cortes (N3) y la 4.1 se resolvió con un brief operativo por feature en lugar de Impeccable.

## Fase 5 — Pulido y escalado · **5.0 rediseño integrado en `main`, pendiente de validación visual del usuario**

La fase arrancó por una tarea que no estaba en el plan original: el usuario pidió un **rediseño con Impeccable** antes del pulido (tarea 5.0 en `00-plan.md`). Lo demás de la fase (5.1–5.7) sigue sin iniciar.

### Dirección (2026-11-03)

- Impeccable instalado por fin (alcance local: solo el repo principal; los worktrees leen las referencias por ruta absoluta). Ronda de dirección con `concept-seed` (seed `2db0aa292d67ea2e`, modo Operate). El usuario fijó de antemano: paleta Obelisco v2 intacta, Material Symbols fijos, tipografía libre, navegación cambiable.
- La tirada asignó «Boleto y SUBE»; el usuario eligió la retadora **«Señalética de terminal»** (señalética de aeropuerto traducida al azul y navy de Obelisco): bandas de señal con una decisión por banda, pictograma blanco en cuadrado, flecha clavada al borde, minutos monumentales, Fira Sans. Bocetos de la ronda en `apps/mobile/.impeccable/mocks/decision/` (commit d79a53f).
- Regla del modo Operate que gobernó todo: el mundo aporta **solo tipografía, paleta, densidad y un movimiento firma**; tabs, headers, gesto de volver y controles del sistema no cambian.

### Piloto en Inicio (F5-HIGH-A, high-dev, 2026-11-03)

Commits 8b295c6…d7fd87f: Fira Sans 0.4.1 como única familia (Nunito y Open Sans fuera), `SignBand` (`lead`/`next`, fundido de 200 ms al cambiar la decisión, corte seco con Reducir movimiento), Inicio recompuesto (tira «Subte ahora», bandas de favoritos con la más cercana como líder solo si el permiso ya existe, fila de frescura). Contrato de dirección en `apps/mobile/.impeccable/surfaces/src-features-inicio-inicioscreen-tsx.md`. Decisión del coordinador F5-inicio-7: el cuadrado del pictograma en claro no llega a 3:1 contra las bandas y se mantiene como contenedor decorativo (el pictograma sí llega, 16,69:1). **El usuario lo probó en el iPhone el 2026-11-04 y lo aprobó**; las capturas para la revisión de cierre quedaron para después.

### Extensión al resto de la app (2026-11-04)

Base compartida del coordinador en `main` (02ed444): `Card` con radio 6 (antes 16), `SignBand` como señal fija sin flecha cuando no abre nada, y un **brief de superficie con contrato de dirección por tab** (`.impeccable/surfaces/`: Subtes, Colectivos, Favoritos, Ajustes). Reglas fijadas en los contratos: una banda es una decisión viva (arribo, estado, conteo); lo demás va en **placas de tablero** (`Board`: placa blanca, outline, radio 6, filas ≥ 56 pt con hairline); la flecha al borde solo donde hay destino; Ajustes con la restricción máxima (listas agrupadas del sistema, sin bandas ni pictogramas).

| Dispatch | Worker | Qué quedó | Commits |
| --- | --- | --- | --- |
| F5-HIGH-B | high-dev | `Pictogram`, `Board` (+ `Row` con `arrow`, `Status`, `Skeleton`, `separatorInset`) y slots `leading`/`trailing` de `SignBand`; **Subtes**: raíz como placa de tablero (7 líneas, estado a la derecha, resumen como nota, «Mapa de la red» como fila), línea con banda fija de estado y estaciones en placa con el trazo GTFS continuo, estación con una banda monumental por sentido («Próximo», «4 min», «Después 7 y 12 min») y estrella en el header; **Favoritos**: una banda `next` por favorito con el mismo contenido que Inicio (`features/favoritos/banda.ts`, Inicio importa de ahí), edición dentro de la banda (manija, «Quitar», texto → alias), huérfano sin flecha, fundido al entrar y salir de la edición | 7a053b3, 3fb46c9, 5bcd82d, 110e516, a45191f |
| F5-MID-B | mid-dev | **Colectivos**: panel de la línea como banda fija con el conteo a 56 pt (se vuelve a señalizar al elegir un vehículo), lista de vehículos como filas sin flecha, raíz con placas (cercanas con distancia a la derecha, recientes, resultados) y favoritos de colectivo como bandas, parada con estrella en el header, barrio y placa «Líneas que paran»; `PermisoUbicacionBloque` con `Pictogram` y prop `inset` | 7406a65, 1b4c3fc, b3d59e2, 24f9722 |
| F5-LOW-B | low-dev | **Ajustes** como lista agrupada en placas (encabezados 13/600, filas de 52 pt, chevron solo donde navega, destructiva en danger), **Acerca de** en lectura con el texto nuevo de «Diseño», **Licencias** en placa; docs de marca: `PRODUCT.md`, S23 y el plan ahora dicen Fira Sans | 7ab47dc, 2a0d81e, b4ada0c, 0abaee9 |

Merges en `main`: 7e4226b (low), 0b41821 (high), 6f20d03 (mid) y 7555e48 (limpieza del coordinador: `FilaTocable`/`Seccion` eliminadas, Colectivos importa `modeloBanda` de favoritos). Sin conflictos. Verificado por el coordinador sobre `main`: `lint`, `typecheck`, `format:check`, **707 tests en 66 suites en una sola corrida** y `expo export --platform ios` sin errores.

### Suposiciones nuevas

En los README de cada feature: `F5-inicio-1…8`, `F5-subtes-1…7`, `F5-favoritos-1…7`, `F5-colectivos-1…11`, `F5-ubicacion-1…3`, `F5-ajustes-1…10`. Las que conviene que el usuario mire primero:

- **F5-favoritos-2**: Favoritos ya no muestra el disco de color de la línea de subte; usa el pictograma por tipo, como Inicio.
- **F5-colectivos-6**: `Board.Row` no tiene `selected`; el vehículo elegido se marca con fondo `bg.pressed` y «Seleccionado» en la etiqueta. Candidato a prop compartido.
- **F5-ajustes-8**: el rojo de la fila destructiva mientras se toca da 4,03:1 (solo durante la pulsación).
- **F5-inicio-1**: la «decisión seguida de pantalla en pantalla» del contrato se resolvió por construcción: el detalle abre con la misma forma de banda arriba (línea, estación, línea de colectivos); Parada no lleva banda porque no tiene valor vivo (N4).
- La redacción del párrafo «Diseño» de Acerca de es provisional.

### Pendiente

1. **Validación visual del usuario en el iPhone** con `11-prueba-manual.md` (§1–§5 reescritos con la forma nueva, más §6–§8 transversales) y **capturas** de cada tab en claro, oscuro, Dynamic Type grande y vacío (la Mac no tiene CocoaPods ni runtime de simulador, así que no hay capturas locales).
2. Con las capturas: **finish review** (`impeccable-finish-reviewer`) contra los contratos y el boceto; correcciones; **documenter** para reescribir `DESIGN.md` desde lo construido (hoy DESIGN.md describe el sistema previo: Nunito/Open Sans, Card radio 16).
3. Decisiones abiertas: texto de «Diseño» en Acerca de; contacto o «Reportar un problema» (F4-ajustes-3); `Board.Row selected`.
4. Después, el resto de la fase (5.1–5.7).
