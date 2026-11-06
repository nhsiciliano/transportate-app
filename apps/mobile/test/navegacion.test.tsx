// Navegación del stack de Inicio con los layouts y pantallas reales (sin las tabs nativas,
// que necesitan el módulo nativo de react-native-screens): Inicio → Ajustes → Acerca de, e
// Inicio → Favoritos (desde el 2026-11-06 se abre con la estrella del header, no es tab).
import { act, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import AcercaScreen from '@/app/(tabs)/inicio/acerca';
import AjustesScreen from '@/app/(tabs)/inicio/ajustes';
import FavoritosRoute from '@/app/(tabs)/inicio/favoritos';
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
  'inicio/favoritos': FavoritosRoute,
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

  it('el header tiene Favoritos y después Ajustes; la estrella abre Favoritos con Editar', async () => {
    const user = userEvent.setup();
    const app = renderWithApp(<></>, {
      fetch: () => jsonResponse({}, { status: 500 }),
      favoritos: [{ tipo: 'linea_subte', refId: 'A', nombre: 'Línea A' }],
    });
    await renderRouter(routes, { initialUrl: '/inicio', wrapper: app.Wrapper });
    const botones = screen
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel as string | undefined)
      .filter((l) => l === 'Favoritos' || l === 'Ajustes');
    expect(botones).toEqual(['Favoritos', 'Ajustes']);

    await user.press(screen.getByRole('button', { name: 'Favoritos' }));
    expect(screen).toHavePathname('/inicio/favoritos');
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('button', { name: 'Listo' })).toBeOnTheScreen();

    // Volver atrás apaga la edición: la próxima vez Favoritos abre en modo lectura.
    await act(() => {
      router.back();
    });
    expect(screen).toHavePathname('/inicio');
    await user.press(screen.getByRole('button', { name: 'Favoritos' }));
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeOnTheScreen();
  });

  it('una ruta inexistente cae en "no encontrado"', async () => {
    await renderRouter({ ...routes, '+not-found': NotFoundScreen }, { initialUrl: '/no-existe' });
    expect(screen.getByRole('header', { name: 'No encontramos esta pantalla' })).toBeOnTheScreen();
  });
});
