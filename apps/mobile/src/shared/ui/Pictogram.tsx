// Pictograma en cuadrado (dirección «Señalética de terminal», Fase 5). Sale de `SignBand` para
// que las placas de tablero (`Board`) usen la misma pieza.
//
// - `tone: 'band'`: sobre una banda de señal. Cuadrado `text.primary` en claro / `bg.base` en
//   oscuro con el ícono en el color contrario (el de siempre del piloto).
// - `tone: 'board'`: sobre una placa blanca (`bg.card`). Cuadrado `role.primary.base` con ícono
//   `role.primary.on`: 13,07:1 contra la placa en claro y 9,94:1 en oscuro (≥ 3:1, sin borde).
//
// Es decorativo: la información la lleva el texto de la banda o la fila, que es el único
// elemento accesible (F5-inicio-7).
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '../icons';
import { useTheme, type ColorScheme, type SchemeName } from '../theme';

export type PictogramSize = 40 | 32;
export type PictogramTone = 'band' | 'board';

export interface PictogramProps {
  icon: IconName;
  /** Lado del cuadrado. Default 40 (bandas); 32 en filas de placa compactas. */
  size?: PictogramSize;
  tone: PictogramTone;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

/** Radio del cuadrado (contrato: radio 4). */
export const PICTOGRAM_RADIUS = 4;

/** Colores del cuadrado y del ícono por tono y esquema. Exportado para tests y README. */
export function pictogramPalette(colors: ColorScheme, scheme: SchemeName, tone: PictogramTone) {
  if (tone === 'board') {
    return { square: colors.role.primary.base, icon: colors.role.primary.on };
  }
  const light = scheme === 'light';
  return {
    square: light ? colors.text.primary : colors.bg.base,
    icon: light ? colors.bg.base : colors.text.primary,
  };
}

export function Pictogram({ icon, size = 40, tone, style, testID }: PictogramProps) {
  const { colors, scheme } = useTheme();
  const palette = pictogramPalette(colors, scheme, tone);
  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: PICTOGRAM_RADIUS,
          backgroundColor: palette.square,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon name={icon} size={size === 40 ? 24 : 20} color={palette.icon} />
    </View>
  );
}
