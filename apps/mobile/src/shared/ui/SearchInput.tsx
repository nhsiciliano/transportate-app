// Búsqueda Obelisco (docs/02-obelisco-tokens.md §4 Input / búsqueda): pill de 48, outline 2 px del
// color de cuerpo, lupa a 16 del borde y botón para limpiar.
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { fontScaleCap, textStyle, useTheme } from '../theme';
import { Text } from './Text';

export interface SearchInputProps extends Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'style' | 'placeholderTextColor'
> {
  value: string;
  onChangeText: (text: string) => void;
  /** Se llama además de `onChangeText('')` al tocar "limpiar". */
  onClear?: () => void;
  /** Nombre accesible del campo (también se usa como placeholder si no hay otro). */
  label: string;
  placeholder?: string;
  /** Slot de la lupa (Icon, tarea 3.5). */
  icon?: ReactNode;
  /** Slot del ícono de limpiar; si no viene, se usa "×". */
  clearIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export function SearchInput({
  value,
  onChangeText,
  onClear,
  label,
  placeholder,
  icon,
  clearIcon,
  style,
  testID,
  ...inputProps
}: SearchInputProps) {
  const theme = useTheme();
  const { colors } = theme;
  const t = theme.component.input;
  const [focused, setFocused] = useState(false);
  const hasText = value.length > 0;
  // Con foco: anillo de foco Obelisco (§1.4) en vez del outline de cuerpo.
  const outline = focused ? colors.focusRing.color : colors.border.strong;
  return (
    <View
      testID={testID}
      style={[
        styles.box,
        {
          minHeight: t.height,
          borderRadius: t.radius,
          borderWidth: t.outlineWidth,
          borderColor: outline,
          backgroundColor: colors.bg.base,
          paddingLeft: icon ? t.iconInset : t.paddingX,
          paddingRight: hasText ? 0 : t.paddingX,
          gap: theme.space[2],
        },
        style,
      ]}
    >
      {icon ? (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {icon}
        </View>
      ) : null}
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.text.placeholder}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
        allowFontScaling
        maxFontSizeMultiplier={fontScaleCap('text.md')}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        style={[textStyle('text.md'), styles.input, { color: colors.text.primary }]}
      />
      {hasText ? (
        <Pressable
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
          // Ocupa el alto del campo (48) y 44 de ancho: área táctil completa.
          style={[
            styles.clear,
            { width: theme.component.hitSlop, minHeight: t.height - 2 * t.outlineWidth },
          ]}
        >
          {clearIcon ?? (
            <Text
              variant="headline.lg"
              tone="secondary"
              maxFontSizeMultiplier={theme.component.badgeFontScale}
            >
              ×
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingVertical: 0 },
  clear: { alignItems: 'center', justifyContent: 'center' },
});
