// Chrome nativo desde el tema (F5-HIGH-C). Headers, large titles, botón «Atrás», tab bar y fondo
// de transición tienen que seguir la preferencia de Ajustes (Sistema / Claro / Oscuro) aunque el
// sistema esté en el otro modo. Tres piezas:
//
// 1. `ThemeProvider` llama a `Appearance.setColorScheme` (lo nativo: tab bar, sheets, alerts).
// 2. `navigationTheme(theme)`: el `ThemeProvider` de React Navigation (vía expo-router) con los
//    colores del tema: títulos en `text.primary` y fondo sin flashes blancos entre pantallas.
// 3. `stackScreenOptions(theme)`: lo que cada `Stack` de tab fija en sus headers.
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';

import { useTheme, type Theme } from './ThemeProvider';

/** Fondo de pantalla de la dirección: `bg.elevated` (#edf4ff) en claro, `bg.base` en oscuro. */
export function fondoPantalla(theme: Pick<Theme, 'scheme' | 'colors'>): string {
  return theme.scheme === 'light' ? theme.colors.bg.elevated : theme.colors.bg.base;
}

/** Tema de React Navigation: el de base (claro/oscuro) con los colores de Obelisco. */
export function navigationTheme(theme: Pick<Theme, 'scheme' | 'colors'>): NavigationTheme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const { colors } = theme;
  return {
    ...base,
    dark: theme.scheme === 'dark',
    colors: {
      ...base.colors,
      primary: colors.text.link,
      background: fondoPantalla(theme),
      card: colors.bg.card,
      text: colors.text.primary,
      border: colors.border.subtle,
      notification: colors.role.danger.base,
    },
  };
}

/**
 * Opciones de header comunes a las `Stack` de los tabs: botón «Atrás» y botones del header en
 * `text.link`, títulos en `text.primary` con Fira Sans 700 y fondo del header igual al de la
 * pantalla (el large title se apoya sobre el mismo celeste en claro).
 */
export function stackScreenOptions(theme: Pick<Theme, 'scheme' | 'colors' | 'fontFamily'>) {
  const fondo = fondoPantalla(theme);
  const titulo = { fontFamily: theme.fontFamily.heading[700], color: theme.colors.text.primary };
  return {
    // Corto en iOS; en Android el back es el ícono nativo.
    headerBackTitle: 'Atrás',
    headerTintColor: theme.colors.text.link,
    headerTitleStyle: titulo,
    headerLargeTitleStyle: titulo,
    headerStyle: { backgroundColor: fondo },
    headerLargeStyle: { backgroundColor: fondo },
    contentStyle: { backgroundColor: fondo },
  } as const;
}

/** `stackScreenOptions` del tema vigente (para `<Stack screenOptions={…}>`). */
export function useStackScreenOptions() {
  return stackScreenOptions(useTheme());
}
