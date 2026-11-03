import { act, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import {
  Snackbar,
  SnackbarProvider,
  SNACKBAR_ACTION_DURATION_MS,
  SNACKBAR_DURATION_MS,
  SNACKBAR_FADE_MS,
  useSnackbar,
} from '..';
import { createMemoryPreferenceStore, ThemeProvider } from '../../theme';
import { renderThemed } from '../__fixtures__/renderThemed';

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

describe('Snackbar', () => {
  it('muestra el mensaje como alerta con live region polite', async () => {
    await renderThemed(<Snackbar message="Listo" visible onDismiss={jest.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAccessibleName('Listo');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByText('Listo')).toBeOnTheScreen();
  });

  it('sin acción se cierra solo a los 5 s', async () => {
    const onDismiss = jest.fn();
    await renderThemed(<Snackbar message="Listo" visible onDismiss={onDismiss} />);
    await advance(SNACKBAR_DURATION_MS - 1);
    expect(onDismiss).not.toHaveBeenCalled();
    await advance(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('con acción espera 8 s', async () => {
    const onDismiss = jest.fn();
    await renderThemed(
      <Snackbar
        message="Borraste tus favoritos."
        action={{ label: 'Deshacer', onPress: jest.fn() }}
        visible
        onDismiss={onDismiss}
      />,
    );
    await advance(SNACKBAR_DURATION_MS);
    expect(onDismiss).not.toHaveBeenCalled();
    await advance(SNACKBAR_ACTION_DURATION_MS - SNACKBAR_DURATION_MS);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('respeta un `durationMs` propio', async () => {
    const onDismiss = jest.fn();
    await renderThemed(
      <Snackbar message="Listo" durationMs={1000} visible onDismiss={onDismiss} />,
    );
    await advance(1000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('la acción se ejecuta y cierra el aviso', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onPress = jest.fn();
    const onDismiss = jest.fn();
    await renderThemed(
      <Snackbar
        message="Borraste tus favoritos."
        action={{ label: 'Deshacer', onPress }}
        visible
        onDismiss={onDismiss}
      />,
    );
    await user.press(screen.getByRole('button', { name: 'Deshacer' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('sin Reduce Motion sigue montado durante el fundido de salida y después desaparece', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const view = await renderThemed(<Snackbar message="Listo" visible onDismiss={jest.fn()} />);
    await advance(SNACKBAR_FADE_MS);
    expect(screen.getByText('Listo')).toBeOnTheScreen();

    await view.rerender(
      <ThemeProvider store={createMemoryPreferenceStore('light')}>
        <Snackbar message="Listo" visible={false} onDismiss={jest.fn()} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Listo')).toBeOnTheScreen();
    await advance(SNACKBAR_FADE_MS * 2);
    expect(screen.queryByText('Listo')).toBeNull();
  });

  it('oculto no renderiza nada ni cuenta tiempo', async () => {
    const onDismiss = jest.fn();
    await renderThemed(<Snackbar message="Listo" visible={false} onDismiss={onDismiss} />);
    expect(screen.queryByRole('alert')).toBeNull();
    await advance(20_000);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

function Trigger() {
  const snackbar = useSnackbar();
  const [undone, setUndone] = useState(false);
  return (
    <>
      <TriggerButtons
        onShow={() => {
          snackbar.show('Borraste tus favoritos.', {
            action: {
              label: 'Deshacer',
              onPress: () => {
                setUndone(true);
              },
            },
          });
        }}
        onShowPlain={() => {
          snackbar.show('Listo, limpiamos los datos guardados');
        }}
        onHide={() => {
          snackbar.hide();
        }}
        undone={undone}
      />
    </>
  );
}

function TriggerButtons({
  onShow,
  onShowPlain,
  onHide,
  undone,
}: {
  onShow: () => void;
  onShowPlain: () => void;
  onHide: () => void;
  undone: boolean;
}) {
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="mostrar" onPress={onShow} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="mostrar simple"
        onPress={onShowPlain}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="ocultar" onPress={onHide} />
      {undone ? <Text>deshecho</Text> : null}
    </>
  );
}

describe('SnackbarProvider', () => {
  it('lo dispara desde un hijo, ejecuta la acción y se cierra solo', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderThemed(
      <SnackbarProvider>
        <Trigger />
      </SnackbarProvider>,
    );
    expect(screen.queryByRole('alert')).toBeNull();

    await user.press(screen.getByRole('button', { name: 'mostrar' }));
    expect(screen.getByText('Borraste tus favoritos.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByText('deshecho')).toBeOnTheScreen();
    await advance(1);
    expect(screen.queryByText('Borraste tus favoritos.')).toBeNull();

    await user.press(screen.getByRole('button', { name: 'mostrar simple' }));
    expect(screen.getByText('Listo, limpiamos los datos guardados')).toBeOnTheScreen();
    await advance(SNACKBAR_DURATION_MS);
    expect(screen.queryByText('Listo, limpiamos los datos guardados')).toBeNull();
  });

  it('un aviso nuevo reemplaza al anterior y reinicia el conteo', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderThemed(
      <SnackbarProvider>
        <Trigger />
      </SnackbarProvider>,
    );
    await user.press(screen.getByRole('button', { name: 'mostrar simple' }));
    await advance(4000);
    await user.press(screen.getByRole('button', { name: 'mostrar' }));
    expect(screen.queryByText('Listo, limpiamos los datos guardados')).toBeNull();
    // 4 s más tarde el primero ya habría vencido, el segundo (con acción, 8 s) sigue.
    await advance(4000);
    expect(screen.getByText('Borraste tus favoritos.')).toBeOnTheScreen();
  });

  it('`useSnackbar` fuera del provider explica qué falta', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(renderThemed(<Trigger />)).rejects.toThrow('SnackbarProvider');
    error.mockRestore();
  });
});
