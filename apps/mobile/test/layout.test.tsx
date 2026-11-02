// Layout raíz: el splash se oculta cuando las fuentes terminan de cargar, y también si fallan
// (en Jest fallan: ver fonts.test.tsx), para no dejar la app colgada en el splash.
import { renderRouter, screen } from 'expo-router/testing-library';
import { hideAsync } from 'expo-splash-screen';

import InicioScreen from '@/app/(tabs)/inicio/index';
import RootLayout from '@/app/_layout';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

describe('layout raíz', () => {
  it('con error de fuentes oculta el splash y muestra la app con la fuente del sistema', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderRouter(
      { _layout: RootLayout, 'inicio/index': InicioScreen },
      { initialUrl: '/inicio' },
    );
    expect(await screen.findByRole('header', { name: 'Inicio' })).toBeOnTheScreen();
    expect(hideAsync).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[fonts]'), expect.any(Error));
    warn.mockRestore();
  });
});
