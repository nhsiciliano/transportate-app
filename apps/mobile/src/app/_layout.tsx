// Layout raíz: un Stack que contiene el grupo de tabs y la pantalla de "no encontrado".
// Áreas seguras con SafeAreaProvider y barra de estado automática (sigue el modo claro/oscuro).
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// TODO(F3): ThemeProvider (high-dev), QueryClientProvider (3.9)
export default function RootLayout() {
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
