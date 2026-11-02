// Frescura del dato (docs/briefs/README.md, "FreshnessLabel", suposición S6). Se calcula con el
// `sourceTimestamp` del contrato v1 (antigüedad del dato, no de la caché):
// - fresco: edad ≤ 3·R → "Actualizado hace 12 s", color neutro;
// - viejo: 3·R < edad ≤ 10 min → "Dato de hace 4 min", color warning (el contenido se sigue mostrando);
// - muy viejo: > 10 min → igual + aviso "Este dato puede no reflejar la situación actual."
// Se actualiza cada segundo solo mientras está montado; el lector de pantalla lo lee al enfocarlo
// ("Actualizado hace 12 segundos") y no se re-anuncia en cada tick (sin live region).
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export type FreshnessLevel = 'fresh' | 'stale' | 'veryStale' | 'unknown';

/** Muy viejo a partir de 10 min (S6). */
export const VERY_STALE_SECONDS = 10 * 60;

export function freshnessLevel(ageSeconds: number | null, intervalSeconds: number): FreshnessLevel {
  if (ageSeconds === null) return 'unknown';
  if (ageSeconds <= 3 * intervalSeconds) return 'fresh';
  if (ageSeconds <= VERY_STALE_SECONDS) return 'stale';
  return 'veryStale';
}

/** "12 s" / "4 min" / "2 h" / "3 días" y su versión larga para el lector de pantalla. */
export function formatAge(ageSeconds: number): { short: string; spoken: string } {
  const s = Math.max(0, Math.floor(ageSeconds));
  if (s < 60) return { short: `${s} s`, spoken: `${s} ${s === 1 ? 'segundo' : 'segundos'}` };
  const m = Math.floor(s / 60);
  if (m < 60) return { short: `${m} min`, spoken: `${m} ${m === 1 ? 'minuto' : 'minutos'}` };
  const h = Math.floor(m / 60);
  if (h < 48) return { short: `${h} h`, spoken: `${h} ${h === 1 ? 'hora' : 'horas'}` };
  const d = Math.floor(h / 24);
  return { short: `${d} días`, spoken: `${d} días` };
}

export interface FreshnessLabelProps {
  /** ISO 8601 del dato upstream (`meta.sourceTimestamp`), o null si no se conoce. */
  sourceTimestamp: string | null;
  /** Intervalo de refresco R en segundos (default 20, S17). */
  intervalSeconds?: number;
  /** Reloj inyectable (tests). */
  now?: () => number;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

export function FreshnessLabel({
  sourceTimestamp,
  intervalSeconds = 20,
  now = Date.now,
  style,
  testID,
}: FreshnessLabelProps) {
  const { colors, space } = useTheme();
  const [tick, setTick] = useState(() => now());
  // Un solo intervalo mientras está montado; el primer valor sale del inicializador de useState.
  useEffect(() => {
    const id = setInterval(() => {
      setTick(now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [now]);

  const ts = sourceTimestamp ? Date.parse(sourceTimestamp) : Number.NaN;
  const age = Number.isFinite(ts) ? Math.max(0, (tick - ts) / 1000) : null;
  const level = freshnessLevel(age, intervalSeconds);

  if (level === 'unknown' || age === null) {
    return (
      <Text testID={testID} variant="text.sm" tone="tertiary" style={style}>
        Sin dato de actualización
      </Text>
    );
  }
  const { short, spoken } = formatAge(age);
  const fresh = level === 'fresh';
  const label = fresh ? `Actualizado hace ${short}` : `Dato de hace ${short}`;
  const a11y = fresh ? `Actualizado hace ${spoken}` : `Dato de hace ${spoken}`;
  // Texto warning legible: en claro orange-600 (§7 fix 1), en oscuro warning base (9.96:1).
  const warning = colors.role.warning;
  return (
    <View testID={testID} style={[styles.box, { gap: space[1] }, style]}>
      <Text
        variant="text.sm"
        color={fresh ? colors.text.secondary : warning.text}
        accessibilityLabel={a11y}
        accessibilityLiveRegion="none"
      >
        {fresh ? label : `⚠ ${label}`}
      </Text>
      {level === 'veryStale' ? (
        <Text variant="text.sm" color={warning.text}>
          Este dato puede no reflejar la situación actual.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'flex-start' },
});
