// Ruta fina: la pantalla vive en `src/features/favoritos`. Se apila en el Stack de Inicio y se
// abre desde la estrella del header (pedido del usuario, 2026-11-06: Favoritos sale de la barra).
import { useEffect } from 'react';

import { FavoritosScreen, useEditMode } from '@/features/favoritos';

export default function FavoritosRoute() {
  // El modo edición vive en el `EditModeProvider` del Stack de Inicio, que sobrevive a esta
  // pantalla: al volver atrás se apaga, así la próxima vez abre en modo lectura.
  const { setEditing } = useEditMode();
  useEffect(
    () => () => {
      setEditing(false);
    },
    [setEditing],
  );
  return <FavoritosScreen />;
}
