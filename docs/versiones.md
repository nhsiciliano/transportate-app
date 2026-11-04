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

## Verificadas para la Fase 3 (tarea 3.1) — 2026-11-02

**Cómo se verificó.** "Última en npm" sale de `npm view <paquete> version` el 2026-11-02 (11:58 UTC). Para los paquetes del SDK, "versión a fijar" es la que declara el `bundledNativeModules.json` de `expo@58.0.22` (`https://cdn.jsdelivr.net/npm/expo@58.0.22/bundledNativeModules.json`), que es el archivo que lee `npx expo install` para alinear versiones al SDK; la tarea 3.2 lo confirma con `npx expo install --check`. Ese archivo escribe rangos `~`: **acá se fija la versión exacta** (sin `~` ni `^`), igual que en la Fase 2. Cuando una fila dice "Context7", la compatibilidad se leyó en esa documentación; "npm" significa que solo se verificó la versión, los `peerDependencies`, `engines` y las fechas de publicación del registro; "prueba local" es algo que se ejecutó en una carpeta temporal fuera del repo.

**Política de antigüedad de pnpm.** El `pnpm-workspace.yaml` no fija `minimumReleaseAge`, así que rige el default de pnpm: **1440 minutos (1 día)** (Context7 `/pnpm/pnpm`, `docs/settings/dependency-resolution.md`). A las 11:58 UTC del 2026-11-02 **todas** las versiones de la tabla tienen más de un día de publicadas (la más reciente, `@tanstack/react-query@5.105.1`, salió el 2026-11-01 10:07 UTC; `expo`, `expo-router`, `expo-dev-client` y `eas-cli` salieron el 2026-10-29/31). Si la tarea 3.2 se corre más adelante y sale una versión nueva, no usarla: se instala la de esta tabla.

### Plataforma y Expo SDK 58

| Herramienta | Versión a fijar | Última en npm | Fuente | Notas de compatibilidad |
|---|---|---|---|---|
| **Expo SDK** (`expo`) | **58.0.22** | 58.0.22 | npm; `bundledNativeModules.json` de `expo@58.0.22`; Context7 `/websites/expo_dev` | Misma versión que ya figura en la tabla de la Fase 2. `peerDependencies` de `expo`: `react`, `react-dom`, `react-native`, `react-native-web`, `@expo/dom-webview`, `@expo/metro-runtime`, `react-native-webview` (todas `*`, las de web son opcionales). Sin web en el MVP. |
| **`react`** | **19.3.0** | 19.3.1 | `bundledNativeModules.json` (`react 19.3.0`), `devDependencies` de `expo@58.0.22` (`react 19.3.0`), npm | **No usar la 19.3.1** aunque exista: el SDK 58 está alineado a 19.3.0 y `expo install --check` la marcaría. `react-dom` (19.3.0) no hace falta sin web; `expo-router` lo declara como peer opcional. |
| **`react-native`** | **0.88.1** | 0.88.1 | `bundledNativeModules.json`, npm, Context7 `/react/react-native` (0.88 indexada) | New Architecture siempre activa (ver tabla de la Fase 1). La Fase 1 anotó 0.88.0 por la plantilla; el SDK 58.0.22 ya trae **0.88.1**. |
| **`expo-router`** | **58.0.29** | 58.0.29 | npm; Context7 `/expo/expo` (instalación, Fase 2) | Peers opcionales (`peerDependenciesMeta`): `@expo/ui`, `react-dom`, `expo-symbols`, `react-native-web`, `react-native-worklets`, `react-native-reanimated`, `react-native-gesture-handler`, `react-server-dom-webpack`, `@testing-library/react-native`. **Peers obligatorios:** `expo`, `react`, `react-native`, `expo-linking`, `expo-constants`, `@expo/log-box`, `@expo/metro-runtime`, `react-native-screens`, `react-native-safe-area-context`. En la Fase 3 **no hace falta** instalar Reanimated, Worklets ni Gesture Handler. |
| **`expo-dev-client`** | **58.0.18** | 58.0.18 | `bundledNativeModules.json`, npm | Necesario: no hay Expo Go (MMKV y MapLibre son módulos nativos). |
| **`expo-font`** | **58.0.11** | 58.0.11 | `bundledNativeModules.json`, Context7 `/websites/expo_dev` (guía de fuentes: `npx expo install expo-font expo-splash-screen`) | Lo usa `useFonts` de `@expo-google-fonts`. |
| **`expo-splash-screen`** | **58.0.12** | 58.0.12 | `bundledNativeModules.json`, Context7 `/websites/expo_dev` | Patrón: `SplashScreen.preventAutoHideAsync()` al cargar el módulo y `SplashScreen.hideAsync()` cuando las fuentes están listas. |
| **`expo-haptics`** | **58.0.7** | 58.0.7 | `bundledNativeModules.json`, Context7 `/websites/expo_dev` (`docs.expo.dev/versions/latest/sdk/haptics/`) | API: `selectionAsync()`, `impactAsync(style)`, `notificationAsync(type)` con `NotificationFeedbackType.{Success, Warning, Error}`. La doc de Expo desaconseja `Vibrator` en Android y recomienda `performAndroidHapticsAsync` (no requiere el permiso `VIBRATE`): usar esa vía si se necesita en Android. |
| **`expo-constants`** | **58.0.14** | 58.0.14 | `bundledNativeModules.json`, npm | Peer de `expo-router`. |
| **`expo-linking`** | **58.0.15** | 58.0.15 | `bundledNativeModules.json`, npm | Peer de `expo-router`. Sin deep links en el MVP (S4), pero el router lo exige. |
| **`expo-status-bar`** | **58.0.4** | 58.0.4 | `bundledNativeModules.json`, npm | Dependencia de `expo-router`. |
| **`react-native-safe-area-context`** | **5.10.1** | 5.11.0 | `bundledNativeModules.json` (`~5.10.1`), npm | **No usar la 5.11.0**: el SDK 58 está en `~5.10.1`. `expo-router` pide `>= 5.4.0`. |
| **`react-native-screens`** | **4.30.1** | 4.30.1 | `bundledNativeModules.json`, npm | `expo-router` pide `^4.30.1 \|\| ^5.0.0-alpha.3`. |
| **`react-native-svg`** | **15.16.0** | 15.16.0 | `bundledNativeModules.json` (sin `~`: versión exacta), Context7 `/websites/expo_dev` (`npx expo install react-native-svg`) | Es lo que elige `expo install` para el SDK 58. `peerDependencies`: `react`, `react-native` (`*`). Importa como `import Svg, { Path } from 'react-native-svg'`. |
| **TypeScript** | **6.0.3** | 7.0.2 | Fase 2 (`typescript-eslint` 8.72.1 declara `<6.1.0`) | Sin cambios. |
| **`@types/react`** | **19.3.0** | 19.3.0 | `devDependencies` de `expo@58.0.22` (`~19.3.0`), npm | Alineada con `react` 19.3.0. |

### Fuentes (tarea 3.4)

> Historial: en la Fase 5 (F5-HIGH-A) Nunito y Open Sans se reemplazaron por Fira Sans 0.4.1; ver «Fase 5: tipografía de la dirección…» más abajo.

| Herramienta | Versión a fijar | Última en npm | Fuente | Notas de compatibilidad |
|---|---|---|---|---|
| **`@expo-google-fonts/nunito`** | **0.4.2** | 0.4.2 | Context7 `/expo/google-fonts` (patrón `useFonts`), npm, `data.jsdelivr.net` (listado de archivos) | Licencia `MIT AND OFL-1.1`. Se importa **por peso** (un subpath por archivo): `@expo-google-fonts/nunito/400Regular`, `/600SemiBold`, `/700Bold`. Cada uno exporta una constante con el mismo nombre que el `fontFamily` a usar (verificado en el `index.js` de cada subpath): **`Nunito_400Regular`**, **`Nunito_600SemiBold`**, **`Nunito_700Bold`**. Los `.ttf` pesan 132.200, 132.152 y 132.148 bytes. |
| **`@expo-google-fonts/open-sans`** | **0.4.2** | 0.4.2 | ídem | **`OpenSans_400Regular`**, **`OpenSans_600SemiBold`**, **`OpenSans_700Bold`** (`.ttf` de 130.832, 130.760 y 130.860 bytes). |

Carga: `import { useFonts } from '@expo-google-fonts/nunito/useFonts'` (también existe en `open-sans`) o `useFonts` de `expo-font` con el objeto `{ Nunito_600SemiBold, … }`. **Hay que citar el `fontFamily` entre comillas** (la doc de `expo/google-fonts` lo remarca). Con la escala de Obelisco (§2 de `02-obelisco-tokens.md`) alcanzan estos 6 archivos (789.000 bytes en total, ≈ 0,79 MB): títulos 700/600 (Nunito), headline 700/600 (Nunito), texto 400 (Open Sans) y 600/700 (Open Sans) para énfasis. **No cargar itálicas** ni otros pesos. No usar `@expo-google-fonts/dev` (descarga por red en ejecución; contradice `05-privacidad.md`). Los `.ttf` se empaquetan en el binario.

### Almacenamiento, datos y red

| Herramienta | Versión a fijar | Última en npm | Fuente | Notas de compatibilidad |
|---|---|---|---|---|
| **`react-native-mmkv`** | **4.3.2** | 4.3.2 | Context7 `/margelo/react-native-mmkv` (`README.md`, `docs/WRAPPER_REACT_QUERY.md`, `docs/V4_UPGRADE_GUIDE.md`), npm | Requiere RN ≥ 0.76 (README) y New Architecture. Instalación en Expo: `npx expo install react-native-mmkv react-native-nitro-modules` y build de dev client (`prebuild`). API: `createMMKV()`, `getString`/`set`/`remove`. En Jest **se usa un mock automático** (README, "Testing with Jest or Vitest"), así que `createMMKV()` funciona en los tests sin configurar nada. Publicada el 2026-06-22. |
| **`react-native-nitro-modules`** | **0.37.1** (alternativa probada por la propia librería: 0.35.9) | 0.37.1 | Context7 `/margelo/nitro` (`troubleshooting.md`, `NativeNitroModules.ts`), npm | `react-native-mmkv@4.3.2` declara el peer como `*`, pero se construyó y testeó contra **0.35.9** y RN 0.85.3 (sus `devDependencies`); no hay una combinación publicada con RN 0.88. El runtime exige que la versión nativa y la de JS **coincidan** y que haya **una sola copia** en `node_modules` (si no, "Nitro was installed twice"). **Sin verificar en dispositivo:** hay que confirmarlo en el primer build del dev client (tarea 3.2/3.9); si falla con 0.37.1, bajar a 0.35.9. Con pnpm, declararla como dependencia directa de `apps/mobile` para que haya una única copia. |
| **`@tanstack/react-query`** | **5.105.1** | 5.105.1 | ver tabla de la Fase 1, npm | Sin cambios. Peers: `react ^18 \|\| ^19`. |
| **`@tanstack/query-async-storage-persister`** | **5.105.1** | 5.105.1 | Context7 `/tanstack/query` (`plugins/createSyncStoragePersister.md`), Context7 `/margelo/react-native-mmkv` (`docs/WRAPPER_REACT_QUERY.md`), npm | **Es el persister a usar con MMKV.** La doc de TanStack marca **`createSyncStoragePersister` como deprecado** ("se va a eliminar en la próxima major; usá `@tanstack/query-async-storage-persister`"), así que `@tanstack/query-sync-storage-persister` (5.105.1 existe en npm) **no se instala**. MMKV es síncrono, pero el persister acepta un storage con `getItem`/`setItem`/`removeItem` que puede devolver valores directos. Adaptador oficial de MMKV: `getItem` devuelve `null` si `getString` da `undefined`. |
| **`@tanstack/react-query-persist-client`** | **5.105.1** | 5.105.1 | Context7 `/tanstack/query`, `/margelo/react-native-mmkv`, npm | Aporta `PersistQueryClientProvider`. Peer: `@tanstack/react-query ^5.105.1`. |
| **`@react-native-community/netinfo`** | **12.0.1** | 12.0.1 | `bundledNativeModules.json` (versión exacta), npm | Para `onlineManager.setEventListener` (ver tabla de la Fase 1). `peerDependencies`: `react *`, `react-native >=0.59`. Publicada el 2026-02-14. |

### Tests

| Herramienta | Versión a fijar | Última en npm | Fuente | Notas de compatibilidad |
|---|---|---|---|---|
| **`jest`** | **30.5.2** | 30.5.2 | npm (`peerDependencies` de `jest-expo`: `^29 \|\| ^30`) | Jest 30. |
| **`jest-expo`** | **58.0.13** | 58.0.13 | `bundledNativeModules.json` (`~58.0.13`), Context7 `/websites/expo_dev` (`develop/unit-testing`), npm | Preset: `"preset": "jest-expo"`. Con **pnpm** la doc da un `transformIgnorePatterns` propio que incluye `.pnpm` en la negación: `node_modules/(?!(.pnpm\|(jest-)?react-native\|@react-native(-community)?\|expo(nent)?\|@expo(nent)?/.*\|@expo-google-fonts/.*\|react-navigation\|@react-navigation/.*\|@sentry/react-native\|native-base\|react-native-svg))`. Agregar también `react-native-mmkv` y `react-native-nitro-modules` si Jest los intenta transformar. **Peer obligatorio nuevo:** `@react-native/jest-preset ^0.88.1`. |
| **`@react-native/jest-preset`** | **0.88.1** | 0.88.1 | npm (`peerDependencies` de `jest-expo`) | `devDependency`; `peerDependencies` propias: `react ^19.2.3`. |
| **`@testing-library/react-native`** | **14.1.0** | 14.1.0 | Context7 `/callstack/react-native-testing-library` (guía `migration-v14.md`, `api/jest-matchers.md`), npm | Pide React ≥ 19, RN ≥ 0.78 y Node `^22.13 \|\| >=24` (cumplido). **v14 cambia la API: `render`, `renderHook`, `fireEvent` y `act` son asíncronos** (`await render(...)`). Context7 indexa solo v13.3.3 y v13.2.0; la parte de v14 salió de la documentación de la rama principal del propio repo. `expo-router` pide `>= 14.0.0` como peer opcional. |
| **`test-renderer`** | **1.3.0** | 1.3.1 | Context7 `/callstack/react-native-testing-library` (`migration-v14.md`), npm | **Reemplaza a `react-test-renderer`** en RNTL 14 (peer obligatorio, `^1.0.0`). Se fija la **1.3.0** porque es la versión exacta que trae `jest-expo@58.0.13` como dependencia: así hay una sola copia. |
| **`react-test-renderer`** | **no instalar** | 19.3.1 | Context7 (`migration-v14.md`: "remove React Test Renderer and its types, then add Test Renderer"), npm | React lo deprecó; RNTL 14 ya no lo usa. Sigue existiendo en npm (19.3.1) pero **no hace falta** con React 19.3. Tampoco `@types/react-test-renderer`. |
| **`@testing-library/jest-native`** | **no instalar** | 5.4.3 | npm (`deprecated`), Context7 (`api/jest-matchers.md`) | **Deprecado**: el propio paquete dice "usá los matchers integrados de `@testing-library/react-native` v12.4+". RNTL 14 trae `toBeOnTheScreen`, `toHaveTextContent`, `toBeEnabled`/`toBeDisabled`, `toBeVisible`, `toHaveStyle`, `toHaveAccessibleName`, etc., disponibles con solo importar RNTL. |
| **`@types/jest`** | **30.0.0** | 30.0.0 | npm | Alineado con Jest 30. |

### Lint

| Herramienta | Versión a fijar | Última en npm | Fuente | Notas de compatibilidad |
|---|---|---|---|---|
| **`eslint-plugin-react-hooks`** | **7.1.1** | 7.1.1 | Context7 `/reactjs/react.dev` (preset `recommended-latest`), npm, prueba local | Declara `eslint` hasta `^10.0.0`. **Probado con ESLint 10.14.0**: `reactHooks.configs.flat['recommended-latest']` carga y reporta `rules-of-hooks`, `exhaustive-deps` y las reglas del compilador (`set-state-in-effect`). |
| **`eslint-plugin-react`** | **no instalar** (7.37.5) | 7.37.5 | npm, prueba local | **No funciona con ESLint 10**: su `peerDependencies` llega solo a `eslint ^9.7`, y al correrlo con ESLint 10.14.0 falla en cada archivo con `TypeError: Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function`. Es la última publicada (`latest` = 7.37.5; la rama `next` es 7.8.0-rc.0, anterior). |
| **`eslint-config-expo`** | **no usar con ESLint 10** (58.0.4) | 58.0.4 | npm, Context7 `/websites/expo_dev` (`guides/using-eslint`), prueba local | Declara `eslint >=8.10`, pero depende de `eslint-plugin-react@^7.37.3`, así que **hereda la falla de arriba con ESLint 10**. **Probado con ESLint 9.39.5**: carga y corre (`import/no-unresolved` solo se queja de que `react` no estaba instalado en la carpeta de prueba). |
| **ESLint** | **10.14.0** (raíz) | 10.14.0 | Fase 2 | La raíz ya usa ESLint 10 + `typescript-eslint`. Ver decisión 4. |

### Íconos, EAS y Fase 4

| Herramienta | Versión a fijar | Última en npm | Fuente | Notas de compatibilidad |
|---|---|---|---|---|
| **`@material-symbols/svg-400`** | **0.48.2** | 0.48.2 | npm, `cdn.jsdelivr.net` (HTTP 200 de cada ícono; ver `08-design-system.md`) | Reconfirmada hoy. Licencia **Apache-2.0** (campo `license` del `package.json` publicado y archivo `LICENSE`). Los SVG son de 48 px con `viewBox="0 -960 960 960"`. |
| **`eas-cli`** | **27.2.0** | 27.2.0 | npm (`engines`: node `^20.18.3 \|\| >=22.0.0`) | **Solo versión: no se consultó Context7.** No va como dependencia del monorepo; correr con `npx eas-cli@27.2.0` o instalarla global. Publicada el 2026-10-29. |
| `@maplibre/maplibre-react-native` | *(Fase 4, no fijar)* 11.5.1 | 11.5.1 | npm | `peerDependencies`: `expo >=54`, `react >=19.1`, `@types/react >=19.1`, `react-native >=0.80`, `@types/geojson ^7946`. Cumple con SDK 58 / RN 0.88. Plugin de config en `app.json` (ver tabla de la Fase 1). |
| `expo-location` | *(Fase 4, no fijar)* 58.0.20 | 58.0.20 | `bundledNativeModules.json` (`~58.0.20`), npm | Permiso "mientras se usa" (S32). Se instala con `npx expo install` en la Fase 4. |

**Decisiones que esto pide a la Fase 3:**

1. **No instalar `@testing-library/jest-native`:** está deprecado; usar los matchers integrados de RNTL 14 (`toBeOnTheScreen`, `toHaveTextContent`, …).
2. **Tests con RNTL 14 (no 13):** reemplaza `react-test-renderer` por `test-renderer@1.3.0`, y `render`/`fireEvent`/`act` son asíncronos. Hay que escribir los tests con `await`. `jest-expo` 58 además exige `@react-native/jest-preset@0.88.1`.
3. **`transformIgnorePatterns` para pnpm** de la doc de Expo en el `jest` de `apps/mobile` (incluye `.pnpm` y `@expo-google-fonts` y `react-native-svg`).
4. **Lint de `apps/mobile`:** `eslint-config-expo` no corre con ESLint 10. Dos caminos: **(A, recomendado)** seguir con la config raíz (ESLint 10 + `typescript-eslint`) y sumar solo `eslint-plugin-react-hooks@7.1.1` (`flat['recommended-latest']`), sin `eslint-plugin-react` ni `eslint-config-expo`; un solo ESLint en todo el monorepo y las reglas de hooks, que son las que importan en RN. **(B)** `eslint@9.39.5` + `eslint-config-expo@58.0.4` solo dentro de `apps/mobile` (probado que carga), a costa de dos versiones de ESLint y de que `pnpm lint` use dos configuraciones. Subir a ESLint 10 con `eslint-config-expo` queda esperando una versión de `eslint-plugin-react` que lo soporte. Lo decide quien haga la 3.2.
5. **Persister de TanStack Query:** `@tanstack/query-async-storage-persister` + `@tanstack/react-query-persist-client` con el adaptador de MMKV; no usar el persister síncrono (deprecado).
6. **Nitro/MMKV:** fijar `react-native-nitro-modules@0.37.1` como dependencia directa y probar el primer dev build; fallback `0.35.9`. Es el riesgo abierto principal de esta tabla.
7. **Alinear a la plantilla del SDK, no a `latest`:** `react` 19.3.0 (no 19.3.1) y `react-native-safe-area-context` 5.10.1 (no 5.11.0). Tras `npx expo install`, convertir los `~` en versión exacta y correr `npx expo install --check`.
8. **Fuentes:** cargar solo los 6 archivos de arriba y usar los `fontFamily` `Nunito_*` / `OpenSans_*` tal cual figuran. *(Reemplazadas por Fira Sans en la Fase 5: ver «Fase 5: tipografía…».)*
9. **Antigüedad mínima de pnpm (1 día):** las versiones de esta tabla ya la cumplen; si 3.2 se corre en un día en que una versión de la tabla tuviera menos de 24 h (no es el caso hoy), esperar en lugar de agregarla a `minimumReleaseAgeExclude`.

## Instaladas en la Fase 3 (2026-11-02)

Cierre de la tarea 3.1: lo que **quedó** en `apps/mobile/package.json` y resuelto en `pnpm-lock.yaml` al 2026-11-02. Todas son versiones exactas (sin `~` ni `^`); `@transportate/contracts` es `workspace:*`. La columna "vs. 3.1" compara con la tabla "Verificadas para la Fase 3": "igual" significa que la versión es la planificada.

### `dependencies`

| Paquete                                      | Versión instalada | vs. 3.1                                                                                                                      |
| -------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `expo`                                       | 58.0.22           | igual                                                                                                                        |
| `expo-router`                                | 58.0.29           | igual                                                                                                                        |
| `expo-dev-client`                            | 58.0.18           | igual                                                                                                                        |
| `expo-constants`                             | 58.0.14           | igual                                                                                                                        |
| `expo-font`                                  | 58.0.11           | igual                                                                                                                        |
| `expo-haptics`                               | 58.0.7            | igual                                                                                                                        |
| `expo-linking`                               | 58.0.15           | igual                                                                                                                        |
| `expo-splash-screen`                         | 58.0.12           | igual                                                                                                                        |
| `expo-status-bar`                            | 58.0.4            | igual                                                                                                                        |
| `react`                                      | 19.3.0            | igual (la de la plantilla del SDK, no la 19.3.1)                                                                             |
| `react-dom`                                  | 19.3.0            | **difiere:** 3.1 decía que no hacía falta sin web; la app lo declara porque `expo` y `expo-router` lo piden como peer       |
| `react-native`                               | 0.88.1            | igual                                                                                                                        |
| `react-native-safe-area-context`             | 5.10.1            | igual (no la 5.11.0)                                                                                                         |
| `react-native-screens`                       | 4.30.1            | igual                                                                                                                        |
| `react-native-svg`                           | 15.16.0           | igual (la que elige `expo install` para SDK 58)                                                                              |
| `@expo-google-fonts/nunito`                  | 0.4.2             | igual                                                                                                                        |
| `@expo-google-fonts/open-sans`               | 0.4.2             | igual                                                                                                                        |
| `@material-symbols/svg-400`                  | 0.48.2            | igual                                                                                                                        |
| `react-native-mmkv`                          | 4.3.2             | igual                                                                                                                        |
| `react-native-nitro-modules`                 | 0.37.1            | igual: la opción recomendada en 3.1 (fallback 0.35.9). **Confirmada en Jest y en `expo export`, no en un dev build real**    |
| `@tanstack/react-query`                      | 5.105.1           | igual                                                                                                                        |
| `@tanstack/query-async-storage-persister`    | 5.105.1           | igual (el persister síncrono, deprecado, no se instaló)                                                                      |
| `@tanstack/react-query-persist-client`       | 5.105.1           | igual                                                                                                                        |
| `@react-native-community/netinfo`            | 12.0.1            | igual                                                                                                                        |
| `zod`                                        | 4.6.7             | **no estaba en 3.1:** el cliente API valida con los esquemas de `@transportate/contracts`, que usan Zod 4 (misma versión que Fase 2) |
| `@transportate/contracts`                    | `workspace:*`     | **no estaba en 3.1:** contratos v1 compartidos con el proxy                                                                  |

### `devDependencies`

| Paquete                         | Versión instalada | vs. 3.1                                                                                                    |
| ------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `typescript`                    | 6.0.3             | igual                                                                                                      |
| `@types/react`                  | 19.3.0            | igual                                                                                                      |
| `@types/jest`                   | 30.0.0            | igual                                                                                                      |
| `jest`                          | 30.5.2            | igual                                                                                                      |
| `jest-expo`                     | 58.0.13           | igual                                                                                                      |
| `@testing-library/react-native` | 14.1.0            | igual                                                                                                      |
| `eslint-plugin-react-hooks`     | 7.1.1             | igual (sin `eslint-plugin-react` ni `eslint-config-expo`, decisión 4 de 3.1)                               |
| `react-native-svg-transformer`  | 1.5.3             | **no estaba en 3.1:** lo agregó la tarea 3.5 para importar los `.svg` como componentes (Context7 `/kristerkari/react-native-svg-transformer`) |

ESLint 10.14.0 y Prettier 3.9.10 siguen en el `package.json` de la raíz, no en el de la app.

### Peers resueltos solo en el lockfile (`autoInstallPeers`)

No figuran en el `package.json` de la app pero quedaron instalados, con estas versiones:

| Paquete                       | Versión en el lockfile | Comentario                                                                                                                               |
| ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `test-renderer`               | 1.3.0                  | igual a lo planificado en 3.1 (la versión exacta que trae `jest-expo`), pero **no está declarado**: llega como peer de RNTL 14           |
| `@react-native/jest-preset`   | 0.88.1                 | igual a lo planificado en 3.1, tampoco declarado: llega como peer de `jest-expo`                                                          |
| `react-native-reanimated`     | 4.7.1                  | **3.1 decía que no hacía falta instalarlo.** Llega como peer opcional resuelto automáticamente; no lo usa ninguna pantalla              |
| `react-native-worklets`       | 0.13.1                 | ídem. El SDK 58 declara `0.13.0` en `bundledNativeModules.json`                                                                           |
| `react-native-gesture-handler` | 3.4.0                 | ídem. El SDK 58 declara `~3.3.0`: **la versión resuelta no coincide con la del SDK**                                                     |

Si la Fase 4 necesita animaciones o gestos (por ejemplo, el bottom sheet de S24), conviene declarar estos tres con `pnpm expo install` para que queden alineados al SDK, en lugar de depender del lockfile.

**Diferencias con lo planificado, en una línea:** (1) `react-dom` y `zod` se declararon de más respecto de 3.1; (2) se sumaron `@transportate/contracts` y `react-native-svg-transformer`; (3) `test-renderer` y `@react-native/jest-preset` quedan solo como peers resueltos por pnpm; (4) `react-native-gesture-handler` 3.4.0 y `react-native-worklets` 0.13.1 quedaron por encima de lo que fija el SDK; (5) Nitro 0.37.1 se confirmó solo en Jest, con el fallback 0.35.9 sin usar. `eas-cli` 27.2.0 no está en el monorepo (se corre con `npx eas-cli@27.2.0`).

## Instaladas en la Fase 4 (tarea 4.0) — 2026-11-03

Dependencias nativas de toda la Fase 4 en un solo commit, para reconstruir el dev client una sola vez. Las de Expo y Software Mansion se instalaron con `pnpm exec expo install` (versiones de `bundledNativeModules.json` del SDK 58) y después se pasaron a versión exacta. `npx expo install --check`: "Dependencies are up to date"; `npx expo-doctor`: 20/20.

| Paquete | Versión | Para qué tarea | Cómo se verificó |
|---|---|---|---|
| `@maplibre/maplibre-react-native` | **11.5.1** | 4.3, 4.6 (ADR-0002) | npm (última). Peers: `expo >=54`, `react >=19.1`, `react-native >=0.80`, `@types/geojson ^7946`. Solo New Architecture. Context7 `/websites/maplibre_maplibre-react-native` (setup Expo: plugin obligatorio en iOS). No está en `bundledNativeModules.json`, así que `expo install` toma la última |
| `@types/geojson` (dev) | **7946.0.16** | 4.3, 4.6 | Peer de MapLibre, declarado para tipar los GeoJSON propios. npm |
| `expo-location` | **58.0.20** | 4.7 | `bundledNativeModules.json` (`~58.0.20`), Context7 `/websites/expo_dev` (config plugin) y lectura de `plugin/build/withLocation.d.ts` (opciones `locationWhenInUsePermission`, `…Always…: false`) |
| `react-native-reanimated` | **4.7.1** | 4.6, 4.9 | `bundledNativeModules.json` (4.7.1). Peers: `react-native 0.86-0.88` y `react-native-worklets 0.13.x`. Context7 `/software-mansion/react-native-reanimated` (4.7.1: plugin en Worklets; guía de Jest) |
| `react-native-worklets` | **0.13.0** | 4.6, 4.9 | `bundledNativeModules.json` (0.13.0; npm ya tiene 0.13.1). Antes era solo un peer resuelto en el lockfile, en 0.13.1 |
| `react-native-gesture-handler` | **3.3.0** | 4.6, 4.9 | `bundledNativeModules.json` (`~3.3.0`; npm ya tiene 3.4.0). Antes era solo un peer en el lockfile, en 3.4.0, que no coincidía con el SDK. Context7 `/software-mansion/react-native-gesture-handler` (guía de testing, `jestSetup.js`) |

**Evaluadas y no instaladas:**

- `@gorhom/bottom-sheet` 5.2.14. Descartada: el detalle de línea de colectivos (4.6) usa un `BottomPanel` propio (Gesture Handler + Reanimated, sin dependencia nueva) y no la `formSheet` nativa, que es una ruta modal y chocaba con el gesto de volver (F4-colectivos-mapa-1).
- `react-native-reorderable-list` 0.18.3. Era la elegida para 4.9 y es puro JS: se instaló en 4.9 sin rebuild (ver abajo).
- `react-native-draggable-flatlist` 4.0.3. Descartada: sin releases desde 2025-05.

El detalle de estas decisiones está en `apps/mobile/src/shared/map/README.md`.

**Sin `babel.config.js` ni cambios en `metro.config.js`.** `babel-preset-expo` 58.0.23 agrega `react-native-worklets/plugin` solo, y lo verifiqué: un bundle de prueba con `useAnimatedStyle` sale con `__workletHash`. Jest usa los setups oficiales de cada librería y un resolver propio (`apps/mobile/test/mocks/resolver.js`), porque con pnpm el resolver de Worklets confunde la carpeta de Reanimated con la suya.

### Instalada después de 4.0: `react-native-reorderable-list` (tarea 4.9) — 2026-11-03

| Paquete | Versión | Para qué tarea | Cómo se verificó |
|---|---|---|---|
| `react-native-reorderable-list` | **0.18.3** | 4.9 (arrastre en Favoritos) | npm (`apps/mobile/package.json`, versión exacta). Licencia MIT, publicada el 2026-11-01. Peers: `react: *`, `react-native: *`, `react-native-reanimated >=3.12.0` y `react-native-gesture-handler >=2.12.0`, que cumplen con Reanimated 4.7.1 y Gesture Handler 3.3.0. **Puro JS** (el paquete trae solo `lib/` y `src/`): no pidió rebuild del dev client. Context7 `/omahili/react-native-reorderable-list`. En Jest tiene mock propio (`test/mocks/reorderable-list.tsx`): la librería llama a `useAnimatedRef()` como función y en Jest Reanimated devuelve un objeto |

### Resumen de las dependencias nuevas de la Fase 4

Todas con versión exacta en `apps/mobile/package.json` y verificadas arriba. Revisadas contra `package.json` el 2026-11-03 al cierre de la fase: no falta ninguna.

| Paquete | Versión | Tipo | Tarea | ¿Nativa? |
|---|---|---|---|---|
| `@maplibre/maplibre-react-native` | 11.5.1 | `dependencies` | 4.3, 4.6 | Sí |
| `expo-location` | 58.0.20 | `dependencies` | 4.7 | Sí |
| `react-native-reanimated` | 4.7.1 | `dependencies` | 4.6, 4.9 | Sí |
| `react-native-worklets` | 0.13.0 | `dependencies` | 4.6, 4.9 | Sí |
| `react-native-gesture-handler` | 3.3.0 | `dependencies` | 4.6, 4.9 | Sí |
| `react-native-reorderable-list` | 0.18.3 | `dependencies` | 4.9 | No (JS puro) |
| `@types/geojson` | 7946.0.16 | `devDependencies` | 4.3, 4.6 | No (tipos) |

El único script nuevo es `"licencias"` (`node scripts/licencias.mjs`, sin dependencias). El dev client se reconstruyó una sola vez para todo lo nativo; ver la bitácora, Fase 4.

## Fase 5: tipografía de la dirección «Señalética de terminal» (F5-HIGH-A) — 2026-11-03

Reemplaza a Nunito y Open Sans (tarea 3.4; filas de arriba quedan como historial). Una sola familia en títulos y texto; la tipografía es libre por decisión del usuario (2026-11-03).

| Paquete | Versión | Tipo | Fuente | Notas |
|---|---|---|---|---|
| **`@expo-google-fonts/fira-sans`** | **0.4.1** | `dependencies` | npm (`npm view @expo-google-fonts/fira-sans@0.4.1`); subpaths verificados en `node_modules` | Licencia `MIT AND OFL-1.1`. Se importa **por peso**: `@expo-google-fonts/fira-sans/400Regular`, `/600SemiBold`, `/700Bold`, que exportan **`FiraSans_400Regular`**, **`FiraSans_600SemiBold`**, **`FiraSans_700Bold`** (mismo patrón que nunito/open-sans, verificado en el `index.js` de cada subpath). `.ttf` de 440.984, 473.160 y 473.876 bytes (1.388.020 en total, ≈ 1,39 MB: cubre más glifos que Nunito/Open Sans). Carga con `useFonts` de `expo-font` en `src/shared/fonts`; nada se descarga por red. Sin itálicas ni otros pesos. |
| ~~`@expo-google-fonts/nunito`~~ | — | quitada | — | Ya no se usa: Fira Sans la reemplaza en títulos. |
| ~~`@expo-google-fonts/open-sans`~~ | — | quitada | — | Ya no se usa: Fira Sans la reemplaza en texto. |

`licencias.json` se regeneró con `pnpm licencias` (30 paquetes).

## Parches del SDK 58 (`npx expo install --fix`) — 2026-11-04

El usuario corrió `npx expo install --fix` el 2026-11-04 (11:15, hora local) y el coordinador formalizó la suba ese mismo día: versiones **exactas** en `apps/mobile/package.json` (el comando escribe rangos `~`), lockfile regenerado y `npx expo install --check` en verde («Dependencies are up to date»). «Publicada» sale de `npm view <paquete>@<versión> time`; como todas tenían menos de 1 día al instalarse, se agregaron a `minimumReleaseAgeExclude` en `pnpm-workspace.yaml` (con sus dependencias transitivas nuevas: `@expo/cli` 58.1.19, `@expo/config` 58.0.11, `@expo/config-plugins` 58.0.12, `@expo/metro-config` 58.0.21, `expo-modules-core` 58.0.30, `babel-preset-expo` 58.0.24, etc.).

| Paquete | Antes | Ahora | Publicada (UTC) | Notas |
|---|---|---|---|---|
| **`expo`** | 58.0.22 | **58.0.23** | 2026-11-03 17:06 | `bundledNativeModules.json` de esta versión es el que alinea las filas de abajo. |
| **`expo-constants`** | 58.0.14 | **58.0.15** | 2026-11-03 16:33 | — |
| **`expo-linking`** | 58.0.15 | **58.0.16** | 2026-11-03 16:51 | — |
| **`expo-router`** | 58.0.29 | **58.0.30** | 2026-11-03 17:06 | — |
| **`expo-splash-screen`** | 58.0.12 | **58.0.13** | 2026-11-03 16:34 | — |
| **`react-native-safe-area-context`** | 5.10.1 | **5.11.1** | 2026-11-03 02:24 | El SDK pasó de `~5.10.1` a `~5.11.1` (la fila de la Fase 3 decía «no usar la 5.11.0»; ya no aplica). Módulo nativo: el dev build siguiente la incorpora. |
| **`jest-expo`** | 58.0.13 | **58.0.14** | 2026-11-03 16:09 | **Cambio de comportamiento en los tests:** mockea el registro de assets de React Native (`src/private/assets/AssetRegistry.js`), así que los `.ttf` cargan en Jest y `useFonts` ya no falla. `test/fonts.test.tsx` cubre el error mockeando `useFonts` (jest-expo crea una instancia nueva del módulo nativo en cada `requireNativeModule`, así que no se puede hacer fallar el `loadAsync` de expo-font desde el test) y suma la carga real en verde; `test/layout.test.tsx` mockea `useAppFonts` para cubrir los dos caminos. |

Sin cambios: `expo-dev-client` 58.0.18, `expo-font` 58.0.11, `react-native` 0.88.1, `react-native-screens` 4.30.1 (siguen siendo lo que pide el SDK 58.0.23).

## Pendiente de fijar

Todavía **sin versión fijada** ni consulta a Context7 (el resto se hace al inicio de cada fase):

| Fase | Herramienta | Qué falta |
|---|---|---|
| 2 | `autocannon` | prueba de carga local (2.12) |
| 2 | Cómo testear Cache API y rate limit con `@cloudflare/vitest-plugin`; configuración compartida de ESLint/Prettier/TS en el monorepo | probar en `apps/proxy` |
| 3 | `eas-cli` | consultar Context7 (solo se verificó la versión en npm) |
| 3 | `react-native-nitro-modules` con `react-native-mmkv` en RN 0.88 | confirmar en el primer dev build (decisión 6); hasta ahora solo en Jest y `expo export` |
| 4 | `@maplibre/maplibre-react-native` + `react-native-nitro-modules`/MMKV en el dev build con MapLibre | el coordinador lanzó un segundo dev build en EAS (`cabc9c80`) con las dependencias nativas nuevas (ver bitácora); falta confirmar su comportamiento en el iPhone con `docs/11-prueba-manual.md` |
| 5 | EAS Build / Update | si se usa OTA, declararlo en `05-privacidad.md` |

Cada fila se cierra con: versión fijada, fecha, y fuente consultada.
