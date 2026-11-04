// Chrome nativo con el tema de la app (F5-HIGH-C). Va en el layout raíz, dentro de `ThemeProvider`.
//
// - El `ThemeProvider` de React Navigation lleva los colores de Obelisco (`navigationTheme`): los
//   títulos toman `text.primary`, el fondo de transición no flashea en blanco y el header nativo
//   recibe `userInterfaceStyle` oscuro o claro según el `dark` del tema (react-native-screens lo
//   deriva de ahí).
// - La barra de estado se elige por esquema, no `auto`: con «Oscuro» en Ajustes y el sistema en
//   claro, `auto` dejaría la hora en negro sobre fondo oscuro.
// - `ThemeProvider` (de este módulo) además le pasa la preferencia a lo nativo con
//   `Appearance.setColorScheme` (tab bar, sheets, alerts, controles).
import { ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, type ReactNode } from 'react';

import { navigationTheme } from './navigation';
import { useTheme } from './ThemeProvider';

export function ChromeNativo({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);
  return (
    <NavigationThemeProvider value={navTheme}>
      {children}
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
