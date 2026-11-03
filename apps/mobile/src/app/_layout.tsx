// Layout raíz: un Stack que contiene el grupo de tabs y la pantalla de "no encontrado".
// Áreas seguras con SafeAreaProvider y barra de estado automática (sigue el modo claro/oscuro).
//
// Fuentes (tarea 3.4): el splash nativo queda visible hasta que carga Fira Sans (3 pesos). Si la
// carga falla, se oculta igual para no colgar la app, que sigue con la fuente del sistema.
//
// Providers (tarea 3.9), de afuera hacia adentro: áreas seguras → tema (Sistema/Claro/Oscuro,
// S18) → datos (TanStack Query + caché persistida en MMKV, src/shared/query) → intervalo de
// refresco (S17) → favoritos (MMKV). Tema e intervalo se guardan en MMKV con los stores de
// `src/shared/storage/preferences.ts`; Ajustes escribe en las mismas claves y los providers se
// enteran por `subscribe`.
//
// Sin conexión (tarea 4.2): `OfflineBanner` global, una sola vez, arriba del Stack y dentro de
// los providers (`useIsOnline()` lee el onlineManager de TanStack). Con el banner visible, el
// banner se queda con el margen superior del sistema y el Stack recibe `top: 0`, para no sumarlo
// dos veces.
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { FavoritosProvider } from '@/features/favoritos';
import { useAppFonts } from '@/shared/fonts';
import { QueryProvider, RefreshIntervalProvider, useIsOnline } from '@/shared/query';
import { getDefaultKeyValueStore } from '@/shared/storage/kv';
import {
  createRefreshIntervalStore,
  createThemePreferenceStore,
} from '@/shared/storage/preferences';
import { ThemeProvider, useTheme } from '@/shared/theme';
import { OfflineBanner } from '@/shared/ui';

// En el scope del módulo, sin await: dentro de un componente podría llegar tarde
// (https://docs.expo.dev/versions/latest/sdk/splash-screen/).
void SplashScreen.preventAutoHideAsync();

function WithOfflineBanner({ children }: { children: ReactNode }) {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  if (online) return children;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.base }}>
      <OfflineBanner visible style={{ paddingTop: insets.top + 8 }} testID="offline-banner" />
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

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
              <WithOfflineBanner>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="+not-found"
                    options={{ headerShown: true, title: 'No encontrado' }}
                  />
                </Stack>
              </WithOfflineBanner>
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
