// Piezas de la lista agrupada de Ajustes, Acerca de y Licencias: sección con encabezado, placa de
// filas y fila de ≥ 52 pt. Dirección «Señalética de terminal» con la restricción máxima del modo
// Operate (contrato: `.impeccable/surfaces/src-features-ajustes-ajustesscreen-tsx.md`): solo
// tipografía, paleta y densidad; sin bandas, sin pictogramas en cuadrado, sin movimiento.
//
// No son componentes compartidos: solo las usan estas pantallas (si otra feature las necesita,
// se pasan a `shared/ui`). Todo el color sale de `useTheme()`.
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Card, Text, type TextProps, type TextTone } from '@/shared/ui';

/** Escala de la lista (contrato: título 17/400, detalle 15/20, nota 13/16). */
export const LIST_TYPE = {
  title: { fontSize: 17, lineHeight: 22 },
  detail: { fontSize: 15, lineHeight: 20 },
  note: { fontSize: 13, lineHeight: 16 },
} as const;

/** Alto mínimo de la fila (contrato: 52 pt) y aire horizontal de la placa. */
export const ROW_MIN_HEIGHT = 52;
export const ROW_PADDING_X = 16;
/** Separación entre secciones (la misma que entre bloques de Inicio). */
export const SECTION_GAP = 12;

/** Título de fila: 17/400, caja de oración. */
export function RowTitle({ style, ...rest }: TextProps) {
  return <Text variant="text.md" style={[LIST_TYPE.title, style]} {...rest} />;
}

/** Detalle de fila (estado, versión, descripción): 15/20 `text.secondary`. */
export function RowDetail({ style, ...rest }: TextProps) {
  return <Text variant="text.sm" tone="secondary" style={[LIST_TYPE.detail, style]} {...rest} />;
}

/** Nota de ayuda de fila: 13/16 `text.secondary`. */
export function RowNote({ style, ...rest }: TextProps) {
  return <Text variant="text.xs" tone="secondary" style={[LIST_TYPE.note, style]} {...rest} />;
}

/** Hairline entre filas de una placa (nunca después de la última). */
export function Hairline() {
  const { colors } = useTheme();
  return (
    <View
      testID="fila-separador"
      style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle }}
    />
  );
}

/**
 * Sección: encabezado en 13/600 `text.secondary` (misma forma que la etiqueta «Subte ahora» de
 * Inicio: caja de oración, sin mayúsculas sostenidas) y una placa blanca (`Card` compartida, radio
 * 6, outline `border.subtle`, sin sombra) con las filas adentro.
 */
export function Section({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: string;
}) {
  const { space, fontFamily } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={{ gap: space[2] }}>
      <Text
        variant="text.sm"
        tone="secondary"
        accessibilityRole="header"
        style={{ fontFamily: fontFamily.text[600], fontSize: 13, lineHeight: 16 }}
      >
        {title}
      </Text>
      <Card style={styles.plate}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <Hairline /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
      {footer ? <RowNote>{footer}</RowNote> : null}
    </View>
  );
}

export interface RowProps {
  title: string;
  /** Estado o descripción debajo del título (con letra grande pasa a otro renglón, no se trunca). */
  detail?: string;
  /**
   * Indicador al final, solo en filas que abren algo: `chevron` navega a otra pantalla del app;
   * `externo` sale (configuración del teléfono, navegador).
   */
  trailing?: 'chevron' | 'externo' | undefined;
  titleTone?: TextTone;
  /** Acción destructiva: el título va en `role.danger.text`. */
  destructive?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  role?: 'button' | 'link';
  /** Reemplaza el nombre accesible por defecto ("título, detalle"). */
  accessibilityLabel?: string;
  /** Contenido extra entre el detalle y el borde (indicadores, texto de estado, progreso). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Fila de la placa: ≥ 52 pt, 16 pt de aire a los lados. Con `onPress` es un solo elemento
 * accesible con etiqueta compuesta; presionada pasa a `bg.pressed`.
 */
export function Row({
  title,
  detail,
  trailing,
  titleTone = 'primary',
  destructive = false,
  onPress,
  disabled = false,
  busy = false,
  role = 'button',
  accessibilityLabel,
  children,
  style,
  testID,
}: RowProps) {
  const { space, colors } = useTheme();
  const body = (
    <>
      <View style={styles.text}>
        <RowTitle
          {...(disabled
            ? { tone: 'disabled' as const }
            : destructive
              ? { color: colors.role.danger.text }
              : { tone: titleTone })}
        >
          {title}
        </RowTitle>
        {detail ? <RowDetail tone={disabled ? 'disabled' : 'secondary'}>{detail}</RowDetail> : null}
        {children}
      </View>
      {trailing ? <TrailingIcon kind={trailing} /> : null}
    </>
  );
  const box: ViewStyle = {
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: space[2] + 2,
    paddingHorizontal: ROW_PADDING_X,
    gap: space[3],
  };
  if (!onPress) {
    return (
      <View testID={testID} style={[styles.row, box, style]}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${title}, ${detail}` : title)}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        styles.row,
        box,
        pressed ? { backgroundColor: colors.bg.pressed } : null,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

/** Chevron del sistema (20, navega) o enlace externo (16, sale), siempre en `text.tertiary`. */
function TrailingIcon({ kind }: { kind: 'chevron' | 'externo' }) {
  const { colors } = useTheme();
  return kind === 'chevron' ? (
    <Icon name="chevron" size={20} color={colors.text.tertiary} testID="fila-chevron" />
  ) : (
    <Icon name="enlaceExterno" size={16} color={colors.text.tertiary} testID="fila-externo" />
  );
}

/**
 * Fila con un control propio debajo del título (el `SegmentedControl` compartido de Tema e
 * intervalo): título 17/400, control, nota opcional 13/16. No es tocable: el que se toca es el
 * control, que ya es accesible por su cuenta.
 */
export function ControlRow({
  title,
  note,
  children,
  testID,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  testID?: string;
}) {
  const { space } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        minHeight: ROW_MIN_HEIGHT,
        paddingVertical: space[3] - 4,
        paddingHorizontal: ROW_PADDING_X,
        gap: space[2],
      }}
    >
      <RowTitle>{title}</RowTitle>
      {children}
      {note ? <RowNote>{note}</RowNote> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sin padding propio: las filas llegan hasta el borde de la placa; `overflow` recorta el
  // fondo presionado al radio.
  plate: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
