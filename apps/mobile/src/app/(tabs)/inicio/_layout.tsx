// Stack del tab Inicio. Ajustes y Acerca de se apilan acá (suposición S2 de
// `docs/briefs/README.md`): se abren desde el botón de la barra superior de Inicio.
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { TITULO_INICIO } from '@/features/inicio';
import { Icon } from '@/shared/icons';
import { useStackScreenOptions, useTheme } from '@/shared/theme';

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
  // Header desde el tema: «Atrás» y botones en `text.link`, títulos en `text.primary` (F5-HIGH-C).
  const screenOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        // Large title en iOS (colapsa con el scroll de `ScreenScroll`); en Android, barra común.
        // El título es el nombre de la app (pedido del usuario, 2026-11-04): el tab sigue
        // diciendo «Inicio» y la pantalla lleva debajo la línea `LEMA` de `InicioScreen`.
        options={{
          title: TITULO_INICIO,
          headerLargeTitleEnabled: true,
          headerRight: AjustesButton,
        }}
      />
      <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
      <Stack.Screen name="acerca" options={{ title: 'Acerca de' }} />
      <Stack.Screen name="licencias" options={{ title: 'Licencias' }} />
    </Stack>
  );
}
