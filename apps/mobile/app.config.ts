// Configuración de Expo (SDK 58). Tipada con `ExpoConfig` de `expo/config`
// (https://docs.expo.dev/workflow/configuration/).
//
// Sin `expo-updates` ni analytics. El único permiso es la ubicación "mientras se usa"
// (`expo-location`, `docs/05-privacidad.md` §3): nada de ubicación en segundo plano. La URL del
// proxy NO va en `extra`: se lee de `process.env.EXPO_PUBLIC_API_URL`, que en desarrollo sale de
// `.env` (ver `.env.example`) y en los builds de EAS de `build.<perfil>.env` en `eas.json`.
// Al evaluar la config, `assertReleaseApiUrl` corta los perfiles release sin URL `https://`.
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Identificador nativo confirmado por el usuario el 2026-11-02 (`docs/bitacora.md`, Fase 3).
// Una vez publicado en las tiendas no se puede cambiar.
const NATIVE_ID = 'app.transportate.mobile';

/** Texto del permiso de ubicación de iOS (`NSLocationWhenInUseUsageDescription`), en voseo. */
export const LOCATION_WHEN_IN_USE_PERMISSION =
  'Transportate usa tu ubicación solo mientras la app está abierta, para mostrarte paradas cercanas. No sale de tu teléfono.';

/** Perfiles de EAS que generan un build release: tienen que apuntar al proxy por HTTPS. */
const RELEASE_PROFILES: readonly string[] = ['preview', 'preview-simulator', 'production'];

/**
 * Guardia de release: en un perfil release, `EXPO_PUBLIC_API_URL` tiene que empezar con
 * `https://`. Con `development*` o sin perfil (Metro local) no hace nada. Pura: recibe el perfil y
 * la URL en vez de leer `process.env`.
 */
export function assertReleaseApiUrl(profile: string | undefined, url: string | undefined): void {
  if (profile === undefined || !RELEASE_PROFILES.includes(profile)) return;
  if (url?.trim().startsWith('https://') !== true) {
    throw new Error(
      `El perfil de EAS "${profile}" necesita EXPO_PUBLIC_API_URL con una URL https:// ` +
        `(recibió ${url?.trim() ? `"${url.trim()}"` : 'nada'}). Se define en ` +
        `build.${profile}.env de apps/mobile/eas.json.`,
    );
  }
}

assertReleaseApiUrl(process.env.EAS_BUILD_PROFILE, process.env.EXPO_PUBLIC_API_URL);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Transportate',
  slug: 'transportate',
  owner: 'nhsiciliano',
  scheme: 'transportate',
  version: '1.0.0',
  orientation: 'portrait',
  // Claro y oscuro de primera clase (`docs/02-obelisco-tokens.md` §6).
  userInterfaceStyle: 'automatic',
  // Ícono de la app (`design/brand/icon-ios-1024.png`): 1024×1024, sin transparencia ni esquinas
  // redondeadas. iOS lo toma de acá porque `ios.icon` no se declara (ver README, "Assets").
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: NATIVE_ID,
    supportsTablet: false,
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
    // MapLibre (ADR-0002): en iOS agrega `$MLRN.post_install(installer)` al Podfile; en Android
    // solo serviría para personalizar versiones nativas, que dejamos en las de la librería.
    '@maplibre/maplibre-react-native',
    [
      'expo-location',
      {
        // Solo "mientras se usa". El plugin escribe un texto genérico en inglés en cada clave que
        // no recibe `false`, así que las de "siempre" se borran explícitamente.
        locationWhenInUsePermission: LOCATION_WHEN_IN_USE_PERMISSION,
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        // Sin actividad de movimiento (CoreMotion queda fuera del build) ni pedido de precisión
        // completa temporal (solo lo usa la API `expo-location/next`).
        motionUsagePermission: false,
        locationFullAccuracyPermission: false,
        // Explícitos aunque sean el default: nada de segundo plano ni servicio en primer plano.
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
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
