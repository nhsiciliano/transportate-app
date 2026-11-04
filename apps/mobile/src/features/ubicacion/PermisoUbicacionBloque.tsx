// Bloque "Sin permiso de ubicación" (brief `docs/briefs/02-colectivos.md`, estados; forma de la
// Fase 5, F5-MID-B). Se muestra en lugar de lo que necesita la ubicación (paradas cercanas).
// Presentacional: recibe lo que viene de `useUbicacion()` y qué hacer en cada botón.
//
// Forma: pictograma `paradasCercanas` en cuadrado a la izquierda, título 17/600, texto 15
// `text.secondary` y los botones debajo. Dentro de una placa de tablero (`Board`) va con `inset`:
// sin fondo ni borde propios, solo el padding de una fila. Suelto, va en una `Card`.
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/shared/theme';
import { Button, Card, Pictogram, Text } from '@/shared/ui';

import type { PermisoUbicacion } from './useUbicacion';

export const PERMISO_TITLE = 'Activá la ubicación para ver paradas cerca tuyo';
export const PERMISO_DETAIL = 'Solo se usa mientras la app está abierta y no sale de tu teléfono.';
/** El mensaje completo, como lo decía el bloque antes de separar título y detalle (S32). */
export const PERMISO_MESSAGE = `${PERMISO_TITLE}. ${PERMISO_DETAIL}`;
export const PERMISO_BLOCKED_MESSAGE = 'La ubicación está desactivada para Transportate.';

export interface PermisoUbicacionBloqueProps {
  permission: PermisoUbicacion;
  /** "Activar": pide el permiso (diálogo del sistema). */
  onRequest: () => void;
  /** "Abrir configuración": cuando el sistema ya no deja volver a preguntar. */
  onOpenSettings: () => void;
  /** "Buscar a mano": sigue sin ubicación. */
  onManual: () => void;
  /** Dentro de una placa de tablero: sin fondo ni borde propios. */
  inset?: boolean;
  testID?: string;
}

export function PermisoUbicacionBloque({
  permission,
  onRequest,
  onOpenSettings,
  onManual,
  inset = false,
  testID,
}: PermisoUbicacionBloqueProps) {
  const { fontFamily } = useTheme();
  const blocked = permission === 'blocked';
  const contenido = (
    <View style={styles.contenido}>
      <View style={styles.cabecera}>
        <Pictogram icon="paradasCercanas" size={40} tone="board" />
        <View style={styles.textos}>
          <Text
            variant="headline.md"
            accessibilityRole="header"
            style={{ fontFamily: fontFamily.text[600], fontSize: 17, lineHeight: 22 }}
          >
            {PERMISO_TITLE}
          </Text>
          <Text
            variant="text.md"
            tone="secondary"
            style={{ fontFamily: fontFamily.text[400], fontSize: 15, lineHeight: 20 }}
          >
            {PERMISO_DETAIL}
          </Text>
          {blocked ? (
            <Text variant="text.sm" tone="secondary">
              {PERMISO_BLOCKED_MESSAGE}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.botones}>
        {blocked ? (
          <Button label="Abrir configuración" onPress={onOpenSettings} size="md" />
        ) : (
          <Button label="Activar" onPress={onRequest} size="md" />
        )}
        <Button label="Buscar a mano" variant="secondary" outline onPress={onManual} size="md" />
      </View>
    </View>
  );
  if (inset) {
    return (
      <View testID={testID} style={styles.inset}>
        {contenido}
      </View>
    );
  }
  return <Card testID={testID}>{contenido}</Card>;
}

const styles = StyleSheet.create({
  inset: { padding: 12 },
  contenido: { gap: 12 },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  textos: { flex: 1, minWidth: 0, gap: 4 },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
