// Pantalla Favoritos con el dato vivo conectado: ok, carga, error, solo filas visibles,
// FreshnessLabel global (la más vieja) y pull to refresh.
import { act, render, screen, waitFor } from '@testing-library/react-native';

import { EditModeProvider, FavoritosScreen, type NuevoFavorito } from '@/features/favoritos';

import {
  arribos,
  createHarness,
  defaultRoutes,
  errorBody,
  estado,
  isoAgo,
  jsonResponse,
  posiciones,
  type Routes,
} from '../../../../test/subtes/fixtures';

jest.setTimeout(30_000);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const lineaB: NuevoFavorito = { tipo: 'linea_subte', refId: 'B', nombre: 'Línea B' };
const casa: NuevoFavorito = {
  tipo: 'estacion_subte',
  refId: '2002',
  nombre: 'Medrano',
  subtitulo: 'Línea B',
  alias: 'Casa',
};
const parada: NuevoFavorito = {
  tipo: 'parada_colectivo',
  refId: '9002',
  nombre: 'Av. Rivadavia y Acoyte',
  subtitulo: 'Líneas 1, 25, 132',
};

const ARRIBOS_ROUTE = '/v1/subtes/estaciones/2002/arribos';
const arribosOk = () =>
  jsonResponse(
    arribos('2002', [
      { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 120 },
      { linea: 'B', estacion: 'Medrano', destino: 'Juan Manuel de Rosas', enSegundos: 300 },
    ]),
  );

function setup(items: readonly NuevoFavorito[], routes: Routes = defaultRoutes()) {
  const harness = createHarness(routes);
  for (const item of items) harness.repository.add(item);
  const renderUi = () =>
    render(
      <harness.Wrapper>
        <EditModeProvider>
          <FavoritosScreen />
        </EditModeProvider>
      </harness.Wrapper>,
    );
  return { harness, renderUi };
}

const paths = (fetchMock: ReturnType<typeof createHarness>['fetchMock']) =>
  fetchMock.mock.calls.map(([url]) => new URL(url).pathname);

describe('Favoritos · datos vivos', () => {
  it('con datos: estado de la línea y próximos arribos, y la etiqueta de la fila los lee', async () => {
    const { renderUi } = setup([lineaB, casa], { ...defaultRoutes(), [ARRIBOS_ROUTE]: arribosOk });
    await renderUi();

    // La banda muestra el primer arribo como valor (24 pt en `next`) y la línea, su estado.
    expect(await screen.findByText('2 min', { includeHiddenElements: true })).toHaveStyle({
      fontSize: 24,
    });
    expect(await screen.findByText('Normal', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Casa. Estación Medrano, Línea B, Hacia Leandro N. Alem en 2 minutos. Hacia Juan Manuel de Rosas en 5 minutos',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Línea B, Estado: normal' })).toBeOnTheScreen();
  });

  it('en carga: la fila ya está y lee "Cargando" mientras llega el dato', async () => {
    // El pedido de arribos no responde: la fila se pinta igual (síncrona desde MMKV).
    const { renderUi } = setup([casa], { ...defaultRoutes(), [ARRIBOS_ROUTE]: () => undefined });
    await renderUi();
    expect(
      screen.getByRole('button', { name: 'Casa. Estación Medrano, Línea B, cargando' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Casa', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('con error: "Sin información" en la fila, sin romper nada', async () => {
    const { renderUi } = setup([lineaB, casa], {
      ...defaultRoutes(),
      [ARRIBOS_ROUTE]: () => jsonResponse(errorBody('upstream_unavailable'), 503),
    });
    await renderUi();

    expect(
      await screen.findByRole('button', {
        name: 'Casa. Estación Medrano, Línea B, Sin información',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Sin información', { includeHiddenElements: true })).toBeOnTheScreen();
    // Un error en un tipo no afecta al resto: la línea de subte sigue normal.
    expect(await screen.findByText('Normal', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('la parada de colectivo muestra solo su dato estático y no pide nada', async () => {
    const { renderUi, harness } = setup([parada]);
    await renderUi();
    // El detalle de la parada (sus líneas) sale una sola vez, sin repetirlo como dato vivo.
    expect(screen.getAllByText('Líneas 1, 25, 132', { includeHiddenElements: true })).toHaveLength(
      1,
    );
    expect(
      screen.getByRole('button', { name: 'Parada Av. Rivadavia y Acoyte, Líneas 1, 25, 132' }),
    ).toBeOnTheScreen();
    await waitFor(() => {
      expect(harness.queryClient.isFetching()).toBe(0);
    });
    expect(paths(harness.fetchMock).some((p) => p.includes('/colectivos/'))).toBe(false);
  });

  it('solo las filas visibles piden datos (las primeras 10 hasta que la lista informe)', async () => {
    const lineas: NuevoFavorito[] = Array.from({ length: 12 }, (_, i) => ({
      tipo: 'linea_colectivo',
      refId: String(100 + i),
      nombre: `Línea ${String(100 + i)}`,
    }));
    const routes: Routes = { ...defaultRoutes() };
    for (const l of lineas) {
      routes[`/v1/colectivos/lineas/${l.refId}/posiciones`] = () =>
        jsonResponse(posiciones(l.refId, 2));
    }
    const { renderUi, harness } = setup(lineas, routes);
    await renderUi();
    await waitFor(() => {
      expect(harness.queryClient.isFetching()).toBe(0);
    });

    const pedidos = paths(harness.fetchMock).filter((p) => p.endsWith('/posiciones'));
    expect(pedidos).toHaveLength(10);
    expect(pedidos).toContain('/v1/colectivos/lineas/100/posiciones');
    expect(pedidos).not.toContain('/v1/colectivos/lineas/111/posiciones');
  });
});

describe('Favoritos · frescura y refresco', () => {
  it('la etiqueta global muestra la más vieja de las visibles', async () => {
    const { renderUi } = setup([lineaB, casa], {
      ...defaultRoutes(),
      '/v1/subtes/estado': () => {
        const body = estado();
        body.meta.sourceTimestamp = isoAgo(40);
        return jsonResponse(body);
      },
      [ARRIBOS_ROUTE]: () =>
        jsonResponse(
          arribos(
            '2002',
            [{ linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 120 }],
            { sourceTimestamp: isoAgo(5) },
          ),
        ),
    });
    await renderUi();

    expect(await screen.findByText(/^Actualizado hace (39|40|41|42) s$/)).toBeOnTheScreen();
  });

  it('sin datos vivos (solo paradas) no hay etiqueta de frescura', async () => {
    const { renderUi } = setup([parada]);
    await renderUi();
    expect(screen.queryByText(/Actualizado hace/)).toBeNull();
    expect(screen.queryByText(/Sin dato de actualización/)).toBeNull();
  });

  it('pull to refresh vuelve a pedir los datos en vivo', async () => {
    const { renderUi, harness } = setup([lineaB]);
    await renderUi();
    await screen.findByText('Normal', { includeHiddenElements: true });
    const antes = paths(harness.fetchMock).filter((p) => p === '/v1/subtes/estado').length;

    // El `RefreshControl` viaja como prop de la lista: se dispara su `onRefresh`.
    const control = screen.getByTestId('favoritos-lista').props.refreshControl as {
      props: { onRefresh: () => void };
    };
    await act(() => {
      control.props.onRefresh();
    });
    await waitFor(() => {
      expect(
        paths(harness.fetchMock).filter((p) => p === '/v1/subtes/estado').length,
      ).toBeGreaterThan(antes);
    });
  });
});
