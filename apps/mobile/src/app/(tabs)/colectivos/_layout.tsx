// Stack del tab Colectivos: listado → línea → parada.
import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/shared/theme';

export default function Layout() {
  // Header desde el tema: «Atrás» y botones en `text.link`, títulos en `text.primary` (F5-HIGH-C).
  const screenOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Colectivos' }} />
      <Stack.Screen name="[linea]" options={{ title: 'Línea' }} />
      <Stack.Screen name="parada/[id]" options={{ title: 'Parada' }} />
    </Stack>
  );
}
