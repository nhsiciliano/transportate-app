// Alert Obelisco (docs/02-obelisco-tokens.md §4 Alert): estándar (fondo suave + outline 1 px del
// rol, texto de cuerpo) y `system` (relleno sólido). Se anuncia como alerta y con live region.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, type ColorScheme } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export type AlertRole = 'success' | 'danger' | 'warning' | 'info';
export type AlertVariant = 'standard' | 'system';

export interface AlertProps {
  role: AlertRole;
  variant?: AlertVariant;
  title?: string;
  message: string;
  /** Slot de ícono (24 pt). */
  icon?: ReactNode;
  action?: { label: string; onPress: () => void };
  /** `polite` por defecto; `assertive` solo para fallas que bloquean (servicio interrumpido). */
  live?: 'polite' | 'assertive' | 'none';
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

interface AlertPalette {
  bg: string;
  border: string;
  fg: string;
}

export function alertPalette(
  colors: ColorScheme,
  role: AlertRole,
  variant: AlertVariant,
): AlertPalette {
  if (variant === 'system') {
    // §4 Alert system: info usa $secondary; contenido blanco salvo warning ($primary) (c/alert:31-43)
    const r = role === 'info' ? colors.role.secondary : colors.role[role];
    return { bg: r.base, border: r.base, fg: r.on };
  }
  const r = colors.role[role];
  // §4 Alert estándar: fondo del rol, outline 1 px del rol, texto de cuerpo (c/alert:52-58).
  // Borde con `role.text`: en claro warning va en orange-600 para llegar a 3:1 (§7 fix 2).
  return { bg: r.container, border: r.text, fg: colors.text.primary };
}

export function Alert({
  role,
  variant = 'standard',
  title,
  message,
  icon,
  action,
  live = 'polite',
  style,
  testID,
}: AlertProps) {
  const theme = useTheme();
  const t = theme.component.alert;
  const pal = alertPalette(theme.colors, role, variant);
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion={live}
      style={[
        {
          backgroundColor: pal.bg,
          borderColor: pal.border,
          borderWidth: t.outlineWidth,
          borderRadius: t.radius,
          paddingTop: t.padding.top,
          paddingRight: t.padding.right,
          paddingBottom: t.padding.bottom,
          // Sin ícono no hace falta el margen izquierdo de 52.
          paddingLeft: icon ? t.padding.left : t.padding.right,
          gap: t.gap,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={[
            styles.icon,
            { left: t.iconInset, top: t.padding.top, width: t.iconSize, height: t.iconSize },
          ]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {icon}
        </View>
      ) : null}
      {title ? (
        <Text variant="headline.sm" color={pal.fg}>
          {title}
        </Text>
      ) : null}
      <Text variant="text.sm" color={pal.fg}>
        {message}
      </Text>
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant={variant === 'system' ? 'light' : 'secondary'}
          size="sm"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
