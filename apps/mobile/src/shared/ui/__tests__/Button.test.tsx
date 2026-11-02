import { fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '..';
import { dark, light } from '../../theme';
import { renderThemed } from '../__fixtures__/renderThemed';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

describe('Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('se presiona y se anuncia como botón con su label', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Guardar" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Guardar' });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button).toBeEnabled();
  });

  it('deshabilitado: no llama a onPress y expone disabled', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Guardar" disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('cargando: bloquea el toque y se anuncia ocupado', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Reintentar" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Reintentar' });
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('usa accessibilityLabel si se pasa (por ejemplo, botón solo con ícono)', async () => {
    await renderThemed(
      <Button label="★" accessibilityLabel="Guardar en favoritos" onPress={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Guardar en favoritos' })).toBeOnTheScreen();
  });

  it('háptico solo si se pide (guardar favorito → éxito)', async () => {
    await renderThemed(<Button label="Sin háptico" onPress={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sin háptico' }));
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();

    await renderThemed(<Button label="Guardar" haptic="success" onPress={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it('área táctil ≥ 44: un botón sm (32) suma 6 de hitSlop arriba y abajo', async () => {
    await renderThemed(<Button label="Chico" size="sm" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Chico' }).props.hitSlop).toEqual({
      top: 6,
      bottom: 6,
      left: 0,
      right: 0,
    });
  });

  it('toma los colores del tema en claro y en oscuro', async () => {
    await renderThemed(<Button label="Primario" onPress={jest.fn()} />, 'light');
    expect(screen.getByRole('button', { name: 'Primario' })).toHaveStyle({
      backgroundColor: light.role.primary.base,
    });
    await renderThemed(<Button label="Oscuro" onPress={jest.fn()} />, 'dark');
    expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveStyle({
      backgroundColor: dark.role.primary.base,
    });
  });
});
