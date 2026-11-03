// Stack del tab Favoritos. El botón Editar/Listo del header comparte el modo edición con la
// pantalla por contexto (`EditModeProvider`).
import { Stack } from 'expo-router';

import { EditModeButton, EditModeProvider } from '@/features/favoritos';

export default function Layout() {
  return (
    <EditModeProvider>
      {/* `headerBackTitle` corto en iOS; en Android el back es el ícono nativo. */}
      <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
        <Stack.Screen name="index" options={{ title: 'Favoritos', headerRight: EditModeButton }} />
      </Stack>
    </EditModeProvider>
  );
}
