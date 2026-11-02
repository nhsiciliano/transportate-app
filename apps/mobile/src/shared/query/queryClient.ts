// QueryClient de la app y conexión de TanStack Query con React Native
// (https://tanstack.com/query/v5/docs/framework/react/react-native):
// - focusManager ← AppState: `active` = enfocada. Con `refetchIntervalInBackground: false`, el
//   polling se detiene en segundo plano y vuelve (con un refetch) al volver a primer plano.
// - onlineManager ← NetInfo: sin conexión las consultas quedan en pausa (no fallan) y se
//   reanudan al reconectar (`refetchOnReconnect`).
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import type { ApiError } from '../api/errors';
import './register';

/** Cuánto vive en caché (y en el persister) una consulta sin uso: 24 h para servir offline. */
export const GC_TIME_MS = 24 * 60 * 60 * 1000;
/** Reintentos como máximo, solo para errores `retryable`. */
export const MAX_RETRIES = 3;
export const BASE_RETRY_DELAY_MS = 1000;
export const MAX_RETRY_DELAY_MS = 30_000;
/** Variación del intervalo de polling: ±10 % para no sincronizar a todos los clientes. */
export const JITTER_RATIO = 0.1;

/** Reintenta solo errores transitorios (red, timeout, 429, 5xx) y como mucho `MAX_RETRIES` veces. */
export function shouldRetry(failureCount: number, error: ApiError): boolean {
  return error.retryable && failureCount < MAX_RETRIES;
}

/**
 * Backoff exponencial (1 s, 2 s, 4 s… con tope 30 s). Si el proxy pidió esperar
 * (`Retry-After` / `retryAfterSeconds`), se espera al menos eso.
 */
export function retryDelay(failureCount: number, error: ApiError): number {
  const backoff = Math.min(BASE_RETRY_DELAY_MS * 2 ** failureCount, MAX_RETRY_DELAY_MS);
  const retryAfterMs =
    error.kind === 'http' && error.retryAfterSeconds !== null ? error.retryAfterSeconds * 1000 : 0;
  return Math.max(backoff, retryAfterMs);
}

/** `ms` ± 10 %. `random` inyectable para tests. */
export function withJitter(ms: number, random: () => number = Math.random): number {
  return Math.round(ms * (1 - JITTER_RATIO + random() * 2 * JITTER_RATIO));
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: GC_TIME_MS,
        retry: shouldRetry,
        retryDelay,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchIntervalInBackground: false,
      },
    },
  });
}

type AppStateLike = {
  addEventListener(type: 'change', listener: (state: AppStateStatus) => void): { remove(): void };
};
type NetInfoLike = {
  addEventListener(listener: (state: NetInfoState) => void): () => void;
};

/** `isConnected: null` = todavía no se sabe: se asume conectado para no mostrar el banner de más. */
export function isOnlineState(state: Pick<NetInfoState, 'isConnected'>): boolean {
  return state.isConnected !== false;
}

/**
 * Conecta focusManager a AppState y onlineManager a NetInfo. En web quedan los listeners por
 * defecto de TanStack (visibilitychange / online). Idempotente: cada llamada reemplaza la anterior.
 */
export function connectQueryManagers(
  appState: AppStateLike = AppState,
  netInfo: NetInfoLike = NetInfo,
): void {
  if (Platform.OS === 'web') return;
  focusManager.setEventListener((setFocused) => {
    const subscription = appState.addEventListener('change', (status) => {
      setFocused(status === 'active');
    });
    return () => {
      subscription.remove();
    };
  });
  onlineManager.setEventListener((setOnline) =>
    netInfo.addEventListener((state) => {
      setOnline(isOnlineState(state));
    }),
  );
}
