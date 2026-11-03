// Primer uso: el índice de líneas y paradas se está bajando (brief 02-colectivos §5). Barra
// determinada con los bytes del manifiesto; sin dato de avance todavía, skeleton.
import { View } from 'react-native';

import { useTheme } from '@/shared/theme';
import { Skeleton, SkeletonGroup, Text } from '@/shared/ui';

export function ProgresoIndice({ progress, label }: { progress: number | null; label: string }) {
  const { colors, radius, space } = useTheme();
  const pct = progress === null ? null : Math.round(progress * 100);
  return (
    <View style={{ gap: space[2] }} testID="indice-progreso">
      <Text variant="text.md">{label}</Text>
      {pct === null ? (
        <SkeletonGroup accessibilityLabel={label}>
          <Skeleton height={8} radius={radius.pill} />
        </SkeletonGroup>
      ) : (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: 100, now: pct, text: `${String(pct)} %` }}
          style={{
            height: 8,
            borderRadius: radius.pill,
            backgroundColor: colors.bg.elevated,
            borderWidth: 1,
            borderColor: colors.border.strong,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${String(pct)}%`,
              height: '100%',
              backgroundColor: colors.role.primary.base,
            }}
          />
        </View>
      )}
      {pct === null ? null : <Text variant="text.sm" tone="secondary">{`${String(pct)} %`}</Text>}
    </View>
  );
}
