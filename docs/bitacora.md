# Bitácora

Resumen por fase: qué se hizo, decisiones, riesgos y qué queda. Cada fase se cierra acá antes de pasar a la siguiente (el plan exige frenar y validar al final de cada una).

## Fase 1 — Investigación · **completada, pendiente de validación del usuario**

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

## Fase 2 — Proxy · **completada, pendiente de validación del usuario**

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

## Fase 3 — Base de la app · **completada, pendiente de validación del usuario**

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

## Fase 4 — Features

_Iniciada el 2026-11-03._ Coordinación con Orca (Run `run_6bc551486d73`), mismas sesiones que la Fase 3 (`low-dev`, `mid-dev`, `high-dev`). La tarea 4.1 (Impeccable) se reemplaza por un brief operativo en el README de cada feature, porque el skill no está disponible; la 4.8 (Tránsito) sigue diferida.

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

### En curso

- mid-dev: reconciliación tras integrar (una sola ubicación con `features/ubicacion`, un solo criterio de huérfano), suite completa de la app en una corrida (4.12) y estado final de `07-app.md`.
- high-dev: 4.6 línea de colectivos con mapa en tiempo real + arrastre de 4.9 en Favoritos.
- low-dev: opción vigente del large title, Alert única de servicio caído en Favoritos y guía de prueba manual (`docs/11-prueba-manual.md`).

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

## Fase 2 — Proxy · **completada, pendiente de validación del usuario**

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

## Fase 3 — Base de la app · **completada, pendiente de validación del usuario**

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

## Fase 4 — Features

_Iniciada el 2026-11-03._ Coordinación con Orca (Run `run_6bc551486d73`), mismas sesiones que la Fase 3 (`low-dev`, `mid-dev`, `high-dev`). La tarea 4.1 (Impeccable) se reemplaza por un brief operativo en el README de cada feature, porque el skill no está disponible; la 4.8 (Tránsito) sigue diferida.

### Integrado en `main`

| Qué | Tarea | Worker | Commits / docs |
| --- | --- | --- | --- |
| Dependencias nativas de la fase en un solo commit: `@maplibre/maplibre-react-native` 11.5.1, `expo-location` 58.0.20 (permiso solo "mientras se usa", texto en voseo), `react-native-reanimated` 4.7.1 + `react-native-worklets` 0.13.0, `react-native-gesture-handler` 3.3.0; mocks de Jest; sheet nativa `formSheet` en lugar de `@gorhom/bottom-sheet`; `react-native-reorderable-list` elegida para 4.9 (puro JS, se instala en 4.9) | 4.0 (previa a 4.3/4.6/4.7/4.9) | high-dev | merge de `nhsiciliano/High-Dev` · [`../apps/mobile/src/shared/map/README.md`](../apps/mobile/src/shared/map/README.md), [`versiones.md`](versiones.md) |
| Ajustes (tema, intervalo, índice estático, limpiar datos, borrar favoritos con diálogo nativo y Deshacer), Acerca de (atribución CC-BY-2.5-AR, "no es app oficial", privacidad, mapa, diseño), Licencias de terceros (`scripts/licencias.mjs` → `licencias.json`), `Snackbar`/`SnackbarProvider` compartido, 42 tests | 4.10 | low-dev | merge de `nhsiciliano/Low-Dev` · [`../apps/mobile/src/features/ajustes/README.md`](../apps/mobile/src/features/ajustes/README.md), [`07-app.md`](07-app.md) |
| Subtes completa: raíz (7 líneas, búsqueda de estaciones, "Ver mapa"), línea (alertas completas, diagrama de estaciones), estación (arribos por sentido, S30); `shared/static` con `useStaticArchivo` (versión por manifiesto y última versión conocida en MMKV); `FavoriteToggle` reutilizable; `OfflineBanner` global; suposiciones `F4-subtes-1…7` | 4.2, 4.11, 4.12 | mid-dev | merge de `nhsiciliano/Mid-Dev` · [`../apps/mobile/src/features/subtes/README.md`](../apps/mobile/src/features/subtes/README.md), [`07-app.md`](07-app.md) §14–15 |
| Favoritos base: lista síncrona desde MMKV, modo edición (alias con contador, quitar con Deshacer, Mover arriba/abajo accesible), búsqueda con más de 15, vacío; slots `liveData` y `dragHandle` para mid-dev y high-dev; suposiciones `F4-favoritos-1…8` | 4.9 (base) | low-dev | merge de `nhsiciliano/Low-Dev` · [`07-app.md`](07-app.md) §16 |
| Inicio de producción: large title, Alert destacada (1, varias o las 7 líneas interrumpidas), 7 filas fijas con skeleton y ErrorState dentro del bloque, 5 favoritos con "Ver todos (N)", pull to refresh; `useFavoritoLiveData`/`FavoritoLiveData` por tipo reutilizando las queries de cada feature; suposiciones `F4-inicio-1…6` | 4.4 | mid-dev | merge de `nhsiciliano/Mid-Dev` · [`../apps/mobile/src/features/inicio/README.md`](../apps/mobile/src/features/inicio/README.md), [`07-app.md`](07-app.md) §17 |

### En curso

- mid-dev: 4.4 Inicio + datos vivos de favoritos (`FavoritoLiveData`).
- high-dev: 4.3 mapa de la red de subte sobre `shared/map` + `GestureHandlerRootView`.
- low-dev: `features/ubicacion` (hook sobre `expo-location`, bloque de permiso), fila Ubicación en Ajustes, colores de subte y huérfanos en Favoritos, `09-testing.md`.
- Coordinador: segundo dev build de iOS en EAS (`cabc9c80`) con las dependencias nativas nuevas.

### Hallazgos

- Los tipos generados de rutas (`.expo/types/router.d.ts`, gitignored) quedan viejos cuando se agrega una ruta desde otro worktree y rompen `tsc` en el worktree del coordinador: se borran y `expo start` los regenera.
- Con la máquina muy cargada (load average 40–65 con tres workers corriendo Jest a la vez), `integracion`, `navegacion` y `layout` de `apps/mobile` superan el timeout; pasan solos. Sigue siendo un riesgo de CI (ver Fase 3).

## Fase 5 — Pulido y escalado

_Sin iniciar._
