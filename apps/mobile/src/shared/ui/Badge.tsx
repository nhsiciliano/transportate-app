// Badge / etiqueta Obelisco (docs/02-obelisco-tokens.md §4 Badge): secundaria (fondo suave + borde)
// y primaria (relleno sólido); sm 20 / md 24 de alto.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, type ColorScheme } from '../theme';
import { Text } from './Text';

export type BadgeTone = 'default' | 'info' | 'success' | 'danger' | 'warning';
export type BadgeVariant = 'secondary' | 'primary';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  /** Por defecto `label`. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export function badgePalette(
  colors: ColorScheme,
  tone: BadgeTone,
  variant: BadgeVariant,
): { bg: string; fg: string; border: string } {
  if (tone === 'default') {
    const n = colors.neutral;
    return variant === 'primary'
      ? { bg: n.solid, fg: n.onSolid, border: n.solid }
      : { bg: n.container, fg: n.onContainer, border: n.border };
  }
  const r = colors.role[tone];
  // Primaria warning: texto $primary sobre orange-400 (4.91:1), no blanco (§7 fix 3) → `on`.
  return variant === 'primary'
    ? { bg: r.base, fg: r.on, border: r.base }
    : { bg: r.container, fg: r.onContainer, border: r.text };
}

export function Badge({
  label,
  tone = 'default',
  variant = 'secondary',
  size = 'md',
  icon,
  accessibilityLabel,
  style,
  testID,
}: BadgeProps) {
  const theme = useTheme();
  const t = theme.component.badge;
  const pal = badgePalette(theme.colors, tone, variant);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        {
          minHeight: t.height[size],
          paddingHorizontal: t.paddingX,
          paddingVertical: t.paddingY[size],
          gap: t.gap,
          borderRadius: t.radius,
          backgroundColor: pal.bg,
          borderColor: pal.border,
          borderWidth: t.borderWidth,
        },
        style,
      ]}
    >
      {icon ? <View importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      <Text variant={size === 'sm' ? 'text.xs' : 'text.sm'} color={pal.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
