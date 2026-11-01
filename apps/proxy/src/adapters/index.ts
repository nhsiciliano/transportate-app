// PLACEHOLDER: high-dev reemplaza este archivo con los adaptadores reales de subtes y
// colectivos. Mantener la firma de `createAdapters`.
import type { Adapters } from '../container';
import { createTransitoAdapter } from './transito';
import { ApiError } from './types';

function notImplemented(): Promise<never> {
  return Promise.reject(
    new ApiError('upstream_unavailable', 'Adaptador no implementado todavía', 503),
  );
}

// El placeholder no usa `env` ni `ctx`; las implementaciones reales sí (secrets, waitUntil).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createAdapters(env: CloudflareBindings, ctx?: ExecutionContext): Adapters {
  return {
    subtes: { estadoLineas: notImplemented, alertas: notImplemented, arribos: notImplemented },
    colectivos: { lineas: notImplemented, posiciones: notImplemented, arribos: notImplemented },
    transito: createTransitoAdapter(),
  };
}
