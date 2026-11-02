// Texto tipado por variante de la escala Obelisco (docs/02-obelisco-tokens.md §2).
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { fontScaleCap, textStyle, useTheme, type ColorScheme, type TextVariant } from '../theme';

export type TextTone = keyof ColorScheme['text'];

export interface TextProps extends RNTextProps {
  /** Variante de la escala (`heading.h1`…`text.xs`). Default `text.md`. */
  variant?: TextVariant;
  /** Color de texto del tema. Default `primary`. Se ignora si viene `color`. */
  tone?: TextTone;
  /** Color explícito (debe salir del tema: `colors.role.danger.on`, `route_text_color`…). */
  color?: string;
}

/**
 * - `allowFontScaling` siempre activo, con tope por variante (títulos 1.6, texto 2; ver tokens.ts).
 * - Los `heading.*` se anuncian como encabezado (`accessibilityRole="header"`).
 */
export function Text({
  variant = 'text.md',
  tone = 'primary',
  color,
  style,
  accessibilityRole,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const role = accessibilityRole ?? (variant.startsWith('heading.') ? 'header' : undefined);
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? fontScaleCap(variant)}
      accessibilityRole={role}
      style={[textStyle(variant), { color: color ?? colors.text[tone] }, style]}
      {...rest}
    />
  );
}
