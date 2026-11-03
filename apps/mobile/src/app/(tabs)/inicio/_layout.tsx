// Stack del tab Inicio. Ajustes y Acerca de se apilan acá (suposición S2 de
// `docs/briefs/README.md`): se abren desde el botón de la barra superior de Inicio.
import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

// Botón (no `Link`): `Link asChild` le pone `role="link"` al hijo y el lector de pantalla lo
// anunciaría como enlace.
function AjustesButton() {
  const router = useRouter();
  return (
    // TODO(3.5/3.7): ícono de engranaje con el componente `Icon` y área táctil de 44×44.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajustes"
      hitSlop={12}
      onPress={() => {
        router.push('/inicio/ajustes');
      }}
    >
      <Text>Ajustes</Text>
    </Pressable>
  );
}

export default function InicioLayout() {
  return (
    // `headerBackTitle` corto en iOS; en Android el back es el ícono nativo.
    <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
      <Stack.Screen name="index" options={{ title: 'Inicio', headerRight: AjustesButton }} />
      <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
      <Stack.Screen name="acerca" options={{ title: 'Acerca de' }} />
      <Stack.Screen name="licencias" options={{ title: 'Licencias' }} />
    </Stack>
  );
}
