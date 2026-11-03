// Navegación del stack de Inicio con los layouts y pantallas reales (sin las tabs nativas,
// que necesitan el módulo nativo de react-native-screens): Inicio → Ajustes → Acerca de.
import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

import AcercaScreen from '@/app/(tabs)/inicio/acerca';
import AjustesScreen from '@/app/(tabs)/inicio/ajustes';
import LicenciasScreen from '@/app/(tabs)/inicio/licencias';
import InicioScreen from '@/app/(tabs)/inicio/index';
import InicioLayout from '@/app/(tabs)/inicio/_layout';
import NotFoundScreen from '@/app/+not-found';

import { jsonResponse } from './api/fixtures';
import { renderWithApp, resetOnline } from './helpers/ajustes';

const routes = {
  'inicio/_layout': InicioLayout,
  'inicio/index': InicioScreen,
  'inicio/ajustes': AjustesScreen,
  'inicio/acerca': AcercaScreen,
  'inicio/licencias': LicenciasScreen,
};

// Ajustes pide favoritos, tema, intervalo y el manifiesto: los providers reales, sin red.
const providers = () => renderWithApp(<></>, { fetch: () => jsonResponse({}, { status: 500 }) });

// Monta el Inicio real (estado del subte, favoritos): con la máquina cargada pasa los 5 s.
jest.setTimeout(30_000);

afterEach(resetOnline);

describe('stack de Inicio', () => {
  it('abre Ajustes desde el botón del header, Acerca de desde Ajustes y Licencias desde Acerca de', async () => {
    const user = userEvent.setup();
    await renderRouter(routes, { initialUrl: '/inicio', wrapper: providers().Wrapper });
    expect(screen).toHavePathname('/inicio');

    await user.press(screen.getByRole('button', { name: 'Ajustes' }));
    expect(await screen.findByRole('header', { name: 'Apariencia' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/inicio/ajustes');

    await user.press(screen.getByRole('button', { name: 'Acerca de Transportate' }));
    expect(await screen.findByRole('header', { name: 'Privacidad' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/inicio/acerca');

    await user.press(screen.getByRole('button', { name: 'Licencias de software de terceros' }));
    expect(await screen.findByText(/librerías de código abierto/)).toBeOnTheScreen();
    expect(screen).toHavePathname('/inicio/licencias');
  });

  it('una ruta inexistente cae en "no encontrado"', async () => {
    await renderRouter({ ...routes, '+not-found': NotFoundScreen }, { initialUrl: '/no-existe' });
    expect(screen.getByRole('header', { name: 'No encontramos esta pantalla' })).toBeOnTheScreen();
  });
});
