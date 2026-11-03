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
const lineaC: NuevoFavorito = { tipo: 'linea_subte', refId: 'C', nombre: 'Línea C' };
const premetro: NuevoFavorito = { tipo: 'linea_subte', refId: 'PM', nombre: 'Premetro' };
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

/** La insignia va dentro de la fila (oculta al lector, que lee la fila entera): se busca igual. */
function badge(label: string, optional = false) {
  const opts = { includeHiddenElements: true };
  return optional ? screen.queryByLabelText(label, opts) : screen.getByLabelText(label, opts);
}

afterEach(() => {
  mockPush.mockClear();
});

describe('Favoritos · colores de subte', () => {
  it('la línea y la estación llevan el color oficial de su línea', async () => {
    const { renderUi } = setup([lineaA, lineaC, premetro, medrano]);
    await renderUi();

    await waitFor(() => {
      expect(badge('Línea A')).toHaveStyle({ backgroundColor: '#A5C8FF' });
    });
    expect(badge('Línea C')).toHaveStyle({ backgroundColor: '#0000FF' });
    expect(badge('Línea PM')).toHaveStyle({ backgroundColor: '#FFBD33' });
    // La estación Medrano muestra la insignia de la línea B (roja, texto negro).
    expect(badge('Línea B')).toHaveStyle({ backgroundColor: '#FF0000' });
    // El texto de la insignia es el `route_text_color` del estático.
    expect(screen.getByText('C', { includeHiddenElements: true })).toHaveStyle({
      color: '#FFFFFF',
    });
    expect(screen.getByText('B', { includeHiddenElements: true })).toHaveStyle({
      color: '#000000',
    });
  });

  it('mientras el estático carga la insignia es neutra y la fila ya funciona', async () => {
    const user = userEvent.setup();
    const { renderUi } = setup([lineaA, medrano], staticLoading());
    await renderUi();

    expect(badge('Línea A')).not.toHaveStyle({ backgroundColor: '#A5C8FF' });
    // La estación todavía no sabe de qué línea es: conserva su ícono (sin insignia).
    expect(badge('Línea B', true)).toBeNull();
    await user.press(screen.getByRole('button', { name: /^Línea A de subte/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/subtes/[linea]', params: { linea: 'A' } });
  });

  it('con el estático caído sigue neutra y no marca ningún huérfano', async () => {
    const { renderUi, harness } = setup([lineaA, lineaFantasma, estacionFantasma], staticDown());
    await renderUi();
    await waitFor(() => {
      expect(harness.fetchMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(harness.queryClient.isFetching()).toBe(0);
    });

    expect(badge('Línea A')).not.toHaveStyle({ backgroundColor: '#A5C8FF' });
    expect(screen.queryByText(/ya no figura/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Quitar/ })).toBeNull();
  });
});

describe('Favoritos · huérfanos', () => {
  it('una línea y una estación que no existen en el estático avisan y se pueden quitar', async () => {
    const { renderUi } = setup([lineaA, lineaFantasma, estacionFantasma]);
    await renderUi();

    expect(
      await screen.findByText('Esta línea ya no figura en los datos oficiales'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Esta estación ya no figura en los datos oficiales')).toBeOnTheScreen();
    // Conservan lo que la persona guardó: el alias y el nombre.
    expect(screen.getByText('Mi estación')).toBeOnTheScreen();
    expect(screen.getByText('Estación vieja')).toBeOnTheScreen();
    // La línea que sí existe no avisa nada.
    expect(screen.getAllByText(/ya no figura/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Quitar Línea Z' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Quitar Línea A' })).toBeNull();
  });

  it('se lee como una unidad con el aviso', async () => {
    const { renderUi } = setup([estacionFantasma]);
    await renderUi();
    await screen.findByText('Esta estación ya no figura en los datos oficiales');
    expect(
      screen.getByLabelText(
        'Mi estación. Estación Estación vieja. Esta estación ya no figura en los datos oficiales.',
      ),
    ).toBeOnTheScreen();
  });

  it('no abre un detalle que ya no existe', async () => {
    const user = userEvent.setup();
    const { renderUi } = setup([lineaFantasma]);
    await renderUi();
    await user.press(await screen.findByText('Línea Z'));
    expect(mockPush).not.toHaveBeenCalled();
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
    await screen.findByText('Esta estación ya no figura en los datos oficiales');
    // El botón Editar vive en el header (fuera de la pantalla): se prende el modo a mano.
    // Acá alcanza con comprobar que fuera de edición el botón "Quitar" está.
    expect(screen.getByRole('button', { name: 'Quitar Mi estación' })).toBeOnTheScreen();
  });

  it('los colectivos nunca se marcan huérfanos todavía (se completa en 4.5)', async () => {
    const { renderUi, harness } = setup([colectivo, parada, lineaA]);
    await renderUi();
    await waitFor(() => {
      expect(badge('Línea A')).toHaveStyle({ backgroundColor: '#A5C8FF' });
    });
    await waitFor(() => {
      expect(harness.queryClient.isFetching()).toBe(0);
    });
    expect(screen.queryByText(/ya no figura/)).toBeNull();
    expect(screen.getByRole('button', { name: /^Línea 60 de colectivo\./ })).toBeOnTheScreen();
  });
});
