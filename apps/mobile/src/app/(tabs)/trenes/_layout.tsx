// Stack del tab Trenes: listado → línea → ramal → estación (también estación desde la búsqueda).
import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/shared/theme';

export default function Layout() {
  // Header desde el tema: «Atrás» y botones en `text.link`, títulos en `text.primary` (F5-HIGH-C).
  const screenOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Trenes' }} />
      <Stack.Screen name="[linea]" options={{ title: 'Línea' }} />
      <Stack.Screen name="ramal/[id]" options={{ title: 'Ramal' }} />
      <Stack.Screen name="estacion/[id]" options={{ title: 'Estación' }} />
    </Stack>
  );
}
