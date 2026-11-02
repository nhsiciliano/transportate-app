# @transportate/mobile

App de Transportate para iOS y Android: **Expo SDK 58** (React Native 0.88, React 19.3) con **Expo Router** y TypeScript strict. Consume el proxy de `apps/proxy` con el contrato JSON v1 de `packages/contracts`.

Estado: **Fase 3**. Están el scaffold y la navegación (tareas 3.2 y 3.8); las pantallas son placeholders. Tema, fuentes, íconos, componentes, cliente API y favoritos llegan en las otras tareas de la fase (`docs/00-plan.md`).

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

| Perfil (`eas.json`) | Para qué |
|---|---|
| `development` | Dev client, distribución interna (dispositivos físicos) |
| `development-simulator` | Igual, pero build para el simulador de iOS |
| `preview` | Build de prueba sin dev client, distribución interna |
| `production` | Tiendas; número de build autoincremental (`cli.appVersionSource: "remote"`) |

EAS necesita `eas login` y un proyecto creado en expo.dev: lo hace el usuario.

**Pendiente de confirmar:** el identificador nativo `app.transportate.mobile` (`ios.bundleIdentifier` y `android.package` en `app.config.ts`) es provisorio. Se tiene que confirmar antes del primer build que se publique.

## Variables de entorno

| Variable | Default de `.env.example` | Uso |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8787` | URL base del proxy (`pnpm --filter transportate-proxy dev` levanta `wrangler dev` en ese puerto) |

- Expo solo expone a la app las variables con prefijo `EXPO_PUBLIC_`, y quedan **embebidas en el bundle**: nunca pongas secretos ahí. Las credenciales del GCBA viven solo en el proxy.
- En un dispositivo físico, `localhost` no es tu computadora: usá la IP de tu red local. En el emulador de Android, `10.0.2.2`.
- `.env` está en `.gitignore`.

## Fuentes

- **Familias:** Nunito para títulos y Open Sans para texto, en los pesos 400, 600 y 700. Son exactamente 6 archivos de `@expo-google-fonts/nunito` y `@expo-google-fonts/open-sans` 0.4.2, unos 0,79 MB en total.
  - Se importan por subpath de peso (`@expo-google-fonts/nunito/600SemiBold`, etc.).
  - Nunca se usa `@expo-google-fonts/dev`, que descarga las fuentes por red.
- **Dónde está:** `src/shared/fonts`.
  - `fontFamilies` tiene los nombres exactos: `fontFamilies.heading.bold` es `'Nunito_700Bold'`, `fontFamilies.body.regular` es `'OpenSans_400Regular'`, etc.
  - `useAppFonts()` devuelve `{ loaded, error }`.
- **Arranque (`src/app/_layout.tsx`):**
  - `SplashScreen.preventAutoHideAsync()` se llama en el scope del módulo.
  - El splash se oculta cuando las fuentes cargan **o fallan**. Si fallan, la app sigue con la fuente del sistema y el error se loguea solo en `__DEV__`.
- **Por qué `useFonts` y no el config plugin de `expo-font`:**
  - La doc de Expo prefiere el plugin, que embebe las fuentes en el binario.
  - Pero con el plugin, iOS toma el nombre de familia del archivo (p. ej. "Nunito") y Android el nombre del archivo ("Nunito_400Regular"), así que el `fontFamily` cambiaría según la plataforma.
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
- **TanStack Query** queda instalado para la tarea 3.9: `@tanstack/react-query`, `@tanstack/react-query-persist-client` y `@tanstack/query-async-storage-persister`, los tres en 5.105.1.
- **Tests:** `pnpm test` desde `apps/mobile`, o `npx jest --ci test/favoritos.test.tsx` para uno solo.
  - En Jest, `createMMKV()` devuelve el mock en memoria de la propia librería (README de react-native-mmkv, "Testing with Jest or Vitest").
  - Igual hay que stubbear `react-native-nitro-modules` en `jest.setup.ts`, porque al importarse busca el TurboModule nativo y tira.
  - Los tests de favoritos usan `MemoryKeyValueStore`.

## Tests, lint y tipos

```sh
pnpm test        # jest --ci con jest-expo + @testing-library/react-native
pnpm lint        # ESLint (config de la raíz + react-hooks)
pnpm typecheck   # tsc --noEmit
```

- Los tests viven en `test/` y no en `src/app/`, porque todo archivo dentro de `src/app/` es una ruta.
- `test/inicio.test.tsx` es el test de humo: renderiza Inicio y encuentra su título.
- `test/navegacion.test.tsx` usa `renderRouter` de `expo-router/testing-library` con los layouts reales del stack de Inicio:
  - recorre Inicio → Ajustes (botón del header) → Acerca de;
  - verifica que una ruta inexistente cae en `+not-found`.
- Las tabs nativas no se prueban en Jest, porque necesitan el módulo nativo.
- `test/fonts.test.tsx` y `test/layout.test.tsx` cubren la carga de fuentes y que el splash se oculte también con error. En Jest los `.ttf` no están en el registro de assets y `loadAsync` rechaza: así se prueba el camino de error real, y el de éxito se prueba mockeando `useFonts`.
- `test/storage.test.ts` prueba `KeyValueStore` (memoria y mock oficial de MMKV) y el persister.
- `test/favoritos.test.tsx` cubre el alta, los duplicados, el alias, el reorden, el borrado con restore, `clear`, la persistencia entre instancias, el JSON corrupto, las migraciones y `useFavoritos`.

## Estructura

```
apps/mobile/
├── app.config.ts          # config de Expo tipada (nombre, scheme, plugins, splash, typed routes)
├── eas.json               # perfiles de EAS Build
├── jest.config.js         # preset jest-expo + transformIgnorePatterns para pnpm
├── jest.setup.ts          # stub de react-native-nitro-modules para Jest
├── eslint.config.mjs      # extiende el flat config de la raíz
├── test/                  # tests de Jest
└── src/
    ├── app/               # rutas (Expo Router)
    │   ├── _layout.tsx                # Stack raíz + SafeAreaProvider + StatusBar
    │   ├── index.tsx                  # "/" redirige a /inicio
    │   ├── +not-found.tsx
    │   └── (tabs)/
    │       ├── _layout.tsx            # NativeTabs: Inicio, Colectivos, Subtes, Favoritos (+ Tránsito oculto)
    │       ├── inicio/                # index, ajustes, acerca
    │       ├── colectivos/            # index, [linea], parada/[id]
    │       ├── subtes/                # index, [linea], estacion/[id]
    │       ├── favoritos/             # index
    │       └── transito/              # index (tab oculto)
    ├── features/          # lógica y componentes por feature (inicio, colectivos, subtes, transito, favoritos, ajustes)
    └── shared/            # fonts, storage, api (y theme, ui, icons: tareas 3.3–3.7)
```

**Alias:** `@/…` apunta a `src/…`. Lo resuelven TypeScript (`paths`), Metro (`experiments.tsconfigPaths`) y Jest (`moduleNameMapper`).

| URL | Pantalla |
|---|---|
| `/inicio` | Inicio. Botón "Ajustes" en el header |
| `/inicio/ajustes` → `/inicio/acerca` | Ajustes → Acerca de (stack dentro de Inicio, suposición S2) |
| `/colectivos`, `/colectivos/:linea`, `/colectivos/parada/:id` | Colectivos → línea → parada |
| `/subtes`, `/subtes/:linea`, `/subtes/estacion/:id` | Subtes → línea → estación |
| `/favoritos` | Favoritos |

## Decisiones

- **Tabs nativas (`NativeTabs` de `expo-router/native-tabs`) en lugar de `Tabs` (JS).**
  - En SDK 58 se importan de `expo-router/native-tabs`. Hasta SDK 57, la doc las importaba de `expo-router/unstable-native-tabs`, ruta que sigue existiendo por compatibilidad.
  - Usan la barra nativa de cada plataforma (UITabBarController en iOS, BottomNavigationView de Material en Android), en línea con la plataforma "adaptive" de `PRODUCT.md`.
  - No tienen header: cada tab anida su `Stack` y el back nativo funciona en todos los niveles.
  - Íconos provisorios: SF Symbols en iOS (`sf`) y Material Symbols en Android (`md`). Los pone el sistema, así que no hace falta `@expo/vector-icons`. El componente `Icon` propio llega en la tarea 3.5.
- **Tab Tránsito oculto:**
  - La ruta existe, pero el trigger va con `hidden`, así que no se puede navegar a ella.
  - Decisión del usuario del 2026-11-01 (`docs/00-plan.md`, "Correcciones tras la Fase 1").
- **pnpm con linker aislado (el default), sin `node-linker=hoisted`.**
  - Expo soporta dependencias aisladas desde SDK 54 ([guía de monorepos](https://docs.expo.dev/guides/monorepos/)). Desde SDK 52, `expo/metro-config` configura Metro para monorepos solo, así que no hay `metro.config.js`.
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
  - Fondo `#ffffff` en claro y `#1d3343` (primary de Obelisco) en oscuro, sin imagen. Los assets de marca llegan en otra tarea.
  - En Android, edge-to-edge es obligatorio desde RN 0.81; la opción `android.edgeToEdgeEnabled` ya no existe en `ExpoConfig` de SDK 58.
- **Privacidad:**
  - Sin `expo-updates`, analytics ni permisos declarados. La ubicación llega en la Fase 4 (`docs/05-privacidad.md`).
  - Sin fuentes descargadas por red: Nunito y Open Sans se empaquetan con `@expo-google-fonts/*` (tarea 3.4).
