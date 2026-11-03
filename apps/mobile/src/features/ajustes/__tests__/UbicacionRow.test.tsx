import { screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { AjustesScreen } from '@/features/ajustes';

import { jsonResponse } from '../../../../test/api/fixtures';
import { renderWithApp, resetOnline } from '../../../../test/helpers/ajustes';
import { locationMock } from '../../../../test/mocks/expo-location';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const okFetch = () =>
  jsonResponse({ version: 'v', generatedAt: '2026-10-12T15:00:00.000Z', archivos: {} });

afterEach(() => {
  resetOnline();
  jest.restoreAllMocks();
});

const row = () => screen.getByRole('button', { name: /^Ubicación/ });

describe('Ajustes · fila Ubicación', () => {
  it('permitida: "Permitida mientras usás la app" y abre la configuración al tocar', async () => {
    locationMock.setPermission('granted');
    const open = jest.spyOn(Linking, 'openSettings').mockClear().mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();

    expect(await screen.findByText('Permitida mientras usás la app')).toBeOnTheScreen();
    expect(screen.queryByText('Podés buscar paradas a mano')).toBeNull();
    await user.press(row());
    expect(open).toHaveBeenCalledTimes(1);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('bloqueada: "No permitida", propone buscar a mano y abre la configuración', async () => {
    locationMock.setPermission('denied', { canAskAgain: false });
    const open = jest.spyOn(Linking, 'openSettings').mockClear().mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();

    expect(await screen.findByText('No permitida')).toBeOnTheScreen();
    expect(screen.getByText('Podés buscar paradas a mano')).toBeOnTheScreen();
    await user.press(row());
    expect(open).toHaveBeenCalledTimes(1);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('sin preguntar: no abre el diálogo al montar y, al tocar, pide el permiso', async () => {
    const user = userEvent.setup();
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();

    expect(await screen.findByText('Todavía no la pediste')).toBeOnTheScreen();
    expect(screen.getByText('Te la pedimos cuando busques paradas cerca tuyo')).toBeOnTheScreen();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    await user.press(row());
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Permitida mientras usás la app')).toBeOnTheScreen();
  });

  it('si la persona rechaza el diálogo la fila pasa a "No permitida"', async () => {
    locationMock.setRequestAnswer('denied');
    const user = userEvent.setup();
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();
    await screen.findByText('Todavía no la pediste');

    await user.press(row());
    await waitFor(() => {
      expect(screen.getByText('No permitida')).toBeOnTheScreen();
    });
  });

  it('negada pero preguntable (Android): vuelve a pedir el permiso', async () => {
    locationMock.setPermission('denied', { canAskAgain: true });
    const user = userEvent.setup();
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();
    await screen.findByText('No permitida');

    await user.press(row());
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
