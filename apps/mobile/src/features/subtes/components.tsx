// Piezas compartidas por las tres pantallas de Subtes. Todo sale de `shared/ui` + `Icon`; los
// únicos colores que no vienen del tema son los de la línea (`route_color`, datos del estático).
import type { EstadoServicioV1 } from '@transportate/contracts';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

import { Icon, type IconName } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Alert,
  alertPalette,
  badgePalette,
  Board,
  LineBadge,
  STATUS,
  StatusChip,
  Text,
  type AlertRole,
  type BoardStatusTone,
  type LineBadgeSize,
  type SignBandStatus,
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

// ---------------------------------------------------------------- «Señalética de terminal» (F5)

/** Estado de servicio → tono del estado a la derecha de una fila de placa. */
export const ESTADO_BOARD: Record<EstadoServicioV1, BoardStatusTone> = {
  normal: 'ok',
  demorada: 'warning',
  interrumpida: 'danger',
  sin_datos: 'muted',
};

/** El estado de una línea a la derecha de su fila («Con demoras» con cuadrado ámbar). */
export function EstadoBoard({ estado, testID }: { estado: EstadoServicioV1; testID?: string }) {
  return <Board.Status text={STATUS[estado].label} tone={ESTADO_BOARD[estado]} testID={testID} />;
}

/** Tono de la nota (resumen de alerta) según el estado de la línea. */
export function tonoNota(estado: EstadoServicioV1): 'warning' | 'danger' | 'muted' {
  return estado === 'interrumpida' ? 'danger' : estado === 'demorada' ? 'warning' : 'muted';
}

/** Cuadrado de estado de una banda: solo con demoras o interrumpida. */
export function estadoBanda(
  estado: EstadoServicioV1,
  text: string = STATUS[estado].label,
): SignBandStatus | undefined {
  if (estado === 'demorada') return { tone: 'warning', text };
  if (estado === 'interrumpida') return { tone: 'danger', text };
  return undefined;
}

/** Fondo de las pantallas del mundo: `bg.elevated` (#edf4ff) en claro, `bg.base` en oscuro. */
export function useFondo(): string {
  const { colors, scheme } = useTheme();
  return scheme === 'light' ? colors.bg.elevated : colors.bg.base;
}

/** Rótulo de bloque (13/600 `text.secondary`), como «Subte ahora» o la etiqueta de una placa. */
export function Rotulo({ children }: { children: string }) {
  const { fontFamily } = useTheme();
  return (
    <Text
      variant="text.sm"
      tone="secondary"
      accessibilityRole="header"
      style={{ fontFamily: fontFamily.text[600], fontSize: 13, lineHeight: 16 }}
    >
      {children}
    </Text>
  );
}
