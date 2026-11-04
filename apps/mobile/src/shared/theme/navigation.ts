// Chrome nativo desde el tema (F5-HIGH-C). Headers, large titles, botón «Atrás», tab bar y fondo
// de transición tienen que seguir la preferencia de Ajustes (Sistema / Claro / Oscuro) aunque el
// sistema esté en el otro modo. Tres piezas:
//
// 1. `ThemeProvider` llama a `Appearance.setColorScheme` (lo nativo: tab bar, sheets, alerts).
// 2. `navigationTheme(theme)`: el `ThemeProvider` de React Navigation (vía expo-router) con los
//    colores del tema: títulos en `text.primary` y fondo sin flashes blancos entre pantallas.
// 3. `stackScreenOptions(theme)`: lo que cada `Stack` de tab fija en sus headers (sin fondo
//    propio y con la fuente del sistema en los títulos: ver la nota de la función).
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
 * `text.link`, títulos en `text.primary` y fondo de pantalla (`contentStyle`) del tema.
 *
 * Sin `headerStyle`/`headerLargeStyle`: en iOS 26+ (Liquid Glass) expo-router usa la barra del
 * sistema cuando nada fija el fondo del header. Con un `backgroundColor` explícito, el header
 * nativo (react-native-screens 4.30) queda alto y **sin título**, en todas las pantallas; es el
 * defecto que apareció en el iPhone el 2026-11-04 y se reprodujo en el simulador (iOS 27). La
 * barra translúcida se apoya sobre el `contentStyle`, así que en claro se ve celeste y en oscuro
 * oscuro, como antes. Nota: expo-router comenta el mismo defecto en `useHeaderConfigProps`.
 *
 * Los títulos van con la fuente del sistema (regla del modo Operate: el chrome es del sistema y
 * la dirección vive en el contenido). Fira Sans en `fontFamily` también dibuja el título; no era
 * la causa del header vacío.
 */
export function stackScreenOptions(theme: Pick<Theme, 'scheme' | 'colors'>) {
  const fondo = fondoPantalla(theme);
  const titulo = { color: theme.colors.text.primary };
  return {
    // Corto en iOS; en Android el back es el ícono nativo.
    headerBackTitle: 'Atrás',
    headerTintColor: theme.colors.text.link,
    headerTitleStyle: titulo,
    headerLargeTitleStyle: titulo,
    contentStyle: { backgroundColor: fondo },
  } as const;
}

/** `stackScreenOptions` del tema vigente (para `<Stack screenOptions={…}>`). */
export function useStackScreenOptions() {
  return stackScreenOptions(useTheme());
}
