// Sheet para ponerle nombre a un favorito (brief §3, S16). `Modal` de React Native con
// `presentationStyle="formSheet"` en iOS (en Android ocupa la pantalla). El campo corta en 30
// caracteres —puntos de código, como el repositorio— mientras se escribe.
import { useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fontScaleCap, textStyle, useTheme } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

import { displayName } from './describe';
import { ALIAS_MAX_LENGTH, type FavoritoV1 } from './model';

export interface AliasSheetProps {
  /** Favorito a renombrar; `null` cierra la sheet. */
  favorito: FavoritoV1 | null;
  /** `null` quita el alias. */
  onSave: (id: string, alias: string | null) => void;
  onCancel: () => void;
}

/** Corta en puntos de código para no partir emojis. */
export function clampAlias(text: string): string {
  return Array.from(text).slice(0, ALIAS_MAX_LENGTH).join('');
}

export function AliasSheet({ favorito, onSave, onCancel }: AliasSheetProps) {
  return (
    <Modal
      visible={favorito !== null}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onCancel}
    >
      {favorito ? (
        <AliasForm key={favorito.id} favorito={favorito} onSave={onSave} onCancel={onCancel} />
      ) : null}
    </Modal>
  );
}

function AliasForm({
  favorito,
  onSave,
  onCancel,
}: {
  favorito: FavoritoV1;
  onSave: AliasSheetProps['onSave'];
  onCancel: () => void;
}) {
  const { colors, space, component } = useTheme();
  const [text, setText] = useState(favorito.alias ?? '');
  const count = Array.from(text).length;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg.base, padding: space[3], gap: space[3] }}
    >
      <Text variant="headline.lg" accessibilityRole="header">
        Cambiar nombre
      </Text>
      <Text variant="text.sm" tone="secondary">
        {favorito.nombre}
      </Text>
      <View style={{ gap: space[1] }}>
        <TextInput
          value={text}
          onChangeText={(next) => {
            setText(clampAlias(next));
          }}
          accessibilityLabel={`Nombre para ${displayName(favorito)}`}
          placeholder={favorito.nombre}
          placeholderTextColor={colors.text.placeholder}
          autoFocus
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            onSave(favorito.id, text.trim() === '' ? null : text);
          }}
          allowFontScaling
          maxFontSizeMultiplier={fontScaleCap('text.md')}
          style={[
            textStyle('text.md'),
            styles.input,
            {
              color: colors.text.primary,
              borderColor: colors.border.strong,
              borderRadius: component.input.radius,
              minHeight: component.input.height,
              paddingHorizontal: component.input.paddingX,
            },
          ]}
        />
        <Text
          variant="text.xs"
          tone="secondary"
          style={styles.counter}
          accessibilityLabel={`${String(count)} de ${String(ALIAS_MAX_LENGTH)} caracteres`}
        >
          {`${String(count)}/${String(ALIAS_MAX_LENGTH)}`}
        </Text>
      </View>
      <View style={[styles.buttons, { gap: space[2] }]}>
        <Button label="Cancelar" variant="tertiary" onPress={onCancel} />
        <Button
          label="Guardar"
          onPress={() => {
            onSave(favorito.id, text.trim() === '' ? null : text);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 2 },
  counter: { textAlign: 'right' },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end' },
});
