// Lógica de Ajustes (sin pantallas): opciones con su copy y un hook genérico para leer/escribir
// una preferencia persistida. La pantalla llega en la Fase 4 (brief `docs/briefs/06-ajustes.md`).
import { useCallback, useSyncExternalStore } from 'react';

import type { ThemePreference } from '@/shared/theme';
import {
  REFRESH_INTERVALS,
  type PreferenceStore,
  type RefreshIntervalSeconds,
} from '@/shared/storage/preferences';

export interface PreferenceOption<T> {
  value: T;
  label: string;
}

/** Tema (S18): el orden es el de la pantalla, con Sistema primero porque es el default. */
export const THEME_OPTIONS: readonly PreferenceOption<ThemePreference>[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

/** Intervalo de actualización (S17). */
export const REFRESH_INTERVAL_OPTIONS: readonly PreferenceOption<RefreshIntervalSeconds>[] =
  REFRESH_INTERVALS.map((value) => ({ value, label: `${String(value)} s` }));

/** Texto de ayuda de "Actualizar cada" (brief de Ajustes). */
export const REFRESH_INTERVAL_HELP =
  'Más seguido usa más datos y batería. Solo se actualiza con la app abierta.';

/** Valor actual de una preferencia y su setter; se re-renderiza con cada cambio. */
export function usePreference<T>(store: PreferenceStore<T>): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.get(),
  );
  const set = useCallback(
    (next: T) => {
      store.set(next);
    },
    [store],
  );
  return [value, set];
}
