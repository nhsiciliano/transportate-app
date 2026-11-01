# Versiones

Registro de las versiones que usa (o usará) Transportate, con la fecha y la fuente de cada verificación. Regla del plan: **nada se escribe de memoria**; al inicio de cada fase se reverifica con Context7 y se anota acá. La versión que se *fija* (en `package.json` / lockfile) se decide al crear cada paquete (Fases 2 y 3).

## Verificadas con Context7 el 2026-11-01

| Herramienta | Versión / dato verificado | Fuente (Context7) | Último en npm el 2026-11-01 |
|---|---|---|---|
| **Expo SDK** | **58**: `expo ~58.0.16`, `react 19.3.0`, `react-native 0.88.0` en la plantilla de SDK 58 (`58.0.25`). La New Architecture está siempre activa desde SDK 55 (RN 0.82 fue el primero sin opción de desactivarla). | `docs.expo.dev/bare/upgrade/`, `docs.expo.dev/guides/new-architecture/` | `expo` 58.0.22 |
| **React Native** | **0.88** (existe como versión indexada junto a 0.87.x y 0.86.3) | Context7 `/react/react-native` | — |
| **`@maplibre/maplibre-react-native`** | **v11**: solo New Architecture, RN ≥ 0.80, plugin de config en `app.json` (`"plugins": ["@maplibre/maplibre-react-native"]`), SDKs nativos iOS v6 / Android v13. En producción hay que proveer estilo/tiles propios o de un proveedor. | `github.com/maplibre/maplibre-react-native` (`docs/content/setup/getting-started.md`, `expo.md`, `AGENTS.md`) | 11.5.1 |
| **`react-native-mmkv`** | **v4** sobre Nitro Modules: requiere `react-native-nitro-modules`; API `createMMKV()` (ya no existe `new MMKV()`). Requisito de RN: la guía de migración dice ≥ 0.75 y el README ≥ 0.76; **usar 0.76 como piso** (discrepancia entre documentos de la propia librería). | `github.com/margelo/react-native-mmkv` (`README.md`, `docs/V4_UPGRADE_GUIDE.md`) | 4.3.2 |
| **TanStack Query** | **v5** (`@tanstack/react-query`): `focusManager.setFocused` con `AppState`, `onlineManager.setEventListener` con NetInfo, `refetchInterval` (pausa en segundo plano salvo `refetchIntervalInBackground`), persister `createAsyncStoragePersister` de `@tanstack/query-async-storage-persister`. El backoff exponencial por defecto (1 s → 30 s) viene del plan y **no se reconsultó** en esta pasada. | `github.com/tanstack/query` (`docs/framework/react/react-native.md`, `guides/window-focus-refetching.md`, `guides/polling.md`, `plugins/createAsyncStoragePersister.md`) | `@tanstack/react-query` 5.105.1 |
| **Hono** | **v4** (versiones indexadas 4.13.x): middleware `cache()` sobre Cache API (`cacheName`, `cacheControl`, `keyGenerator`, `cacheableStatusCodes`); `wrangler types --env-interface CloudflareBindings` y `new Hono<{ Bindings: CloudflareBindings }>()`. | `hono.dev/docs/middleware/builtin/cache`, `hono.dev/docs/getting-started/cloudflare-workers` | 4.13.16 |
| **`@material-symbols/svg-400`** | Paquete existente, licencia Apache-2.0; los archivos `rounded/<nombre>-fill.svg` (FILL 1) existen (`directions_bus-fill.svg`, `subway-fill.svg`, `star-fill.svg` → HTTP 200). | registro npm + `cdn.jsdelivr.net` (no Context7) | 0.48.2 |
| **`react-native-maps`** (solo para el ADR-0002) | Android usa siempre Google Maps y requiere API key en el manifest; iOS usa Apple MapKit por defecto. | Context7 `/react-native-maps/react-native-maps` | 1.29.11 |

### Cloudflare (verificado con Context7 el 2026-11-01; detalle y fuentes en `04-escalabilidad.md`)

| Dato | Valor |
|---|---|
| Workers Free | 100.000 requests/día (reinicia 00:00 UTC), 10 ms de CPU por invocación; al excederse, error 1027 |
| Workers Paid (Standard) | mínimo USD 5/mes, 10 M requests/mes incluidos, USD 0,30 por M adicional; 30 M ms de CPU incluidos, USD 0,02 por M ms adicional |
| Rate Limiting binding | `ratelimits` en wrangler (≥ 4.36.0), `period` 10 o 60 s, contadores locales a cada ubicación, permisivo y eventualmente consistente |
| Durable Objects | SQLite-backed disponible en Free; alarms con reintentos (backoff desde 2 s, hasta 6) |

> Las cifras de Cloudflare cambian: reverificar antes de decidir el plan en Fase 5 (la propia doc anuncia cambios, por ejemplo precios de Workers Logs desde el 2026-12-01).

## Pendiente de fijar en Fase 2/3

Todavía **sin versión fijada** ni consulta a Context7 (se hace al inicio de cada fase, tareas 2.1 y 3.1 del plan):

| Fase | Herramienta | Qué falta |
|---|---|---|
| 2 | Node.js, pnpm | versión LTS y `packageManager` en `package.json` |
| 2 | wrangler, `@cloudflare/workers-types` / `wrangler types`, compatibility date | versión y fecha de compatibilidad |
| 2 | Vitest y `@cloudflare/vitest-pool-workers` (o Miniflare) | versión y forma de testear Cache API y rate limit |
| 2 | Zod | mayor vigente y API de esquemas compartidos |
| 2 | `gtfs-realtime-bindings` (protobuf) | versión y decodificación en Workers |
| 2 | ESLint, Prettier, TypeScript (strict) | configuración compartida del monorepo |
| 2 | `autocannon` | prueba de carga local (2.12) |
| 3 | Expo Router, `expo-dev-client`, EAS CLI | versiones alineadas a SDK 58 (`expo install`) |
| 3 | `react-native-svg`, `expo-font`, `@expo-google-fonts/nunito`, `@expo-google-fonts/open-sans` | versiones y pesos a cargar |
| 3 | `@react-native-community/netinfo`, `expo-location`, `expo-haptics` | versiones alineadas a SDK 58 |
| 3 | Jest + React Native Testing Library | versiones compatibles con RN 0.88 |
| 5 | EAS Build / Update | si se usa OTA, declararlo en `05-privacidad.md` |

Cada fila se cierra con: versión fijada, fecha, y fuente consultada.
