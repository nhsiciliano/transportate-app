// Fila de la lista de favoritos (brief `docs/briefs/05-favoritos.md`, §3 y §6).
//
// - Normal: toda la fila es un botón que lleva al detalle del tipo. El lector la lee como una
//   unidad: "Casa. Estación Medrano, línea B.".
// - Edición: el texto abre el alias, hay botones "Cambiar nombre" y "Quitar", y las acciones de
//   accesibilidad "Mover arriba" / "Mover abajo" (alternativa al arrastre).
// - Slots: `liveData` (dato vivo, lo conecta la tarea de datos) y `dragHandle` (4.9-drag).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Button, LineBadge, Text } from '@/shared/ui';

import { accessibleLabel, displayName, lineLabel, secondaryText, TIPO_ICON } from './describe';
import type { FavoritoV1 } from './model';
import { orphanMessage, type SubteBadge } from './subte';

export const MOVE_UP = 'moveUp';
export const MOVE_DOWN = 'moveDown';

export interface FavoritoRowProps {
  favorito: FavoritoV1;
  editing: boolean;
  onOpen: () => void;
  onRename: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Primera/última fila: no ofrece la acción que no se puede hacer. */
  isFirst: boolean;
  isLast: boolean;
  /** Color de la insignia de subte (del estático). Sin él, insignia neutra. */
  subteBadge?: SubteBadge | undefined;
  /** El destino ya no existe en los datos oficiales: la fila avisa y se puede quitar. */
  orphan?: boolean | undefined;
  /** Dato vivo (StatusChip, próximo arribo, "18 en servicio"). Lo conecta la tarea de datos. */
  liveData?: ReactNode;
  /** Lo que el lector agrega al final de la fila ("Hacia Alem en 2 minutos"). */
  liveDataLabel?: string;
  /** Handle de arrastre en edición. Lo agrega high-dev (4.9-drag). */
  dragHandle?: ReactNode;
  testID?: string;
}

function LeadingBadge({
  favorito,
  badge,
}: {
  favorito: FavoritoV1;
  badge: SubteBadge | undefined;
}) {
  // Con el estático cargado, la línea y la estación de subte llevan el color oficial de la línea.
  if (badge) {
    return (
      <LineBadge
        kind="subte"
        label={badge.label}
        color={badge.color}
        textColor={badge.textColor}
        size="md"
        accessibilityLabel={`Línea ${badge.label}`}
      />
    );
  }
  const isLine = favorito.tipo === 'linea_subte' || favorito.tipo === 'linea_colectivo';
  if (!isLine) return <Icon name={TIPO_ICON[favorito.tipo]} size={24} />;
  // Sin el estático (cargando o con error), insignia neutra.
  return <LineBadge kind="colectivo" label={lineLabel(favorito)} size="md" />;
}

export function FavoritoRow({
  favorito,
  editing,
  onOpen,
  onRename,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  subteBadge,
  orphan = false,
  liveData,
  liveDataLabel,
  dragHandle,
  testID,
}: FavoritoRowProps) {
  const { space, colors, component } = useTheme();
  const name = displayName(favorito);
  const secondary = secondaryText(favorito);
  const message = orphan ? orphanMessage(favorito) : undefined;
  const label = accessibleLabel(favorito, message ?? liveDataLabel);
  const minHeight = component.hitSlop + space[3];

  const texts = (
    <>
      <View style={styles.lead} importantForAccessibility="no-hide-descendants">
        <LeadingBadge favorito={favorito} badge={subteBadge} />
      </View>
      <View style={styles.texts}>
        <Text variant="text.md" numberOfLines={1}>
          {name}
        </Text>
        {secondary ? (
          <Text variant="text.sm" tone="secondary" numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
        {message ? (
          <View style={[styles.orphan, { gap: space[1] }]}>
            <Icon name="alerta" size={16} color={colors.role.warning.text} />
            <Text variant="text.sm" color={colors.role.warning.text} style={styles.grow}>
              {message}
            </Text>
          </View>
        ) : null}
      </View>
      {liveData ? <View style={styles.live}>{liveData}</View> : null}
    </>
  );

  // Huérfano fuera de edición: no hay detalle al que ir, así que la fila solo avisa y se quita.
  if (orphan && !editing) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={label}
        style={{
          minHeight,
          backgroundColor: colors.bg.card,
          paddingVertical: space[2],
          paddingHorizontal: space[3],
          gap: space[2],
        }}
      >
        <View style={[styles.row, { gap: space[3] }]}>{texts}</View>
        <View style={[styles.row, styles.buttons, { gap: space[2] }]}>
          <Button
            label="Quitar"
            accessibilityLabel={`Quitar ${name}`}
            variant="danger"
            outline
            size="sm"
            onPress={onRemove}
          />
        </View>
      </View>
    );
  }

  if (!editing) {
    return (
      <Pressable
        testID={testID}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.row,
          {
            minHeight,
            paddingVertical: space[2],
            paddingHorizontal: space[3],
            gap: space[3],
            backgroundColor: pressed ? colors.bg.pressed : colors.bg.card,
          },
        ]}
      >
        {texts}
      </Pressable>
    );
  }

  const actions: { name: string; label: string }[] = [];
  if (!isFirst) actions.push({ name: MOVE_UP, label: 'Mover arriba' });
  if (!isLast) actions.push({ name: MOVE_DOWN, label: 'Mover abajo' });

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: colors.bg.card,
        paddingVertical: space[2],
        paddingHorizontal: space[3],
        gap: space[2],
      }}
    >
      <View style={[styles.row, { gap: space[3] }]}>
        {dragHandle ?? null}
        <Pressable
          onPress={onRename}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Tocá para cambiar el nombre"
          accessibilityActions={actions}
          onAccessibilityAction={(event: AccessibilityActionEvent) => {
            if (event.nativeEvent.actionName === MOVE_UP) onMoveUp();
            else if (event.nativeEvent.actionName === MOVE_DOWN) onMoveDown();
          }}
          style={[styles.row, styles.grow, { gap: space[3], minHeight: component.hitSlop }]}
        >
          {texts}
        </Pressable>
      </View>
      <View style={[styles.row, styles.buttons, { gap: space[2] }]}>
        <Button
          label="Cambiar nombre"
          accessibilityLabel={`Cambiar nombre de ${name}`}
          variant="secondary"
          outline
          size="sm"
          onPress={onRename}
        />
        <Button
          label="Quitar"
          accessibilityLabel={`Quitar ${name}`}
          variant="danger"
          outline
          size="sm"
          onPress={onRemove}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  buttons: { flexWrap: 'wrap' },
  orphan: { flexDirection: 'row', alignItems: 'center' },
  lead: { minWidth: 32, alignItems: 'center' },
  texts: { flex: 1, gap: 2 },
  live: { alignItems: 'flex-end', flexShrink: 0 },
});
