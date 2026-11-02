// Botón Obelisco (docs/02-obelisco-tokens.md §1.5 y §4 Button): pill, `headline-md` en bold,
// alturas 32/40/48 con área táctil ≥ 44 vía hitSlop.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type Insets,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme, type ColorScheme, type Theme } from '../theme';
import { triggerHaptic, type HapticKind } from './haptics';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'light' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Solo borde de 2 px del color del rol (Obelisco `outline-*`). */
  outline?: boolean;
  size?: ButtonSize;
  disabled?: boolean;
  /** Muestra un indicador y bloquea el toque; el lector anuncia "ocupado". */
  loading?: boolean;
  /** Slot de ícono (el componente Icon llega en la tarea 3.5). */
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  /** Por defecto el nombre accesible es `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Háptico al tocar: solo donde el brief lo pide (guardar favorito → `success`). */
  haptic?: HapticKind;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

interface Palette {
  bg: string;
  bgPressed: string;
  fg: string;
  fgPressed: string;
  border: string | null;
}

function palette(
  colors: ColorScheme,
  variant: ButtonVariant,
  outline: boolean,
  disabled: boolean,
): Palette {
  if (disabled) {
    // §1.5 deshabilitado: fondo $disabled-bg, texto $disabled-text (c/button:33-50)
    return {
      bg: colors.bg.disabled,
      bgPressed: colors.bg.disabled,
      fg: colors.text.disabled,
      fgPressed: colors.text.disabled,
      border: null,
    };
  }
  if (variant === 'light') {
    // §1.5 light: fondo light, texto oscuro, hover slate-200 (c/button:27,114-118)
    return {
      bg: colors.bg.elevated,
      bgPressed: colors.bg.pressed,
      fg: colors.text.primary,
      fgPressed: colors.text.primary,
      border: outline ? colors.border.strong : null,
    };
  }
  if (variant === 'link') {
    // §1.5 link: sin relleno, activo slate-100 (c/button:8-12,30)
    return {
      bg: 'transparent',
      bgPressed: colors.bg.pressed,
      fg: colors.text.link,
      fgPressed: colors.text.link,
      border: null,
    };
  }
  const role = colors.role[variant];
  if (outline) {
    // §1.5 outline-*: transparente, borde 2 px del rol; presionado → relleno (c/button:277-316)
    return {
      bg: 'transparent',
      bgPressed: role.base,
      fg: role.base,
      fgPressed: role.on,
      border: role.base,
    };
  }
  return { bg: role.base, bgPressed: role.hover, fg: role.on, fgPressed: role.on, border: null };
}

/** hitSlop vertical para llegar a 44 pt aunque el botón sea de 32 o 40. */
export function hitSlopFor(height: number, minTarget: number): Insets {
  const v = Math.max(0, Math.ceil((minTarget - height) / 2));
  return { top: v, bottom: v, left: 0, right: 0 };
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  outline = false,
  size = 'lg',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'start',
  accessibilityLabel,
  accessibilityHint,
  haptic,
  fullWidth = false,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const t = theme.component.button;
  const inactive = disabled || loading;
  const pal = palette(theme.colors, variant, outline, disabled);
  const height = t.height[size];

  const handlePress = () => {
    if (inactive) return;
    if (haptic) triggerHaptic(haptic);
    onPress?.();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={hitSlopFor(height, theme.component.hitSlop)}
      style={({ pressed }) => [
        styles.base,
        buttonBox(theme, size, pal, pressed),
        fullWidth ? styles.fullWidth : null,
        style,
      ]}
    >
      {({ pressed }) => {
        const fg = pressed ? pal.fgPressed : pal.fg;
        const content = (
          <Text
            variant="headline.md"
            color={fg}
            // headline-md en bold (c/button:122-123): la familia bold sale del tema.
            style={[styles.label, { fontFamily: theme.fontFamily.heading[700] }]}
            numberOfLines={2}
          >
            {label}
          </Text>
        );
        return (
          <>
            {loading ? (
              <ActivityIndicator color={fg} size="small" accessibilityElementsHidden />
            ) : null}
            {!loading && icon && iconPosition === 'start' ? <View>{icon}</View> : null}
            {content}
            {!loading && icon && iconPosition === 'end' ? <View>{icon}</View> : null}
          </>
        );
      }}
    </Pressable>
  );
}

function buttonBox(theme: Theme, size: ButtonSize, pal: Palette, pressed: boolean): ViewStyle {
  const t = theme.component.button;
  return {
    minHeight: t.height[size],
    paddingHorizontal: t.paddingX[size],
    paddingVertical: t.paddingY[size],
    gap: t.gap,
    borderRadius: t.radius,
    backgroundColor: pressed ? pal.bgPressed : pal.bg,
    borderWidth: pal.border ? t.outlineWidth : 0,
    borderColor: pal.border ?? 'transparent',
  };
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  label: { textAlign: 'center' },
});
