// Estrella para guardar o quitar un favorito (docs/briefs/README.md, "Otros componentes
// compartidos"). Botón de ícono de 44×44: estrella con contorno (no es favorito) o llena (sí):
// la forma cambia, no solo el color. Háptico de éxito al guardar y de selección al quitar (S25).
// El "Deshacer" (snackbar, S19) llega con la pantalla de Favoritos (tarea 4.9).
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { triggerHaptic } from '@/shared/ui';

import { useFavoritos } from './FavoritosProvider';
import { favoritoId, type FavoritoTipo } from './model';

export interface FavoriteToggleProps {
  tipo: FavoritoTipo;
  refId: string;
  /** Nombre que se guarda y se muestra en Favoritos ("Línea B", "Medrano"). */
  nombre: string;
  subtitulo?: string;
  testID?: string;
}

export const SAVED_ANNOUNCEMENT = 'Guardado en favoritos';
export const REMOVED_ANNOUNCEMENT = 'Quitado de favoritos';

export function FavoriteToggle({ tipo, refId, nombre, subtitulo, testID }: FavoriteToggleProps) {
  const { colors, component } = useTheme();
  const { favoritos, repository } = useFavoritos();
  const id = favoritoId(tipo, refId);
  const selected = favoritos.some((f) => f.id === id);

  const toggle = () => {
    if (selected) {
      repository.remove(id);
      triggerHaptic('selection');
      AccessibilityInfo.announceForAccessibility(REMOVED_ANNOUNCEMENT);
    } else {
      repository.add({ tipo, refId, nombre, ...(subtitulo === undefined ? {} : { subtitulo }) });
      triggerHaptic('success');
      AccessibilityInfo.announceForAccessibility(SAVED_ANNOUNCEMENT);
    }
  };

  return (
    <Pressable
      testID={testID}
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={selected ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.base,
        {
          width: component.hitSlop,
          height: component.hitSlop,
          borderRadius: component.hitSlop / 2,
          backgroundColor: pressed ? colors.bg.pressed : 'transparent',
        },
      ]}
    >
      <Icon
        name={selected ? 'favoritoOn' : 'favoritoOff'}
        size={24}
        color={colors.role.primary.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
