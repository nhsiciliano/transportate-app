// Stack del tab Colectivos: listado → línea → parada.
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    // `headerBackTitle` corto en iOS; en Android el back es el ícono nativo.
    <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
      <Stack.Screen name="index" options={{ title: 'Colectivos' }} />
      <Stack.Screen name="[linea]" options={{ title: 'Línea' }} />
      <Stack.Screen name="parada/[id]" options={{ title: 'Parada' }} />
    </Stack>
  );
}
