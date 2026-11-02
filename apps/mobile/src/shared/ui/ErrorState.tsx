// Error sin nada que mostrar (docs/briefs/README.md, "ErrorState"): título llano + causa en lenguaje
// de la persona + "Volver a intentar". Con `retryable: false` es informativo y no hay botón
// ("Esta información no está disponible por ahora."). Nunca culpa a la persona.
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export interface ErrorStateProps {
  title: string;
  cause: string;
  /** Default true. Con false no se muestra el botón (feed inexistente / función no disponible). */
  retryable?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
  /** Mientras se reintenta. */
  retrying?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export function ErrorState({
  title,
  cause,
  retryable = true,
  onRetry,
  retryLabel = 'Volver a intentar',
  retrying = false,
  icon,
  style,
  testID,
}: ErrorStateProps) {
  const theme = useTheme();
  const showRetry = retryable && onRetry !== undefined;
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[styles.box, { gap: theme.space[3], padding: theme.space[4] }, style]}
    >
      {icon ? <View importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      <Text variant="headline.lg" style={styles.center}>
        {title}
      </Text>
      <Text variant="text.md" tone="secondary" style={styles.center}>
        {cause}
      </Text>
      {showRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
          variant="primary"
          size="lg"
          loading={retrying}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
