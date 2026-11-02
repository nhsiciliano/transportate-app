// Banner sin conexión (docs/briefs/README.md, "Banner sin conexión"): fijo arriba del contenido,
// no bloquea la UI. Texto fijo. Estilo: Alert `system` warning (relleno sólido, texto $primary,
// 4.91:1, docs/02-obelisco-tokens.md §4 Alert y §7). El safe area lo resuelve la pantalla que lo
// ubica debajo de la barra de navegación.
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export const OFFLINE_MESSAGE = 'Sin conexión. Mostramos lo último guardado.';

export interface OfflineBannerProps {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export function OfflineBanner({ visible, style, testID }: OfflineBannerProps) {
  const { colors, space } = useTheme();
  if (!visible) return null;
  const r = colors.role.warning;
  return (
    <View
      testID={testID}
      // Sin `accessible`, el View no expone su rol: el lector no lo anuncia como alerta.
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        { backgroundColor: r.base, paddingVertical: space[2], paddingHorizontal: space[3] },
        style,
      ]}
    >
      <Text variant="text.sm" color={r.on}>
        {OFFLINE_MESSAGE}
      </Text>
    </View>
  );
}
