// Un favorito como banda de señal `next` (dirección «Señalética de terminal», Fase 5; contrato en
// `.impeccable/surfaces/src-features-favoritos-favoritosscreen-tsx.md`). Mismo contenido que en
// Inicio (`modeloBanda`): todas las bandas al mismo rango, en el orden que fijó la persona.
//
// - Lectura: toda la banda es un botón que abre el detalle del tipo (flecha al borde). El lector la
//   lee como una unidad: "Casa. Estación Medrano, Línea B, Hacia Leandro N. Alem en 4 minutos".
// - Edición: la banda conserva su forma. A la izquierda entra la manija «Reordenar» (la pasa la
//   pantalla: es la del arrastre), la flecha se reemplaza por «Quitar» y tocar el texto abre el
//   alias (ícono `editar` junto al mensaje). Acciones del lector «Mover arriba» / «Mover abajo».
// - Huérfano: sin destino, así que no navega ni lleva flecha; cuadrado rojo «Ya no figura» y
//   «Quitar» siempre visible.
// - Al entrar y salir de la edición el contenido cruza en fundido (corte seco con Reducir
//   movimiento): `transitionKey` incluye el modo.
import type { EstadoServicioV1 } from '@transportate/contracts';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type AccessibilityActionEvent } from 'react-native';

import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { SignBand, signBandPalette } from '@/shared/ui';

import { modeloBanda } from './banda';
import { displayName } from './describe';
import type { FavoritoV1 } from './model';
import type { FavoritoLiveDataResult } from './useFavoritoLiveData';

export const MOVE_UP = 'moveUp';
export const MOVE_DOWN = 'moveDown';
/** Valor de la banda de un huérfano; el estado rojo dice «Ya no figura». */
export const HUERFANO_VALOR = 'Sin datos oficiales';
export const HUERFANO_ESTADO = 'Ya no figura';
export const RENAME_HINT = 'Cambiar nombre';

export interface FavoritoRowProps {
  favorito: FavoritoV1;
  /** Dato vivo del favorito (`useFavoritoLiveData`). */
  live: FavoritoLiveDataResult;
  /** Solo estaciones de subte: estado de su línea (cuadrado ámbar o rojo). */
  estadoLinea?: EstadoServicioV1 | undefined;
  editing: boolean;
  onOpen: () => void;
  onRename: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Primera/última fila: no ofrece la acción que no se puede hacer. */
  isFirst: boolean;
  isLast: boolean;
  /** Manija de arrastre en edición (la de `react-native-reorderable-list`). */
  dragHandle?: ReactNode;
  testID?: string;
}

/** Botón «Quitar» de 44×44 en el color de la banda. */
function QuitarButton({ name, onPress }: { name: string; onPress: () => void }) {
  const { colors, scheme, component } = useTheme();
  const fg = signBandPalette(colors, scheme, 'next').foreground;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Quitar ${name}`}
      hitSlop={4}
      style={({ pressed }) => [
        styles.boton,
        { width: component.hitSlop, height: component.hitSlop },
        pressed ? { opacity: 0.6 } : null,
      ]}
      testID="favorito-quitar"
    >
      <Icon name="borrar" size={24} color={fg} />
    </Pressable>
  );
}

export function FavoritoRow({
  favorito,
  live,
  estadoLinea,
  editing,
  onOpen,
  onRename,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  dragHandle,
  testID,
}: FavoritoRowProps) {
  const name = displayName(favorito);
  const orphan = live.status === 'orphan';
  const modelo = modeloBanda(favorito, live, {
    lider: false,
    estadoLinea,
    testID: testID ?? `favorito-${favorito.id}`,
  });
  const contenido = orphan
    ? {
        ...modelo,
        value: HUERFANO_VALOR,
        valueStyle: 'text' as const,
        status: { tone: 'danger' as const, text: HUERFANO_ESTADO },
      }
    : modelo;
  const quitar = <QuitarButton name={name} onPress={onRemove} />;
  const transitionKey = editing ? 'edicion' : 'lectura';

  if (!editing) {
    return orphan ? (
      // Sin destino: no navega ni lleva flecha; «Quitar» siempre a mano.
      <SignBand {...contenido} variant="next" trailing={quitar} transitionKey={transitionKey} />
    ) : (
      <SignBand {...contenido} variant="next" onPress={onOpen} transitionKey={transitionKey} />
    );
  }

  const actions: { name: string; label: string }[] = [];
  if (!isFirst) actions.push({ name: MOVE_UP, label: 'Mover arriba' });
  if (!isLast) actions.push({ name: MOVE_DOWN, label: 'Mover abajo' });

  return (
    <SignBand
      {...contenido}
      variant="next"
      transitionKey={transitionKey}
      leading={dragHandle}
      trailing={quitar}
      onPressContent={onRename}
      contentAccessibilityHint={RENAME_HINT}
      contentAccessibilityActions={actions}
      onContentAccessibilityAction={(event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName === MOVE_UP) onMoveUp();
        else if (event.nativeEvent.actionName === MOVE_DOWN) onMoveDown();
      }}
      messageIcon="editar"
    />
  );
}

const styles = StyleSheet.create({
  boton: { alignItems: 'center', justifyContent: 'center' },
});
