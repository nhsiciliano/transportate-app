// Banda de señal (dirección «Señalética de terminal», piloto en Inicio, Fase 5). Contrato de
// dirección: `apps/mobile/.impeccable/surfaces/src-features-inicio-inicioscreen-tsx.md`.
//
// Una decisión por banda: pictograma en un cuadrado a la izquierda, mensaje, un valor grande
// («4 min») y una flecha clavada al borde derecho. Toda la banda es un solo botón: el lector de
// pantalla la lee de una vez y abre el detalle.
//
// - `lead`: la decisión más cercana. Alto mínimo 148, fondo `role.secondary.base`, valor a 56 pt.
// - `next`: las siguientes. Alto mínimo 72, fondo `role.primary.base`, valor a 24 pt.
// - Radio 6 y sin sombra (Obelisco separa superficies sin sombras, DESIGN.md §3.3).
// - En oscuro los `base` de Obelisco son claros (#67a5cd, #a4d9ff) con `on` oscuro: se usan tal cual.
// - Con Dynamic Type la banda crece en alto: el mensaje puede truncar con elipsis; el valor y el
//   estado nunca (el valor grande se achica para entrar en una línea antes que cortarse).
// - Movimiento firma: si cambia `transitionKey` (otro favorito u otro valor), el contenido cruza
//   en fundido de 200 ms; con «Reducir movimiento», corte seco. El fondo de la banda no se mueve.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type IconName } from '../icons';
import { useTheme, type ColorScheme, type SchemeName } from '../theme';
import { Skeleton } from './Skeleton';
import { Text } from './Text';
import { useReduceMotion } from './useReduceMotion';

export type SignBandVariant = 'lead' | 'next';
export type SignBandStatusTone = 'warning' | 'danger' | 'muted';

export interface SignBandStatus {
  text: string;
  tone: SignBandStatusTone;
}

export interface SignBandProps {
  variant: SignBandVariant;
  /** Pictograma del mapa curado (tipo de favorito). */
  icon: IconName;
  /** «Parada 60 · Cabildo y Juramento». Una línea; trunca con elipsis. */
  message: string;
  /** Rótulo sobre el valor («Próximo»). Opcional. */
  label?: string | undefined;
  /** Valor principal («4 min»). `null` = cargando (skeleton en lugar del valor). */
  value: string | null;
  /**
   * `display`: el valor es un número de la decisión (arribo) y va a escala monumental en `lead`.
   * `text`: el valor es un estado o una frase («Sin información», «2 en servicio») y va más chico
   * para que entre sin cortarse. En `next` las dos escalas coinciden (24 pt). Default `display`.
   */
  valueStyle?: 'display' | 'text';
  /** Estado al lado del valor: cuadrado de color (warning/danger) + texto; `muted` sin cuadrado. */
  status?: SignBandStatus | undefined;
  /** Lo que lee el lector de pantalla. Default: mensaje, rótulo, valor y estado. */
  accessibilityLabel?: string | undefined;
  /** Cuando cambia (y no es el primer render), el contenido cruza en fundido de 200 ms. */
  transitionKey?: string | undefined;
  /**
   * Abre el detalle. Sin `onPress` la banda es una señal fija (por ejemplo, el próximo arribo por
   * sentido en una estación): no es botón y no lleva la flecha al borde, porque la flecha promete
   * un destino.
   */
  onPress?: (() => void) | undefined;
  style?: StyleProp<ViewStyle>;
  testID?: string | undefined;
}

/** Medidas de la banda (contrato de dirección, «FIRST VIEWPORT»). */
export const SIGN_BAND = {
  radius: 6,
  minHeight: { lead: 148, next: 72 },
  /** Lado del cuadrado del pictograma y su radio. */
  pictogram: 40,
  pictogramRadius: 4,
  /** La flecha se clava a 12 pt del borde derecho; el texto deja 44 pt libres para ella. */
  arrowInset: 12,
  textInsetRight: 44,
  statusSquare: 10,
  /** Duración del fundido del contenido (movimiento firma). */
  crossfadeMs: 200,
} as const;

/** Colores de la banda por variante y esquema. Exportado para los tests y el README. */
export function signBandPalette(colors: ColorScheme, scheme: SchemeName, variant: SignBandVariant) {
  const role = variant === 'lead' ? colors.role.secondary : colors.role.primary;
  const light = scheme === 'light';
  return {
    background: role.base,
    pressed: role.hover,
    /** Texto, rótulo, valor y flecha. */
    foreground: role.on,
    /** Cuadrado del pictograma: el más oscuro del esquema en claro, el fondo de la app en oscuro. */
    pictogram: light ? colors.text.primary : colors.bg.base,
    /** Pictograma en el color contrario al cuadrado. */
    pictogramIcon: light ? colors.bg.base : colors.text.primary,
    warning: colors.role.warning.base,
    danger: colors.role.danger.base,
  };
}

type Palette = ReturnType<typeof signBandPalette>;

interface ContentProps {
  variant: SignBandVariant;
  icon: IconName;
  message: string;
  label: string | undefined;
  value: string | null;
  valueStyle: 'display' | 'text';
  status: SignBandStatus | undefined;
}

/** Firma del contenido visible: si no cambia, no hay nada que redibujar ni animar. */
function signature(c: ContentProps): string {
  return JSON.stringify([
    c.variant,
    c.icon,
    c.message,
    c.label,
    c.value,
    c.valueStyle,
    c.status?.text,
    c.status?.tone,
  ]);
}

function defaultLabel({ message, label, value, status }: ContentProps): string {
  const valor = value === null ? 'cargando' : [label, value].filter(Boolean).join(' ');
  return [message, valor, status?.text].filter((x) => x !== undefined && x !== '').join(', ');
}

export function SignBand({
  variant,
  icon,
  message,
  label,
  value,
  valueStyle = 'display',
  status,
  accessibilityLabel,
  transitionKey,
  onPress,
  style,
  testID,
}: SignBandProps) {
  const { colors, scheme } = useTheme();
  const palette = signBandPalette(colors, scheme, variant);
  const reduceMotion = useReduceMotion();
  const content: ContentProps = { variant, icon, message, label, value, valueStyle, status };
  const sig = signature(content);

  // Movimiento firma. Estado derivado durante el render (patrón de React para "ajustar el estado
  // cuando cambia una prop"): al cambiar la clave se guarda el contenido anterior como fantasma
  // que se desvanece mientras el nuevo aparece. Si cambia el contenido sin cambiar la clave
  // (por ejemplo, el estado), solo se actualiza el recuerdo: nada se anima.
  const [shown, setShown] = useState<{
    key: string | undefined;
    sig: string;
    content: ContentProps;
    ghost: ContentProps | null;
    generation: number;
  }>({ key: transitionKey, sig, content, ghost: null, generation: 0 });
  if (shown.key !== transitionKey) {
    setShown({
      key: transitionKey,
      sig,
      content,
      // Del skeleton al primer valor no hay fundido: es la primera señal, no un cambio.
      ghost: reduceMotion || shown.content.value === null ? null : shown.content,
      generation: shown.generation + 1,
    });
  } else if (shown.sig !== sig) {
    setShown({ ...shown, sig, content });
  }

  const progress = useSharedValue(1);
  const ghost = shown.ghost;
  const generation = shown.generation;
  useEffect(() => {
    if (ghost === null) return undefined;
    progress.set(0);
    progress.set(
      withTiming(1, { duration: SIGN_BAND.crossfadeMs, easing: Easing.out(Easing.exp) }),
    );
    const id = setTimeout(() => {
      setShown((s) => (s.generation === generation ? { ...s, ghost: null } : s));
    }, SIGN_BAND.crossfadeMs);
    return () => {
      clearTimeout(id);
    };
  }, [ghost, generation, progress]);
  const incoming = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const outgoing = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));

  const isLead = variant === 'lead';
  const pressable = onPress !== undefined;
  const bandStyle = (pressed: boolean) => [
    styles.band,
    {
      minHeight: SIGN_BAND.minHeight[variant],
      backgroundColor: pressed ? palette.pressed : palette.background,
    },
    style,
  ];
  const Band = pressable ? Pressable : View;
  return (
    <Band
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel ?? defaultLabel(content)}
      {...(pressable
        ? {
            onPress,
            accessibilityRole: 'button' as const,
            style: ({ pressed }) => bandStyle(pressed),
          }
        : { style: bandStyle(false) })}
    >
      <Animated.View style={[styles.layer, ghost === null ? null : incoming]}>
        <BandContent {...content} palette={palette} pressable={pressable} />
      </Animated.View>
      {ghost === null ? null : (
        <Animated.View
          testID={testID === undefined ? undefined : `${testID}-saliente`}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, outgoing]}
        >
          <BandContent {...ghost} palette={palette} pressable={pressable} />
        </Animated.View>
      )}
      {/* Flecha clavada al borde: abajo a la derecha en lead, centrada en next. Solo si abre algo. */}
      {pressable ? (
        <View
          pointerEvents="none"
          style={[styles.arrow, isLead ? styles.arrowLead : styles.arrowNext]}
          testID={testID === undefined ? undefined : `${testID}-flecha`}
        >
          <Icon name="irA" size={isLead ? 24 : 20} color={palette.foreground} />
        </View>
      ) : null}
    </Band>
  );
}

function BandContent({
  variant,
  icon,
  message,
  label,
  value,
  valueStyle,
  status,
  palette,
  pressable,
}: ContentProps & { palette: Palette; pressable: boolean }) {
  const { fontFamily } = useTheme();
  const isLead = variant === 'lead';
  const display = isLead && valueStyle === 'display';
  const fg = palette.foreground;

  const valueNode =
    value === null ? (
      // Skeleton del valor con el color de la banda (no el gris de la app, que no se ve sobre azul).
      <Skeleton
        width={isLead ? 128 : 72}
        height={isLead ? 48 : 24}
        radius={4}
        style={{ backgroundColor: `${fg}33`, marginVertical: isLead ? 4 : 2 }}
      />
    ) : (
      <Text
        variant="headline.lg"
        color={fg}
        maxFontSizeMultiplier={1.2}
        // El valor grande nunca se corta: con Dynamic Type alto se achica para entrar en una línea.
        {...(display
          ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.5 }
          : {})}
        style={
          display
            ? {
                fontFamily: fontFamily.heading[700],
                fontSize: 56,
                lineHeight: 60,
                letterSpacing: -1,
              }
            : isLead
              ? { fontFamily: fontFamily.heading[700], fontSize: 28, lineHeight: 34 }
              : { fontFamily: fontFamily.heading[700], fontSize: 24, lineHeight: 28 }
        }
      >
        {value}
      </Text>
    );

  return (
    <View
      style={[
        styles.content,
        isLead ? styles.contentLead : styles.contentNext,
        pressable ? null : styles.contentStatic,
      ]}
    >
      {/* Contenedor decorativo: la información la lleva el pictograma (16,69:1 contra el cuadrado).
          No es un elemento accesible aparte: la banda entera es el único (F5-inicio-7). */}
      <View
        testID="signband-pictograma"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.pictogram,
          { backgroundColor: palette.pictogram, borderRadius: SIGN_BAND.pictogramRadius },
        ]}
      >
        <Icon name={icon} size={24} color={palette.pictogramIcon} />
      </View>
      <View style={[styles.texts, isLead ? styles.textsLead : null]}>
        <Text
          variant="text.md"
          color={fg}
          numberOfLines={1}
          style={{ fontFamily: fontFamily.text[600], fontSize: 17, lineHeight: 22 }}
        >
          {message}
        </Text>
        <View style={isLead ? styles.valueGroupLead : styles.valueGroupNext}>
          {label !== undefined && label !== '' ? (
            <Text
              variant="text.sm"
              color={fg}
              style={{
                fontFamily: fontFamily.text[400],
                fontSize: 13,
                lineHeight: 16,
                opacity: 0.8,
              }}
            >
              {label}
            </Text>
          ) : null}
          <View style={styles.valueRow}>
            {valueNode}
            {status === undefined ? null : <BandStatus status={status} palette={palette} />}
          </View>
        </View>
      </View>
    </View>
  );
}

function BandStatus({ status, palette }: { status: SignBandStatus; palette: Palette }) {
  const { fontFamily } = useTheme();
  const square =
    status.tone === 'warning' ? palette.warning : status.tone === 'danger' ? palette.danger : null;
  return (
    <View style={styles.status}>
      {square === null ? null : (
        <View
          testID="signband-estado-cuadrado"
          style={{
            width: SIGN_BAND.statusSquare,
            height: SIGN_BAND.statusSquare,
            borderRadius: 1,
            backgroundColor: square,
            // Borde de 1 pt en el color del texto: el cuadrado llega a ≥ 3:1 contra cualquier
            // banda (el ámbar y el rojo solos no lo logran sobre los azules de Obelisco).
            borderWidth: 1,
            borderColor: palette.foreground,
          }}
        />
      )}
      <Text
        variant="text.xs"
        color={palette.foreground}
        style={{ fontFamily: fontFamily.text[400], fontSize: 12, lineHeight: 14, opacity: 0.85 }}
      >
        {status.text}
      </Text>
    </View>
  );
}

/** Silueta de la banda para la carga. Va dentro de un `SkeletonGroup`, que anuncia "Cargando". */
function SignBandSkeleton({ variant, testID }: { variant: SignBandVariant; testID?: string }) {
  return (
    <View testID={testID}>
      <Skeleton height={SIGN_BAND.minHeight[variant]} radius={SIGN_BAND.radius} />
    </View>
  );
}

SignBand.Skeleton = SignBandSkeleton;

const styles = StyleSheet.create({
  band: {
    borderRadius: SIGN_BAND.radius,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  layer: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: 12,
    paddingLeft: 12,
    paddingRight: SIGN_BAND.textInsetRight,
  },
  contentStatic: { paddingRight: 12 },
  contentLead: { alignItems: 'flex-start', paddingTop: 16, paddingBottom: 14 },
  contentNext: { alignItems: 'center', paddingVertical: 12 },
  pictogram: {
    width: SIGN_BAND.pictogram,
    height: SIGN_BAND.pictogram,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0 },
  textsLead: { alignSelf: 'stretch' },
  // En lead, rótulo + valor van abajo (el mensaje arriba): `marginTop: 'auto'` los empuja.
  valueGroupLead: { marginTop: 'auto', paddingTop: 12, gap: 2 },
  valueGroupNext: { marginTop: 2 },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: { position: 'absolute', right: SIGN_BAND.arrowInset },
  arrowLead: { bottom: 14 },
  arrowNext: { top: 0, bottom: 0, justifyContent: 'center' },
});
