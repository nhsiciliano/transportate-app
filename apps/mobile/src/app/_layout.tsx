// Layout raíz: un Stack que contiene el grupo de tabs y la pantalla de "no encontrado".
// Áreas seguras con SafeAreaProvider y barra de estado automática (sigue el modo claro/oscuro).
//
// Fuentes (tarea 3.4): el splash nativo queda visible hasta que cargan Nunito y Open Sans. Si la
// carga falla, se oculta igual para no colgar la app, que sigue con la fuente del sistema.
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppFonts } from '@/shared/fonts';

// En el scope del módulo, sin await: dentro de un componente podría llegar tarde
// (https://docs.expo.dev/versions/latest/sdk/splash-screen/).
void SplashScreen.preventAutoHideAsync();

// TODO(F3): ThemeProvider (high-dev), QueryClientProvider (3.9)
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'No encontrado' }} />
      </Stack>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
