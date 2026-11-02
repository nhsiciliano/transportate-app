// Tema de la app: esquema claro/oscuro resuelto a partir del sistema (`useColorScheme`) y de la
// preferencia de la persona (Sistema / Claro / Oscuro, suposición S18 de docs/briefs/README.md).
//
// La persistencia de la preferencia NO vive acá: se inyecta un `ThemePreferenceStore` (Ajustes lo
// implementa con MMKV en otra tarea). Por defecto la preferencia queda en memoria.
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useColorScheme, type TextStyle } from 'react-native';
import {
  borderWidth,
  component,
  fontFamily,
  maxFontSizeMultiplier,
  motion,
  radius,
  schemes,
  space,
  typeStyle,
  typography,
  type ColorScheme,
  type SchemeName,
  type TextVariant,
} from './tokens';

export type ThemePreference = 'system' | SchemeName;

/** Dónde se guarda la preferencia de tema. Ajustes la implementa sobre MMKV. */
export interface ThemePreferenceStore {
  get(): ThemePreference;
  set(preference: ThemePreference): void;
  /** Avisa cambios hechos desde afuera (otra pantalla, migración). Devuelve la desuscripción. */
  subscribe?(listener: () => void): () => void;
}

/** Store en memoria (default y tests): no sobrevive a reiniciar la app. */
export function createMemoryPreferenceStore(
  initial: ThemePreference = 'system',
): ThemePreferenceStore {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export interface Theme {
  scheme: SchemeName;
  colors: ColorScheme;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  space: typeof space;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  component: typeof component;
  motion: typeof motion;
  preference: ThemePreference;
  setPreference(preference: ThemePreference): void;
}

/** `useColorScheme()` puede devolver null/'unspecified': todo lo que no sea 'dark' es claro. */
export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): SchemeName {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

function buildTheme(
  scheme: SchemeName,
  preference: ThemePreference,
  setPreference: (p: ThemePreference) => void,
): Theme {
  return {
    scheme,
    colors: schemes[scheme],
    typography,
    fontFamily,
    space,
    radius,
    borderWidth,
    component,
    motion,
    preference,
    setPreference,
  };
}

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Persistencia de la preferencia (default: en memoria). */
  store?: ThemePreferenceStore;
}

/**
 * Envuelve el store para que `useSyncExternalStore` se entere de los `set` hechos desde la app
 * aunque el store no tenga `subscribe` (o no avise en su propio `set`), y además reenvía los
 * avisos del store original (cambios hechos desde afuera).
 */
function observable(store: ThemePreferenceStore) {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const l of listeners) l();
  };
  return {
    get: () => store.get(),
    set: (next: ThemePreference) => {
      store.set(next);
      notify();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      const off = store.subscribe?.(listener);
      return () => {
        listeners.delete(listener);
        off?.();
      };
    },
  };
}

export function ThemeProvider({ children, store }: ThemeProviderProps) {
  const [fallbackStore] = useState(() => createMemoryPreferenceStore());
  const prefStore = store ?? fallbackStore;
  const obs = useMemo(() => observable(prefStore), [prefStore]);
  const preference = useSyncExternalStore(obs.subscribe, obs.get, obs.get);
  const system = useColorScheme();
  const setPreference = obs.set;

  const scheme = resolveScheme(preference, system);
  const theme = useMemo(
    () => buildTheme(scheme, preference, setPreference),
    [scheme, preference, setPreference],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Tema vigente. Fuera de un ThemeProvider (p. ej. un test aislado) usa el claro de solo lectura. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  return theme ?? DEFAULT_THEME;
}

const DEFAULT_THEME: Theme = buildTheme('light', 'system', () => undefined);

/**
 * Estilo de texto de una variante (`heading.h1`, `headline.md`, `text.sm`…). En RN no hay cascada
 * de pesos: cada peso es una familia (`Nunito_700Bold`), así que no se setea `fontWeight`
 * (Android sintetiza negrita falsa si se combinan). Si la fuente todavía no cargó, RN usa la del
 * sistema con el mismo tamaño e interlineado.
 */
export function textStyle(variant: TextVariant): TextStyle {
  const s = typeStyle(variant);
  return {
    fontFamily: fontFamily[s.family][s.weight],
    fontSize: s.size,
    lineHeight: s.lineHeight,
  };
}

/** Tope de escalado por variante (títulos 1.2, texto 1.3; DESIGN.md §3.2, justificación en tokens.ts). */
export function fontScaleCap(variant: TextVariant): number {
  return variant.startsWith('text.') ? maxFontSizeMultiplier.text : maxFontSizeMultiplier.heading;
}
