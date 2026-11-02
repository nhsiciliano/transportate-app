// Insignia de línea (docs/briefs/README.md, "Otros componentes compartidos"; docs/02b-colores-subte.md §3).
// - Subte: letra sobre `route_color` con texto `route_text_color` (vienen del estático procesado,
//   nunca escritos en el código). Si la insignia tiene < 3:1 contra la superficie, lleva borde
//   (WCAG 1.4.11; regla de §3 "Reglas de uso").
// - Colectivo: número sobre neutro (suposición S11: no hay color oficial por línea).
// La letra o el número siempre van adentro: el color nunca es el único canal (WCAG 1.4.1).
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { contrastRatio } from '../theme/contrast';
import { useTheme } from '../theme';
import { Text } from './Text';

export type LineBadgeSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  /** Letra (`A`, `PM`) o número (`152`, `10A`). */
  label: string;
  size?: LineBadgeSize;
  /** Superficie sobre la que se apoya (para decidir el borde). Default `bg.base` del tema. */
  surface?: string;
  /** Default: "Línea A" / "Línea 152". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export type LineBadgeProps =
  | (CommonProps & { kind: 'subte'; color: string; textColor: string })
  | (CommonProps & { kind: 'colectivo' });

export function LineBadge(props: LineBadgeProps) {
  const { label, size = 'md', surface, accessibilityLabel, style, testID } = props;
  const { colors, borderWidth, component } = useTheme();
  const t = component.lineBadge;
  const box = t.size[size];
  const isSubte = props.kind === 'subte';
  const bg = isSubte ? props.color : colors.neutral.container;
  const fg = isSubte ? props.textColor : colors.neutral.onContainer;
  const surfaceColor = surface ?? colors.bg.base;
  const needsBorder = !isSubte || contrastRatio(bg, surfaceColor) < 3;
  const border = isSubte ? colors.text.primary : colors.neutral.border;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `Línea ${label}`}
      style={[
        styles.base,
        {
          minWidth: box,
          height: box,
          paddingHorizontal: isSubte ? 0 : t.paddingX,
          // Subte: círculo (como la señalética); colectivo: rectángulo redondeado (badge estática, radio 8).
          borderRadius: isSubte ? box / 2 : t.radius,
          backgroundColor: bg,
          borderWidth: needsBorder ? borderWidth.hairline : 0,
          borderColor: border,
        },
        style,
      ]}
    >
      <Text
        variant={size === 'lg' ? 'headline.lg' : size === 'md' ? 'headline.md' : 'headline.sm'}
        color={fg}
        // La insignia no crece con Dynamic Type más allá de 1.3: es un ícono con texto, no un párrafo.
        maxFontSizeMultiplier={component.badgeFontScale}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
});
