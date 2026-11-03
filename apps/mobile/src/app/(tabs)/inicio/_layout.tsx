// Stack del tab Inicio. Ajustes y Acerca de se apilan acá (suposición S2 de
// `docs/briefs/README.md`): se abren desde el botón de la barra superior de Inicio.
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';

// Botón (no `Link`): `Link asChild` le pone `role="link"` al hijo y el lector de pantalla lo
// anunciaría como enlace.
function AjustesButton() {
  const router = useRouter();
  const { colors, component } = useTheme();
  return (
    // Engranaje de 24 dentro de un área táctil de 44×44.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajustes"
      style={{
        width: component.hitSlop,
        height: component.hitSlop,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onPress={() => {
        router.push('/inicio/ajustes');
      }}
    >
      <Icon name="ajustes" size={24} color={colors.text.primary} />
    </Pressable>
  );
}

export default function InicioLayout() {
  return (
    // `headerBackTitle` corto en iOS; en Android el back es el ícono nativo.
    <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
      <Stack.Screen
        name="index"
        // Large title en iOS (colapsa con el scroll de `ScreenScroll`); en Android, barra común.
        options={{ title: 'Inicio', headerLargeTitleEnabled: true, headerRight: AjustesButton }}
      />
      <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
      <Stack.Screen name="acerca" options={{ title: 'Acerca de' }} />
      <Stack.Screen name="licencias" options={{ title: 'Licencias' }} />
    </Stack>
  );
}
