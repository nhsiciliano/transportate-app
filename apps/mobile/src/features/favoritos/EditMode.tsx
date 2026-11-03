// Modo edición de la pantalla Favoritos. El botón "Editar"/"Listo" vive en el header del Stack
// (`src/app/(tabs)/favoritos/_layout.tsx`) y la lista en la pantalla: comparten el estado por
// contexto, así no hay un singleton de módulo y cada árbol de tests tiene el suyo.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';

import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import { useFavoritos } from './FavoritosProvider';

interface EditModeValue {
  editing: boolean;
  setEditing: (editing: boolean) => void;
}

const EditModeContext = createContext<EditModeValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const value = useMemo(() => ({ editing, setEditing }), [editing]);
  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

/** Fuera de un `EditModeProvider` el modo edición queda apagado y no se puede prender. */
export function useEditMode(): EditModeValue {
  return useContext(EditModeContext) ?? { editing: false, setEditing: () => undefined };
}

export const EDIT_LABEL = 'Editar';
export const DONE_LABEL = 'Listo';

/** Botón del header: sin favoritos no hay nada que editar, así que no se muestra. */
export function EditModeButton() {
  const { favoritos } = useFavoritos();
  const { editing, setEditing } = useEditMode();
  const { component } = useTheme();
  if (favoritos.length === 0) return null;
  const label = editing ? DONE_LABEL : EDIT_LABEL;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        setEditing(!editing);
      }}
      style={{
        minHeight: component.hitSlop,
        minWidth: component.hitSlop,
        justifyContent: 'center',
      }}
    >
      <Text variant="headline.sm" tone="link">
        {label}
      </Text>
    </Pressable>
  );
}
