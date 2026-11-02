import { screen } from '@testing-library/react-native';
import { Showcase } from '../__fixtures__/Showcase';
import { renderThemed } from '../__fixtures__/renderThemed';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

const NOW = Date.parse('2026-11-02T12:00:00Z');

describe('Showcase: todos los componentes renderizan en claro y en oscuro', () => {
  it.each(['light', 'dark'] as const)(
    '%s',
    async (scheme) => {
      await renderThemed(<Showcase now={NOW} />, scheme);
      expect(screen.getByText('Sin conexión. Mostramos lo último guardado.')).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Transportate' })).toBeOnTheScreen();
      expect(screen.getByLabelText('Estado: Con demoras')).toBeOnTheScreen();
      expect(screen.getByLabelText('Línea A')).toBeOnTheScreen();
      expect(screen.getByRole('tab', { name: 'Lista' })).toBeSelected();
      expect(screen.getByRole('progressbar', { name: 'Cargando…' })).toBeOnTheScreen();
      expect(screen.getByText('Actualizado hace 12 s')).toBeOnTheScreen();
      expect(screen.getByText('⚠ Dato de hace 4 min')).toBeOnTheScreen();
      // ErrorState informativo (retryable: false) no tiene botón; el otro sí.
      expect(screen.getAllByRole('button', { name: 'Volver a intentar' })).toHaveLength(1);
      // Renderiza los 15 componentes: en frío (sin caché de Babel y con suites en paralelo) supera
      // los 5 s por defecto de Jest; en caliente tarda ~1 s.
    },
    20_000,
  );
});
