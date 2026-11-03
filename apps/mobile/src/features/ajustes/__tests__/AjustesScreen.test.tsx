import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { AjustesScreen } from '@/features/ajustes';
import { MemoryKeyValueStore } from '@/shared/storage/kv';
import { QUERY_CACHE_KEY } from '@/shared/storage/queryPersister';
import { REFRESH_INTERVAL_KEY, THEME_PREFERENCE_KEY } from '@/shared/storage/preferences';

import { jsonResponse } from '../../../../test/api/fixtures';
import { renderWithApp, resetOnline } from '../../../../test/helpers/ajustes';
import { CLEAR_DONE_MESSAGE, FAVORITOS_EMPTY_MESSAGE } from '../AjustesScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const manifest = {
  version: 'abc123',
  generatedAt: '2026-10-12T15:00:00.000Z',
  archivos: {
    'subte-estaciones.json': {
      url: 'abc123/subte-estaciones.json',
      bytes: 5_000_000,
      sha256: 'a'.repeat(64),
    },
  },
};

const subteA = { tipo: 'linea_subte', refId: 'LineaA', nombre: 'Línea A' } as const;
const subteB = { tipo: 'linea_subte', refId: 'LineaB', nombre: 'Línea B' } as const;

const okFetch = () => jsonResponse(manifest);

afterEach(() => {
  resetOnline();
  jest.restoreAllMocks();
  mockPush.mockClear();
});

describe('Ajustes · preferencias', () => {
  it('cambiar el tema lo aplica al instante y lo guarda', async () => {
    const user = userEvent.setup();
    const app = renderWithApp(<AjustesScreen />, { fetch: okFetch });
    await app.render();
    expect(screen.getByTestId('scheme-probe')).toHaveTextContent('light/system');

    await user.press(screen.getByRole('tab', { name: 'Oscuro' }));

    expect(screen.getByTestId('scheme-probe')).toHaveTextContent('dark/dark');
    expect(app.kv.getString(THEME_PREFERENCE_KEY)).toBe('"dark"');
    expect(screen.getByRole('tab', { name: 'Oscuro' })).toBeSelected();
  });

  it('cambiar el intervalo lo guarda y marca la opción', async () => {
    const user = userEvent.setup();
    const app = renderWithApp(<AjustesScreen />, { fetch: okFetch });
    await app.render();
    expect(screen.getByRole('tab', { name: '20 segundos' })).toBeSelected();
    expect(
      screen.getByText(
        'Más seguido usa más datos y batería. Solo se actualiza con la app abierta.',
      ),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: '30 segundos' }));

    expect(app.kv.getString(REFRESH_INTERVAL_KEY)).toBe('30');
    expect(screen.getByRole('tab', { name: '30 segundos' })).toBeSelected();
  });

  it('"Acerca de Transportate" navega a /inicio/acerca', async () => {
    const user = userEvent.setup();
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();
    await user.press(screen.getByRole('button', { name: 'Acerca de Transportate' }));
    expect(mockPush).toHaveBeenCalledWith('/inicio/acerca');
  });
});

describe('Ajustes · favoritos', () => {
  it('con 0 favoritos "Borrar todos" está deshabilitado y lo explica', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();

    expect(screen.getByText(FAVORITOS_EMPTY_MESSAGE)).toBeOnTheScreen();
    const button = screen.getByRole('button', { name: 'Borrar todos los favoritos' });
    expect(button).toBeDisabled();
    await user.press(button);
    expect(alert).not.toHaveBeenCalled();
  });

  it('confirma con el diálogo nativo, borra y "Deshacer" los restaura en orden', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const app = renderWithApp(<AjustesScreen />, {
      fetch: okFetch,
      favoritos: [subteA, subteB],
    });
    await app.render();
    expect(screen.getByText('Tenés 2 favoritos guardados.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Borrar todos los favoritos' }));

    expect(alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alert.mock.calls[0] ?? [];
    expect(title).toBe('¿Borrar todos tus favoritos?');
    expect(buttons?.map((b) => b.text)).toEqual(['Cancelar', 'Borrar']);
    // Todavía no se borró nada: falta confirmar.
    expect(app.favoritosRepo.list()).toHaveLength(2);

    await act(() => {
      buttons?.find((b) => b.text === 'Borrar')?.onPress?.();
    });
    expect(app.favoritosRepo.list()).toHaveLength(0);
    expect(screen.getByText('Borraste tus favoritos.')).toBeOnTheScreen();
    expect(screen.getByText(FAVORITOS_EMPTY_MESSAGE)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Deshacer' }));

    expect(app.favoritosRepo.list().map((f) => f.refId)).toEqual(['LineaA', 'LineaB']);
    expect(screen.getByText('Tenés 2 favoritos guardados.')).toBeOnTheScreen();
  });

  it('"Cancelar" no borra nada', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const app = renderWithApp(<AjustesScreen />, { fetch: okFetch, favoritos: [subteA] });
    await app.render();
    expect(screen.getByText('Tenés 1 favorito guardado.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Borrar todos los favoritos' }));
    const buttons = alert.mock.calls[0]?.[2];
    await act(() => {
      buttons?.find((b) => b.text === 'Cancelar')?.onPress?.();
    });

    expect(app.favoritosRepo.list()).toHaveLength(1);
    expect(screen.queryByText('Borraste tus favoritos.')).toBeNull();
  });
});

describe('Ajustes · limpiar datos guardados', () => {
  it('vacía el QueryClient y la caché persistida, sin tocar favoritos ni ajustes', async () => {
    const user = userEvent.setup();
    const cacheStore = new MemoryKeyValueStore({ [QUERY_CACHE_KEY]: '{"clientState":{}}' });
    const app = renderWithApp(<AjustesScreen queryCacheStore={cacheStore} />, {
      fetch: okFetch,
      favoritos: [subteA],
    });
    await app.render();
    app.queryClient.setQueryData(['demo'], { dato: 1 });
    await act(() => {
      app.kv.set(THEME_PREFERENCE_KEY, '"dark"');
    });

    await user.press(screen.getByRole('button', { name: /Limpiar datos guardados/ }));

    expect(app.queryClient.getQueryData(['demo'])).toBeUndefined();
    expect(cacheStore.getString(QUERY_CACHE_KEY)).toBeUndefined();
    expect(app.favoritosRepo.list()).toHaveLength(1);
    expect(app.kv.getString(THEME_PREFERENCE_KEY)).toBe('"dark"');
    expect(screen.getByText(CLEAR_DONE_MESSAGE)).toBeOnTheScreen();
  });
});

describe('Ajustes · índice de líneas y paradas', () => {
  it('con datos muestra la versión y el peso, y "Buscar actualización" vuelve a consultar', async () => {
    const user = userEvent.setup();
    const app = renderWithApp(<AjustesScreen />, { fetch: okFetch });
    await app.render();

    expect(await screen.findByText('Versión del 12/10/2026 · 4,8 MB')).toBeOnTheScreen();
    const row = screen.getByRole('button', { name: /Índice de líneas y paradas/ });
    expect(row).toBeEnabled();
    expect(screen.getByText('Buscar actualización')).toBeOnTheScreen();
    expect(app.fetchMock).toHaveBeenCalledTimes(1);

    await user.press(row);
    await waitFor(() => {
      expect(app.fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('mientras busca por primera vez muestra el indicador en la fila', async () => {
    // La respuesta queda en manos del test: así se resuelve al final y no queda ningún timer vivo.
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await renderWithApp(<AjustesScreen />, {
      fetch: () => pending,
    }).render();
    expect(screen.getByText('Buscando…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Índice de líneas y paradas/ })).toBeBusy();

    await act(() => {
      release(jsonResponse(manifest));
    });
    expect(await screen.findByText('Versión del 12/10/2026 · 4,8 MB')).toBeOnTheScreen();
  });

  it('con error y sin datos ofrece reintentar', async () => {
    const user = userEvent.setup();
    let fail = true;
    const app = renderWithApp(<AjustesScreen />, {
      fetch: () =>
        fail
          ? jsonResponse({ error: { code: 'internal', message: 'x' } }, { status: 500 })
          : jsonResponse(manifest),
    });
    await app.render();

    expect(
      await screen.findByText('No pudimos actualizar. Tocá para reintentar.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Reintentar')).toBeOnTheScreen();

    fail = false;
    await user.press(screen.getByRole('button', { name: /Índice de líneas y paradas/ }));
    expect(await screen.findByText('Versión del 12/10/2026 · 4,8 MB')).toBeOnTheScreen();
    expect(screen.queryByText('No pudimos actualizar. Tocá para reintentar.')).toBeNull();
  });

  it('con datos y una actualización fallida conserva la versión y avisa el error', async () => {
    const user = userEvent.setup();
    let fail = false;
    const app = renderWithApp(<AjustesScreen />, {
      fetch: () =>
        fail
          ? jsonResponse({ error: { code: 'internal', message: 'x' } }, { status: 500 })
          : jsonResponse(manifest),
    });
    await app.render();
    expect(await screen.findByText('Versión del 12/10/2026 · 4,8 MB')).toBeOnTheScreen();

    fail = true;
    await user.press(screen.getByRole('button', { name: /Índice de líneas y paradas/ }));

    expect(
      await screen.findByText('No pudimos actualizar. Tocá para reintentar.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Versión del 12/10/2026 · 4,8 MB')).toBeOnTheScreen();
  });

  it('sin conexión la acción dice "Necesitás conexión" y queda deshabilitada', async () => {
    const app = renderWithApp(<AjustesScreen />, { fetch: okFetch, online: false });
    await app.render();

    expect(screen.getByText('Necesitás conexión')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Índice de líneas y paradas/ })).toBeDisabled();
    // Sin conexión no se consulta nada.
    expect(app.fetchMock).not.toHaveBeenCalled();
  });
});
