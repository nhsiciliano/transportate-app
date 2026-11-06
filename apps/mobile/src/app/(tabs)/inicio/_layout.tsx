// Stack del tab Inicio. Ajustes y Acerca de se apilan acá (suposición S2 de
// `docs/briefs/README.md`): se abren desde el botón de la barra superior de Inicio. Favoritos
// también (pedido del usuario, 2026-11-06): salió de la barra de tabs y se abre con la estrella
// del header, a la izquierda del engranaje.
import { Stack, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { EditModeButton, EditModeProvider } from '@/features/favoritos';
import { TITULO_INICIO } from '@/features/inicio';
import { Icon } from '@/shared/icons';
import { useStackScreenOptions, useTheme } from '@/shared/theme';

// Botones (no `Link`): `Link asChild` le pone `role="link"` al hijo y el lector de pantalla lo
// anunciaría como enlace.
function HeaderButton({
  label,
  icon,
  href,
}: {
  label: string;
  icon: 'favoritos' | 'ajustes';
  href: '/inicio/favoritos' | '/inicio/ajustes';
}) {
  const router = useRouter();
  const { colors, component } = useTheme();
  return (
    // Ícono de 24 dentro de un área táctil de 44×44.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: component.hitSlop,
        height: component.hitSlop,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onPress={() => {
        router.push(href);
      }}
    >
      <Icon name={icon} size={24} color={colors.text.primary} />
    </Pressable>
  );
}

/** Estrella de Favoritos y engranaje de Ajustes, sin separación extra: los 44 ya dan aire. */
function InicioHeaderRight() {
  return (
    <View style={{ flexDirection: 'row' }}>
      <HeaderButton label="Favoritos" icon="favoritos" href="/inicio/favoritos" />
      <HeaderButton label="Ajustes" icon="ajustes" href="/inicio/ajustes" />
    </View>
  );
}

export default function InicioLayout() {
  // Header desde el tema: «Atrás» y botones en `text.link`, títulos en `text.primary` (F5-HIGH-C).
  const screenOptions = useStackScreenOptions();
  return (
    // El botón Editar/Listo del header de Favoritos y la lista comparten el modo edición por
    // contexto: el provider envuelve el Stack porque el header lo dibuja este Stack.
    <EditModeProvider>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen
          name="index"
          // Large title en iOS (colapsa con el scroll de `ScreenScroll`); en Android, barra común.
          // El título es el nombre de la app (pedido del usuario, 2026-11-04): el tab sigue
          // diciendo «Inicio» y la pantalla lleva debajo la línea `LEMA` de `InicioScreen`.
          options={{
            title: TITULO_INICIO,
            headerLargeTitleEnabled: true,
            headerRight: InicioHeaderRight,
          }}
        />
        <Stack.Screen
          name="favoritos"
          // Large title en iOS como el resto: sin él, en iOS 26 el header opaco se extiende sobre
          // el contenido y tapa la primera fila. «Atrás» del sistema.
          options={{
            title: 'Favoritos',
            headerLargeTitleEnabled: true,
            headerRight: EditModeButton,
          }}
        />
        <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
        <Stack.Screen name="acerca" options={{ title: 'Acerca de' }} />
        <Stack.Screen name="licencias" options={{ title: 'Licencias' }} />
      </Stack>
    </EditModeProvider>
  );
}
