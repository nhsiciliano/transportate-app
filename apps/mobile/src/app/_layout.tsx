// Layout raíz: un Stack que contiene el grupo de tabs y la pantalla de "no encontrado".
// Áreas seguras con SafeAreaProvider y barra de estado automática (sigue el modo claro/oscuro).
//
// Fuentes (tarea 3.4): el splash nativo queda visible hasta que cargan Nunito y Open Sans. Si la
// carga falla, se oculta igual para no colgar la app, que sigue con la fuente del sistema.
//
// Providers (tarea 3.9), de afuera hacia adentro: áreas seguras → tema (Sistema/Claro/Oscuro,
// S18) → datos (TanStack Query + caché persistida en MMKV, src/shared/query) → intervalo de
// refresco (S17) → favoritos (MMKV). Las preferencias de tema e intervalo usan stores en memoria
// hasta que Ajustes las guarde (`src/shared/storage/preferences.ts`, tarea 3.11).
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FavoritosProvider } from '@/features/favoritos';
import { useAppFonts } from '@/shared/fonts';
import { QueryProvider, RefreshIntervalProvider } from '@/shared/query';
import { ThemeProvider } from '@/shared/theme';

// En el scope del módulo, sin await: dentro de un componente podría llegar tarde
// (https://docs.expo.dev/versions/latest/sdk/splash-screen/).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { loaded, error } = useAppFonts();

  useEffect(() => {
    if (!loaded && !error) return;
    if (error && __DEV__) {
      console.warn('[fonts] No se pudieron cargar las fuentes; se usa la del sistema.', error);
    }
    void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryProvider>
          <RefreshIntervalProvider>
            <FavoritosProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="+not-found"
                  options={{ headerShown: true, title: 'No encontrado' }}
                />
              </Stack>
              <StatusBar style="auto" />
            </FavoritosProvider>
          </RefreshIntervalProvider>
        </QueryProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
