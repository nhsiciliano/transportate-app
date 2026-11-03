// Layout raíz: el splash se oculta cuando las fuentes terminan de cargar, y también si fallan
// (en Jest fallan: ver fonts.test.tsx), para no dejar la app colgada en el splash. Sin conexión,
// el OfflineBanner global aparece una vez arriba del Stack.
import { onlineManager } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { hideAsync } from 'expo-splash-screen';

import InicioScreen from '@/app/(tabs)/inicio/index';
import RootLayout from '@/app/_layout';
import { OFFLINE_MESSAGE } from '@/shared/ui';

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

describe('OfflineBanner global', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('aparece una sola vez arriba del Stack cuando no hay conexión y se va al volver', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderRouter(
      { _layout: RootLayout, 'inicio/index': InicioScreen },
      { initialUrl: '/inicio' },
    );
    await screen.findByRole('header', { name: 'Inicio' });
    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();

    await act(() => {
      onlineManager.setOnline(false);
    });
    expect(screen.getAllByText(OFFLINE_MESSAGE)).toHaveLength(1);
    expect(screen.getByRole('header', { name: 'Inicio' })).toBeOnTheScreen();

    await act(() => {
      onlineManager.setOnline(true);
    });
    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
    warn.mockRestore();
  });
});
