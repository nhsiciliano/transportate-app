// Chip de filtro seleccionable. Obelisco no tiene chip (docs/02-obelisco-tokens.md §4 Chip): se usa
// la badge secundaria clickeable (borde 1 px, hover -100) con alto ≥ 32 y área táctil 44.
// Seleccionado = color activo de navegación ($active-color = role.secondary, §4 Tabs).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { hitSlopFor } from './Button';
import { triggerHaptic } from './haptics';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const { colors } = theme;
  const t = theme.component.chip;
  const active = colors.role.secondary;
  const fg = disabled ? colors.text.disabled : selected ? active.on : colors.text.primary;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (disabled) return;
        triggerHaptic('selection');
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      hitSlop={hitSlopFor(t.minHeight, theme.component.hitSlop)}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: t.minHeight,
          paddingHorizontal: t.paddingX,
          gap: theme.component.badge.gap,
          borderRadius: t.radius,
          borderWidth: theme.borderWidth.hairline,
          borderColor: disabled
            ? colors.border.subtle
            : selected
              ? active.base
              : colors.border.strong,
          backgroundColor: disabled
            ? colors.bg.disabled
            : selected
              ? pressed
                ? active.hover
                : active.base
              : pressed
                ? colors.bg.pressed
                : colors.bg.base,
        },
        style,
      ]}
    >
      {icon ? <View importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      <Text variant="text.sm" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
