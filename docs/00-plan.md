# Plan maestro — Transportate

**Leyenda de dificultad:** 🟢 bajo · 🟡 medio · 🔴 alto

## Contexto

App móvil (iOS/Android) para ver en tiempo real colectivos, subtes y tránsito de CABA, sin cuentas ni datos personales, con favoritos locales. Repo vacío (solo commit inicial). Se trabaja por fases con validación al final de cada una, toda la documentación vive en `docs/`, y el diseño arranca para cientos de usuarios y escala a miles/millones sin reescribir.

Hallazgos de la investigación preliminar (solo lectura, a profundizar en Fase 1):

- **API Transporte GCBA.** Base `https://apitransporte.buenosaires.gob.ar`, auth por query `client_id`/`client_secret`. Endpoints confirmados por uso de terceros (no por doc oficial todavía): `/colectivos/vehiclePositions` (GTFS-RT pb), `/colectivos/vehiclePositionsSimple` (JSON, ~1.1 MB, ~3.200 vehículos), `/subtes/forecastGTFS`, `/subtes/serviceAlerts`, `/subtes/feed-gtfs`, `/transito/v1/cortes`. La consola oficial (`/console/`) es JS-rendered; hay que leerla en Fase 1 con el navegador. **Riesgo alto:** el portal data.buenosaires.gob.ar (actualizado 2026-06-17) dice que "todos los datasets con Formato API y GTFS están suspendidos, en revisión y corrección". El usuario tiene credenciales: Fase 1 verifica empíricamente qué responde hoy.
- **GTFS estático de colectivos pesa ~209 MB** (zip). No se procesa en un Worker: va preprocesado offline.
- **Obelisco v2.** Tokens en `src/styles/variables/` (SCSS) y `dist/styles.css`. **Corrección (Fase 1, tarea 1.5):** el HEAD del repo tiene dos identidades. La **vigente** (src + dist, lo que publica npm) usa primary `#1d3343`, secondary `#035c80`, tertiary `#009688` y tipografía Archivo + Open Sans; la **histórica** (`app/out`, export viejo del sitio de docs) usa primary `#336ACC` y Nunito. Decisión: colores de la identidad vigente; tipografía Nunito + Open Sans por mandato explícito del brief (desvío consciente, documentado en `docs/02-obelisco-tokens.md`) (reemplazadas por Fira Sans en la Fase 5). No define modo oscuro: se deriva (hecho en 1.6).

Versiones verificadas con Context7 (se reverifican al inicio de cada fase):

| Herramienta | Versión / dato verificado |
|---|---|
| Expo | SDK 58 (RN 0.88, React 19.3). New Architecture obligatoria desde SDK 55. Dev client vía `expo-dev-client` + `developmentClient: true` en `eas.json`. |
| `@maplibre/maplibre-react-native` | v11, solo New Arch, RN ≥ 0.80, config plugin en `app.json`; en producción hay que proveer tiles propios o de un proveedor. |
| `react-native-mmkv` | v4 sobre Nitro Modules (`react-native-nitro-modules`), API `createMMKV()`; persister de TanStack vía `@tanstack/query-async-storage-persister`. |
| TanStack Query | v5: `focusManager` con `AppState`, `onlineManager` con NetInfo, `refetchInterval`, backoff exponencial por defecto (1 s → 30 s). |
| Hono | v4: `cache()` middleware sobre Cache API, `wrangler types --env-interface CloudflareBindings` para tipar bindings. |

Respuestas del usuario: tiene credenciales de la API; cuenta Cloudflare en plan Free.

## Correcciones tras la Fase 1 (2026-11-01)

Resultado de la verificación empírica (`docs/01-api-transporte.md`) y de la bitácora. Lo que sigue **reemplaza** lo que diga el resto del plan cuando se contradigan:

- **Sí hay arribos de colectivos:** `/colectivos/tripUpdates` existe (no documentado) y se actualiza cada 60 s. Las tareas 2.6 y 4.7 pasan de "si la API lo permite" a "condicionado a un GTFS estático vigente" (el oficial es de 2021 y cruza solo 32 % de rutas / 40 % de paradas).
- **Arribos de subte bloqueados:** `forecastGTFS` congelado desde 2026-10-24. Tarea 4.2 implementa arribos detrás de un flag con detección de dato viejo; el estado por línea se deriva de `serviceAlerts?json=1` (el protobuf llega corrupto).
- **Cortes de tránsito:** `/transito/v1/cortes` devuelve 500. **Decisión del usuario (2026-11-01): el tab Tránsito se oculta por ahora.** Tareas 2.7 y 4.8 quedan **diferidas**; la navegación del MVP tiene 4 tabs (Inicio, Colectivos, Subtes, Favoritos). `TransitoAdapter` se escribe solo como stub vacío para conservar el patrón.
- **Trenes:** 404 en la API del GCBA. Fuera del MVP; **el 2026-11-05 el usuario decidió sumarlos en la Fase 6** con una fuente comunitaria de SOFSE consumida solo por el Worker (evaluación, cobertura y plan de salida en [`01d-api-trenes-sofse.md`](01d-api-trenes-sofse.md)).
- **Proxy:** TTL de 20–30 s para colectivos (cadencia real 60 s) y 15–30 s para alertas de subte; reintentos y último dato bueno obligatorios (1–9 % de fallos upstream); compresión en el Worker (upstream no comprime); nunca loguear la URL upstream (lleva el secret en la query).
- **Tokens Obelisco:** identidad vigente (`#1d3343`, `#035c80`, `#009688`) **confirmada por el usuario el 2026-11-01** + Nunito/Open Sans por mandato del brief (reemplazadas por Fira Sans en la Fase 5); paleta oscura ya derivada y verificada (tarea 1.6 hecha).
- **GTFS alternativo (tarea 1.11, hecha):** no existe un GTFS de colectivos vigente y público (API 2021, BA Data/Mobility Database 2019, Nación sin GTFS). Decisión técnica (`docs/01b-gtfs-alternativos.md`): líneas desde el propio tiempo real (`vehiclePositionsSimple`, unidas por empresa + número, nunca por `route_id`); paradas desde el dataset oficial BA "Colectivos: paradas" (2026, 7.027 paradas en CABA); arribos por parada solo donde exista una **tabla de equivalencias `stop_id` → parada** (semilla GTFS 2021 + aprendizaje desde `vehiclePositions`). **Cambia 2.10:** ya no procesa el GTFS de 209 MB sino paradas BA + `stops`/`shapes` del GTFS 2021 + tabla aprendida, y agrega un job de aprendizaje (lugar y costo a definir en Fase 2). **4.5** viable sin GTFS; **4.7** arribos parciales, ocultos en paradas sin equivalencia. Pendiente: ADR-0006 (paradas + licencia ODbL de OSM) y medir cobertura del aprendizaje con captura de 24–48 h al inicio de Fase 2.
- **Costos:** Free alcanza para ~1.100 usuarios activos (1 request por tick de 20 s, 30 min/día), no 300; la Cache API no reduce requests facturadas.
- **Sin `bearing`** en los feeds: tarea 4.6 no rota íconos por rumbo real (se puede derivar de posiciones sucesivas, opcional).

## Estado tras la Fase 2 (2026-11-02)

Fase 2 completada (ver `docs/bitacora.md`): proxy en `apps/proxy` con capa A, adaptadores reales de subtes y colectivos (arribos por parada incluidos), estáticos desde R2, rate limiting, ETag/304, 154 tests en el monorepo + 79 en `tools/gtfs`, prueba de carga sin errores, despliegue documentado (sin ejecutar: requiere `wrangler login` del usuario). Ajustes al plan: la tarea 2.10 produce ahora `indice-colectivos.json` para el proxy además de los archivos para la app; `TransitoAdapter` es un stub 503; ADR-0006 y ADR-0007 quedan como Propuestas a confirmar. Fase 3 arranca con la app (`apps/mobile`) consumiendo los contratos de `packages/contracts` y el proxy en `preview`.

## Estado tras la Fase 3 (2026-11-02)

Fase 3 completada técnicamente (ver `docs/bitacora.md`; falta la validación del usuario): `apps/mobile` con Expo SDK 58 y Expo Router, 4 tabs nativas (Inicio, Colectivos, Subtes, Favoritos) y Ajustes y Acerca de como stack desde Inicio, tema Obelisco claro/oscuro, fuentes Nunito y Open Sans, `Icon` con 45 usos, 15 componentes de `shared/ui`, cliente API tipado con `QueryClient` (polling solo en primer plano, persister MMKV), `FavoritosRepository` y preferencias en MMKV, `DESIGN.md`, `docs/07-app.md` y `docs/08-design-system.md`; 422 tests en el monorepo (contracts 67, proxy 87, mobile 268) y `lint`, `typecheck` y `test` en verde. Ajustes al plan: `DESIGN.md` se escribió a mano porque el skill Impeccable no estaba disponible; las fuentes se cargan con `useFonts` y no con el plugin de `expo-font`; la tarea 3.2 no incluye assets de marca, que quedan pendientes (la sesión Dev Images se demoró) (se integraron después, commit 32da02b); el identificador nativo `app.transportate.mobile` quedó confirmado por el usuario el 2026-11-02. Nada se probó todavía en un dev build real (simulador o dispositivo). Para la Fase 4: las features consumen los hooks de `src/shared/api` y los componentes de `shared/ui` (hoy ninguna pantalla los usa), arrancan por Subtes sobre pantallas que son placeholders, y Tránsito sigue oculto hasta que exista una fuente de cortes.

## Estado tras la Fase 4 (2026-11-03)

Fase 4 completada técnicamente (ver `docs/bitacora.md`; falta la validación del usuario en el iPhone con [`docs/11-prueba-manual.md`](11-prueba-manual.md)). Quedó hecho: **4.2** Subtes completa (raíz con búsqueda, línea con alertas, estación con arribos por sentido), con `shared/static` para el paquete estático; **4.3** mapa de la red de subte sobre `shared/map` (MapLibre 11, colores GTFS con contorno); **4.4** Inicio con el estado de las 7 líneas, la Alert destacada y los favoritos con su dato vivo; **4.5** Colectivos con el índice grande descargado por archivo (con progreso) y búsqueda local; **4.6** línea de colectivos con mapa en tiempo real, panel inferior, "Seguir" y selector de ramal; **4.7** paradas cercanas con `features/ubicacion` (`expo-location`, solo en memoria, permiso en contexto); **4.9** Favoritos con alias, borrado con Deshacer, búsqueda, colores de subte, huérfanos, datos vivos, Alert de servicio caído y reorden por arrastre; **4.10** Ajustes, Acerca de y Licencias (más el `Snackbar` compartido); **4.11** estados en todas las pantallas (skeleton, vacío, error con reintento, frescura, pull to refresh, `OfflineBanner` global); **4.12** tests por feature. La **4.8** (Tránsito) sigue diferida y el tab oculto (N3: `/transito/v1/cortes` devuelve 500); la **4.1** (Impeccable) se reemplazó por un brief operativo en el README de cada feature, porque el skill no estaba disponible. Primera validación en el iPhone el 2026-11-03: tres defectos corregidos en `main` (alerta de subte repetida, colectivos en servicio sin orden por cercanía, header de Favoritos sobre el contenido; ver `docs/bitacora.md`). Impeccable resultó ser un marketplace registrado con el plugin sin instalar: pendiente `/plugin install impeccable@impeccable` antes de la Fase 5. Hay 760 tests que corren (contracts 74, proxy 86, mobile 600; 3 `skipped`) y `lint`, `typecheck` y `format:check` en verde desde la raíz; la corrida de `pnpm test` desde la raíz da timeouts con la máquina cargada y se corre por paquete. Ajustes al plan: las dependencias nativas se instalaron juntas (4.0) para un solo rebuild del dev client; el detalle de línea usa un `BottomPanel` propio en lugar de la `formSheet` nativa; el feed de colectivos no informa el sentido, así que el selector es de ramal; los archivos grandes del estático van por archivo en MMKV fuera del persister; el huérfano de un favorito se decide en un solo lugar (`useFavoritoLiveData`); y la verificación "contra el Worker desplegado" se hizo contra `wrangler dev` porque el proxy no está en `preview`. Para la Fase 5: validar todo en dispositivo (sobre todo mapa, gestos, permiso de ubicación y banner offline), hacer el `audit` nativo y las pruebas de accesibilidad, la capa B del proxy, EAS Build de producción y CI, y decidir sobre el despliegue a `preview` (`wrangler login`), `forecastGTFS` congelado y los tiles de OpenFreeMap sin SLA.

## Estado tras la Fase 5 (2026-11-05)

La Fase 5 está **a medias** (detalle en `docs/bitacora.md`): se hizo la tarea 5.0, el rediseño «Señalética de terminal» (Fira Sans como única familia, placas y bandas de señal sobre Obelisco v2) en toda la app, validado por el usuario en el iPhone el 2026-11-04 y corregido en tres rondas (modo oscuro nativo, headers sin título en iOS 26+, lista de colectivos a 3 km). Quedan pendientes la re-prueba del usuario, las capturas finales con el *finish review* y el nuevo `DESIGN.md`, y las tareas 5.1 a 5.7. El 2026-11-05 el usuario sumó la Fase 6 (Trenes) mientras la 5 sigue abierta.

## Herramientas de trabajo transversales

- **Impeccable (UX/UI).** Es el skill de diseño para todo lo visual. `PRODUCT.md` y `DESIGN.md` viven en la raíz del repo porque el launcher los lee de ahí; `docs/README.md` los enlaza. Comandos por fase: `init` y `shape` en Fase 1, `extract`/`document` en Fase 3, `shape` + `onboard` + `clarify` por feature en Fase 4, `audit` nativo + `adapt` nativo + `harden` + `critique` + `polish` en Fase 5. Antes de cualquier edición de UI se lee `craft-floor.md` como indica el skill.
- **Context7 (docs al día).** Al inicio de cada fase se consultan las APIs exactas de las librerías que se van a tocar (Expo, Expo Router, MapLibre RN, MMKV, TanStack Query, Hono, wrangler/Workers, gtfs-realtime-bindings, Zod, Vitest, Jest/RNTL) y se anota la versión fijada en `docs/versiones.md`. Nada se escribe de memoria.
- **Skills de Expo y Cloudflare** ya instalados (`expo:expo-router`, `expo:expo-data-fetching`, `expo:eas-*`, `cloudflare:workers-best-practices`, `cloudflare:durable-objects`, `cloudflare:wrangler`) se usan como referencia secundaria.

## Decisiones de arquitectura (con justificación)

1. **Monorepo pnpm** con `apps/mobile` (Expo), `apps/proxy` (Worker), `packages/contracts` (Zod + tipos compartidos), `tools/gtfs` (preprocesado estático), `docs/`. El contrato JSON del proxy es la única dependencia entre app y backend; compartir los esquemas Zod evita drift.
2. **Mapas: MapLibre** (`@maplibre/maplibre-react-native`). Sin API keys ni facturación por carga (react-native-maps en Android usa Google Maps SDK con billing, inviable a millones de usuarios), tiles vectoriales con estilo claro/oscuro propio alineado a Obelisco, y posibilidad de self-hostear tiles como PMTiles en Cloudflare R2. Tiles iniciales: OpenFreeMap (sin key). Riesgo: look menos "nativo" que Apple Maps; aceptable.
3. **Favoritos: MMKV** detrás de `FavoritosRepository` (interfaz). Son pocas decenas de registros, lectura síncrona al arrancar, sin consultas relacionales; SQLite sería sobreingeniería. MMKV también sirve de persister de TanStack Query para el modo offline. Si en el futuro hay historial/consultas, se cambia la implementación sin tocar UI.
4. **Íconos: `@material-symbols/svg-400`** (variantes `rounded/*-fill.svg`, FILL 1) renderizados con `react-native-svg` vía un componente `Icon` con mapa curado. RN no soporta `font-variation-settings`, así que la fuente variable no garantiza FILL 1; los SVG sí, y son tree-shakeables.
5. **Proxy escalable en dos capas, misma interfaz `FeedSource`.**
   - Capa A (MVP, cientos→miles): Worker Hono + Cache API por colo (TTL 15–30 s RT, horas estático) + coalescing de requests en el isolate (una promesa en vuelo por clave) + `stale-while-revalidate`. Upstream recibe como máximo `colos × 1 req/TTL` por feed, independiente de usuarios.
   - Capa B (miles→millones): Durable Object `FeedHub` (uno por feed, alarm cada TTL) como único fetcher upstream; los Workers leen del DO y cachean en edge. Upstream = 1 req/TTL/feed global; precomputa slices por línea para colectivos (el feed completo nunca viaja al teléfono). SQLite-backed DOs están en Free. Se implementa en Fase 5 detrás de flag; Fase 2 deja la interfaz y el diseño documentado.
   - Rate limiting con el **binding nativo de Workers Rate Limiting** (in-memory, por colo, no persiste IPs), sin logs de request.
   - **Costos a escala** (en `docs/04-escalabilidad.md`): Free = 100k req/día (≈ 300 usuarios activos con polling de 20 s en foreground); Paid USD 5/mes incluye 10M req, luego USD 0,30/M. Mitigaciones en la app: polling solo con pantalla visible, pausa en background, jitter, ETag/304, intervalo configurable (default 20 s).
6. **GTFS estático preprocesado offline** (`tools/gtfs`, Node): genera JSON compacto (paradas, rutas, estaciones, colores de líneas) filtrado a bbox CABA, versionado con hash, subido a **R2** y servido por el Worker con `Cache-Control` largo + ETag. La app lo descarga una vez, lo persiste y hace búsqueda y paradas cercanas **localmente** (funciona offline y no genera carga por consulta).
7. **Contratos propios, desacoplados del upstream.** `packages/contracts` define el JSON v1 (campos cortos, `generatedAt` y `sourceTimestamp` para "datos de hace X s" y staleness). Cada `*Adapter` traduce upstream → contrato y es lo único que cambia con API 2.0.
8. **Privacidad por diseño**: sin analytics, sin logs con IP/UA, ubicación solo en memoria, observabilidad de Workers con sampling y sin campos de request. Documentado en `docs/05-privacidad.md` y en "Acerca de".

## Estructura del repo

```
Transportate/
├── PRODUCT.md, DESIGN.md       # contexto de Impeccable (el launcher los lee de la raíz)
├── docs/                       # toda la documentación (índice en docs/README.md)
│   ├── README.md
│   ├── 01-api-transporte.md    # Fase 1: endpoints verificados, formatos, muestras
│   ├── 02-obelisco-tokens.md   # Fase 1: tokens con cita de archivo origen
│   ├── 03-arquitectura.md · 04-escalabilidad.md · 05-privacidad.md
│   ├── 06-proxy.md · 07-app.md · 08-design-system.md · 09-testing.md · 10-deploy.md
│   ├── versiones.md            # versiones fijadas y verificadas con Context7 por fase
│   ├── bitacora.md             # resumen por fase: qué se hizo, decisiones, riesgos
│   └── adr/ADR-000N-*.md       # mapas, storage, íconos, monorepo, DO
├── apps/mobile/                # Expo SDK 58 + Expo Router + TS strict
│   └── src/{app,features/{inicio,colectivos,subtes,transito,favoritos,ajustes},shared/{ui,theme,api,storage}}
├── apps/proxy/                 # Cloudflare Worker + Hono
│   └── src/{index.ts,routes/v1,adapters/{colectivos,subtes,transito},sources,cache,ratelimit}
├── packages/contracts/         # Zod schemas + tipos v1
├── tools/gtfs/                 # preprocesado GTFS → R2
├── .github/workflows/ci.yml    # lint, typecheck, tests
└── README.md, .env.example, pnpm-workspace.yaml
```

## Fases (freno y validación al final de cada una)

### Fase 1 — Investigación (solo `docs/` + contexto de diseño, sin código de producto)

| # | Tarea | Dificultad |
|---|---|---|
| 1.1 | Crear `docs/` con índice, `03-arquitectura.md`, `04-escalabilidad.md`, `05-privacidad.md`, `versiones.md`, `bitacora.md` y ADRs iniciales | 🟢 |
| 1.2 | Leer la consola oficial de la API (`/console/`) con el navegador y el portal MuleSoft; listar endpoints candidatos con método, path, params y formato | 🟡 |
| 1.3 | Con credenciales en `.env` local (fuera del repo) llamar a cada endpoint candidato y registrar status, tamaño, formato, timestamps, frecuencia observada, inconsistencias y si está suspendido | 🔴 |
| 1.4 | Capturar fixtures reales (`.pb` y JSON) en `apps/proxy/test/fixtures/` para Fase 2 | 🟢 |
| 1.5 | Extraer tokens de Obelisco desde `src/styles/variables/*.scss`, `dist/styles.css`, `colors.txt`, `typography.txt`: colores, tipografía, espaciados, radios, sombras, foco, con archivo y línea | 🟡 |
| 1.6 | Derivar paleta oscura con contraste WCAG AA verificado (ratio ≥ 4.5:1 texto, ≥ 3:1 UI) | 🟡 |
| 1.7 | Colores oficiales de líneas de subte desde `routes.txt` del GTFS de subtes, cruzados con fuente oficial | 🟢 |
| 1.8 | Impeccable `init`: escribir `PRODUCT.md` (audiencia, modo Operate, plataformas iOS/Android, voseo, restricciones de privacidad) | 🟢 |
| 1.9 | Impeccable `shape` de las 6 pantallas del MVP: brief por pantalla con estados (carga, vacío, error, stale, offline, sin permiso de ubicación) sin código | 🟡 |
| 1.10 | Entregar `01-api-transporte.md`, `02-obelisco-tokens.md`, briefs y **frenar** | 🟢 |

### Fase 2 — Proxy

| # | Tarea | Dificultad |
|---|---|---|
| 2.1 | Verificar con Context7 Hono, wrangler, Vitest, Zod, gtfs-realtime-bindings; anotar en `versiones.md` | 🟢 |
| 2.2 | Scaffold monorepo pnpm, `apps/proxy` (Hono + wrangler + Vitest), `packages/contracts`, ESLint/Prettier/TS strict compartidos | 🟡 |
| 2.3 | Definir contratos Zod v1 (subtes estado/arribos/alertas, colectivos posiciones/arribos, tránsito cortes, static manifest) con `generatedAt`/`sourceTimestamp` | 🟡 |
| 2.4 | Interfaz `FeedSource` + implementación capa A: Cache API por colo, coalescing in-isolate, `stale-while-revalidate`, TTL por feed | 🔴 |
| 2.5 | `SubtesAdapter`: decodificar forecastGTFS y serviceAlerts, derivar estado por línea (normal / demorada / interrumpida) con reglas documentadas | 🔴 |
| 2.6 | `ColectivosAdapter`: decodificar vehicle positions, filtrar por línea/bbox, slices cacheables por línea; arribos solo si Fase 1 confirmó feed | 🔴 |
| 2.7 | `TransitoAdapter`: normalizar cortes a GeoJSON mínimo + lista | 🟡 |
| 2.8 | Rutas `/v1/*`, `/v1/health`, ETag/304, headers de cache, errores tipados, versionado | 🟡 |
| 2.9 | Rate limiting con binding nativo de Workers; sin logs identificables; secrets vía `wrangler secret` | 🟡 |
| 2.10 | `tools/gtfs`: descargar GTFS (209 MB), filtrar bbox CABA, generar JSON compacto versionado, subir a R2; rutas `/v1/static/*` | 🔴 |
| 2.11 | Tests Vitest por adaptador con fixtures reales + tests de cache/coalescing/rate limit (Miniflare) | 🟡 |
| 2.12 | Prueba de carga local (`autocannon`) demostrando 1 upstream por TTL; documentar `06-proxy.md`, `10-deploy.md`; `.env.example`; **frenar** | 🟡 |

### Fase 3 — Base de la app

| # | Tarea | Dificultad |
|---|---|---|
| 3.1 | Verificar con Context7 Expo SDK 58, Expo Router, MMKV, TanStack Query, react-native-svg, expo-font; anotar versiones | 🟢 |
| 3.2 | Crear `apps/mobile` (Expo SDK 58, Router, TS strict, ESLint/Prettier, Jest + RNTL, `expo-dev-client`, `eas.json` dev/preview/production) | 🟡 |
| 3.3 | `shared/theme/tokens.ts` con cita de origen por token; `ThemeProvider` claro/oscuro con `useColorScheme` y override desde Ajustes | 🟡 |
| 3.4 | Fuentes Nunito y Open Sans (reemplazadas por Fira Sans en la Fase 5) con `@expo-google-fonts` (cargadas con `useFonts`, no con el plugin de `expo-font`); escala tipográfica con soporte de Dynamic Type (`allowFontScaling`, `maxFontSizeMultiplier` razonable) | 🟢 |
| 3.5 | Componente `Icon` con `@material-symbols/svg-400` rounded fill + mapa curado | 🟢 |
| 3.6 | Impeccable `extract`/`document`: generar `DESIGN.md` desde tokens; leer `craft-floor.md` antes de componentes (hecho a mano: el skill no estaba disponible) | 🟢 |
| 3.7 | Componentes Obelisco en RN: Button, Card, Alert, Badge, Chip, SearchInput, Tabs, Skeleton, EmptyState, ErrorState, FreshnessLabel, con haptics, 44×44 y labels de accesibilidad | 🔴 |
| 3.8 | Navegación con Expo Router: tabs Inicio/Colectivos/Subtes/Favoritos (Tránsito oculto, 4 tabs), Ajustes y Acerca de como stack; safe areas y back nativo | 🟡 |
| 3.9 | Cliente API tipado con Zod (`shared/api`), `QueryClient` con `focusManager`/`onlineManager`, polling con jitter solo en foreground, retry con backoff, persister MMKV | 🔴 |
| 3.10 | `FavoritosRepository` (interfaz) + implementación MMKV + tests (alta, alias, reorden, borrado, migración de esquema) | 🟡 |
| 3.11 | Tests RNTL de componentes clave; documentar `07-app.md`, `08-design-system.md`; **frenar** | 🟡 |

### Fase 4 — Features (subtes → colectivos → tránsito)

| # | Tarea | Dificultad |
|---|---|---|
| 4.1 | Impeccable `shape` + `onboard` + `clarify` por feature antes de codificar (brief, empty states, copy en voseo) | 🟡 |
| 4.2 | Subtes: estado por línea con colores oficiales, lista de alertas, selector de estación, próximos arribos con frescura | 🟡 |
| 4.3 | Subtes: mapa de red (estilo MapLibre claro/oscuro, líneas y estaciones como GeoJSON del estático) | 🔴 |
| 4.4 | Inicio: resumen de estado del subte, alertas activas, accesos rápidos a favoritos | 🟡 |
| 4.5 | Colectivos: descarga y persistencia del índice estático; búsqueda local por línea y parada | 🟡 |
| 4.6 | Colectivos: mapa con posiciones en tiempo real por línea (SymbolLayer con rotación por `bearing`), seguimiento y frescura | 🔴 |
| 4.7 | Colectivos: paradas cercanas con `expo-location` (while in use, solo en memoria) y fallback a búsqueda manual; arribos por parada si existe el feed | 🟡 |
| 4.8 | Tránsito: cortes en mapa y en lista, con filtro por tipo y detalle | 🟡 |
| 4.9 | Favoritos: pantalla con alias, reorden por drag, borrado con deshacer, accesos directos a cada tipo | 🟡 |
| 4.10 | Ajustes: tema, intervalo de actualización, limpiar favoritos, Acerca de (atribución GCBA, privacidad) | 🟢 |
| 4.11 | Estados en todas las pantallas: skeleton, vacío, error con reintento, "hace X s", aviso de dato viejo, pull to refresh | 🟡 |
| 4.12 | Tests RNTL por feature (estados y favoritos); **frenar** | 🟡 |

### Fase 5 — Pulido y escalado

| # | Tarea | Dificultad |
|---|---|---|
| 5.0 | Rediseño con Impeccable: dirección «Señalética de terminal» (ronda de dirección 2026-11-03, piloto en Inicio validado en el iPhone el 2026-11-04, extensión a Subtes, Colectivos, Favoritos y Ajustes); cierre con capturas, finish review y `DESIGN.md` nuevo | 🔴 |
| 5.1 | Impeccable `audit` nativo + `critique`: corregir hallazgos de accesibilidad, performance, theming y conformidad de plataforma | 🟡 |
| 5.2 | Impeccable `adapt` nativo + `harden`: tablets, landscape, teclado, textos largos, errores de red, i18n defensiva | 🟡 |
| 5.3 | Modo offline completo: favoritos y último dato cacheado marcados como no actualizados; banner de sin conexión | 🟡 |
| 5.4 | Dark mode revisado pantalla por pantalla; Reduce Motion; haptics coherentes; Impeccable `polish` | 🟡 |
| 5.5 | Capa B del proxy: Durable Object `FeedHub` con alarms, slices por línea, flag de entorno, tests; guía Free → Paid | 🔴 |
| 5.6 | EAS Build iOS/Android (dev, preview, production), íconos y splash, permisos con textos en voseo | 🟡 |
| 5.7 | CI en GitHub Actions (lint, typecheck, tests de ambos apps), README final, `.env.example`, bitácora cerrada | 🟢 |

### Fase 6 — Trenes (fuente comunitaria de SOFSE)

Tab «Trenes» espejo de Subtes, sin mapa: tablero de las 6 líneas de SOFSE con estado derivado de las alertas, línea → ramales, estación con arribos, y favoritos de **ramal** y de **estación** (no de línea: una línea tiene varios ramales). Fuente: la instancia comunitaria `ariedro.dev/api-trenes`, consumida solo por el Worker (`/v1/trenes/*`), nunca por la app. Evaluación, riesgos y plan de salida en [`01d-api-trenes-sofse.md`](01d-api-trenes-sofse.md); colores (provisorios) en [`02c-colores-trenes.md`](02c-colores-trenes.md); brief en [`briefs/07-trenes.md`](briefs/07-trenes.md).

| # | Tarea | Dificultad |
|---|---|---|
| 6.1 | Contratos (`packages/contracts`) + fuente + adaptador SOFSE + rutas `/v1/trenes/*` + fixtures + `tools/sofse-probe`; kill-switch `TRENES_ENABLED` y base `TRENES_UPSTREAM_BASE` | 🔴 |
| 6.2 | Evaluación de la fuente, producto, plan, colores y brief de superficie (esta ola de documentación) | 🟢 |
| 6.3 | Paquete estático de trenes en `tools/gtfs` (paso `trenes`: `trenes-lineas.json`, `trenes-estaciones.json`) a partir de los volcados de `tools/sofse-probe` | 🟡 |
| 6.4 | App: feature Trenes (raíz, línea, ramal, estación) + tab + favoritos de ramal y estación + Inicio | 🔴 |
| 6.5 | Docs de app, testing y prueba manual + atribución en Acerca de | 🟢 |
| 6.6 | Colores oficiales confirmados + subida a R2 + smoke en el simulador | coordinador |
| 6.7 | Capturas + *finish review* contra el brief | 🟡 |
| 6.8 | Pasar los componentes compartidos de `features/subtes` a `shared/ui` (posterior) | 🟢 |

### Fase 7 — Publicación en iOS (TestFlight → App Store)

**Objetivo:** llevar Transportate a producción en iOS: primero TestFlight, después App Store, solo iPhone y solo Argentina. Decisiones del usuario del 2026-11-10 (sin dominio propio por ahora, sitio de privacidad y soporte como Worker de assets, versión 1.0.0, App Privacy «No recopilamos datos», contacto por mail en la página de soporte) y guía operativa en [`12-publicacion.md`](12-publicacion.md). Fuera de alcance: Android / Google Play, dominio propio (solo se documenta la transición), EAS Update, CI de EAS y video de App Preview.

| # | Tarea | Dificultad |
|---|---|---|
| 7.1 | Proxy a producción en `workers.dev`: Worker `transportate-proxy-production`, secrets cargados, verificación con `curl` (ola B, hecha el 2026-11-10) | 🟢 ✔ |
| 7.2 | URL del proxy por perfil de EAS (`env.EXPO_PUBLIC_API_URL` en `eas.json`), guardias en `app.config.ts` que hacen fallar el build sin URL `https://`, versión 1.0.0 y `supportsTablet: false`; perfil `preview-simulator` | 🟡 |
| 7.3 | Acerca de con versión y build, enlaces a «Política de privacidad» y «Soporte y contacto»; sitio estático `transportate-site` (`site/`) con `/privacidad` y `/soporte` | 🟡 |
| 7.4 | App Store Connect: app, ficha base, categoría, edad, App Privacy, API Key, precio, disponibilidad y grupo de TestFlight | 🟡 usuario |
| 7.5 | Build de producción con EAS y `eas submit` a TestFlight | 🟡 usuario |
| 7.6 | Prueba en TestFlight con datos reales ([`12-publicacion.md`](12-publicacion.md) §4) | 🟢 usuario |
| 7.7 | Ficha de App Store, capturas 6,9″ y envío a revisión; gate de dominio antes de abrir en App Store | 🟡 |
| 7.8 | Docs al día (`10-deploy`, `05-privacidad`, `12-publicacion`, `versiones`), CI alineado y cierre en la bitácora | 🟢 |

**Verificación:** `eas config --profile production` muestra 1.0.0, `supportsTablet: false` y una URL `https://`; el build de TestFlight muestra datos reales en las 4 tabs (la URL quedó embebida) y «Versión 1.0.0 (build N)» en Acerca de; las páginas de privacidad y soporte responden en el sitio; App Privacy dice «No recopilamos datos» con la justificación de [`05-privacidad.md`](05-privacidad.md) §9; `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde antes de buildear.

**Frenar** al terminar TestFlight (7.6): el usuario valida el build antes de enviar a revisión. Antes de abrir en App Store (7.7), **decisión explícita sobre el dominio**: o hay dominio propio y la transición de [`10-deploy.md`](10-deploy.md) §4, o el usuario acepta por escrito el riesgo de la Cache API inerte en `workers.dev` (se anota en la bitácora).

## Verificación

- **Fase 1:** cada endpoint del doc tiene respuesta real registrada (status, tamaño, timestamp) o está marcado como suspendido/no verificado; cada token cita archivo origen; contraste del dark mode verificado; `PRODUCT.md` y briefs de `shape` confirmados por el usuario.
- **Fase 2:** `pnpm test` en proxy verde con fixtures reales; `wrangler dev` responde en `/v1/*` con JSON validado por Zod; prueba de carga muestra 1 llamada upstream por TTL; 429 al superar el límite.
- **Fase 3:** `pnpm typecheck` y `pnpm lint` sin errores ni `any`; tests de componentes y de `FavoritosRepository` verdes; app corre en dev client iOS/Android con tema claro/oscuro y fuentes correctas.
- **Fase 4:** recorrido manual de cada feature contra el Worker desplegado; estados de carga/vacío/error/stale visibles forzando fallos del proxy.
- **Fase 5:** build EAS de ambas plataformas; VoiceOver/TalkBack recorren las pantallas principales; modo avión muestra favoritos y último dato marcado; `audit` nativo de Impeccable con todas las dimensiones ≥ 3.
- **Fase 7:** ver la verificación al final de la sección de la Fase 7 (build de TestFlight con datos reales, ficha de App Privacy y decisión sobre el dominio).

## Riesgos principales

1. 🔴 API suspendida o inestable (aviso oficial de junio 2026). Mitigación: verificación empírica en Fase 1, adaptadores aislados, fallback a último dato bueno, estado "servicio no disponible".
2. 🟡 Arribos de colectivos pueden no existir en la API (solo posiciones). Se documenta y se omite la feature si no hay feed.
3. 🟢 Límite Free de 100k req/día: suficiente para cientos de usuarios; pasar a Paid es cambio de plan, no de código.
4. 🟡 GTFS estático de 209 MB: el preprocesado offline debe ser reproducible y versionado.
5. 🟡 MapLibre y MMKV exigen dev client y New Architecture: no hay Expo Go en ningún momento. Tiles de producción dependen de un proveedor externo (OpenFreeMap) hasta self-hostear PMTiles en R2.
6. 🔴 Publicar sin dominio propio: en `*.workers.dev` la Cache API no tiene efecto, así que cada pedido de cada usuario llega al GCBA y solo protegen el rate limit (60 pedidos cada 60 s) y el coalescing por isolate. Mitigación: TestFlight con pocos testers; el dominio es gate antes de App Store (o aceptación explícita del riesgo) y la transición está documentada en `10-deploy.md` §4 y `12-publicacion.md` §8.
