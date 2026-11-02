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
 * `EXPO_PUBLIC_API_URL` sin barra final. Si falta, en desarrollo avisa una vez con un error claro
 * en la consola (no corta la app) y usa `http://localhost:8787`.
 */
export function getApiBaseUrl(value: string | undefined = process.env.EXPO_PUBLIC_API_URL): string {
  const url = normalizeBaseUrl(value);
  if (url) return url;
  if (__DEV__ && !warned) {
    warned = true;
    console.error(
      `[api] Falta EXPO_PUBLIC_API_URL: copiá apps/mobile/.env.example a apps/mobile/.env y ` +
        `reiniciá Metro. Mientras tanto se usa ${DEFAULT_API_URL}.`,
    );
  }
  return DEFAULT_API_URL;
}
