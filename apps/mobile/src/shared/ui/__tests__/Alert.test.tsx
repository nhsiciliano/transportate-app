import { fireEvent, screen } from '@testing-library/react-native';
import { Alert, alertPalette } from '..';
import { dark, light } from '../../theme';
import { renderThemed } from '../__fixtures__/renderThemed';

describe('Alert', () => {
  it.each(['success', 'danger', 'warning', 'info'] as const)(
    'estándar %s: rol alert, fondo container y texto de cuerpo',
    async (role) => {
      await renderThemed(<Alert role={role} message={`Mensaje ${role}`} testID="alert" />);
      const el = screen.getByTestId('alert');
      expect(el.props.accessibilityRole).toBe('alert');
      expect(el.props.accessibilityLiveRegion).toBe('polite');
      expect(el).toHaveStyle({ backgroundColor: light.role[role].container });
      expect(screen.getByText(`Mensaje ${role}`)).toHaveStyle({ color: light.text.primary });
    },
  );

  it('system: relleno sólido; info usa secondary y warning texto primary (§4 Alert)', () => {
    expect(alertPalette(light, 'info', 'system')).toEqual({
      bg: light.role.secondary.base,
      border: light.role.secondary.base,
      fg: light.role.secondary.on,
    });
    expect(alertPalette(light, 'warning', 'system').fg).toBe(light.role.primary.base);
    expect(alertPalette(light, 'danger', 'system').bg).toBe(light.role.danger.base);
  });

  it('borde warning en claro con orange-600 (§7 fix 2); en oscuro el base del rol', () => {
    expect(alertPalette(light, 'warning', 'standard').border).toBe('#a25c00');
    expect(alertPalette(dark, 'warning', 'standard').border).toBe(dark.role.warning.base);
  });

  it('acción opcional y live region assertive para fallas que bloquean', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <Alert
        role="danger"
        variant="system"
        message="Servicio interrumpido."
        live="assertive"
        action={{ label: 'Reintentar', onPress }}
        testID="alert"
      />,
      'dark',
    );
    expect(screen.getByTestId('alert').props.accessibilityLiveRegion).toBe('assertive');
    expect(screen.getByTestId('alert')).toHaveStyle({ backgroundColor: dark.role.danger.base });
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('sin message: solo el título, sin texto vacío debajo', async () => {
    await renderThemed(<Alert role="warning" title="Servicio limitado" testID="alert" />);
    expect(screen.getByText('Servicio limitado')).toBeOnTheScreen();
    expect(screen.getAllByText(/./)).toHaveLength(1);
  });
});
