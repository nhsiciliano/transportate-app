// Alert única de "servicio caído": solo si TODAS las filas con dato vivo fallaron por un error
// reintentable. Una sola fila que ande, o un error que no es del servicio (404), no la muestra.
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { EditModeProvider, FavoritosScreen, type NuevoFavorito } from '@/features/favoritos';

import {
  arribos,
  createHarness,
  defaultRoutes,
  errorBody,
  estado,
  jsonResponse,
  type Routes,
} from '../../../../test/subtes/fixtures';
import { SERVICE_DOWN_MESSAGE } from '../FavoritosScreen';

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
const colectivo: NuevoFavorito = { tipo: 'linea_colectivo', refId: '60', nombre: 'Línea 60' };
const parada: NuevoFavorito = {
  tipo: 'parada_colectivo',
  refId: '9002',
  nombre: 'Av. Rivadavia y Acoyte',
  subtitulo: 'Líneas 1, 25, 132',
};

const down = () => jsonResponse(errorBody('upstream_unavailable'), 503);
const notFound = () => jsonResponse(errorBody('not_found'), 404);
const ESTADO = '/v1/subtes/estado';
const ARRIBOS = '/v1/subtes/estaciones/2002/arribos';
const POSICIONES = '/v1/colectivos/lineas/60/posiciones';

function setup(items: readonly NuevoFavorito[], routes: Routes) {
  const harness = createHarness({ ...defaultRoutes(), ...routes });
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

const paths = (h: ReturnType<typeof createHarness>) =>
  h.fetchMock.mock.calls.map(([url]) => new URL(url).pathname);

describe('Favoritos · servicio caído', () => {
  it('todas las filas con dato vivo en error → una sola Alert y cada fila "Sin información"', async () => {
    const { renderUi } = setup([lineaB, casa, colectivo], {
      [ESTADO]: down,
      [ARRIBOS]: down,
      [POSICIONES]: down,
    });
    await renderUi();

    expect(await screen.findByText(SERVICE_DOWN_MESSAGE)).toBeOnTheScreen();
    expect(screen.getAllByText(SERVICE_DOWN_MESSAGE)).toHaveLength(1);
    await waitFor(() => {
      expect(screen.getAllByText('Sin información', { includeHiddenElements: true })).toHaveLength(
        3,
      );
    });
  });

  it('si solo falla un tipo no hay Alert global: solo esas filas dicen "Sin información"', async () => {
    const { renderUi } = setup([lineaB, casa], { [ARRIBOS]: down });
    await renderUi();

    expect(
      await screen.findByRole('button', {
        name: 'Casa. Estación Medrano, Línea B, Sin información',
      }),
    ).toBeOnTheScreen();
    expect(await screen.findByText('Normal', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText(SERVICE_DOWN_MESSAGE)).toBeNull();
  });

  it('un error que no es del servicio (404: la línea ya no existe) no dispara la Alert', async () => {
    const { renderUi } = setup([casa, colectivo], { [ARRIBOS]: notFound, [POSICIONES]: notFound });
    await renderUi();
    await screen.findByRole('button', { name: /^Casa\..*Sin información$/ });
    expect(screen.queryByText(SERVICE_DOWN_MESSAGE)).toBeNull();
  });

  it('una fila en error reintentable y otra en error de contenido (404) → sin Alert', async () => {
    const { renderUi } = setup([casa, colectivo], { [ARRIBOS]: down, [POSICIONES]: notFound });
    await renderUi();
    await screen.findByRole('button', { name: /^Colectivo Línea 60, Sin información$/ });
    await screen.findByRole('button', { name: /^Casa\..*Sin información$/ });
    expect(screen.queryByText(SERVICE_DOWN_MESSAGE)).toBeNull();
  });

  it('sin filas con dato vivo (solo paradas estáticas) no hay Alert', async () => {
    const { renderUi, harness } = setup([parada], {});
    await renderUi();
    await waitFor(() => {
      expect(harness.queryClient.isFetching()).toBe(0);
    });
    expect(screen.queryByText(SERVICE_DOWN_MESSAGE)).toBeNull();
  });

  it('mientras carga no se avisa nada', async () => {
    const { renderUi } = setup([casa], { [ARRIBOS]: () => undefined });
    await renderUi();
    expect(screen.queryByText(SERVICE_DOWN_MESSAGE)).toBeNull();
  });

  it('"Reintentar" vuelve a pedir los datos en vivo y la Alert se va cuando el servicio vuelve', async () => {
    const user = userEvent.setup();
    let caido = true;
    const { renderUi, harness } = setup([lineaB, casa], {
      [ESTADO]: () => (caido ? down() : jsonResponse(estado())),
      [ARRIBOS]: () =>
        caido
          ? down()
          : jsonResponse(
              arribos('2002', [
                { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 120 },
              ]),
            ),
    });
    await renderUi();
    await screen.findByText(SERVICE_DOWN_MESSAGE);
    const antes = paths(harness).filter((p) => p === ESTADO || p === ARRIBOS).length;

    caido = false;
    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(paths(harness).filter((p) => p === ESTADO || p === ARRIBOS).length).toBeGreaterThan(
        antes,
      );
    });
    await waitFor(() => {
      expect(screen.queryByText(SERVICE_DOWN_MESSAGE)).toBeNull();
    });
    expect(await screen.findByText('Normal', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
