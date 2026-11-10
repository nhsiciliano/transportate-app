// URL base del proxy. Expo embebe en el bundle las variables `EXPO_PUBLIC_*` cuando se leen con
// acceso estático (`process.env.EXPO_PUBLIC_API_URL`, no `process.env[nombre]`):
// https://docs.expo.dev/guides/environment-variables/. Nunca va un secreto acá.

/** Default de desarrollo: `wrangler dev` del proxy (apps/mobile/.env.example). */
export const DEFAULT_API_URL = 'http://localhost:8787';

/** Normaliza: sin espacios ni barras finales. `undefined`/vacío → `null`. */
export function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '');
  return trimmed ? trimmed : null;
}

let warned = false;

/**
 * `EXPO_PUBLIC_API_URL` sin barra final.
 *
 * - Con URL: la devuelve normalizada.
 * - Sin URL en desarrollo (`dev`): avisa una vez con un error claro en la consola (no corta la app)
 *   y usa `http://localhost:8787`.
 * - Sin URL fuera de desarrollo: lanza. Un build release nunca puede apuntar a localhost.
 *
 * El acceso por defecto a `process.env.EXPO_PUBLIC_API_URL` tiene que seguir siendo estático: así
 * lo embebe Expo en el bundle.
 */
export function getApiBaseUrl(
  value: string | undefined = process.env.EXPO_PUBLIC_API_URL,
  dev: boolean = __DEV__,
): string {
  const url = normalizeBaseUrl(value);
  if (url) return url;
  if (!dev) {
    throw new Error(
      '[api] Falta EXPO_PUBLIC_API_URL en un build release: definila en build.<perfil>.env de ' +
        'apps/mobile/eas.json.',
    );
  }
  if (!warned) {
    warned = true;
    console.error(
      `[api] Falta EXPO_PUBLIC_API_URL: copiá apps/mobile/.env.example a apps/mobile/.env y ` +
        `reiniciá Metro. Mientras tanto se usa ${DEFAULT_API_URL}.`,
    );
  }
  return DEFAULT_API_URL;
}
