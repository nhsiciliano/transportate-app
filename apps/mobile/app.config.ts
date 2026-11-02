// Configuración de Expo (SDK 58). Tipada con `ExpoConfig` de `expo/config`
// (https://docs.expo.dev/workflow/configuration/).
//
// Sin `expo-updates`, sin analytics y sin permisos declarados: la ubicación llega en la Fase 4
// (`docs/05-privacidad.md`). La URL del proxy NO va en `extra`: se lee de
// `process.env.EXPO_PUBLIC_API_URL` (ver `.env.example`).
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Identificador nativo PROVISORIO: lo tiene que confirmar el usuario antes del primer build
// de EAS (una vez publicado en las tiendas no se puede cambiar).
const NATIVE_ID = 'app.transportate.mobile';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Transportate',
  slug: 'transportate',
  scheme: 'transportate',
  version: '0.1.0',
  orientation: 'portrait',
  // Claro y oscuro de primera clase (`docs/02-obelisco-tokens.md` §6).
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: NATIVE_ID,
    supportsTablet: true,
  },
  // Edge-to-edge: en SDK 58 (React Native 0.88) es obligatorio en Android y la opción
  // `android.edgeToEdgeEnabled` ya no existe en `ExpoConfig`; no hace falta declararla.
  android: {
    package: NATIVE_ID,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // Sin imagen por ahora: los assets de marca los produce otra tarea.
        // Claro: blanco. Oscuro: primary de Obelisco `#1d3343` (`docs/02-obelisco-tokens.md`).
        backgroundColor: '#ffffff',
        dark: { backgroundColor: '#1d3343' },
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
  extra: {},
});
