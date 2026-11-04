// Colores de subte y favoritos huérfanos, con el estático de `test/subtes/fixtures`.
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { EditModeProvider, FavoritosScreen, type NuevoFavorito } from '@/features/favoritos';

import {
  createHarness,
  defaultRoutes,
  errorBody,
  jsonResponse,
  VERSION,
  type Routes,
} from '../../../../test/subtes/fixtures';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const lineaA: NuevoFavorito = { tipo: 'linea_subte', refId: 'A', nombre: 'Línea A' };
const medrano: NuevoFavorito = {
  tipo: 'estacion_subte',
  refId: '2002',
  nombre: 'Medrano',
  subtitulo: 'Línea B',
};
const lineaFantasma: NuevoFavorito = { tipo: 'linea_subte', refId: 'Z', nombre: 'Línea Z' };
const estacionFantasma: NuevoFavorito = {
  tipo: 'estacion_subte',
  refId: '999999',
  nombre: 'Estación vieja',
  alias: 'Mi estación',
};
const colectivo: NuevoFavorito = { tipo: 'linea_colectivo', refId: '60', nombre: 'Línea 60' };
const parada: NuevoFavorito = { tipo: 'parada_colectivo', refId: '9002', nombre: 'Rivadavia' };

function setup(items: readonly NuevoFavorito[], routes: Routes = defaultRoutes()) {
  const harness = createHarness(routes);
  const repo = harness.repository;
  for (const item of items) repo.add(item);
  const renderUi = () =>
    render(
      <harness.Wrapper>
        <EditModeProvider>
          <FavoritosScreen />
        </EditModeProvider>
      </harness.Wrapper>,
    );
  return { repo, renderUi, harness };
}

/** Rutas con el estático caído: manifiesto, líneas y estaciones dan 503. */
function staticDown(): Routes {
  const down = () => jsonResponse(errorBody('upstream_unavailable'), 503);
  return {
    ...defaultRoutes(),
    '/v1/static/manifest': down,
    [`/v1/static/${VERSION}/subte-lineas.json`]: down,
    [`/v1/static/${VERSION}/subte-estaciones.json`]: down,
  };
}

/** Estático que nunca responde: la pantalla se queda en el estado "sin cargar". */
function staticLoading(): Routes {
  return { ...defaultRoutes(), '/v1/static/manifest': () => undefined };
}

afterEach(() => {
  mockPush.mockClear();
});

describe('Favoritos · pictograma por tipo', () => {
  // Desde la Fase 5 la banda lleva el pictograma del tipo (como Inicio), no el disco de la línea:
  // el color de la línea ya no es un canal de la banda (F5-favoritos-2).
  it('cada banda lleva el pictograma de su tipo en el cuadrado', async () => {
    const { renderUi } = setup([lineaA, medrano]);
    await renderUi();
    const cuadrados = await screen.findAllByTestId('signband-pictograma', {
      includeHiddenElements: true,
    });
    expect(cuadrados).toHaveLength(2);
    // Línea y estación de subte comparten el glifo `subway` (mapa curado: `subtes`/`estacion`).
    expect(screen.getAllByTestId('svg:subway-fill', { includeHiddenElements: true })).toHaveLength(
      2,
    );
  });

  it('mientras el estático carga la banda ya funciona', async () => {
    const user = userEvent.setup();
    const { renderUi } = setup([lineaA, medrano], staticLoading());
    await renderUi();
    await user.press(screen.getByRole('button', { name: /^Línea A, / }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/subtes/[linea]', params: { linea: 'A' } });
  });

  it('con el estático caído no marca ningún huérfano', async () => {
    const { renderUi, harness } = setup([lineaA, lineaFantasma, estacionFantasma], staticDown());
    await renderUi();
    await waitFor(() => {
      expect(harness.fetchMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(harness.queryClient.isFetching()).toBe(0);
    });
    expect(screen.queryByText('Ya no figura', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Quitar/ })).toBeNull();
  });
});

describe('Favoritos · huérfanos', () => {
  it('una línea y una estación que no existen en el estático avisan y se pueden quitar', async () => {
    const { renderUi } = setup([lineaA, lineaFantasma, estacionFantasma]);
    await renderUi();

    // Banda sin flecha, cuadrado rojo «Ya no figura» y «Quitar» siempre visible.
    expect(
      await screen.findByLabelText(/^Línea Z, Esta línea ya no figura en los datos oficiales$/),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/Esta estación ya no figura en los datos oficiales$/),
    ).toBeOnTheScreen();
    // Conservan lo que la persona guardó: el alias es el mensaje.
    expect(screen.getByText('Mi estación', { includeHiddenElements: true })).toBeOnTheScreen();
    // La línea que sí existe no avisa nada.
    expect(screen.getAllByText('Ya no figura', { includeHiddenElements: true })).toHaveLength(2);
    expect(
      screen.getAllByText('Sin datos oficiales', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(
      screen.getAllByTestId('signband-estado-cuadrado', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Quitar Línea Z' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Quitar Línea A' })).toBeNull();
  });

  it('se lee como una unidad con el aviso', async () => {
    const { renderUi } = setup([estacionFantasma]);
    await renderUi();
    expect(
      await screen.findByLabelText(
        'Mi estación. Estación Estación vieja, Esta estación ya no figura en los datos oficiales',
      ),
    ).toBeOnTheScreen();
  });

  it('no abre un detalle que ya no existe', async () => {
    const user = userEvent.setup();
    const { renderUi } = setup([lineaFantasma]);
    await renderUi();
    await user.press(await screen.findByText('Línea Z', { includeHiddenElements: true }));
    expect(mockPush).not.toHaveBeenCalled();
    // Sin destino no hay flecha.
    expect(screen.queryAllByTestId(/-flecha$/, { includeHiddenElements: true })).toHaveLength(0);
  });

  it('"Quitar" lo saca al instante y "Deshacer" lo devuelve', async () => {
    const user = userEvent.setup();
    const { renderUi, repo } = setup([lineaA, lineaFantasma]);
    await renderUi();

    await user.press(await screen.findByRole('button', { name: 'Quitar Línea Z' }));
    expect(repo.list().map((f) => f.refId)).toEqual(['A']);
    expect(screen.getByText('Quitaste «Línea Z».')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Deshacer' }));
    expect(repo.list().map((f) => f.refId)).toEqual(['A', 'Z']);
  });

  it('en edición el huérfano conserva "Cambiar nombre" y "Quitar"', async () => {
    const { renderUi } = setup([estacionFantasma]);
    await renderUi();
    await screen.findByText('Ya no figura', { includeHiddenElements: true });
    // El botón Editar vive en el header (fuera de la pantalla): se prende el modo a mano.
    // Acá alcanza con comprobar que fuera de edición el botón "Quitar" está.
    expect(screen.getByRole('button', { name: 'Quitar Mi estación' })).toBeOnTheScreen();
  });

  it('colectivos que figuran en el índice y líneas sin dato del proxy no son huérfanos', async () => {
    const { renderUi, harness } = setup([colectivo, parada, lineaA]);
    await renderUi();
    await waitFor(() => {
      expect(harness.queryClient.isFetching()).toBe(0);
    });
    expect(screen.queryByText('Ya no figura', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByRole('button', { name: /^Colectivo Línea 60, / })).toBeOnTheScreen();
  });

  it('una parada que ya no está en el índice es huérfana (mismo criterio que subte)', async () => {
    const { renderUi } = setup([{ ...parada, refId: 'p-que-ya-no-existe' }]);
    await renderUi();
    expect(
      await screen.findByLabelText(/Esta parada ya no figura en los datos oficiales$/),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Quitar / })).toBeOnTheScreen();
  });
});
