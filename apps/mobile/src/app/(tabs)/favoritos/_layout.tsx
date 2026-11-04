// Stack del tab Favoritos. El botón Editar/Listo del header comparte el modo edición con la
// pantalla por contexto (`EditModeProvider`).
import { Stack } from 'expo-router';

import { EditModeButton, EditModeProvider } from '@/features/favoritos';
import { useStackScreenOptions } from '@/shared/theme';

export default function Layout() {
  // Header desde el tema: «Atrás» y botones en `text.link`, títulos en `text.primary` (F5-HIGH-C).
  const screenOptions = useStackScreenOptions();
  return (
    <EditModeProvider>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen
          name="index"
          // Large title en iOS como en los otros tabs: sin él, en iOS 26 el header opaco se
          // extiende sobre el contenido y tapa la primera fila. En Android, barra común.
          options={{
            title: 'Favoritos',
            headerLargeTitleEnabled: true,
            headerRight: EditModeButton,
          }}
        />
      </Stack>
    </EditModeProvider>
  );
}
