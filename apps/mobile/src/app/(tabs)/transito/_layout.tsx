// Stack del tab Tránsito, OCULTO en el MVP (ver `(tabs)/_layout.tsx`).
import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/shared/theme';

export default function Layout() {
  // Header desde el tema: «Atrás» y botones en `text.link`, títulos en `text.primary` (F5-HIGH-C).
  const screenOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Tránsito' }} />
    </Stack>
  );
}
