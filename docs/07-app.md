# 07 — App móvil (`apps/mobile`)

Referencia técnica de la app de Transportate al cierre de la Fase 3. Es la base sobre la que se construyen las features de la Fase 4. La guía de uso diario (instalar, correr, EAS) está en [`../apps/mobile/README.md`](../apps/mobile/README.md). El sistema de diseño en código está en [`08-design-system.md`](08-design-system.md) y los tests en [`09-testing.md`](09-testing.md) §8.

**Stack:**

- Expo SDK 58 (React Native 0.88.1, React 19.3.0) con New Architecture.
- Expo Router 58 con rutas tipadas.
- TypeScript 6 strict.
- MMKV 4, TanStack Query 5 y Zod 4.

Las versiones exactas y su verificación están en [`versiones.md`](versiones.md).

## 1. Estructura de carpetas

```
apps/mobile/
├── app.config.ts            # Expo: nombre, scheme, splash, plugins, typed routes, tsconfigPaths
├── eas.json                 # perfiles development, development-simulator, preview, production
├── metro.config.js          # react-native-svg-transformer (íconos)
├── jest.config.js           # preset jest-expo, transformIgnorePatterns para pnpm, transformer de .svg
├── jest.setup.ts            # stub de react-native-nitro-modules
├── test/                    # tests de integración y de módulos (los de componentes van junto a ellos)
└── src/
    ├── app/                 # rutas de Expo Router (cada archivo es una pantalla)
    ├── features/            # lógica por feature: inicio, colectivos, subtes, transito, favoritos, ajustes
    └── shared/
        ├── api/             # cliente del proxy y QueryClient (tarea 3.9)
        ├── fonts/           # carga de Nunito y Open Sans
        ├── icons/           # Icon + mapa curado de Material Symbols
        ├── storage/         # KeyValueStore (MMKV), persister de queries, preferencias
        ├── theme/           # tokens Obelisco + ThemeProvider
        └── ui/              # 15 componentes compartidos
```

**Reglas:**

- `src/app/` solo tiene rutas y layouts. La lógica va en `features/<feature>` y lo reutilizable en `shared/`.
- Los tests no van dentro de `src/app/`, porque todo archivo ahí es una ruta.
- El alias `@/…` apunta a `src/…`. Lo resuelven TypeScript, Metro y Jest.

## 2. Navegación

Mapa de [`briefs/README.md`](briefs/README.md), con la corrección de **4 tabs** de [`00-plan.md`](00-plan.md) ("Correcciones tras la Fase 1").

| Ruta                                                            | Pantalla                                         | Archivo                                   |
| --------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| `/`                                                             | Redirige a `/inicio`                             | `src/app/index.tsx`                       |
| `/inicio`                                                       | Inicio. Botón "Ajustes" en el header             | `(tabs)/inicio/index.tsx`                 |
| `/inicio/ajustes` → `/inicio/acerca`                            | Ajustes → Acerca de (stack dentro de Inicio, S2) | `(tabs)/inicio/ajustes.tsx`, `acerca.tsx` |
| `/colectivos` → `/colectivos/:linea` → `/colectivos/parada/:id` | Colectivos → línea → parada                      | `(tabs)/colectivos/…`                     |
| `/subtes` → `/subtes/:linea` → `/subtes/estacion/:id`           | Subtes → línea → estación                        | `(tabs)/subtes/…`                         |
| `/favoritos`                                                    | Favoritos                                        | `(tabs)/favoritos/index.tsx`              |
| `/transito`                                                     | **Oculto** (no navegable)                        | `(tabs)/transito/…`                       |
| cualquier otra                                                  | "No encontramos esta pantalla" + link a Inicio   | `+not-found.tsx`                          |

- **Tabs nativas** (`NativeTabs` de `expo-router/native-tabs`): UITabBarController en iOS y la barra de Material en Android.
  - No tienen header: cada tab anida su `Stack`, con back nativo y `headerBackTitle` "Atrás" en iOS.
  - Íconos provisorios: SF Symbols (`sf`) y Material Symbols (`md`) del sistema. Se reemplazan por `Icon` cuando las tabs acepten imágenes propias.
- **Tránsito oculto:** el trigger va con `hidden`. Decisión del usuario del 2026-11-01: el upstream devuelve 500 y las tareas 2.7 y 4.8 están diferidas.
- **Rutas tipadas:** `experiments.typedRoutes`. `expo start` genera `.expo/types/router.d.ts` y `expo-env.d.ts`, que no se commitean. `tsc` pasa con y sin ellos.
- **Deep links:** el scheme es `transportate`, pero los deep links quedan fuera del MVP (suposición del brief).

## 3. Providers y orden de montaje

El layout raíz (`src/app/_layout.tsx`):

1. Llama a `SplashScreen.preventAutoHideAsync()` en el scope del módulo.
2. Espera las fuentes (`useAppFonts`) y oculta el splash cuando cargan **o fallan**.
3. Monta los providers.

Orden, de afuera hacia adentro (`src/app/_layout.tsx`):

```
SafeAreaProvider
└── ThemeProvider            (store: createThemePreferenceStore(kv))
    └── QueryProvider        (QueryClient + persister; tarea 3.9)
        └── RefreshIntervalProvider (store: createRefreshIntervalStore(kv); tarea 3.9)
            └── FavoritosProvider   (repository: MmkvFavoritosRepository)
                └── Stack (tabs + not-found) + StatusBar automática
```

> Montado en la tarea **3.9**. Los stores de tema e intervalo se crean una vez sobre `getDefaultKeyValueStore()` (MMKV); el detalle de datos y red está en `apps/mobile/src/shared/query/README.md`.

Todos los providers reciben sus dependencias por prop, con un default de producción (MMKV). Los tests pasan versiones en memoria: `MemoryKeyValueStore`, `createMemoryPreferenceStore`. Ningún provider lee estado global oculto.

## 4. Tema

- **Tokens:** `src/shared/theme/tokens.ts`. Cada valor cita [`02-obelisco-tokens.md`](02-obelisco-tokens.md), y los valores y contrastes están en [`../DESIGN.md`](../DESIGN.md).
- **Preferencia:** `system` (default), `light` o `dark` (S18).
  - `ThemeProvider` la resuelve contra `useColorScheme()`; cualquier valor que no sea `dark` cuenta como claro.
  - Se persiste con `createThemePreferenceStore(kv)`, en la clave `transportate.pref.theme.v1`.
- **`useTheme()`** devuelve `{ scheme, colors, typography, fontFamily, space, radius, borderWidth, component, motion, preference, setPreference }`. Fuera de un provider devuelve el tema claro de solo lectura.
- **Texto:**
  - `textStyle(variant)` da `fontFamily`, `fontSize` y `lineHeight`. No setea `fontWeight`, porque en RN cada peso es una familia distinta.
  - `fontScaleCap(variant)` da el tope de Dynamic Type: 1.2 para títulos y 1.3 para texto (DESIGN.md §3.2).
  - El componente `Text` de `shared/ui` aplica las dos cosas.

## 5. Fuentes

- **Qué se carga:** 6 archivos de `@expo-google-fonts` 0.4.2, `Nunito_400Regular`/`600SemiBold`/`700Bold` y `OpenSans_400Regular`/`600SemiBold`/`700Bold` (unos 0,79 MB).
  - Se cargan con `useFonts` de `expo-font` en `src/shared/fonts`.
  - Viajan en el bundle: no hay descargas en ejecución.
- **Nombres:** `fontFamilies` (`shared/fonts`) y `fontFamily` (`shared/theme/tokens.ts`) nombran las mismas 6 familias. Los componentes usan las del tema.
- **Por qué `useFonts` y no el plugin de `expo-font`:** con el plugin, el nombre de familia difiere entre iOS y Android.

## 6. Íconos

- `Icon` (`src/shared/icons`) dibuja Material Symbols Rounded FILL 1 (`@material-symbols/svg-400` 0.48.2) con `react-native-svg`.
- Los SVG se importan uno por uno con `react-native-svg-transformer`. Solo existen los 45 usos del mapa curado.
- Detalle y tabla de usos: [`08-design-system.md`](08-design-system.md), "Íconos".

## 7. Almacenamiento local (MMKV)

- **`KeyValueStore`** (`shared/storage/kv.ts`): interfaz síncrona `getString`/`set`/`remove`/`onChange?`.
  - `MmkvKeyValueStore` usa la instancia `transportate` de `react-native-mmkv` 4.3.2 sobre Nitro 0.37.1.
  - `MemoryKeyValueStore` es para tests.
  - Sin cifrado: no hay datos personales ([`05-privacidad.md`](05-privacidad.md)).
- **Claves:** todas versionadas. Si cambia el formato, se sube el sufijo o se agrega una migración.

  | Clave                                  | Contenido                                            | Dueño                              |
  | -------------------------------------- | ---------------------------------------------------- | ---------------------------------- |
  | `transportate.favoritos.v1`            | `FavoritosDocV1` (JSON)                              | `features/favoritos`               |
  | `transportate.pref.theme.v1`           | `"system" \| "light" \| "dark"`                      | `shared/storage/preferences.ts`    |
  | `transportate.pref.refreshInterval.v1` | `15 \| 20 \| 30 \| 60`                               | `shared/storage/preferences.ts`    |
  | `transportate.query-cache.v1`          | caché de TanStack Query (persister, throttle de 1 s) | `shared/storage/queryPersister.ts` |

- **Preferencias:** `createThemePreferenceStore(kv)` y `createRefreshIntervalStore(kv)` tienen la forma `PreferenceStore<T>` (`get`/`set`/`subscribe`).
  - Validan con Zod al leer (un valor inválido da el default) y al escribir (un valor fuera de la lista tira).
  - `usePreference(store)` (`features/ajustes`) las expone a la UI.
  - `THEME_OPTIONS` y `REFRESH_INTERVAL_OPTIONS` traen el copy de Ajustes.

## 8. Favoritos

- **Modelo** (Zod, `features/favoritos/model.ts`):
  - `FavoritoV1 = { id, tipo, refId, nombre, subtitulo?, alias? (≤ 30), orden, creadoEn }`.
  - `tipo` es `linea_colectivo`, `parada_colectivo`, `linea_subte` o `estacion_subte`.
  - Se guardan `nombre` y `subtitulo` porque los ids del upstream pueden cambiar.
- **Repositorio:** `FavoritosRepository` (interfaz) + `MmkvFavoritosRepository(store)`.
  - **Id determinístico** `tipo:refId`: no hay duplicados, y `has(tipo, refId)` resuelve la estrella.
  - **Escritura:** una sola escritura atómica por operación, y `orden` se renumera 0..n−1.
  - **Lectura defensiva:** JSON roto, un esquema inválido o una versión sin migrador dejan la lista vacía, con un log solo en `__DEV__`.
  - **Migraciones:** `migrations.ts` con el patrón `schemaVersion` N → N + 1. Hoy no hay ninguna.
- **Deshacer** (S19): `remove` devuelve el favorito y `restore` lo reinserta en su posición. "Borrar todos" guarda `list()` antes de `clear()`.
- **UI:** `FavoritosProvider` + `useFavoritos()` (sobre `useSyncExternalStore`) + `useFavoritosRepository()`.

## 9. Datos y red

Cliente tipado del proxy y TanStack Query, hechos en la tarea 3.9. El detalle está en [`../apps/mobile/src/shared/api/README.md`](../apps/mobile/src/shared/api/README.md) (cliente, errores, hooks) y [`../apps/mobile/src/shared/query/README.md`](../apps/mobile/src/shared/query/README.md) (`QueryClient`, polling, red). Las rutas del proxy están en [`06-proxy.md`](06-proxy.md).

**Cliente (`src/shared/api`):**

- `createApiClient({ baseUrl, fetch?, now?, timeoutMs?, etagCacheSize? })` tiene un método por ruta `/v1/*`. La URL base sale de `EXPO_PUBLIC_API_URL` (`getApiBaseUrl()`).
- **Validación con Zod:** cada respuesta se valida con los esquemas de `@transportate/contracts`. Un JSON inválido o fuera de contrato es un `ContractError` y no se reintenta.
- **Timeout** de 8 s con `AbortController`.
- **ETag / 304:** guarda en memoria, por URL, el último `ETag` y el cuerpo ya validado (LRU de 64 entradas, no persistido). Manda `If-None-Match` y, ante un `304`, devuelve ese cuerpo con `fromCache: true`.
- **Errores tipados** (`ApiError`, unión por `kind`): `network`, `timeout`, `http`, `contract` y `aborted`, con `retryable` y `userMessage()` en voseo ("No pudimos conectarnos", "El servicio de la Ciudad no responde en este momento.", "Algo falló de nuestro lado."). Los mensajes nunca llevan host, ids ni cuerpo crudo.
- **Frescura:** los feeds llegan con `sourceTimestamp`, `stale` y `ageSeconds`, listos para `FreshnessLabel`. La edad se calcula con `sourceTimestamp` y no con `generatedAt`.
- **Privacidad:** el único header propio es `Accept: application/json` (más `If-None-Match`). Sin User-Agent custom ni ids de dispositivo.
- **Hooks por recurso:** `useEstadoSubtes`, `useAlertasSubtes`, `useArribosEstacion`, `useLineasColectivo`, `usePosicionesLinea`, `useArribosParada` y `useManifest`. Exponen `isPending` (Skeleton), `isRefreshError` (hay datos y falló la actualización: Alert en línea) e `isLoadingError` (sin datos: ErrorState).

**`QueryClient` (`src/shared/query`):**

- `focusManager` conectado a `AppState` y `onlineManager` a NetInfo. Sin conexión, las consultas quedan en pausa (`isPaused`) y la pantalla muestra lo persistido; `useIsOnline()` alimenta el `OfflineBanner`.
- **Polling con jitter solo en primer plano:** el intervalo elegido (15, 20, 30 o 60 s; S17) ± 10 %, recalculado en cada ciclo. En segundo plano no hay polling (`refetchIntervalInBackground: false`); al volver a primer plano o a tener conexión se refresca lo vencido. Los estáticos (líneas de colectivo, manifiesto) no hacen polling.
- **Retry solo de errores `retryable`:** como mucho 3 intentos, con backoff de 1 s, 2 s, 4 s… hasta 30 s y nunca menos que `retryAfterSeconds`.
- `staleTime` = `meta.ttlSeconds` del último dato; `gcTime` de 24 h para servir offline.
- **Último dato bueno:** si una actualización falla y ya había datos, se conservan; la pantalla muestra la Alert "No pudimos actualizar. Mostramos lo último que sabemos." y no el ErrorState.

**Persistencia (`src/shared/storage/queryPersister.ts`):** persister asíncrono de TanStack Query sobre MMKV, clave `transportate.query-cache.v1`, una escritura por segundo como máximo, solo consultas exitosas. `maxAge` de 24 h y `buster: 'v1'` (la versión del contrato): si cambia el esquema, la caché vieja se descarta entera.

**Orden de providers** en `src/app/_layout.tsx`: `SafeAreaProvider` → `ThemeProvider` → `QueryProvider` → `RefreshIntervalProvider` → `FavoritosProvider` → `Stack` (ver §3).

**Estado a la Fase 3:** el cliente y los hooks están probados con `fetch` mockeado (`test/api/`, `src/shared/query/__tests__/`), pero ninguna pantalla los consume todavía: las features de la Fase 4 los usan.

## 10. Variables de entorno

| Variable              | Default (`apps/mobile/.env.example`) | Uso                                                                                                                      |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8787`              | URL base del proxy (`wrangler dev`). En un dispositivo, usá la IP de la red local; en el emulador de Android, `10.0.2.2` |

Las variables `EXPO_PUBLIC_*` quedan embebidas en el bundle. Nunca van secretos.

## 11. Correr y testear

```sh
pnpm install                                  # desde la raíz
cd apps/mobile && pnpm ios                    # o pnpm android: compila el dev client
pnpm test && pnpm lint && pnpm typecheck      # en apps/mobile, o desde la raíz para todo el monorepo
```

La app necesita **dev client** porque MMKV y Nitro son nativos; no anda en Expo Go. La estrategia de tests está en [`09-testing.md`](09-testing.md) §8.

## 12. Decisiones y suposiciones de la Fase 3

**Decisiones:**

| #   | Decisión                                                            | Motivo                                                                                            |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D1  | Tabs nativas (`NativeTabs`) en lugar de `Tabs` JS                   | Plataforma "adaptive" de `PRODUCT.md`; estable en SDK 58                                          |
| D2  | pnpm con linker aislado (sin `hoisted`)                             | Expo lo soporta desde SDK 54; verificado con `expo-doctor` y `expo export`                        |
| D3  | `@types/jsdom` fuera del hoisting (`pnpm-workspace.yaml`)           | Si se iza, mete `lib.dom` en el typecheck del proxy y rompe `caches.default`                      |
| D4  | Fuentes con `useFonts`, no con el plugin                            | Mismo `fontFamily` en iOS, Android y Jest                                                         |
| D5  | Persister asíncrono de TanStack Query sobre MMKV                    | El síncrono está deprecado; el asíncrono acepta métodos síncronos                                 |
| D6  | Nitro 0.37.1 como dependencia directa                               | Una sola copia en `node_modules`. Falta confirmarlo en el primer dev build; el fallback es 0.35.9 |
| D7  | Sin `eslint-plugin-react` ni `eslint-config-expo`                   | No soportan ESLint 10; se usa solo `eslint-plugin-react-hooks` 7.1.1                              |
| D8  | Botón "Ajustes" como `Pressable` + `router.push`, no `Link asChild` | `Link` le pone `role="link"`                                                                      |

**Suposiciones:**

| #    | Suposición                                                                                                                                                                  | Referencia                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| S2   | Ajustes y Acerca de se apilan dentro del tab Inicio                                                                                                                         | `briefs/README.md`                                 |
| S16  | Alias de hasta 30 caracteres. **Fase 3:** el repositorio recorta espacios y **trunca** a 30 caracteres (contando caracteres, no unidades UTF-16); la UI muestra el contador | `briefs/README.md`, `features/favoritos/README.md` |
| S17  | Intervalos de 15, 20 (default), 30 y 60 s; un valor guardado inválido da 20                                                                                                 | `briefs/README.md`                                 |
| S18  | Tema Sistema (default) / Claro / Oscuro; un valor guardado inválido da Sistema                                                                                              | `briefs/README.md`                                 |
| S19  | Deshacer con `remove` + `restore`, no con un diálogo                                                                                                                        | `briefs/README.md`                                 |
| F3-a | Id de favorito `tipo:refId` (agregar dos veces devuelve el existente)                                                                                                       | `features/favoritos/model.ts`                      |
| F3-b | Splash con la marca de `design/brand/` (200 px, `contain`) sobre `#ffffff` en claro y `#1d3343` en oscuro                                                                   | `app.config.ts`                                    |
| F3-c | Identificador nativo `app.transportate.mobile`, confirmado por el usuario el 2026-11-02                                                                                      | `app.config.ts`                                    |
