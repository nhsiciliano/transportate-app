// Stack del tab Favoritos.
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    // `headerBackTitle` corto en iOS; en Android el back es el ícono nativo.
    <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
      <Stack.Screen name="index" options={{ title: 'Favoritos' }} />
    </Stack>
  );
}
