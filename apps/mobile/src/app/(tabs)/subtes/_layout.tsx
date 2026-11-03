// Stack del tab Subtes: listado → línea → estación.
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    // `headerBackTitle` corto en iOS; en Android el back es el ícono nativo.
    <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
      <Stack.Screen name="index" options={{ title: 'Subtes' }} />
      <Stack.Screen name="[linea]" options={{ title: 'Línea' }} />
      <Stack.Screen name="estacion/[id]" options={{ title: 'Estación' }} />
      <Stack.Screen name="mapa" options={{ title: 'Mapa de la red' }} />
    </Stack>
  );
}
