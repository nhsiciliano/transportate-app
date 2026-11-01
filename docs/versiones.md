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

## Verificadas para la Fase 2 (tarea 2.1) — 2026-11-01

"Última en npm" sale de `npm view <paquete> version` el 2026-11-01. **Fijar versión exacta** (sin `^` ni `~`) en cada `package.json`; el lockfile de pnpm hace el resto. Cuando una fila dice "Context7", la compatibilidad se leyó en esa documentación; cuando dice "npm", solo se verificó la versión y los `peerDependencies`/`engines` del registro.

| Herramienta | Versión a fijar | Última en npm | Fuente | Notas de compatibilidad |
|---|---|---|---|---|
| **Node.js** | 24 (LTS; local: v24.20.0) | — | `engines` en npm: wrangler `>=22`, tools del repo `>=22` | Vitest 4 pide Node ≥ 20 y Vite ≥ 6 (Context7 `/vitest-dev/vitest/v4.1.6`). |
| **pnpm** | **12.16.1** (local: 12.14.0) | 12.16.1 | Context7 `/pnpm/pnpm` (indexadas v12.11.2 y v12.15.0), npm | Declarar `packageManager` en el `package.json` raíz. Los `tools/*` de investigación siguen con npm (paquetes sueltos, sin lockfile). |
| **Hono** | **4.13.16** | 4.13.16 | Context7 `hono.dev` (ver tabla anterior), npm | Sin cambios respecto de la verificación previa. |
| **wrangler** | **4.156.1** | 4.156.1 | Context7 `/cloudflare/workers-sdk`, npm | `ratelimits` pide ≥ 4.36.0 (cumplido). Usar `wrangler types` para los bindings en lugar de `@cloudflare/workers-types` (5.20261101.1 existe, pero `wrangler types` genera lo que el `wrangler.jsonc` declara). |
| **`compatibility_date`** | **2026-10-23** (el default de wrangler 4.156.1, que sigue a `workerd`) | — | Context7 `/cloudflare/workers-sdk` (`default-compat-date.ts`) | `workerd` rechaza fechas posteriores a su fecha de release + 7 días o a hoy (UTC). **`nodejs_compat` viene activado por defecto desde 2026-08-04**: con una fecha ≥ esa, el flag es redundante y `workerd` lo rechaza. No lo agregues. |
| **Vitest** | **4.1.12** | 5.0.5 | Context7 `/vitest-dev/vitest` (indexadas v4.1.6 y v5.0.3), npm | La 4.1 es la línea que aceptan **los dos** paquetes de tests de Workers (ver abajo). 5.0.5 es posible solo con `@cloudflare/vitest-plugin`. |
| **`@cloudflare/vitest-plugin`** | **1.4.12** | 1.4.12 | Context7 `/cloudflare/workers-sdk` (`packages/vitest-plugin`), npm | **Reemplaza a `@cloudflare/vitest-pool-workers`** (el codemod `vitest:pool-workers-to-vitest-plugin` hace el cambio). Se configura con el plugin `cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })` en `vitest.config.ts`; en los tests, `env`/`exports` salen de `cloudflare:workers` y `createExecutionContext`/`waitOnExecutionContext` de `cloudflare:test`. `peerDependencies`: `vitest ^4.1.0 \|\| ^5.0.0`; depende de `wrangler` 4.156.1. |
| **`@cloudflare/vitest-pool-workers`** (alternativa heredada) | 0.23.0 | 0.23.0 | npm | Última publicada, pero con `peerDependencies` `vitest ^4.1.0` y `wrangler` 4.124.0 (desfasado de la 4.156.1). **Recomendación: usar `@cloudflare/vitest-plugin`.** Si el plan sigue nombrando el pool, Fase 2 tiene que decidirlo. |
| **Zod** | **4.6.7** | 4.6.7 | Context7 `/colinhacks/zod` (v4.6.5 indexada) y `zod.dev/library-authors` | **Sí, v4.** Con `zod@4.x`, `import { z } from 'zod'` exporta Zod 4 (en 3.x exportaba Zod 3); Zod 3 está "funcionalmente en fin de vida". No confundir con el contrato "v1" de `packages/contracts` (versión de nuestro JSON). |
| **`gtfs-realtime-bindings`** | **2.2.0** | 2.2.0 | npm + uso real en `tools/captura-posiciones` y `tools/api-probe` | **Context7 no la indexa** (la búsqueda no devuelve el paquete). `FeedMessage.decode(Uint8Array)` funciona en Node 24; `timestamp` (uint64) llega como objeto `Long`. **Sin verificar:** que corra en `workerd` (usa `protobufjs`); probarlo en la Fase 2 antes de apoyarse en él. |
| **TypeScript** | **6.0.3** | 7.0.2 | npm (`peerDependencies` de typescript-eslint) | **No usar la 7.0.2 todavía:** `typescript-eslint` 8.72.1 declara `typescript >=4.8.4 <6.1.0`. Subir cuando typescript-eslint soporte 7. |
| **typescript-eslint** | **8.72.1** | 8.72.1 | Context7 `/typescript-eslint/typescript-eslint` (v8.72.1), npm | Config plana: `tseslint.configs.strictTypeChecked` + `languageOptions.parserOptions.projectService: true` (y `tsconfigRootDir: import.meta.dirname`). Peer `eslint ^8.57 \|\| ^9 \|\| ^10`. |
| **ESLint** | **10.14.0** | 10.14.0 | npm (peer de typescript-eslint) | Config plana (`eslint.config.mjs`). |
| **Prettier** | **3.9.10** | 3.9.10 | npm | Sin consulta a Context7 (solo versión). |
| **tsx** | **4.23.15** | 4.23.15 | Context7 `/privatenumber/tsx` (v4.23.15), npm | Para correr scripts TS de `tools/*` sin compilar. |
| **Expo SDK** | **58** (`expo` **58.0.22**) | 58.0.22 | npm; la verificación de SDK 58 está arriba | Corrige la fila anterior (`~58.0.16` era la plantilla): instalar con `npx expo install expo`. |
| **Expo Router** | **58.0.29** | 58.0.29 | Context7 `/expo/expo` (`docs/pages/router/installation.mdx`), npm | Instalar con `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar` (versiones alineadas al SDK); `"main": "expo-router/entry"`; raíz de rutas `src/app/_layout.tsx`. |
| **`@expo-google-fonts/nunito`** y **`/open-sans`** | **0.4.2** cada una | 0.4.2 | Context7 `/expo/google-fonts`, npm | Importar solo los pesos necesarios y cargarlos con `useFonts` desde `@expo-google-fonts/<familia>/useFonts` + `expo-font`. **No usar `@expo-google-fonts/dev`** (descarga las fuentes por red en ejecución, contradice `05-privacidad.md`). |
| **`@maplibre/maplibre-react-native`** | 11.5.1 | 11.5.1 | ver tabla anterior, npm | Reconfirmada hoy en npm. |
| **`react-native-mmkv`** | 4.3.2 | 4.3.2 | ver tabla anterior, npm | Reconfirmada hoy en npm. |
| **`@tanstack/react-query`** | 5.105.1 | 5.105.1 | ver tabla anterior, npm | Reconfirmada hoy en npm. |

**Decisiones que esto pide a la Fase 2:**

1. Test runner de Workers: `@cloudflare/vitest-plugin` en lugar de `@cloudflare/vitest-pool-workers` (el plan y la tarea nombran el segundo).
2. TypeScript queda en **6.0.3** aunque exista la 7.0.2.
3. No declarar `nodejs_compat` con la `compatibility_date` recomendada.
4. Probar `gtfs-realtime-bindings` dentro de `workerd` antes de depender de él.

## Pendiente de fijar en Fase 2/3

Todavía **sin versión fijada** ni consulta a Context7 (la Fase 2 cerró lo que corresponde a 2.1; el resto se hace al inicio de cada fase, tarea 3.1 del plan):

| Fase | Herramienta | Qué falta |
|---|---|---|
| 2 | `autocannon` | prueba de carga local (2.12) |
| 2 | Cómo testear Cache API y rate limit con `@cloudflare/vitest-plugin`; configuración compartida de ESLint/Prettier/TS en el monorepo | probar en `apps/proxy` |
| 3 | `expo-dev-client`, EAS CLI | versiones alineadas a SDK 58 (`expo install`) |
| 3 | `react-native-svg`, `expo-font` y los pesos de Nunito/Open Sans a cargar | versiones y pesos |
| 3 | `@react-native-community/netinfo`, `expo-location`, `expo-haptics` | versiones alineadas a SDK 58 |
| 3 | Jest + React Native Testing Library | versiones compatibles con RN 0.88 |
| 5 | EAS Build / Update | si se usa OTA, declararlo en `05-privacidad.md` |

Cada fila se cierra con: versión fijada, fecha, y fuente consultada.
