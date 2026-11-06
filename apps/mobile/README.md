# @transportate/mobile

App de Transportate para iOS y Android: **Expo SDK 58** (React Native 0.88, React 19.3) con **Expo Router** y TypeScript strict. Consume el proxy de `apps/proxy` con el contrato JSON v1 de `packages/contracts`.

Estado (2026-11-06): **Fase 6 (Trenes) integrada**, Fase 5 («Señalética de terminal») mergeada y validada en el iPhone. Cuatro tabs nativas: Inicio, Colectivos, Subtes y Trenes; Favoritos se abre con la estrella del header de Inicio (`/inicio/favoritos`). Inicio, Subtes (raíz, línea, estación y mapa de la red), Colectivos (búsqueda local, paradas cercanas, parada y línea con mapa en tiempo real), Trenes (tablero de 6 líneas, ramales, estación con arribos por destino), Favoritos (alias, Deshacer, búsqueda, datos vivos y reorden por arrastre), Ajustes, Acerca de y Licencias. Tránsito sigue oculto (tarea 4.8 diferida). Prueba en el iPhone: [`docs/11-prueba-manual.md`](../../docs/11-prueba-manual.md). Referencia técnica: [`docs/07-app.md`](../../docs/07-app.md); tests: [`docs/09-testing.md`](../../docs/09-testing.md) §8 (804 tests en 72 suites).

## Instalar

Desde la **raíz** del monorepo (pnpm 12, Node 24; nunca npm ni yarn):

```sh
pnpm install
cp apps/mobile/.env.example apps/mobile/.env   # opcional: URL del proxy
```

Para paquetes nuevos de Expo usá `pnpm expo install <paquete>` desde `apps/mobile`, así la versión queda alineada al SDK, y después fijá la versión exacta (sin `~` ni `^`) en `package.json`.

## Correr

La app usa un **dev client** (`expo-dev-client`), no Expo Go. El build nativo se compila a demanda; no hay script `prebuild` ni carpetas `ios/` o `android/` commiteadas (están en `.gitignore`).

```sh
cd apps/mobile
pnpm ios            # expo run:ios: compila e instala el dev client en el simulador (necesita Xcode)
pnpm android        # expo run:android: idem en el emulador (necesita Android Studio)
pnpm start          # solo Metro, si el dev client ya está instalado
```

Con EAS (en la nube) en lugar de compilar local:

```sh
npx eas-cli build --profile development-simulator --platform ios   # simulador de iOS
npx eas-cli build --profile development --platform android         # APK interna
```

| Perfil (`eas.json`)     | Para qué                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| `development`           | Dev client, distribución interna (dispositivos físicos)                     |
| `development-simulator` | Igual, pero build para el simulador de iOS                                  |
| `preview`               | Build de prueba sin dev client, distribución interna                        |
| `production`            | Tiendas; número de build autoincremental (`cli.appVersionSource: "remote"`) |

El proyecto de EAS es `@nhsiciliano/transportate` (creado el 2026-11-02 con `eas init`; `owner` y `extra.eas.projectId` en `app.config.ts`). Hace falta tener sesión iniciada con `eas login` (el CLI se usa con `npx eas-cli@latest`). El repositorio remoto es `github.com/nhsiciliano/transportate-app`.

El identificador nativo `app.transportate.mobile` (`ios.bundleIdentifier` y `android.package` en `app.config.ts`) quedó confirmado por el usuario el 2026-11-02. Una vez publicado en las tiendas no se puede cambiar.

## Variables de entorno

| Variable              | Default de `.env.example` | Uso                                                                                              |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8787`   | URL base del proxy (`pnpm --filter transportate-proxy dev` levanta `wrangler dev` en ese puerto) |

- Expo solo expone a la app las variables con prefijo `EXPO_PUBLIC_`, y quedan **embebidas en el bundle**: nunca pongas secretos ahí. Las credenciales del GCBA viven solo en el proxy.
- En un dispositivo físico, `localhost` no es tu computadora: usá la IP de tu red local. En el emulador de Android, `10.0.2.2`.
- `.env` está en `.gitignore`.

## Fuentes

- **Familia:** Fira Sans para títulos y texto, en los pesos 400, 600 y 700 (dirección «Señalética de terminal», Fase 5; antes Nunito + Open Sans). Son exactamente 3 archivos de `@expo-google-fonts/fira-sans` 0.4.1, unos 1,39 MB en total.
  - Se importan por subpath de peso (`@expo-google-fonts/fira-sans/600SemiBold`, etc.).
  - Nunca se usa `@expo-google-fonts/dev`, que descarga las fuentes por red.
- **Dónde está:** `src/shared/fonts`.
  - `fontFamilies` tiene los nombres exactos: `fontFamilies.heading.bold` es `'FiraSans_700Bold'`, `fontFamilies.body.regular` es `'FiraSans_400Regular'`, etc. (`heading` y `body` apuntan a la misma familia).
  - `useAppFonts()` devuelve `{ loaded, error }`.
- **Arranque (`src/app/_layout.tsx`):**
  - `SplashScreen.preventAutoHideAsync()` se llama en el scope del módulo.
  - El splash se oculta cuando las fuentes cargan **o fallan**. Si fallan, la app sigue con la fuente del sistema y el error se loguea solo en `__DEV__`.
- **Por qué `useFonts` y no el config plugin de `expo-font`:**
  - La doc de Expo prefiere el plugin, que embebe las fuentes en el binario.
  - Pero con el plugin, iOS toma el nombre de familia del archivo (p. ej. "Fira Sans") y Android el nombre del archivo ("FiraSans_400Regular"), así que el `fontFamily` cambiaría según la plataforma.
  - Con `useFonts`, el nombre es el mismo en iOS, Android y Jest, y coincide con DESIGN.md §3.
  - Los `.ttf` igual viajan dentro de la app como assets del bundle; no hay descargas.
- **Escala de fuente:** no hay un `maxFontSizeMultiplier` global. Lo aplica cada componente: 1,3 en texto y 1,2 en títulos (DESIGN.md §3.2).

## Almacenamiento local (MMKV)

- **Versiones:** `react-native-mmkv` 4.3.2 y `react-native-nitro-modules` **0.37.1**.
  - Nitro es dependencia directa para que pnpm deje una sola copia; si hay dos, aparece el error "Nitro was installed twice".
  - `expo install --check` y `expo-doctor` lo aceptan.
  - **Sin verificar en dispositivo:** si el primer dev build falla con 0.37.1, el fallback documentado es 0.35.9 (`docs/versiones.md`, decisión 6).
- **Requiere dev client:** MMKV es un módulo nativo y no anda en Expo Go.
- **Qué hay:** `src/shared/storage` (`KeyValueStore`, persister de TanStack Query) y `src/features/favoritos` (`FavoritosRepository`). El detalle está en los README de cada carpeta.
- **TanStack Query** (5.105.1: `@tanstack/react-query`, `@tanstack/react-query-persist-client` y `@tanstack/query-async-storage-persister`) usa este persister: ver "Datos y red".
- **Tests:** `pnpm test` desde `apps/mobile`, o `npx jest --ci test/favoritos.test.tsx` para uno solo.
  - En Jest, `createMMKV()` devuelve el mock en memoria de la propia librería (README de react-native-mmkv, "Testing with Jest or Vitest").
  - Igual hay que stubbear `react-native-nitro-modules` en `jest.setup.ts`, porque al importarse busca el TurboModule nativo y tira.
  - Los tests de favoritos usan `MemoryKeyValueStore`.

## Datos y red

La app solo habla con el proxy (`apps/proxy`). La URL sale de `EXPO_PUBLIC_API_URL`, y el contrato es `@transportate/contracts` (Zod 4). El detalle está en [`src/shared/api/README.md`](src/shared/api/README.md) y [`src/shared/query/README.md`](src/shared/query/README.md).

- **Cliente** (`src/shared/api/client.ts`): un método por ruta del proxy.
  - Toda respuesta se valida con su esquema `*ResponseV1`. Si no valida, sale `ContractError` y la pantalla no recibe nada.
  - Timeout de 8 s por request.
  - El único header propio es `Accept: application/json`: sin User-Agent custom ni identificadores (`docs/05-privacidad.md`).
- **ETag:** el cliente recuerda en memoria el último `ETag` y el cuerpo validado por URL (LRU de 64) y manda `If-None-Match`. Con `304` devuelve ese cuerpo (`fromCache: true`).
- **Frescura:**
  - `stale` es `true` con `X-Transportate-Stale: 1` o con `meta.stale`.
  - Los hooks exponen `sourceTimestamp` (para `FreshnessLabel`) y `ageSeconds`.
  - La edad se calcula con `sourceTimestamp`, nunca con `generatedAt`.
- **Polling:** solo en primer plano.
  - Intervalo: el que elige la persona (S17: 15, 20, 30 o 60 s; default 20 s, `RefreshIntervalProvider` con `createRefreshIntervalStore` sobre MMKV, ver "Preferencias"), con ±10 % de jitter en cada ciclo.
  - En segundo plano se detiene: `refetchIntervalInBackground: false`, con `focusManager` conectado a `AppState`. Al volver a primer plano se refresca lo vencido.
  - Las líneas de colectivo y el manifiesto son estáticos: no hacen polling.
- **Offline:**
  - `onlineManager` está conectado a NetInfo. Sin conexión, las consultas quedan en pausa en lugar de fallar.
  - `useIsOnline()` alimenta el `OfflineBanner`.
  - La caché de TanStack Query se persiste en MMKV (`createQueryPersister`, `maxAge` 24 h, `buster` `'v1'`), así que al abrir la app sin red se ve lo último guardado.
- **Errores:** `ApiError` es una unión discriminada por `kind` (`network`, `timeout`, `http`, `contract`, `aborted`) y deriva `retryable`.
  - **Reintentos:** solo los retryable (red, timeout, 429, 5xx), hasta 3 veces, con backoff 1 s → 30 s y respetando `Retry-After`.
  - **Mensajes:** `userMessage()` da el texto en voseo: "Servicio no disponible", "Esta información no está disponible por ahora.", "Algo falló de nuestro lado.". Nunca incluye la URL ni el cuerpo crudo.
  - **Último dato bueno:** si falla una actualización y había datos, el hook conserva `data` y marca `isRefreshError`. La pantalla muestra la Alert en línea, no el ErrorState.
- **Tests:** `test/api/` (cliente, hooks, persistencia) y `src/shared/{api,query}/__tests__`, siempre con `fetch` mockeado.
  - NetInfo se mockea globalmente en `jest.setup.ts` con el mock oficial de la librería: sin su módulo nativo, tira el proceso de Jest.

## Preferencias (tema e intervalo)

Las preferencias viven en `src/shared/storage/preferences.ts`, sobre el mismo `KeyValueStore` (MMKV):

| Store | Clave | Valores | Default |
|---|---|---|---|
| `createThemePreferenceStore(kv)` | `transportate.pref.theme.v1` | `'system' \| 'light' \| 'dark'` (S18) | `'system'` |
| `createRefreshIntervalStore(kv)` | `transportate.pref.refreshInterval.v1` | `15 \| 20 \| 30 \| 60` (S17) | `20` |

- Los dos tienen la forma `PreferenceStore<T>` (`get`/`set`/`subscribe`). El de tema implementa `ThemePreferenceStore` de `shared/theme`, y `RefreshIntervalStore` es el que consume el polling (tarea 3.9).
- **Validación:**
  - Al leer, con Zod: un valor guardado inválido da el default.
  - Al escribir: un valor fuera de la lista tira, así nunca se guarda algo ilegible.
- **Ajustes:** `src/features/ajustes` exporta `usePreference(store)` y las opciones con su copy: `THEME_OPTIONS` (Sistema, Claro, Oscuro) y `REFRESH_INTERVAL_OPTIONS` (15, 20, 30, 60 s).

La referencia completa de la app (providers, claves, decisiones) está en [`docs/07-app.md`](../../docs/07-app.md).

## Tests, lint y tipos

```sh
pnpm test        # jest --ci con jest-expo + @testing-library/react-native
pnpm lint        # ESLint (config de la raíz + react-hooks)
pnpm typecheck   # tsc --noEmit
```

- Los tests viven en `test/` y en `src/**/__tests__/`, y nunca en `src/app/`, porque todo archivo dentro de `src/app/` es una ruta.
- Hay carpetas de tests por área (`test/api`, `test/subtes`, `test/colectivos`, `test/map`) con sus fixtures y harness, helpers compartidos en `test/helpers/` y los mocks nativos (MapLibre, `expo-location`, Reanimated/Worklets, Gesture Handler, `react-native-reorderable-list`) en `test/mocks/`.
- `test/inicio.test.tsx` es el test de humo: renderiza Inicio y encuentra su título.
- `test/navegacion.test.tsx` usa `renderRouter` de `expo-router/testing-library` con los layouts reales del stack de Inicio:
  - recorre Inicio → Ajustes (botón del header) → Acerca de;
  - verifica que una ruta inexistente cae en `+not-found`.
- Las tabs nativas no se prueban en Jest, porque necesitan el módulo nativo.
- `test/fonts.test.tsx` y `test/layout.test.tsx` cubren la carga de fuentes y que el splash se oculte también con error. En Jest los `.ttf` no están en el registro de assets y `loadAsync` rechaza: así se prueba el camino de error real, y el de éxito se prueba mockeando `useFonts`.
- `test/storage.test.ts` prueba `KeyValueStore` (memoria y mock oficial de MMKV) y el persister.
- `test/preferences.test.tsx` prueba los stores de tema e intervalo y `usePreference`.
- `test/integracion.test.tsx` cubre:
  - providers reales con tabs nativas en Inicio;
  - cambio de tema persistido;
  - favoritos de punta a punta;
  - `FreshnessLabel` en tema oscuro;
  - `OfflineBanner`.
- La estrategia completa de tests está en [`docs/09-testing.md`](../../docs/09-testing.md) §8.
- `test/favoritos.test.tsx` cubre el alta, los duplicados, el alias, el reorden, el borrado con restore, `clear`, la persistencia entre instancias, el JSON corrupto, las migraciones y `useFavoritos`.

## Estructura

```
apps/mobile/
├── app.config.ts          # config de Expo tipada (nombre, scheme, plugins, splash, typed routes)
├── eas.json               # perfiles de EAS Build
├── metro.config.js        # Metro con react-native-svg-transformer (importar .svg como componentes)
├── jest.config.js         # preset jest-expo + transformIgnorePatterns para pnpm + transformer de .svg
├── jest.setup.ts          # stubs de Jest: react-native-nitro-modules y NetInfo (mock oficial)
├── eslint.config.mjs      # extiende el flat config de la raíz
├── test/                  # tests de Jest
└── src/
    ├── app/               # rutas (Expo Router)
    │   ├── _layout.tsx                # Stack raíz + providers (tema, datos, intervalo, favoritos) + StatusBar
    │   ├── index.tsx                  # "/" redirige a /inicio
    │   ├── +not-found.tsx
    │   └── (tabs)/
    │       ├── _layout.tsx            # NativeTabs: Inicio, Colectivos, Subtes, Trenes (+ Tránsito oculto)
    │       ├── inicio/                # index, favoritos, ajustes, acerca, licencias
    │       ├── colectivos/            # index, [linea], parada/[id]
    │       ├── subtes/                # index, [linea], estacion/[id], mapa
    │       ├── trenes/                # index, [linea], ramal/[id], estacion/[id]
    │       └── transito/              # index (tab oculto)
    ├── features/          # lógica y componentes por feature (inicio, colectivos, subtes, trenes, transito, favoritos, ajustes, ubicacion)
    └── shared/            # theme, ui, icons, fonts, storage, api, query, static, map
```

**Alias:** `@/…` apunta a `src/…`. Lo resuelven TypeScript (`paths`), Metro (`experiments.tsconfigPaths`) y Jest (`moduleNameMapper`).

| URL                                                           | Pantalla                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `/inicio`                                                     | Inicio. Botones «Favoritos» y «Ajustes» en el header        |
| `/inicio/favoritos`                                           | Favoritos (stack dentro de Inicio; antes era una tab)       |
| `/inicio/ajustes` → `/inicio/acerca` → `/inicio/licencias`    | Ajustes → Acerca de → Licencias (stack dentro de Inicio, suposición S2) |
| `/colectivos`, `/colectivos/:linea`, `/colectivos/parada/:id` | Colectivos → línea → parada                                 |
| `/subtes`, `/subtes/:linea`, `/subtes/estacion/:id`, `/subtes/mapa` | Subtes → línea → estación; mapa de la red            |
| `/trenes`, `/trenes/:linea`, `/trenes/ramal/:id`, `/trenes/estacion/:id` | Trenes → línea → ramal → estación                 |

## Decisiones

- **Tabs nativas (`NativeTabs` de `expo-router/native-tabs`) en lugar de `Tabs` (JS).**
  - En SDK 58 se importan de `expo-router/native-tabs`. Hasta SDK 57, la doc las importaba de `expo-router/unstable-native-tabs`, ruta que sigue existiendo por compatibilidad.
  - Usan la barra nativa de cada plataforma (UITabBarController en iOS, BottomNavigationView de Material en Android), en línea con la plataforma "adaptive" de `PRODUCT.md`.
  - No tienen header: cada tab anida su `Stack` y el back nativo funciona en todos los niveles.
  - Íconos provisorios de la barra: SF Symbols en iOS (`sf`) y Material Symbols en Android (`md`). Los pone el sistema, así que no hace falta `@expo/vector-icons`. El componente `Icon` (ver "Íconos") es para el contenido de las pantallas; la barra de tabs todavía no lo usa.
- **Tab Tránsito oculto:**
  - La ruta existe, pero el trigger va con `hidden`, así que no se puede navegar a ella.
  - Decisión del usuario del 2026-11-01 (`docs/00-plan.md`, "Correcciones tras la Fase 1").
- **pnpm con linker aislado (el default), sin `node-linker=hoisted`.**
  - Expo soporta dependencias aisladas desde SDK 54 ([guía de monorepos](https://docs.expo.dev/guides/monorepos/)). Desde SDK 52, `expo/metro-config` configura Metro para monorepos solo; el `metro.config.js` de la app existe únicamente para el transformer de SVG (ver "Íconos").
  - Verificado con `expo-doctor` (20/20) y `expo export --platform ios`.
  - Si una librería nativa futura falla con dependencias aisladas, la salida documentada es `nodeLinker: hoisted` en `pnpm-workspace.yaml`. Después hay que volver a correr los tests del proxy.
- **Ajustes en `pnpm-workspace.yaml` por la app:**
  - `@parcel/watcher` (dependencia de Jest) no corre su script de build: trae binarios precompilados.
  - `hoistPattern` excluye `@types/jsdom`. Si se iza, los tipos de vitest lo encuentran y meten `lib.dom` en el typecheck del proxy, que rompe `caches.default` de Workers.
- **TypeScript:**
  - `tsconfig.json` extiende la base del monorepo y después `expo/tsconfig.base`.
  - Quedan activas todas las opciones estrictas: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns` y `verbatimModuleSyntax`. Ninguna rompe Expo.
  - Rutas tipadas activadas (`experiments.typedRoutes`). `expo start` genera `.expo/types/router.d.ts` y `expo-env.d.ts`, que **no se commitean** (`.gitignore`, como recomienda Expo).
  - Sin esos archivos, `href` acepta cualquier string; con ellos, solo rutas existentes. `tsc` pasa en los dos casos.
- **ESLint:**
  - `eslint-plugin-react-hooks` 7.1.1 sí soporta ESLint 10.
  - `eslint-plugin-react` 7.37.5 no (su peer llega a ESLint ^9.7), y `eslint-config-expo` depende de él. Por eso no se usan.
- **Botón "Ajustes" del header:** es un `Pressable` con `router.push` y no un `Link asChild`, porque `Link` le pone `role="link"` y el lector de pantalla lo anunciaría como enlace.
- **Splash:**
  - Marca de `design/brand/` centrada, 200 px de ancho, sobre `#ffffff` en claro y sobre `#1d3343` (primary de Obelisco) en oscuro (ver "Assets").
  - En Android, edge-to-edge es obligatorio desde RN 0.81; la opción `android.edgeToEdgeEnabled` ya no existe en `ExpoConfig` de SDK 58.
- **Privacidad:**
  - Sin `expo-updates` ni analytics. El único permiso es la ubicación "mientras se usa" (ver "Dependencias nativas de la Fase 4" y `docs/05-privacidad.md` §3).
  - Sin fuentes descargadas por red: Fira Sans se empaqueta con `@expo-google-fonts/fira-sans` (Fase 5; antes Nunito y Open Sans, tarea 3.4).

## Dependencias nativas de la Fase 4

Tarea 4.0. Están instaladas todas juntas para reconstruir el dev client **una sola vez** (EAS) antes de las features. Versiones y fuentes en [`docs/versiones.md`](../../docs/versiones.md), "Instaladas en la Fase 4". El plan del mapa está en [`src/shared/map/README.md`](src/shared/map/README.md).

| Paquete | Versión | Config nativa | Para qué |
|---|---|---|---|
| `@maplibre/maplibre-react-native` | 11.5.1 | Plugin `@maplibre/maplibre-react-native` (en iOS agrega `$MLRN.post_install` al Podfile) | Mapas de subte (4.3) y colectivos (4.6), con tiles de OpenFreeMap |
| `expo-location` | 58.0.20 | Plugin `expo-location`: solo `NSLocationWhenInUseUsageDescription`; sin "siempre", movimiento ni segundo plano | Paradas cercanas y "centrar en mí" (4.7) |
| `react-native-reanimated` + `react-native-worklets` | 4.7.1 + 0.13.0 | Ninguna: `babel-preset-expo` agrega el plugin de Worklets solo | Bottom sheet y seguimiento (4.6), reorden (4.9) |
| `react-native-gesture-handler` | 3.3.0 | Ninguna; falta `<GestureHandlerRootView>` en `_layout.tsx`, que lo agrega el primer uso | Gestos del mapa y reorden por arrastre |

- **Después de cambiar algo de esta tabla** (versión o plugin) hay que reconstruir el dev client: `npx eas-cli@27.2.0 build --profile development`. Un `expo start` no alcanza.
- **Sin `babel.config.js`** y sin cambios en `metro.config.js`.
- **Comprobado:** `npx expo-doctor` 20/20, `expo export` para iOS y Android, y `expo prebuild --clean` (el `Info.plist` y el `AndroidManifest.xml` generados tienen solo los permisos de arriba, más los de la plantilla de Expo).
- **Panel inferior del mapa de línea:** es un `BottomPanel` propio (`shared/map`, Gesture Handler + Reanimated), no la `formSheet` nativa ni `@gorhom/bottom-sheet`, que no se instaló (F4-colectivos-mapa-1).
- **Reorden:** `react-native-reorderable-list` 0.18.3, JS puro, instalada en 4.9 sin rebuild. Las decisiones están explicadas en `src/shared/map/README.md`.
- **Jest:**
  - `jest.setup.ts` registra el mock de MapLibre (`test/mocks/maplibre.tsx`) y el de `expo-location` (`test/mocks/expo-location.ts`, con `locationMock`). También carga `setUpTests()` de Reanimated, el mock oficial de Worklets y el `jestSetup` de Gesture Handler.
  - `test/mocks/setup-after-env.ts` reinicia la ubicación y los refs del mapa antes de cada test.
  - `test/mocks/resolver.js` compone el resolver de Reanimated con el del preset. Con pnpm, el de Worklets confundía la carpeta de Reanimated (`react-native-reanimated@…_react-native-worklets@…`) con la suya.
  - Ejemplos de uso en `test/mocks/native-deps.test.tsx`.

## Íconos

El componente `Icon` (`src/shared/icons`) dibuja **Material Symbols Rounded, FILL 1**, como SVG (`@material-symbols/svg-400` 0.48.2 + `react-native-svg` 15.16.0), según ADR-0004.

```tsx
import { Icon } from '@/shared/icons';

<Icon name="subtes" />                                            {/* decorativo, junto a un texto */}
<Icon name="interrumpida" accessibilityLabel="Servicio interrumpido" />
```

- **Mapa curado:** `src/shared/icons/map.ts` importa de forma explícita los 42 SVG de los 45 usos documentados en [`docs/08-design-system.md`](../../docs/08-design-system.md). Solo esos entran al bundle. Sumar un ícono es una fila en `map.ts` y otra en el documento.
- **Cómo se importan los `.svg`:** `metro.config.js` usa `react-native-svg-transformer/expo` (SVGR + SVGO) y mueve `svg` de `assetExts` a `sourceExts`. El módulo `*.svg` se declara en `src/shared/icons/svg.d.ts`. En Jest, `test/mocks/svg-transformer.js` reemplaza cada `.svg` por un `View` con `testID="svg:<archivo>"`.
- **Accesibilidad:** decorativo por default (oculto a VoiceOver/TalkBack); con `accessibilityLabel` pasa a ser una imagen con esa etiqueta.
- **Verificación:** `pnpm test` (`test/icons.test.tsx`) y `pnpm exec expo export --platform ios` desde `apps/mobile`.
- **Pendiente:** el color por default es `#000000` provisorio hasta que exista `useTheme` (tarea 3.3). La estrella de "no es favorito" usa el glifo de contorno (FILL 0), única excepción a FILL 1, a validar por el usuario.

Detalle y reglas de uso: [`src/shared/icons/README.md`](src/shared/icons/README.md).

## Assets

Ícono, ícono adaptativo y splash vienen de la marca de [`design/brand/`](../../design/brand/README.md) (concepto, paleta y script de generación). **Las fuentes originales siguen en `design/brand/`**; Expo usa las copias de `assets/images/`, que hay que actualizar a mano si se regenera la marca.

| Copia en `assets/images/` | Origen en `design/brand/` | Dónde se usa en `app.config.ts` |
|---|---|---|
| `icon.png` | `icon-ios-1024.png` | `icon` (iOS y fallback de Android): 1024×1024, sin alfa |
| `adaptive-icon.png` | `adaptive-foreground-1024.png` | `android.adaptiveIcon.foregroundImage`, sobre `backgroundColor: '#1d3343'` |
| `adaptive-icon-monochrome.png` | `adaptive-monochrome-1024.png` | `android.adaptiveIcon.monochromeImage` (íconos temáticos de Android 13+) |
| `splash-icon-light.png` | `splash-icon-light-1024.png` | plugin `expo-splash-screen`: `image`, sobre `#ffffff` |
| `splash-icon-dark.png` | `splash-icon-dark-1024.png` | plugin `expo-splash-screen`: `dark.image`, sobre `#1d3343` |
| `notification-icon.png` | `notification-icon-96.png` | Sin uso todavía: reserva para notificaciones (la app no las usa; `docs/05-privacidad.md`) |

- **Splash:** `imageWidth: 200` y `resizeMode: 'contain'`. Solo se aceptan PNG (con otro formato fallan los builds de producción). El splash no se ve en Expo Go ni en un dev client: hay que probarlo en un build `preview` o `production`.
- **`ios.icon` no se declara.** El SDK 58 lo acepta como objeto `{ light, dark, tinted }` y, si existe, pisa a `icon`. No se usa porque la marca no trae variantes oscura ni tintada: el PNG monocromo es la silueta blanca para Android 13+, no una imagen tintada de iOS. iOS toma `icon`. Si se diseñan esas variantes, se agregan ahí.
- **Verificación:** `test/app-config.test.ts` comprueba que cada ruta de imagen existe y es PNG, que `icon.png` es de 1024×1024 sin alfa y que el fondo del adaptativo coincide con `design/brand/adaptive-background.txt`. A mano: `pnpm exec expo config --type public` lista las rutas, `npx expo-doctor` (20/20) y `pnpm exec expo export --platform ios`.
- **`@types/node`** está en `devDependencies` solo para ese test (usa `node:fs` y `node:path`); el `tsconfig.json` no lo incluye globalmente, el test lo referencia con `/// <reference types="node" />`.
