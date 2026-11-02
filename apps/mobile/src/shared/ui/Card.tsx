// Card Obelisco (docs/02-obelisco-tokens.md §4 Card): sin sombra, outline de 2 px slate-100.
// Radio: 32 en web; en nativo 16 (DESIGN.md §4.2; component.card.radius). Outline decorativo border.subtle.
import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, type Theme } from '../theme';

export interface CardProps {
  children: ReactNode;
  /** Si se pasa, la tarjeta entera es tocable (y necesita `accessibilityLabel`). */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

function cardStyle(theme: Theme, pressed: boolean): ViewStyle {
  const t = theme.component.card;
  return {
    backgroundColor: pressed ? theme.colors.bg.pressed : theme.colors.bg.card,
    borderColor: theme.colors.border.subtle,
    borderWidth: t.outlineWidth,
    borderRadius: t.radius,
    padding: t.padding,
    gap: theme.space[1],
  };
}

export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: CardProps) {
  const theme = useTheme();
  if (!onPress) {
    return (
      <View testID={testID} style={[cardStyle(theme, false), style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [cardStyle(theme, pressed), style]}
    >
      {children}
    </Pressable>
  );
}
