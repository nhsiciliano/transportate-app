// Preferencias persistidas sobre el `KeyValueStore` (MMKV en la app): tema e intervalo de
// actualización. Cada valor se valida con Zod al leer; si lo guardado no es válido (dato viejo,
// corrupto o de otra versión), se usa el default sin tirar.
//
// - Tema: Sistema (default) / Claro / Oscuro (suposición S18). Implementa `ThemePreferenceStore`
//   de `src/shared/theme/ThemeProvider.tsx`.
// - Intervalo: 15, 20 (default), 30 o 60 s (suposición S17). `RefreshIntervalStore` tiene la misma
//   forma para que lo consuma el polling de TanStack Query (tarea 3.9).
import { z } from 'zod';

import type { ThemePreference, ThemePreferenceStore } from '@/shared/theme';

import type { KeyValueStore } from './kv';

export const THEME_PREFERENCE_KEY = 'transportate.pref.theme.v1';
export const REFRESH_INTERVAL_KEY = 'transportate.pref.refreshInterval.v1';

export const ThemePreferenceSchema = z.enum(['system', 'light', 'dark']);
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export const REFRESH_INTERVALS = [15, 20, 30, 60] as const;
export type RefreshIntervalSeconds = (typeof REFRESH_INTERVALS)[number];
export const RefreshIntervalSchema = z.union([
  z.literal(15),
  z.literal(20),
  z.literal(30),
  z.literal(60),
]);
export const DEFAULT_REFRESH_INTERVAL: RefreshIntervalSeconds = 20;

/** Store de una preferencia: lectura síncrona, escritura y aviso de cambios. */
export interface PreferenceStore<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

export type RefreshIntervalStore = PreferenceStore<RefreshIntervalSeconds>;

function createPreferenceStore<T>(
  kv: KeyValueStore,
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): PreferenceStore<T> {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get() {
      const raw = kv.getString(key);
      if (raw === undefined) return fallback;
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        return fallback;
      }
      const parsed = schema.safeParse(json);
      return parsed.success ? parsed.data : fallback;
    },
    set(value) {
      // Se valida también al escribir: nunca se persiste un valor que después no se podría leer.
      kv.set(key, JSON.stringify(schema.parse(value)));
      // Si el store avisa cambios, los listeners se enteran por `onChange`; si no, a mano.
      if (!kv.onChange) notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      const off = kv.onChange?.((changed) => {
        if (changed === key) listener();
      });
      return () => {
        listeners.delete(listener);
        off?.();
      };
    },
  };
}

export function createThemePreferenceStore(
  kv: KeyValueStore,
): ThemePreferenceStore & PreferenceStore<ThemePreference> {
  return createPreferenceStore(
    kv,
    THEME_PREFERENCE_KEY,
    ThemePreferenceSchema,
    DEFAULT_THEME_PREFERENCE,
  );
}

export function createRefreshIntervalStore(kv: KeyValueStore): RefreshIntervalStore {
  return createPreferenceStore(
    kv,
    REFRESH_INTERVAL_KEY,
    RefreshIntervalSchema,
    DEFAULT_REFRESH_INTERVAL,
  );
}
