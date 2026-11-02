// Vacío (docs/briefs/README.md, "EmptyState"): ícono + una frase que explica por qué + una acción.
// Es para vacío REAL ("no hay alertas"); "sin datos" por error es ErrorState, nunca vacío.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  message: string;
  title?: string;
  icon?: ReactNode;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export function EmptyState({ message, title, icon, action, style, testID }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={[styles.box, { gap: theme.space[3], padding: theme.space[4] }, style]}
    >
      {icon ? <View importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      {title ? (
        <Text variant="headline.lg" style={styles.center}>
          {title}
        </Text>
      ) : null}
      <Text variant="text.md" tone="secondary" style={styles.center}>
        {message}
      </Text>
      {action ? (
        <Button label={action.label} onPress={action.onPress} variant="secondary" size="md" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
