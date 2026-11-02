// Test de humo: la pantalla de Inicio se renderiza y expone su título como encabezado.
import { render, screen } from '@testing-library/react-native';

import InicioScreen from '@/app/(tabs)/inicio/index';

describe('InicioScreen', () => {
  it('muestra el título "Inicio" como encabezado', async () => {
    await render(<InicioScreen />);
    expect(screen.getByRole('header', { name: 'Inicio' })).toBeOnTheScreen();
  });
});
