// Navegación del stack de Inicio con los layouts y pantallas reales (sin las tabs nativas,
// que necesitan el módulo nativo de react-native-screens): Inicio → Ajustes → Acerca de.
import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

import AcercaScreen from '@/app/(tabs)/inicio/acerca';
import AjustesScreen from '@/app/(tabs)/inicio/ajustes';
import InicioScreen from '@/app/(tabs)/inicio/index';
import InicioLayout from '@/app/(tabs)/inicio/_layout';
import NotFoundScreen from '@/app/+not-found';

const routes = {
  'inicio/_layout': InicioLayout,
  'inicio/index': InicioScreen,
  'inicio/ajustes': AjustesScreen,
  'inicio/acerca': AcercaScreen,
};

describe('stack de Inicio', () => {
  it('abre Ajustes desde el botón del header y Acerca de desde Ajustes', async () => {
    const user = userEvent.setup();
    await renderRouter(routes, { initialUrl: '/inicio' });
    expect(screen).toHavePathname('/inicio');

    await user.press(screen.getByRole('button', { name: 'Ajustes' }));
    expect(await screen.findByRole('header', { name: 'Ajustes' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/inicio/ajustes');

    await user.press(screen.getByRole('link', { name: 'Acerca de Transportate' }));
    expect(await screen.findByRole('header', { name: 'Acerca de' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/inicio/acerca');
  });

  it('una ruta inexistente cae en "no encontrado"', async () => {
    await renderRouter({ ...routes, '+not-found': NotFoundScreen }, { initialUrl: '/no-existe' });
    expect(screen.getByRole('header', { name: 'No encontramos esta pantalla' })).toBeOnTheScreen();
  });
});
