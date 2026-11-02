import { View } from 'react-native';

import { useTheme } from '../theme';
import { iconMap, type IconName } from './map';

/** Tamaños permitidos en px (`docs/08-design-system.md`; `docs/02-obelisco-tokens.md` §4). */
export type IconSize = 16 | 20 | 24 | 32;

interface IconBaseProps {
  /** Nombre de uso del mapa curado (`map.ts`). */
  name: IconName;
  /** Lado en px. Default: 24. El área táctil de un botón-ícono la pone el botón, no el ícono. */
  size?: IconSize;
  /** Color de relleno. Default: `colors.text.primary` del tema (claro u oscuro). Nunca hardcodear en pantallas. */
  color?: string;
  /** Para pruebas: va en el `View` contenedor. */
  testID?: string;
}

/** Ícono decorativo (default): hay un texto al lado que dice lo mismo. Se oculta a VoiceOver/TalkBack. */
interface DecorativeIconProps extends IconBaseProps {
  decorative?: true;
  accessibilityLabel?: undefined;
}

/** Ícono con significado propio: la etiqueta es obligatoria (voseo, en castellano). */
interface LabeledIconProps extends IconBaseProps {
  decorative?: false;
  accessibilityLabel: string;
}

export type IconProps = DecorativeIconProps | LabeledIconProps;

/**
 * Ícono Material Symbols Rounded (FILL 1) dibujado con `react-native-svg`.
 *
 * - Decorativo por default. Si pasás `accessibilityLabel` deja de serlo (rol `image` con esa
 *   etiqueta); el estado nunca depende solo del color (`DESIGN.md` §6).
 * - `size` y `color` van directo al `Svg`: `width`/`height` = `size` y `fill` = `color`.
 */
export function Icon({
  name,
  size = 24,
  color,
  accessibilityLabel,
  decorative,
  testID,
}: IconProps) {
  const { colors } = useTheme();
  const Glyph = iconMap[name];
  const hidden = decorative ?? accessibilityLabel === undefined;

  return (
    <View
      style={{ width: size, height: size }}
      {...(testID === undefined ? {} : { testID })}
      {...(hidden
        ? {
            accessible: false,
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants' as const,
          }
        : {
            accessible: true,
            accessibilityRole: 'image' as const,
            ...(accessibilityLabel === undefined ? {} : { accessibilityLabel }),
          })}
    >
      <Glyph width={size} height={size} fill={color ?? colors.text.primary} />
    </View>
  );
}
