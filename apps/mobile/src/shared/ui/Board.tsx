// Placa de tablero (dirección «Señalética de terminal», Fase 5). Lo que no es una decisión viva
// (listas, búsqueda, recorridos, ajustes) va en placas: placa blanca `bg.card` con outline 1 px
// `border.subtle`, radio 6 y sin sombra; filas de ≥ 56 pt separadas por hairline `border.subtle`.
// La flecha `irA` se clava a 12 pt del borde **solo** en las filas que abren algo.
//
// - `Board`: la placa. `label` opcional arriba y afuera (13/600 `text.secondary`, como la
//   etiqueta «Subte ahora» de Inicio). Separadores entre filas, nunca después de la última.
// - `Board.Row`: una fila; con `onPress` es un botón con flecha, sin él no hay flecha. Siempre es un
//   solo elemento accesible con etiqueta compuesta.
// - `Board.Status`: el estado que va a la derecha de una fila («Con demoras» con cuadrado ámbar).
// - `Board.Skeleton`: la silueta para la carga.
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '../icons';
import { useTheme, type ColorScheme } from '../theme';
import { Skeleton, SkeletonGroup } from './Skeleton';
import { Text } from './Text';

/** Medidas de la placa. */
export const BOARD = {
  radius: 6,
  rowMinHeight: 56,
  paddingX: 12,
  gap: 12,
  /**
   * Flecha de 20 a 12 pt del borde. Es un elemento más de la fila (no `absolute`) con
   * `flexShrink: 0`: el contenido, incluido el `trailing`, nunca la tapa (F5-HIGH-C). Reserva
   * total a la derecha: gap 12 + flecha 20 + borde 12 = 44 pt.
   */
  arrowSize: 20,
  arrowInset: 12,
  arrowReserve: 44,
  statusSquare: 10,
} as const;

// ---------------------------------------------------------------- placa

export interface BoardProps {
  children: ReactNode;
  /** Etiqueta arriba y afuera de la placa. Se anuncia como encabezado. */
  label?: string | undefined;
  /**
   * Sangría izquierda del separador (pt). Default 0 (de borde a borde). Sirve para que un trazo
   * dibujado en `leading` (recorrido de una línea) siga continuo entre filas.
   */
  separatorInset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

function BoardRoot({ children, label, separatorInset = 0, style, testID }: BoardProps) {
  const { colors, fontFamily, borderWidth } = useTheme();
  const filas = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.wrapper}>
      {label === undefined ? null : (
        <Text
          variant="text.sm"
          tone="secondary"
          accessibilityRole="header"
          style={{ fontFamily: fontFamily.text[600], fontSize: 13, lineHeight: 16 }}
        >
          {label}
        </Text>
      )}
      <View
        testID={testID}
        style={[
          styles.board,
          {
            backgroundColor: colors.bg.card,
            borderColor: colors.border.subtle,
            borderWidth: borderWidth.hairline,
          },
          style,
        ]}
      >
        {filas.map((fila, i) => (
          <Fragment key={fila.key ?? i}>
            {i === 0 ? null : (
              <View
                testID="board-separador"
                style={{
                  height: StyleSheet.hairlineWidth,
                  marginLeft: separatorInset,
                  backgroundColor: colors.border.subtle,
                }}
              />
            )}
            {fila}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- estado

export type BoardStatusTone = 'ok' | 'warning' | 'danger' | 'muted';

export interface BoardStatusProps {
  text: string;
  tone: BoardStatusTone;
  testID?: string | undefined;
}

/** Colores del estado: cuadrado (solo warning/danger), su borde y el texto. */
export function boardStatusPalette(colors: ColorScheme, tone: BoardStatusTone) {
  const conCuadrado = tone === 'warning' || tone === 'danger';
  return {
    // Relleno del rol con borde `text.primary` de 1 pt: el ámbar solo da 2,66:1 sobre la placa
    // blanca; el borde llega a 16,69:1 (claro) y 13,53:1 (oscuro).
    square: conCuadrado ? colors.role[tone].base : null,
    squareBorder: colors.text.primary,
    text: conCuadrado ? colors.role[tone].text : colors.text.secondary,
  };
}

/** «Estado: Con demoras» (lo que lee el lector si el estado se lee solo). */
export function boardStatusLabel(text: string): string {
  return `Estado: ${text}`;
}

function BoardStatus({ text, tone, testID }: BoardStatusProps) {
  const { colors, fontFamily } = useTheme();
  const palette = boardStatusPalette(colors, tone);
  return (
    <View testID={testID} style={styles.status}>
      {palette.square === null ? null : (
        <View
          testID="board-estado-cuadrado"
          style={{
            width: BOARD.statusSquare,
            height: BOARD.statusSquare,
            borderRadius: 1,
            backgroundColor: palette.square,
            borderWidth: 1,
            borderColor: palette.squareBorder,
          }}
        />
      )}
      <Text
        variant="headline.sm"
        color={palette.text}
        accessibilityLabel={boardStatusLabel(text)}
        style={[
          styles.statusText,
          { fontFamily: fontFamily.text[600], fontSize: 15, lineHeight: 20 },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------- fila

export type BoardNoteTone = 'warning' | 'danger' | 'muted';

export interface BoardRowProps {
  /** A la izquierda: `LineBadge`, `Pictogram tone="board"`, trazo de recorrido… (alto completo). */
  leading?: ReactNode;
  /** 17/600 `text.primary`, hasta 2 líneas. */
  title: string;
  /** 13/16 `text.secondary`. */
  subtitle?: string | undefined;
  /** Tercera línea 13/16 con el color del tono (`role.<tone>.text`) o `text.secondary`. */
  note?: { text: string; tone: BoardNoteTone } | undefined;
  /** Valor a la derecha (`Board.Status`, un tiempo…). */
  trailing?: ReactNode;
  /** Abre algo: la fila es botón y lleva la flecha al borde. Sin `onPress`, no hay flecha. */
  onPress?: (() => void) | undefined;
  /**
   * Flecha al borde. Default `true` cuando hay `onPress`. `false` para filas que seleccionan pero
   * no navegan (por ejemplo, elegir un vehículo en la lista de una línea): siguen siendo botón.
   */
  arrow?: boolean | undefined;
  /** Lo que lee el lector. Default: título, subtítulo y nota. */
  accessibilityLabel?: string | undefined;
  accessibilityHint?: string | undefined;
  disabled?: boolean;
  testID?: string | undefined;
}

function BoardRow({
  leading,
  title,
  subtitle,
  note,
  trailing,
  onPress,
  arrow,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  testID,
}: BoardRowProps) {
  const { colors, fontFamily } = useTheme();
  const tocable = onPress !== undefined;
  // La flecha promete un destino: solo con `onPress` y si no se apagó a propósito.
  const navega = tocable && arrow !== false;
  const label =
    accessibilityLabel ??
    [title, subtitle, note?.text].filter((x) => x !== undefined && x !== '').join(', ');
  const noteColor =
    note === undefined
      ? colors.text.secondary
      : note.tone === 'muted'
        ? colors.text.secondary
        : colors.role[note.tone].text;

  const contenido = (
    <>
      {leading === undefined ? null : <View style={styles.leading}>{leading}</View>}
      <View style={styles.texts}>
        <Text
          variant="headline.md"
          numberOfLines={2}
          style={{ fontFamily: fontFamily.text[600], fontSize: 17, lineHeight: 22 }}
        >
          {title}
        </Text>
        {subtitle === undefined || subtitle === '' ? null : (
          <Text variant="text.sm" tone="secondary" style={styles.small}>
            {subtitle}
          </Text>
        )}
        {note === undefined || note.text === '' ? null : (
          <Text variant="text.sm" color={noteColor} style={styles.small} numberOfLines={2}>
            {note.text}
          </Text>
        )}
      </View>
      {trailing === undefined ? null : <View style={styles.trailing}>{trailing}</View>}
      {navega ? (
        <View
          pointerEvents="none"
          style={styles.arrow}
          testID={testID === undefined ? undefined : `${testID}-flecha`}
        >
          <Icon name="irA" size={BOARD.arrowSize} color={colors.text.secondary} />
        </View>
      ) : null}
    </>
  );

  const base = styles.row;
  if (tocable) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [base, pressed ? { backgroundColor: colors.bg.pressed } : null]}
      >
        {contenido}
      </Pressable>
    );
  }
  return (
    <View testID={testID} accessible accessibilityLabel={label} style={base}>
      {contenido}
    </View>
  );
}

// ---------------------------------------------------------------- skeleton

function BoardSkeleton({
  rows,
  accessibilityLabel,
  testID,
}: {
  rows: number;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { colors, borderWidth } = useTheme();
  return (
    <SkeletonGroup
      testID={testID}
      {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
      style={[
        styles.board,
        {
          gap: 0,
          backgroundColor: colors.bg.card,
          borderColor: colors.border.subtle,
          borderWidth: borderWidth.hairline,
        },
      ]}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, { alignItems: 'center' }]}>
          <Skeleton height={32} circle />
          <View style={styles.skeletonTexts}>
            <Skeleton height={16} width="45%" radius={4} />
            <Skeleton height={12} width="70%" radius={4} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

export const Board = Object.assign(BoardRoot, {
  Row: BoardRow,
  Status: BoardStatus,
  Skeleton: BoardSkeleton,
});

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  board: { borderRadius: BOARD.radius, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: BOARD.rowMinHeight,
    paddingHorizontal: BOARD.paddingX,
    gap: BOARD.gap,
  },
  // El `leading` va de borde a borde en alto (un trazo de recorrido sigue entre filas).
  leading: { justifyContent: 'center' },
  texts: { flex: 1, minWidth: 0, justifyContent: 'center', paddingVertical: 8, gap: 2 },
  small: { fontSize: 13, lineHeight: 16 },
  // Sin pasar de la mitad del lugar que queda (la flecha ya está afuera de ese lugar): con Dynamic
  // Type grande, el texto del `trailing` baja de línea antes que crecer.
  trailing: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '50%',
    paddingVertical: 8,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { flexShrink: 1, textAlign: 'right' },
  arrow: { width: BOARD.arrowSize, flexShrink: 0, justifyContent: 'center' },
  skeletonTexts: { flex: 1, gap: 6 },
});
