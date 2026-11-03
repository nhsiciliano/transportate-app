// Piezas de la lista agrupada de Ajustes y Acerca de: sección con encabezado y fila ≥ 44 pt.
// No son componentes compartidos: solo las usan estas pantallas (si otra feature las necesita,
// se pasan a `shared/ui`). Todo el color sale de `useTheme()`.
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Card, Text, type TextTone } from '@/shared/ui';

export function Section({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: string;
}) {
  const { space, colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="headline.sm" tone="secondary" accessibilityRole="header">
        {title}
      </Text>
      <Card style={styles.group}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </Card>
      {footer ? (
        <Text variant="text.xs" tone="secondary">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export interface RowProps {
  title: string;
  /** Valor o descripción debajo del título (con letra grande pasa a otro renglón, no se trunca). */
  value?: string;
  icon?: IconName;
  /** Ícono al final: flecha de navegación o enlace externo. */
  trailing?: 'chevron' | 'externo';
  titleTone?: TextTone;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  role?: 'button' | 'link';
  /** Reemplaza el nombre accesible por defecto ("título, valor"). */
  accessibilityLabel?: string;
  /** Contenido extra entre el valor y el borde (indicadores, texto de estado). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Fila de la lista. Con `onPress` es tocable y se lee como una sola unidad. */
export function Row({
  title,
  value,
  icon,
  trailing,
  titleTone = 'primary',
  onPress,
  disabled = false,
  busy = false,
  role = 'button',
  accessibilityLabel,
  children,
  style,
  testID,
}: RowProps) {
  const { space, colors, component } = useTheme();
  const body = (
    <>
      {icon ? <Icon name={icon} size={24} /> : null}
      <View style={styles.text}>
        <Text variant="text.md" tone={disabled ? 'disabled' : titleTone}>
          {title}
        </Text>
        {value ? (
          <Text variant="text.sm" tone="secondary">
            {value}
          </Text>
        ) : null}
        {children}
      </View>
      {trailing ? (
        <Icon name={trailing === 'chevron' ? 'chevron' : 'enlaceExterno'} size={20} />
      ) : null}
    </>
  );
  const box: ViewStyle = {
    minHeight: component.hitSlop + space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    gap: space[3],
  };
  if (!onPress) {
    return (
      <View testID={testID} style={[styles.row, box, style]}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? (value ? `${title}, ${value}` : title)}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        styles.row,
        box,
        pressed ? { backgroundColor: colors.bg.pressed } : null,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Sin padding propio: las filas llegan hasta el borde de la tarjeta.
  group: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
