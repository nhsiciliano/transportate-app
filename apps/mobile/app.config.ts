// Configuración de Expo (SDK 58). Tipada con `ExpoConfig` de `expo/config`
// (https://docs.expo.dev/workflow/configuration/).
//
// Sin `expo-updates`, sin analytics y sin permisos declarados: la ubicación llega en la Fase 4
// (`docs/05-privacidad.md`). La URL del proxy NO va en `extra`: se lee de
// `process.env.EXPO_PUBLIC_API_URL` (ver `.env.example`).
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Identificador nativo confirmado por el usuario el 2026-11-02 (`docs/bitacora.md`, Fase 3).
// Una vez publicado en las tiendas no se puede cambiar.
const NATIVE_ID = 'app.transportate.mobile';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Transportate',
  slug: 'transportate',
  owner: 'nhsiciliano',
  scheme: 'transportate',
  version: '0.1.0',
  orientation: 'portrait',
  // Claro y oscuro de primera clase (`docs/02-obelisco-tokens.md` §6).
  userInterfaceStyle: 'automatic',
  // Ícono de la app (`design/brand/icon-ios-1024.png`): 1024×1024, sin transparencia ni esquinas
  // redondeadas. iOS lo toma de acá porque `ios.icon` no se declara (ver README, "Assets").
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: NATIVE_ID,
    supportsTablet: true,
    infoPlist: {
      // La app solo usa HTTPS estándar (exento de la declaración de cifrado de exportación);
      // sin esto, cada build pide la respuesta a mano en App Store Connect.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  // Edge-to-edge: en SDK 58 (React Native 0.88) es obligatorio en Android y la opción
  // `android.edgeToEdgeEnabled` ya no existe en `ExpoConfig`; no hace falta declararla.
  android: {
    package: NATIVE_ID,
    // Adaptativo: primer plano y silueta monocromática (íconos temáticos de Android 13+) sobre el
    // fondo primary de Obelisco `#1d3343` (`docs/02-obelisco-tokens.md` §1.2). El valor tiene que
    // coincidir con `design/brand/adaptive-background.txt` (lo verifica `test/app-config.test.ts`).
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#1d3343',
      monochromeImage: './assets/images/adaptive-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // Marca de `design/brand/`: silueta primary sobre blanco en claro, silueta blanca sobre el
        // primary de Obelisco `#1d3343` en oscuro (`docs/02-obelisco-tokens.md` §1.2).
        image: './assets/images/splash-icon-light.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: {
          image: './assets/images/splash-icon-dark.png',
          backgroundColor: '#1d3343',
        },
      },
    ],
    'expo-dev-client',
  ],
  experiments: {
    // Rutas tipadas de Expo Router: genera `.expo/types/router.d.ts` al correr `expo start`
    // o `expo customize tsconfig.json` (https://docs.expo.dev/router/reference/typed-routes/).
    typedRoutes: true,
    // Alias `@/*` → `src/*` desde `compilerOptions.paths` del tsconfig.
    tsconfigPaths: true,
  },
  // Proyecto de EAS (expo.dev), creado el 2026-11-02 con `eas init`. El projectId no es un secreto:
  // identifica el proyecto y queda embebido en el bundle como cualquier `extra`.
  extra: {
    eas: {
      projectId: 'a60f9663-fe90-4a10-89e3-cc91f140b122',
    },
  },
});
