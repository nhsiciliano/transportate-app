// Estado de servicio (docs/briefs/README.md, "Otros componentes compartidos"): badge secundaria +
// ícono + texto; nunca solo color. Mapea `EstadoServicioV1` del contrato del proxy.
import type { EstadoServicioV1 } from '@transportate/contracts';
import type { ReactNode } from 'react';
import { useTheme } from '../theme';
import { Badge, badgePalette, type BadgeSize, type BadgeTone } from './Badge';
import { Text } from './Text';

export interface StatusInfo {
  label: string;
  tone: BadgeTone;
  /** Glifo de respaldo hasta que exista el componente Icon (tarea 3.5). */
  glyph: string;
}

/** Copy y tono por estado (voseo no aplica: son rótulos). */
export const STATUS: Record<EstadoServicioV1, StatusInfo> = {
  normal: { label: 'Normal', tone: 'success', glyph: '✓' },
  demorada: { label: 'Con demoras', tone: 'warning', glyph: '!' },
  interrumpida: { label: 'Interrumpida', tone: 'danger', glyph: '✕' },
  sin_datos: { label: 'Sin información', tone: 'default', glyph: '?' },
};

export interface StatusChipProps {
  estado: EstadoServicioV1;
  size?: BadgeSize;
  /** Ícono real (Icon, tarea 3.5); si no viene, se usa un glifo de texto. */
  icon?: ReactNode;
  testID?: string | undefined;
}

export function StatusChip({ estado, size = 'md', icon, testID }: StatusChipProps) {
  const { colors, component } = useTheme();
  const info = STATUS[estado];
  const fg = badgePalette(colors, info.tone, 'secondary').fg;
  const fallback = (
    <Text
      variant={size === 'sm' ? 'text.xs' : 'text.sm'}
      color={fg}
      maxFontSizeMultiplier={component.badgeFontScale}
    >
      {info.glyph}
    </Text>
  );
  return (
    <Badge
      testID={testID}
      label={info.label}
      tone={info.tone}
      size={size}
      icon={icon ?? fallback}
      accessibilityLabel={`Estado: ${info.label}`}
    />
  );
}
