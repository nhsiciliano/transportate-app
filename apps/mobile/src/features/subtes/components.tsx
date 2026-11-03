// Piezas compartidas por las tres pantallas de Subtes. Todo sale de `shared/ui` + `Icon`; los
// únicos colores que no vienen del tema son los de la línea (`route_color`, datos del estático).
import type { EstadoServicioV1 } from '@transportate/contracts';
import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Alert,
  alertPalette,
  badgePalette,
  LineBadge,
  STATUS,
  StatusChip,
  Text,
  type AlertRole,
  type LineBadgeSize,
} from '@/shared/ui';

import type { LineaSubte } from './model';

export const REFRESH_ERROR_MESSAGE = 'No pudimos actualizar. Mostramos lo último que sabemos.';

const STATUS_ICON: Record<EstadoServicioV1, IconName> = {
  normal: 'ok',
  demorada: 'demoras',
  interrumpida: 'interrumpida',
  sin_datos: 'sinInformacion',
};

/** `StatusChip` con el ícono del mapa curado en vez del glifo de texto. */
export function EstadoChip({ estado, testID }: { estado: EstadoServicioV1; testID?: string }) {
  const { colors } = useTheme();
  const fg = badgePalette(colors, STATUS[estado].tone, 'secondary').fg;
  return (
    <StatusChip
      estado={estado}
      testID={testID}
      icon={<Icon name={STATUS_ICON[estado]} size={16} color={fg} />}
    />
  );
}

/** Insignia de la línea con sus colores GTFS ("Premetro" para el lector). */
export function LineaBadge({
  linea,
  size = 'md',
}: {
  linea: Pick<LineaSubte, 'badge' | 'color' | 'colorTexto' | 'nombre'>;
  size?: LineBadgeSize;
}) {
  return (
    <LineBadge
      kind="subte"
      label={linea.badge}
      color={linea.color}
      textColor={linea.colorTexto}
      size={size}
      accessibilityLabel={linea.nombre}
    />
  );
}

/** Alert con ícono del mapa curado. */
export function AvisoAlert({
  role,
  variant = 'standard',
  title,
  message,
  action,
  testID,
}: {
  role: AlertRole;
  variant?: 'standard' | 'system';
  title?: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}) {
  const { colors } = useTheme();
  const fg = alertPalette(colors, role, variant).fg;
  const icon: IconName = role === 'danger' ? 'error' : role === 'info' ? 'info' : 'alerta';
  return (
    <Alert
      role={role}
      variant={variant}
      testID={testID}
      icon={<Icon name={icon} size={24} color={fg} />}
      {...(message === undefined ? {} : { message })}
      {...(title === undefined ? {} : { title })}
      {...(action === undefined ? {} : { action })}
    />
  );
}

/** Con datos y la última actualización fallida (`isRefreshError`). */
export function RefreshErrorAlert({ onRetry }: { onRetry: () => void }) {
  return (
    <AvisoAlert
      role="warning"
      message={REFRESH_ERROR_MESSAGE}
      action={{ label: 'Reintentar', onPress: onRetry }}
      testID="refresh-error"
    />
  );
}

/**
 * Pantalla con scroll, márgenes del sistema y pull to refresh nativo. `backgroundColor` y `gap`
 * son opcionales (Inicio usa `bg.elevated` y 12 entre bloques, dirección «Señalética de terminal»).
 */
export function ScreenScroll({
  refreshing,
  onRefresh,
  children,
  testID,
  backgroundColor,
  gap,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
  testID?: string;
  backgroundColor?: string;
  gap?: number;
}) {
  const { colors, space } = useTheme();
  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: backgroundColor ?? colors.bg.base }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space[3], gap: gap ?? space[3], paddingBottom: space[5] }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.text.secondary}
          colors={[colors.role.primary.text]}
          progressBackgroundColor={colors.bg.elevated}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

/** Fila tocable completa con chevron: se lee como una unidad. */
export function FilaTocable({
  onPress,
  accessibilityLabel,
  children,
  style,
  testID,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, space, radius, borderWidth } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.fila,
        {
          minHeight: 56,
          gap: space[2],
          paddingVertical: space[2],
          paddingHorizontal: space[3],
          borderRadius: radius['3xl'],
          borderWidth: borderWidth.control,
          borderColor: colors.border.subtle,
          backgroundColor: pressed ? colors.bg.pressed : colors.bg.card,
        },
        style,
      ]}
    >
      <View style={styles.filaContenido}>{children}</View>
      <Icon name="chevron" size={24} color={colors.text.secondary} />
    </Pressable>
  );
}

/** Título de sección (encabezado para el lector). */
export function Seccion({ children }: { children: string }) {
  return (
    <Text variant="headline.md" accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
  filaContenido: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
