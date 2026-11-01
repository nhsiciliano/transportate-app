# Plan maestro — Transportate

**Leyenda de dificultad:** 🟢 bajo · 🟡 medio · 🔴 alto

## Contexto

App móvil (iOS/Android) para ver en tiempo real colectivos, subtes y tránsito de CABA, sin cuentas ni datos personales, con favoritos locales. Repo vacío (solo commit inicial). Se trabaja por fases con validación al final de cada una, toda la documentación vive en `docs/`, y el diseño arranca para cientos de usuarios y escala a miles/millones sin reescribir.

Hallazgos de la investigación preliminar (solo lectura, a profundizar en Fase 1):

- **API Transporte GCBA.** Base `https://apitransporte.buenosaires.gob.ar`, auth por query `client_id`/`client_secret`. Endpoints confirmados por uso de terceros (no por doc oficial todavía): `/colectivos/vehiclePositions` (GTFS-RT pb), `/colectivos/vehiclePositionsSimple` (JSON, ~1.1 MB, ~3.200 vehículos), `/subtes/forecastGTFS`, `/subtes/serviceAlerts`, `/subtes/feed-gtfs`, `/transito/v1/cortes`. La consola oficial (`/console/`) es JS-rendered; hay que leerla en Fase 1 con el navegador. **Riesgo alto:** el portal data.buenosaires.gob.ar (actualizado 2026-06-17) dice que "todos los datasets con Formato API y GTFS están suspendidos, en revisión y corrección". El usuario tiene credenciales: Fase 1 verifica empíricamente qué responde hoy.
- **GTFS estático de colectivos pesa ~209 MB** (zip). No se procesa en un Worker: va preprocesado offline.
- **Obelisco v2.** Tokens en `src/styles/variables/` (SCSS) y `dist/styles.css`. **Corrección (Fase 1, tarea 1.5):** el HEAD del repo tiene dos identidades. La **vigente** (src + dist, lo que publica npm) usa primary `#1d3343`, secondary `#035c80`, tertiary `#009688` y tipografía Archivo + Open Sans; la **histórica** (`app/out`, export viejo del sitio de docs) usa primary `#336ACC` y Nunito. Decisión: colores de la identidad vigente; tipografía Nunito + Open Sans por mandato explícito del brief (desvío consciente, documentado en `docs/02-obelisco-tokens.md`). No define modo oscuro: se deriva (hecho en 1.6).

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
- **Cortes de tránsito:** `/transito/v1/cortes` devuelve 500. Tareas 2.7 y 4.8 se mantienen con el estado "Fuente no disponible" hasta que el usuario decida N3 (ocultar el tab o buscar otra fuente).
- **Trenes:** 404. Sin cambios (fuera del MVP).
- **Proxy:** TTL de 20–30 s para colectivos (cadencia real 60 s) y 15–30 s para alertas de subte; reintentos y último dato bueno obligatorios (1–9 % de fallos upstream); compresión en el Worker (upstream no comprime); nunca loguear la URL upstream (lleva el secret en la query).
- **Tokens Obelisco:** identidad vigente (`#1d3343`, `#035c80`, `#009688`) + Nunito/Open Sans por mandato del brief; paleta oscura ya derivada y verificada (tarea 1.6 hecha).
- **Costos:** Free alcanza para ~1.100 usuarios activos (1 request por tick de 20 s, 30 min/día), no 300; la Cache API no reduce requests facturadas.
- **Sin `bearing`** en los feeds: tarea 4.6 no rota íconos por rumbo real (se puede derivar de posiciones sucesivas, opcional).

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
| 3.4 | Fuentes Nunito y Open Sans con `@expo-google-fonts`; escala tipográfica con soporte de Dynamic Type (`allowFontScaling`, `maxFontSizeMultiplier` razonable) | 🟢 |
| 3.5 | Componente `Icon` con `@material-symbols/svg-400` rounded fill + mapa curado | 🟢 |
| 3.6 | Impeccable `extract`/`document`: generar `DESIGN.md` desde tokens; leer `craft-floor.md` antes de componentes | 🟢 |
| 3.7 | Componentes Obelisco en RN: Button, Card, Alert, Badge, Chip, SearchInput, Tabs, Skeleton, EmptyState, ErrorState, FreshnessLabel, con haptics, 44×44 y labels de accesibilidad | 🔴 |
| 3.8 | Navegación con Expo Router: tabs Inicio/Colectivos/Subtes/Tránsito/Favoritos, Ajustes y Acerca de como stack; safe areas y back nativo | 🟡 |
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
| 5.1 | Impeccable `audit` nativo + `critique`: corregir hallazgos de accesibilidad, performance, theming y conformidad de plataforma | 🟡 |
| 5.2 | Impeccable `adapt` nativo + `harden`: tablets, landscape, teclado, textos largos, errores de red, i18n defensiva | 🟡 |
| 5.3 | Modo offline completo: favoritos y último dato cacheado marcados como no actualizados; banner de sin conexión | 🟡 |
| 5.4 | Dark mode revisado pantalla por pantalla; Reduce Motion; haptics coherentes; Impeccable `polish` | 🟡 |
| 5.5 | Capa B del proxy: Durable Object `FeedHub` con alarms, slices por línea, flag de entorno, tests; guía Free → Paid | 🔴 |
| 5.6 | EAS Build iOS/Android (dev, preview, production), íconos y splash, permisos con textos en voseo | 🟡 |
| 5.7 | CI en GitHub Actions (lint, typecheck, tests de ambos apps), README final, `.env.example`, bitácora cerrada | 🟢 |

## Verificación

- **Fase 1:** cada endpoint del doc tiene respuesta real registrada (status, tamaño, timestamp) o está marcado como suspendido/no verificado; cada token cita archivo origen; contraste del dark mode verificado; `PRODUCT.md` y briefs de `shape` confirmados por el usuario.
- **Fase 2:** `pnpm test` en proxy verde con fixtures reales; `wrangler dev` responde en `/v1/*` con JSON validado por Zod; prueba de carga muestra 1 llamada upstream por TTL; 429 al superar el límite.
- **Fase 3:** `pnpm typecheck` y `pnpm lint` sin errores ni `any`; tests de componentes y de `FavoritosRepository` verdes; app corre en dev client iOS/Android con tema claro/oscuro y fuentes correctas.
- **Fase 4:** recorrido manual de cada feature contra el Worker desplegado; estados de carga/vacío/error/stale visibles forzando fallos del proxy.
- **Fase 5:** build EAS de ambas plataformas; VoiceOver/TalkBack recorren las pantallas principales; modo avión muestra favoritos y último dato marcado; `audit` nativo de Impeccable con todas las dimensiones ≥ 3.

## Riesgos principales

1. 🔴 API suspendida o inestable (aviso oficial de junio 2026). Mitigación: verificación empírica en Fase 1, adaptadores aislados, fallback a último dato bueno, estado "servicio no disponible".
2. 🟡 Arribos de colectivos pueden no existir en la API (solo posiciones). Se documenta y se omite la feature si no hay feed.
3. 🟢 Límite Free de 100k req/día: suficiente para cientos de usuarios; pasar a Paid es cambio de plan, no de código.
4. 🟡 GTFS estático de 209 MB: el preprocesado offline debe ser reproducible y versionado.
5. 🟡 MapLibre y MMKV exigen dev client y New Architecture: no hay Expo Go en ningún momento. Tiles de producción dependen de un proveedor externo (OpenFreeMap) hasta self-hostear PMTiles en R2.
