// Snackbar: aviso breve abajo, con una acción opcional ("Deshacer"). Patrón "toast con acción" de
// `docs/briefs/06-ajustes.md`. Superficie inversa: no hay un token propio, así que el fondo es
// `colors.text.primary` y el texto `colors.text.inverse` (en claro: casi negro con texto blanco; en
// oscuro: blanco con texto azul oscuro). Contraste ≥ 4.5:1 en los dos esquemas por construcción.
//
// - `Snackbar` es presentacional: se ubica con `position: absolute` abajo del contenedor padre
//   (que tiene que ocupar la pantalla) y respeta el safe area. La tab bar nativa queda fuera del
//   contenedor de la pantalla, así que el aviso siempre queda por encima de ella.
// - `SnackbarProvider` + `useSnackbar()` lo dispara desde cualquier pantalla hija sin repetir
//   estado. Un aviso nuevo reemplaza al anterior y reinicia el temporizador.
// - Accesibilidad: `alert` + live region `polite`. La acción mide ≥ 44 pt de alto.
// - Movimiento: crossfade de 200 ms; sin animación con Reduce Motion (`useReduceMotion`).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { Text } from './Text';
import { useReduceMotion } from './useReduceMotion';

/** Duración por defecto de un aviso sin acción. */
export const SNACKBAR_DURATION_MS = 5000;
/** Con acción se da más tiempo para leerla y tocarla. */
export const SNACKBAR_ACTION_DURATION_MS = 8000;
/** Crossfade de entrada y salida (dentro del rango de 150–250 ms de DESIGN.md). */
export const SNACKBAR_FADE_MS = 200;

export interface SnackbarAction {
  label: string;
  onPress: () => void;
}

export interface SnackbarProps {
  message: string;
  action?: SnackbarAction | undefined;
  /** Default: 5000 ms, u 8000 ms si hay acción. */
  durationMs?: number | undefined;
  visible: boolean;
  /** Se llama al vencer el tiempo y después de tocar la acción. */
  onDismiss: () => void;
  testID?: string | undefined;
}

export function Snackbar({
  message,
  action,
  durationMs,
  visible,
  onDismiss,
  testID,
}: SnackbarProps) {
  const theme = useTheme();
  const { colors, space } = theme;
  const insets = useContext(SafeAreaInsetsContext);
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  // Sigue montado mientras dura el fundido de salida.
  const [rendered, setRendered] = useState(visible);
  if (visible && !rendered) setRendered(true);

  const timeout = durationMs ?? (action ? SNACKBAR_ACTION_DURATION_MS : SNACKBAR_DURATION_MS);

  // Cierre automático. Cambiar el mensaje o la acción reinicia el conteo.
  useEffect(() => {
    if (!visible) return undefined;
    const id = setTimeout(onDismiss, timeout);
    return () => {
      clearTimeout(id);
    };
  }, [visible, message, action, timeout, onDismiss]);

  // Entrada y salida.
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(visible ? 1 : 0);
      return undefined;
    }
    const animation = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: SNACKBAR_FADE_MS,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setRendered(false);
    });
    return () => {
      animation.stop();
    };
  }, [visible, reduceMotion, opacity]);

  // Con Reduce Motion no hay fundido de salida: desaparece de una. `rendered` solo importa
  // mientras dura la animación.
  if (!visible && (reduceMotion || !rendered)) return null;

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.host,
        { left: space[3], right: space[3], bottom: (insets?.bottom ?? 0) + space[3] },
      ]}
    >
      <Animated.View
        testID={testID}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={action ? `${message}. ${action.label}` : message}
        style={[
          styles.bar,
          {
            opacity,
            backgroundColor: colors.text.primary,
            borderRadius: theme.component.card.radius,
            paddingLeft: space[3],
            paddingRight: action ? space[2] : space[3],
            minHeight: theme.component.hitSlop,
            gap: space[2],
          },
        ]}
      >
        <Text variant="text.sm" color={colors.text.inverse} style={styles.message}>
          {message}
        </Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => {
              action.onPress();
              onDismiss();
            }}
            style={({ pressed }) => [
              styles.action,
              {
                minHeight: theme.component.hitSlop,
                paddingHorizontal: space[2],
                borderRadius: theme.component.button.radius,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text
              variant="headline.sm"
              color={colors.text.inverse}
              style={[styles.actionLabel, { fontFamily: theme.fontFamily.heading[700] }]}
            >
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- contexto

export interface ShowSnackbarOptions {
  action?: SnackbarAction;
  durationMs?: number;
}

export interface SnackbarController {
  show(message: string, options?: ShowSnackbarOptions): void;
  hide(): void;
}

interface SnackbarState {
  /** Cambia con cada `show`: aunque el mensaje se repita, el aviso se reinicia. */
  id: number;
  message: string;
  options: ShowSnackbarOptions;
}

const SnackbarContext = createContext<SnackbarController | null>(null);

/**
 * Monta el aviso sobre el contenido. Poné el provider en un contenedor que ocupe toda la
 * pantalla (el `View` que genera ya lo hace: `flex: 1`).
 */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SnackbarState | null>(null);
  const [visible, setVisible] = useState(false);

  const show = useCallback((message: string, options: ShowSnackbarOptions = {}) => {
    setState((prev) => ({ id: (prev?.id ?? 0) + 1, message, options }));
    setVisible(true);
  }, []);
  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const controller = useMemo<SnackbarController>(() => ({ show, hide }), [show, hide]);

  return (
    <SnackbarContext.Provider value={controller}>
      <View style={styles.provider}>
        {children}
        {state ? (
          <Snackbar
            key={state.id}
            message={state.message}
            action={state.options.action}
            durationMs={state.options.durationMs}
            visible={visible}
            onDismiss={hide}
          />
        ) : null}
      </View>
    </SnackbarContext.Provider>
  );
}

/** Dispara avisos desde cualquier pantalla dentro de un `SnackbarProvider`. */
export function useSnackbar(): SnackbarController {
  const controller = useContext(SnackbarContext);
  if (!controller) throw new Error('useSnackbar necesita un <SnackbarProvider> más arriba.');
  return controller;
}

const styles = StyleSheet.create({
  provider: { flex: 1 },
  host: { position: 'absolute' },
  bar: { flexDirection: 'row', alignItems: 'center' },
  message: { flex: 1, paddingVertical: 8 },
  action: { alignItems: 'center', justifyContent: 'center' },
  actionLabel: { textDecorationLine: 'underline' },
});
