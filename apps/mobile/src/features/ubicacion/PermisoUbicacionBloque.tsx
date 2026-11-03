// Bloque "Sin permiso de ubicación" (brief `docs/briefs/02-colectivos.md`, estados). Se muestra en
// lugar de lo que necesita la ubicación (paradas cercanas). Presentacional: recibe lo que viene de
// `useUbicacion()` y qué hacer en cada botón.
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Button, Card, Text } from '@/shared/ui';

import type { PermisoUbicacion } from './useUbicacion';

export const PERMISO_MESSAGE =
  'Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono.';
export const PERMISO_BLOCKED_MESSAGE = 'La ubicación está desactivada para Transportate.';

export interface PermisoUbicacionBloqueProps {
  permission: PermisoUbicacion;
  /** "Activar": pide el permiso (diálogo del sistema). */
  onRequest: () => void;
  /** "Abrir configuración": cuando el sistema ya no deja volver a preguntar. */
  onOpenSettings: () => void;
  /** "Buscar a mano": sigue sin ubicación. */
  onManual: () => void;
  testID?: string;
}

export function PermisoUbicacionBloque({
  permission,
  onRequest,
  onOpenSettings,
  onManual,
  testID,
}: PermisoUbicacionBloqueProps) {
  const { space } = useTheme();
  const blocked = permission === 'blocked';
  return (
    <Card testID={testID} style={{ gap: space[3] }}>
      <View style={[styles.header, { gap: space[2] }]}>
        <Icon name="sinUbicacion" size={24} />
        <Text variant="headline.sm" style={styles.title} accessibilityRole="header">
          Ubicación
        </Text>
      </View>
      <Text>{PERMISO_MESSAGE}</Text>
      {blocked ? (
        <Text variant="text.sm" tone="secondary">
          {PERMISO_BLOCKED_MESSAGE}
        </Text>
      ) : null}
      <View style={[styles.buttons, { gap: space[2] }]}>
        {blocked ? (
          <Button label="Abrir configuración" onPress={onOpenSettings} size="md" />
        ) : (
          <Button label="Activar" onPress={onRequest} size="md" />
        )}
        <Button label="Buscar a mano" variant="secondary" outline onPress={onManual} size="md" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap' },
});
