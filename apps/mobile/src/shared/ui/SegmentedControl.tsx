// Tabs tipo pill / control segmentado (docs/02-obelisco-tokens.md §4 Tabs/navegación): para Lista ⇄
// Mapa y para andén/sentido. Activo = fondo $active-color (role.secondary) con texto on (c/nav:122-123).
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { triggerHaptic } from './haptics';
import { Text } from './Text';

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  accessibilityLabel?: string;
}

export interface SegmentedControlProps<V extends string> {
  options: readonly SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Nombre del grupo para el lector de pantalla ("Vista", "Sentido"). */
  accessibilityLabel: string;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  size = 'lg',
  style,
  testID,
}: SegmentedControlProps<V>) {
  const theme = useTheme();
  const { colors } = theme;
  const t = theme.component.tab;
  const active = colors.role.secondary;
  // Nunca menos de 44 de alto: los segmentos son blancos de toque contiguos (sin hitSlop).
  const height = Math.max(t.height[size], theme.component.hitSlop);
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.row,
        {
          borderRadius: t.radius,
          borderWidth: theme.borderWidth.hairline,
          borderColor: colors.border.strong,
          backgroundColor: colors.bg.base,
          padding: theme.space[1] / 2,
        },
        style,
      ]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (selected) return;
              triggerHaptic('selection');
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              {
                minHeight: height - theme.space[1],
                paddingHorizontal: t.paddingX,
                borderRadius: t.radius,
                backgroundColor: selected
                  ? active.base
                  : pressed
                    ? colors.bg.pressed
                    : 'transparent',
              },
            ]}
          >
            <Text
              variant="headline.sm"
              color={selected ? active.on : colors.text.primary}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Alias: en el brief se los nombra "Tabs" (pill) o "SegmentedControl". */
export const Tabs = SegmentedControl;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignSelf: 'stretch' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
