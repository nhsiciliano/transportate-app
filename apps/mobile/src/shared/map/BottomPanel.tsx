// Panel inferior sobre un mapa, con tres alturas (S24 para el detalle de línea, F4-colectivos-mapa-1).
//
// Por qué no la `formSheet` nativa: es una ruta modal. Sirve para un detalle pasajero, pero acá
// el panel tiene que quedar SIEMPRE (colapsado como mínimo) sobre el mapa, sin que un gesto lo
// cierre ni que el "volver" del header choque con el stack. Este panel vive en la pantalla:
// - alturas: colapsado = manija + `header` (se mide), medio = 50 % y expandido = 90 % del alto
//   disponible;
// - se arrastra desde la manija o el encabezado (Gesture Handler v3, `usePanGesture`); el cuerpo
//   scrollea sin pelear con el gesto;
// - la manija también es un botón: "Ver más" / "Ver la lista" / "Ver menos" (lector de pantalla y
//   quien no arrastra);
// - Reducir movimiento: cambia de altura sin animar.
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '../theme';
import { useReduceMotion } from '../ui';

export type PanelIndex = 0 | 1 | 2;

export const PANEL_HANDLE_HEIGHT = 28;
export const PANEL_ANIMATION_MS = 220;
const MEDIUM = 0.5;
const EXPANDED = 0.9;

export const PANEL_LABELS: Record<PanelIndex, string> = {
  0: 'Ver más',
  1: 'Ver la lista completa',
  2: 'Ver menos',
};

/** Alturas de cada nivel para un alto disponible y un encabezado medido. */
export function panelHeights(available: number, headerHeight: number): [number, number, number] {
  const collapsed = Math.min(PANEL_HANDLE_HEIGHT + headerHeight, available * EXPANDED);
  const expanded = Math.max(collapsed, available * EXPANDED);
  const medium = Math.min(expanded, Math.max(collapsed + 48, available * MEDIUM));
  return [collapsed, medium, expanded];
}

/** El nivel más cercano a donde terminó el arrastre, con un poco de inercia. */
export function nearestIndex(
  heights: readonly [number, number, number],
  height: number,
  velocityY: number,
): PanelIndex {
  const projected = height - velocityY * 0.15;
  let best: PanelIndex = 0;
  for (const i of [1, 2] as const) {
    if (Math.abs(heights[i] - projected) < Math.abs(heights[best] - projected)) best = i;
  }
  return best;
}

export interface BottomPanelProps {
  index: PanelIndex;
  onIndexChange: (index: PanelIndex) => void;
  /** Alto disponible (el de la pantalla que contiene mapa y panel). */
  availableHeight: number;
  /** Siempre visible (colapsado): se mide para la altura mínima. */
  header: ReactNode;
  /** Se revela al subir el panel. */
  children?: ReactNode;
  /** Avisa el alto del encabezado medido (para correr los controles del mapa). */
  onHeaderHeight?: (height: number) => void;
  headerHeight: number;
  testID?: string;
}

export function BottomPanel({
  index,
  onIndexChange,
  availableHeight,
  header,
  children,
  onHeaderHeight,
  headerHeight,
  testID = 'bottom-panel',
}: BottomPanelProps) {
  const { colors, space, radius, borderWidth } = useTheme();
  const reduceMotion = useReduceMotion();
  const heights = panelHeights(availableHeight, headerHeight);
  const target = heights[index];
  const height = useSharedValue(target);
  const start = useRef(target);

  useEffect(() => {
    height.set(reduceMotion ? target : withTiming(target, { duration: PANEL_ANIMATION_MS }));
  }, [target, reduceMotion, height]);

  const pan = usePanGesture({
    // Corre en el hilo de JS: solo mueve un valor compartido y al soltar elige el nivel.
    disableReanimated: true,
    activeOffsetY: [-8, 8],
    onActivate: () => {
      start.current = height.get();
    },
    onUpdate: (e) => {
      const next = start.current - e.translationY;
      height.set(Math.min(heights[2], Math.max(heights[0], next)));
    },
    onDeactivate: (e) => {
      const next = nearestIndex(heights, height.get(), e.velocityY);
      if (next === index) {
        height.set(reduceMotion ? target : withTiming(target, { duration: PANEL_ANIMATION_MS }));
      } else {
        onIndexChange(next);
      }
    },
  });

  const animated = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.panel,
        {
          backgroundColor: colors.bg.card,
          borderColor: colors.border.subtle,
          borderTopWidth: borderWidth.hairline,
          borderTopLeftRadius: radius['3xl'],
          borderTopRightRadius: radius['3xl'],
        },
        animated,
      ]}
    >
      <GestureDetector gesture={pan}>
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={PANEL_LABELS[index]}
            accessibilityState={{ expanded: index === 2 }}
            onPress={() => {
              onIndexChange(index === 2 ? 0 : ((index + 1) as PanelIndex));
            }}
            style={styles.handleArea}
            // 28 + 8 + 8 = 44 pt de área táctil.
            hitSlop={{ top: 8, bottom: 8, left: 24, right: 24 }}
            testID={`${testID}-handle`}
          >
            <View style={[styles.handle, { backgroundColor: colors.border.strong }]} />
          </Pressable>
          <View
            style={{ paddingHorizontal: space[3], paddingBottom: space[2] }}
            onLayout={(e) => {
              onHeaderHeight?.(Math.ceil(e.nativeEvent.layout.height));
            }}
          >
            {header}
          </View>
        </View>
      </GestureDetector>
      <ScrollView
        style={styles.body}
        contentContainerStyle={{
          paddingHorizontal: space[3],
          paddingBottom: space[4],
          gap: space[3],
        }}
        scrollEnabled={index > 0}
        testID={`${testID}-body`}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  handleArea: {
    height: PANEL_HANDLE_HEIGHT,
    minHeight: PANEL_HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2 },
  body: { flex: 1 },
});
