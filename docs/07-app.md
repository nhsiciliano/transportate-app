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
        ├── static/          # paquete estático versionado: useStaticArchivo + última versión conocida (§13)
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
| `/inicio`                                                       | Inicio (§15). Engranaje "Ajustes" en el header   | `(tabs)/inicio/index.tsx`                 |
| `/inicio/ajustes` → `/inicio/acerca`                            | Ajustes → Acerca de (stack dentro de Inicio, S2) | `(tabs)/inicio/ajustes.tsx`, `acerca.tsx` |
| `/inicio/acerca` → `/inicio/licencias`                          | Acerca de → Licencias de software de terceros    | `(tabs)/inicio/licencias.tsx`             |
| `/colectivos` → `/colectivos/:linea` → `/colectivos/parada/:id` | Colectivos (§19) → línea (`lineaId`, `?parada=`) → parada | `(tabs)/colectivos/…`                     |
| `/subtes` → `/subtes/:linea` → `/subtes/estacion/:id`           | Subtes → línea (`A`…`H`, `PM`) → estación (§14)  | `(tabs)/subtes/…`                         |
| `/subtes/mapa`                                                  | Mapa de la red (tarea 4.3), desde "Ver mapa"     | `(tabs)/subtes/mapa.tsx`                  |
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
GestureHandlerRootView           (gestos de RNGH; tarea 4.3, ver §18)
└── SafeAreaProvider
    └── ThemeProvider            (store: createThemePreferenceStore(kv))
        └── QueryProvider        (QueryClient + persister; tarea 3.9)
            └── RefreshIntervalProvider (store: createRefreshIntervalStore(kv); tarea 3.9)
                └── FavoritosProvider   (repository: MmkvFavoritosRepository)
                    └── OfflineBanner global (useIsOnline; tarea 4.2)
                        └── Stack (tabs + not-found) + StatusBar automática
```

**`OfflineBanner` global (tarea 4.2):** se monta una sola vez, arriba del `Stack`. Sin conexión, el banner ocupa el margen superior del sistema (`paddingTop` = inset superior) y el `Stack` recibe un `SafeAreaInsetsContext` con `top: 0`, para no sumar el margen dos veces. Las pantallas no muestran su propio aviso de conexión. **A validar en el dispositivo:** que el header nativo del Stack no deje un hueco extra con el banner visible.

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

**Estado a la Fase 3:** el cliente y los hooks están probados con `fetch` mockeado (`test/api/`, `src/shared/query/__tests__/`). Desde la Fase 4 los consume Subtes (§14).

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

## 13. Ajustes y Acerca de

Tarea 4.10 de la Fase 4. Las tres rutas (`/inicio/ajustes`, `/inicio/acerca`, `/inicio/licencias`) son finas y montan las pantallas de [`src/features/ajustes/`](../apps/mobile/src/features/ajustes/README.md), que tiene el brief operativo, los estados con su copy y las suposiciones `F4-ajustes-n`.

| Ajuste | De dónde sale | Dónde se guarda |
| --- | --- | --- |
| Tema (Sistema / Claro / Oscuro, S18) | `useTheme().setPreference` | MMKV, `transportate.pref.theme.v1`. Se aplica al instante |
| Actualizar cada (15 / 20 / 30 / 60 s, S17) | `useRefreshInterval().setSeconds` | MMKV, `transportate.pref.refreshInterval.v1`. El polling lo toma en el próximo ciclo |
| Índice de líneas y paradas | `useManifest()` + `useIsOnline()` | Caché de TanStack Query. Estados: carga, datos, error y sin conexión |
| Limpiar datos guardados | `queryClient.clear()` + `clearPersistedQueryCache(store)` | Borra la clave `transportate.query-cache.v1`. **No** toca favoritos ni preferencias |
| Borrar todos los favoritos (S19) | `Alert.alert` nativo → `repository.clear()` | Antes guarda `list()`; "Deshacer" llama a `restore()` por cada uno, en orden |

- **Acerca de:** la versión sale de `expo-constants` (`expoConfig.version` y `nativeBuildVersion`). La licencia de los datos es CC BY 2.5 AR, con la aclaración de que no es una app oficial (S27). La privacidad repite los puntos de [`05-privacidad.md`](05-privacidad.md) para la persona.
- **Licencias:** `pnpm licencias` (en `apps/mobile`) genera `licencias.json` a partir de las `dependencies` directas, con el texto de `LICENSE*`. Hay que regenerarlo cuando cambian las dependencias.
- **`Snackbar`:** componente compartido (`shared/ui/Snackbar.tsx`, ver su fila en [`shared/ui/README.md`](../apps/mobile/src/shared/ui/README.md)). Hoy lo monta `AjustesScreen` (F4-ajustes-1).
- **Pendiente:** la fila **Ubicación** llega con `expo-location` (4.7) y el progreso de descarga del índice con 4.5.

## 14. Estático en la app

`src/shared/static` ([README](../apps/mobile/src/shared/static/README.md)), tarea 4.2. `useStaticArchivo(archivo)`:

- Resuelve la versión con `useManifest()`: `archivos[archivo].url` = `<version>/<archivo>`.
- Pide el archivo con la versión en la query key (`['static', 'archivo', archivo, version]`), `staleTime: Infinity` y `gcTime` de 24 h. El persister MMKV lo guarda con el resto de la caché.
- Guarda además la **última versión conocida** en MMKV (`transportate.static.<archivo>.v1`). Con ella:
  - la pantalla arranca sin esperar al manifiesto;
  - si la versión no cambió, no se vuelve a bajar;
  - si cambió, se muestra la vieja mientras baja la nueva;
  - sin red o con el manifiesto caído, sigue andando aunque la caché persistida haya vencido.
- Hoy lo usan `subte-lineas.json` (5 KB) y `subte-estaciones.json` (17 KB).

**Archivos grandes** (tarea 4.5): `useStaticArchivoGrande(archivo)` tiene la misma forma que `useStaticArchivo`, más `progress` (0 a 1), `isDownloading` y `bytes`. Lo usan `paradas.json` (1,7 MB) y `lineas-colectivos.json` (161 KB).

- **Fuera de la caché de TanStack Query:** su persister reescribe toda la caché en una clave cada vez que algo cambia.
- **`LargeFileManager`:** guarda en MMKV un par de claves por archivo, con una sola versión: `transportate.static.file.<archivo>.data` (el cuerpo tal cual) y `.meta` (`{ version, savedAt, bytes }`, escrita al final).
- **Validación:** con Zod solo al descargar. Al leer de MMKV no se vuelve a validar: `JSON.parse` de 1,7 MB tarda unos 6 ms en Node, y Zod sumaría unos 15 ms.
- **Descarga:** por `XMLHttpRequest`, con progreso (`loaded / total`, o los `bytes` del manifiesto si no hay total). Una versión nueva baja en segundo plano y la vieja sigue hasta que termina.
- **Ajustes:** `useStaticDownloadProgress` alimenta el "Descargando… 40 %" de la fila del índice.
- **Detalle:** [README de `shared/static`](../apps/mobile/src/shared/static/README.md#archivos-grandes-tarea-45).

## 15. Subtes

`src/features/subtes` ([README](../apps/mobile/src/features/subtes/README.md): brief operativo, estados y suposiciones `F4-subtes-1…7`), tareas 4.1, 4.2, 4.11 y 4.12.

- **Rutas finas:** `subtes/index.tsx`, `[linea].tsx` y `estacion/[id].tsx` montan `SubtesScreen`, `LineaScreen` y `EstacionScreen`. El título del header lo pone cada pantalla con `Stack.Screen options`; la raíz usa large title.
- **Modelo (`model.ts`, funciones puras):** `buildRed` une los dos archivos del estático en 7 líneas (`LineaKey` = `A`…`H` o `PM`) y 108 estaciones. Premetro es una sola fila con los dos ramales (S8): estado más severo y alertas unidas de `PM-C` y `PM-S`. También: búsqueda sin tildes, agrupación de arribos por sentido y formato "Llegando" / "2 min".
- **Hooks (`hooks.ts`):** `useRedSubte`, `useLineasSubte`, `useEstacionesSubte`, `useLineasConEstado` y `useLineaDetalle` combinan el estático con `useEstadoSubtes`, `useAlertasSubtes` y `useArribosEstacion`. `usePullToRefresh` muestra el indicador nativo solo en el refresco que pide la persona.
- **Estados (tarea 4.11):**
  - Skeleton en la primera carga.
  - `ErrorState` sin datos, con `retryable`.
  - Alert "No pudimos actualizar. Mostramos lo último que sabemos." con datos y actualización fallida.
  - `FreshnessLabel` con el intervalo elegido.
  - Pull to refresh nativo.
  - Arribos con dato de más de 10 min: los tiempos se reemplazan por "Dato de hace X min" (S30).
  - Feed de arribos no disponible (404): mensaje sin reintento. Hoy `forecastGTFS` está congelado, así que lo normal es "No hay próximos trenes informados para esta estación." con la frescura en warning.
- **`FavoriteToggle`** (`features/favoritos`): estrella de 44×44, reutilizable para los cuatro tipos de favorito. Tiene `accessibilityState.selected`, háptico (éxito al guardar, selección al quitar) y anuncio para el lector.
- **Tests:**
  - `test/subtes/` (raíz, línea, estación y `useStaticArchivo`), con `fetch` mockeado por ruta y estático mínimo validado con los contratos.
  - `src/features/subtes/__tests__/model.test.ts`.
  - `src/features/favoritos/__tests__/FavoriteToggle.test.tsx`.
  - `test/layout.test.tsx` (banner global).
## 16. Favoritos (pantalla)

Tarea 4.9 de la Fase 4 (parte base). La ruta `/favoritos` es fina y monta `FavoritosScreen` de [`src/features/favoritos/`](../apps/mobile/src/features/favoritos/README.md), que tiene el brief operativo, los estados con su copy y las suposiciones `F4-favoritos-n`.

| Pieza | Qué hace |
| --- | --- |
| Lista | Una sola, en el orden guardado, pintada síncrona desde MMKV (`useFavoritos()`). Cada fila lleva al detalle de su tipo con `router.push({ pathname, params })`: `/subtes/[linea]`, `/subtes/estacion/[id]`, `/colectivos/[linea]` y `/colectivos/parada/[id]` |
| Edición | "Editar"/"Listo" en el header (`EditModeProvider` en el `_layout`). En edición: "Cambiar nombre", "Quitar" y las acciones de accesibilidad "Mover arriba"/"Mover abajo" (`repository.reorder`) |
| Quitar (S19) | `remove` al instante y `Snackbar` «Quitaste «Casa». Deshacer» (`restore` lo devuelve a su posición). Sin diálogo |
| Alias (S16) | `Modal` `formSheet` con campo de 30 caracteres (puntos de código) y contador. `setAlias`; vacío lo quita |
| Búsqueda (S15) | `SearchInput` con más de 15 favoritos; filtra alias, nombre y subtítulo sin tildes |
| Vacío | Estrella, "Todavía no guardaste favoritos." y los botones "Ver subtes" y "Buscar colectivo" |

Agregado en la tarea F4-LOW-C:

| Pieza | Qué hace |
| --- | --- |
| Colores de subte | La línea y la estación de subte usan `LineBadge kind="subte"` con `color` y `colorTexto` del estático (`useRedSubte()`, `subte.ts › resolveFavorito`). Sin el estático cargado, insignia neutra |
| Favorito huérfano | **Un solo criterio** (F4-MID-D): lo decide `useFavoritoLiveData` (`status: 'orphan'`) para los cuatro tipos. Subte: el `refId` no está en el estático (`resolveFavorito` con `useRedSubte`). Línea de colectivo: no está entre las líneas vigentes del proxy (`useLineasColectivo`). Parada: no está en el índice (`paradas.json`). Sin el dato cargado no se marca nada. `FavoritoItem` lo lee de ahí y `FavoritoRow` muestra "Esta parada/estación/línea ya no figura en los datos oficiales", sin navegar y con "Quitar" siempre visible. Un huérfano no pide datos vivos |
| Datos vivos | `FavoritoItem` llama a `useFavoritoLiveData` por fila y le pasa `liveData` y `liveDataLabel` (lo que lee el lector) a `FavoritoRow`. Solo piden datos las filas visibles (`onViewableItemsChanged`; hasta que la lista informe, las primeras 10). El dato estático de la parada no se repite |
| Frescura | `FreshnessLabel` arriba de la lista, con el `sourceTimestamp` más viejo de las filas visibles y el intervalo de `useRefreshInterval()`. Sin datos vivos no se muestra |
| Pull to refresh | `RefreshControl` con `usePullToRefresh` e `invalidateRealtime` (estado, arribos y posiciones; los estáticos no se tocan) |

**Lo que queda:**

- **high-dev (arrastre):** reemplazar el `FlatList` (`// 4.9-drag`) y pasar `dragHandle` a `FavoritoRow` (a través de `FavoritoItem`). El reorden se persiste con `repository.reorder`; las acciones "Mover arriba/abajo" tienen que seguir andando.
- **Resuelto en 4.5 / F4-MID-D:** huérfanos de colectivos y el dato de las paradas (sus líneas) con el índice de colectivos.
- **Limpieza hecha (F4-LOW-E):** `FavoritosScreen` ya no le pasa `orphan` a `FavoritoItem` y se borró `isOrphanColectivo`. `resolveFavorito` sigue devolviendo `orphan` porque `useFavoritoLiveData` lo usa para subte; la pantalla solo usa su `badge`.
- **Servicio caído:** si **todas** las filas visibles con dato vivo fallan por un error reintentable (red, timeout, 5xx, 429), aparece una sola `Alert` "El servicio de la Ciudad no responde" con "Reintentar" (`invalidateRealtime`). Si anda al menos una fila, o el error es de contenido (404), no hay Alert y cada fila afectada dice "Sin información". El error se lee del estado de la query de cada fila (`servicio.ts`), porque `useFavoritoLiveData` no lo expone. Un huérfano no cuenta para la Alert (no pide datos vivos).

## 16b. Ubicación

`src/features/ubicacion` ([README](../apps/mobile/src/features/ubicacion/README.md)), compartida por Colectivos (paradas cercanas, 4.7), el mapa ("centrar en mí") y Ajustes. **La ubicación nunca sale del teléfono**: vive solo en la memoria del hook, no se guarda en MMKV ni en la caché de consultas y no se manda al proxy ([`05-privacidad.md`](05-privacidad.md) §3).

| Pieza | Qué hace |
| --- | --- |
| `usePermisoUbicacion()` | Solo el permiso: `permission` (`undetermined` / `granted` / `denied` / `blocked`), `canAskAgain`, `checked` (ya se leyó el permiso real), `request()`, `refresh()`, `openSettings()`. Lee el permiso al montar **sin** abrir el diálogo y lo vuelve a leer cuando la app vuelve a primer plano |
| `useUbicacion({ watch })` | Permiso + `position: { lat, lon, accuracy, timestamp } \| null` + `positionUnavailable` (con permiso, la lectura falló). Con permiso lee la posición y, si `watch` (default), se suscribe con `Accuracy.Balanced` (cada 10 s o 25 m). El `watch` se suelta al desmontar y en segundo plano. Colectivos usa `watch: false` (una lectura) |
| `request()` | **Solo desde una acción de la persona** (S32): "Paradas cercanas", "centrar en mí" o la fila de Ajustes. Nunca al montar |
| `isInsideCaba(lat, lon)` | Rectángulo lat −34,71 a −34,52 y lon −58,54 a −58,33 (el bbox con el que se relevó la Ciudad, `01b-gtfs-alternativos.md`). Para "Ubicación fuera de CABA". Es el **único** rectángulo de CABA para decidir: Colectivos lo usa directamente (el `CABA_BOUNDS` de `shared/map/styles.ts` es solo el encuadre de la cámara del mapa) |
| `distanceMeters(a, b)` | Haversine, en metros |
| `PermisoUbicacionBloque` | "Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono." + "Activar" (o "Abrir configuración" si el sistema ya no deja preguntar) + "Buscar a mano" |

**Ajustes:** la sección Privacidad tiene la fila **Ubicación** con el estado real ("Permitida mientras usás la app" / "No permitida" + "Podés buscar paradas a mano" / "Todavía no la pediste"). Tocarla pide el permiso si todavía se puede preguntar y, si no, abre la configuración del teléfono.

**Permisos nativos:** el plugin de `expo-location` en `app.config.ts` declara solo "mientras se usa". Los tests cambian el estado con `locationMock` (ver [`09-testing.md`](09-testing.md) §8).

## 17. Inicio

`src/features/inicio` ([README](../apps/mobile/src/features/inicio/README.md): brief operativo, estados y suposiciones `F4-inicio-1…6`), tareas 4.1, 4.4, 4.11 y 4.12. Ruta fina: `(tabs)/inicio/index.tsx` monta `InicioScreen`.

- **Header:** large title en iOS (`headerLargeTitleEnabled`) y engranaje "Ajustes" de 44×44 (`inicio/_layout.tsx`).
- **Alert destacada:** `Alert` `system` danger solo si hay líneas interrumpidas.
  - Con una, título "Línea B interrumpida", el `resumen` del estado y "Ver la línea".
  - Con varias, "N líneas con problemas" y "Ver el subte".
  - Con las 7, "El subte no está funcionando".
- **Estado del subte:** 7 filas fijas (A–H y Premetro, S28), sacadas de `useLineasConEstado()` de `features/subtes`. Cada una abre `/subtes/[linea]`, con `FreshnessLabel` debajo.
  - Skeleton en la primera carga.
  - `ErrorState` dentro del bloque sin datos: los favoritos siguen visibles.
  - Alert en línea con datos y actualización fallida.
- **Favoritos:** los primeros 5, cada uno con ícono de tipo, alias o nombre y dato vivo. Cada favorito abre su detalle en su tab (S3); "Ver todos (N)" abre `/favoritos`. Sin favoritos, `EmptyState` + "Explorar subtes".
- **Datos vivos de favoritos** (`features/favoritos/useFavoritoLiveData.ts`, [README](../apps/mobile/src/features/favoritos/README.md#datos-vivos-tarea-44)): estado de línea, próximo arribo por sentido, vehículos en servicio o el subtítulo guardado. Reutilizan las queries de cada feature, sin endpoints ni polling nuevos. Los usa también la pantalla de Favoritos (slot `liveData` de `FavoritoRow`).
- **Pull to refresh:** `invalidateRealtime`, que refresca el estado del subte y los datos vivos activos.
- **Tests:** `test/inicio.test.tsx` y `src/features/favoritos/__tests__/FavoritoLiveData.test.tsx`.

## 18. Mapas

Tareas 4.0 y 4.3 de la Fase 4. MapLibre React Native 11.5.1 con tiles de OpenFreeMap (ADR-0002). El código compartido está en [`src/shared/map/`](../apps/mobile/src/shared/map/README.md), que tiene la API completa, el brief operativo del mapa de la red y las suposiciones `F4-mapa-n`.

| Pieza | Qué hace |
| --- | --- |
| `MapView` (`shared/map`) | Mapa base. Estilo `positron` en claro y `dark` en oscuro según `useTheme().scheme`, atribución propia siempre visible, controles "Norte arriba" y "Centrar en mi ubicación" (este último solo si el permiso ya está concedido; nunca lo pide), cámara que salta con Reducir movimiento y franja izquierda de 20 pt en iOS para el gesto de volver. `ref` con `flyTo`/`fitBounds`/`resetNorth` |
| `useStaticGeoJson` (`shared/map`) | Baja los `.geojson` del estático con la convención de `useStaticArchivo` (§14): la versión sale del manifiesto, la key es `['static', 'archivo', archivo, version]` y queda persistido en MMKV. Las estaciones del mapa van por `useStaticArchivo` |
| `client.staticGeoJson` (`shared/api`) | `GET /v1/static/:version/:archivo` para `.geojson`, validado con `GEOJSON_ESTATICOS_V1` de `@transportate/contracts` (`SubteRedGeoJsonV1` y `GeoJsonFeatureCollectionV1`) |
| `/subtes/mapa` → `features/subtes/MapaRedScreen.tsx` | Trazos de `subte-red.geojson` con el color GTFS, un contorno `text.primary` y la letra de la línea. Las estaciones salen de `subte-estaciones.json`. Tocar una estación lleva a `/subtes/estacion/[id]` y tocar un trazo, a `/subtes/[linea]` (si caen juntas, gana la estación) |

- **Colores de los trazos (N2, resuelta):** se usan los colores del GTFS con contorno del color de texto del tema y la letra de cada línea sobre el trazo. El detalle está en `briefs/README.md` y en `shared/map/README.md`.
- **Gestos:** `GestureHandlerRootView` envuelve toda la app (`src/app/_layout.tsx`). El layout de siempre se llama `AppTree` y el `RootLayout` exportado solo lo envuelve.
- **Jest:** MapLibre y `expo-location` están mockeados (`test/mocks/`). Los componentes del mapa se renderizan como `View` con `testID` (`maplibre-Layer-<id>`, `maplibre-GeoJSONSource-<id>`) y todas sus props. Lo que Jest no prueba (render real de los estilos, gesto de volver con el mapa, toques en el mapa) lo valida el coordinador en el dispositivo.
- **Pendiente:**
  - Autoalojar los tiles (PMTiles en R2, plan en `shared/map/README.md`).
  - Sumar los `.geojson` a `useStaticArchivo` (con última versión conocida) y sacar `useStaticGeoJson`.
  - Sumar un ícono de brújula al mapa curado si "Norte arriba" lo necesita (F4-mapa-4).

## 19. Colectivos

`src/features/colectivos` ([README](../apps/mobile/src/features/colectivos/README.md): brief operativo, estados y suposiciones `F4-colectivos-1…7`), tareas 4.5, 4.7, 4.11 y 4.12. Rutas finas: `colectivos/index.tsx` monta `ColectivosScreen` y `colectivos/parada/[id].tsx` monta `ParadaScreen`. El detalle de línea con el mapa (`colectivos/[linea].tsx`, tarea 4.6) es de otra tarea.

- **Índice (`useIndiceColectivos`):** `paradas.json` + `lineas-colectivos.json` como archivos grandes (§14).
  - Si `/v1/colectivos/lineas` tiene dato, sus líneas reemplazan a las del archivo, porque los `route_id` se reasignan (`06-proxy.md` §6).
  - `indice-colectivos.json` es del proxy; la app no lo usa.
- **Modelo (`model.ts`, funciones puras):**
  - `buildIndice`, `numerosDeParada`, `lineaParaNumero`.
  - `buscar`, sin tildes y con ranking: número exacto, nombre exacto, número que empieza igual, y después ramal, cabecera o empresa. Paradas desde 3 caracteres.
  - `paradasCercanas`: filtro por rectángulo + haversine, radio de 1,5 km. Con 7.027 paradas tarda menos de 1 ms en Node.
  - `isInsideCaba`, `distanceMeters`, `formatDistancia`.
- **Raíz:**
  - Primer uso con "Preparando el listado de líneas y paradas…" y barra de progreso. Si falla, `ErrorState` "No pudimos descargar las líneas y paradas".
  - Búsqueda local con resultados mezclados.
  - Paradas cercanas: 10, con "Ver más" hasta 30. Tiene el bloque de permiso con "Activar", "Abrir configuración" y "Buscar a mano", y el caso fuera de CABA.
  - Líneas recientes (MMKV, `transportate.colectivos.recientes.v1`, Zod, 5) y favoritos de colectivo con su dato vivo.
  - Todo funciona sin red una vez descargado el índice.
- **Ubicación:** `useUbicacion({ watch: false })` y `PermisoUbicacionBloque` de `features/ubicacion` (§16b).
  - Una sola lectura de la posición, precisión `Balanced`, solo en memoria.
  - Permiso pedido solo al tocar "Activar" (S32). Con el permiso bloqueado, "Abrir configuración".
  - Mientras se lee el permiso o la posición, skeleton. Si la posición falla (`positionUnavailable`), "No pudimos saber dónde estás…" con "Volver a intentar" y "Buscar a mano".
  - `paradasCercanas` usa `distanceMeters` y "fuera de CABA" usa `isInsideCaba`, los de `features/ubicacion/geo.ts`.
- **Parada:**
  - Calle y altura, barrio y `FavoriteToggle` (nombre = calle y altura; subtítulo = "Líneas 10, 60, 152").
  - Insignias de las líneas, que abren `/colectivos/[linea]` con `linea` = `lineaId` y el query param **`parada=<paradaId>`** (`PARAM_PARADA`), para que el mapa centre la cámara.
  - "Próximos arribos" (`useArribosParada`) **solo si hay arribos**: por línea hasta 3 tiempos, con `FreshnessLabel` y la Alert de actualización fallida. Vacío, cargando o con error sin datos, la sección no existe (N4).
- **Favorito de parada:** `useFavoritoLiveData` muestra las líneas que paran desde el índice. Si la parada ya no figura, `status: 'orphan'`: es el mismo criterio único de huérfano de §16.
- **Tests:**
  - `src/features/colectivos/__tests__/model.test.ts`.
  - `test/colectivos/largeFiles.test.tsx`.
  - `test/colectivos/pantallas.test.tsx`: índice descargando, error y listo; búsqueda; cercanas con y sin permiso y fuera de CABA; parada con y sin arribos; huérfano.

## 20. Estado al cierre de la Fase 4

Estado después de la reconciliación F4-MID-D.

- Ubicación hay una sola: `features/ubicacion`.
- El huérfano se decide en un solo lugar: `useFavoritoLiveData`, con `status: 'orphan'`.
- Colectivos usa el índice real: `paradas.json` + `lineas-colectivos.json`, sin `indice-colectivos.json`.

Queda pendiente, sacado de los README de cada feature.

**En curso al cerrar esta tarea:**
- **Mapa de línea de colectivos (4.6, high-dev):** `colectivos/[linea].tsx` con vehículos en vivo. Recibe `linea` = `lineaId` y `?parada=<paradaId>` para centrar (§19).
- **Arrastre en Favoritos (4.9-drag, high-dev):** reemplaza el `FlatList` del bloque `// 4.9-drag`.
- **Integrado en `main` (F4-LOW-D):** la Alert única "El servicio de la Ciudad no responde" en Favoritos, el large title de Subtes con `headerLargeTitleEnabled` y `docs/11-prueba-manual.md`.

**Para la Fase 5 (o cuando haya fuente):**
- **Tránsito (4.8):** diferido. No hay fuente de cortes (N3).
- **Arribos de subte:** `forecastGTFS` está congelado upstream, así que la estación muestra "No hay próximos trenes informados" con el dato viejo. Hay que revisarlo cuando el feed vuelva.
- **Subtes:**
  - combinaciones ("Combinás con D") y "El servicio no está funcionando a esta hora", porque el estático no trae `transfers.txt` ni horarios;
  - marcar en el diagrama las estaciones afectadas solo si la alerta trae `stop_id`.
- **Mapa:** autoalojar los tiles (PMTiles en R2, `shared/map/README.md`), y el ícono de brújula si "Norte arriba" lo necesita (F4-mapa-4). Los `.geojson` ya se pueden bajar con `useStaticArchivoGrande`, con persistencia y versión.
- **Favoritos:**
  - menú contextual con long press (F4-inicio-1, F4-favoritos-6);
  - el "Deshacer" de Ajustes se pierde al salir de la pantalla (F4-ajustes-1);
  - limpieza menor del huérfano (§16): `FavoritosScreen` deja de pasar `orphan`, y `resolveFavorito` deja de calcularlo.
- **Colectivos:**
  - con más de un ramal por número, la parada abre el primero en CABA (F4-colectivos-3); falta el selector de ramal en el detalle de línea;
  - arribos por parada solo donde hay equivalencia (ADR-0006).
- **Validación:**
  - dev build en el iPhone de cada ola;
  - VoiceOver y TalkBack en las pantallas principales;
  - modo avión;
  - `audit` nativo de Impeccable;
  - pruebas E2E (no hay ninguna).
- **Docs de otras features:** `features/ajustes/README.md` todavía lista como pendientes la fila Ubicación (4.7) y el progreso del índice (4.5). Las dos ya están hechas.
