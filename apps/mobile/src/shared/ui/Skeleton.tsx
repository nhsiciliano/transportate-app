// Carga (docs/briefs/README.md, "Skeleton"): bloques con la forma real del contenido, nunca un spinner
// centrado. Pulso suave de opacidad; sin animación si la persona activó Reduce Motion.
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { useReduceMotion } from './useReduceMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  /** Default: radio de badge (6). `circle` usa la mitad del alto. */
  radius?: number;
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Duración de cada medio ciclo del pulso. Es un indicador de espera, no una transición de estado. */
const PULSE_MS = 800;

function usePulse(): Animated.Value {
  const [opacity] = useState(() => new Animated.Value(1));
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity, reduce]);
  return opacity;
}

/** Un bloque. Va siempre dentro de un `SkeletonGroup`, que es el que anuncia "Cargando". */
export function Skeleton({ width = '100%', height, radius, circle = false, style }: SkeletonProps) {
  const theme = useTheme();
  const opacity = usePulse();
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        {
          width: circle ? height : width,
          height,
          borderRadius: circle ? height / 2 : (radius ?? theme.component.badge.radius),
          backgroundColor: theme.colors.bg.pressed,
          opacity,
        },
        style,
      ]}
    />
  );
}

export interface SkeletonGroupProps {
  children: ReactNode;
  /** Lo que anuncia el lector de pantalla. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export function SkeletonGroup({
  children,
  accessibilityLabel = 'Cargando…',
  style,
  testID,
}: SkeletonGroupProps) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      style={[{ gap: theme.space[2] }, style]}
    >
      {children}
    </View>
  );
}
