// Layout raíz: un Stack que contiene el grupo de tabs y la pantalla de "no encontrado".
// Áreas seguras con SafeAreaProvider y barra de estado automática (sigue el modo claro/oscuro).
//
// Fuentes (tarea 3.4): el splash nativo queda visible hasta que cargan Nunito y Open Sans. Si la
// carga falla, se oculta igual para no colgar la app, que sigue con la fuente del sistema.
//
// Providers (tarea 3.9), de afuera hacia adentro: áreas seguras → tema (Sistema/Claro/Oscuro,
// S18) → datos (TanStack Query + caché persistida en MMKV, src/shared/query) → intervalo de
// refresco (S17) → favoritos (MMKV). Tema e intervalo se guardan en MMKV con los stores de
// `src/shared/storage/preferences.ts`; Ajustes escribe en las mismas claves y los providers se
// enteran por `subscribe`.
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FavoritosProvider } from '@/features/favoritos';
import { useAppFonts } from '@/shared/fonts';
import { QueryProvider, RefreshIntervalProvider } from '@/shared/query';
import { getDefaultKeyValueStore } from '@/shared/storage/kv';
import {
  createRefreshIntervalStore,
  createThemePreferenceStore,
} from '@/shared/storage/preferences';
import { ThemeProvider } from '@/shared/theme';

// En el scope del módulo, sin await: dentro de un componente podría llegar tarde
// (https://docs.expo.dev/versions/latest/sdk/splash-screen/).
void SplashScreen.preventAutoHideAsync();

function AppTree() {
  const { loaded, error } = useAppFonts();
  const [themeStore] = useState(() => createThemePreferenceStore(getDefaultKeyValueStore()));
  const [intervalStore] = useState(() => createRefreshIntervalStore(getDefaultKeyValueStore()));

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
      <ThemeProvider store={themeStore}>
        <QueryProvider>
          <RefreshIntervalProvider store={intervalStore}>
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

// Gestos (mapa, reorden): RNGH solo los reconoce dentro de su raíz, que envuelve toda la app.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppTree />
    </GestureHandlerRootView>
  );
}
