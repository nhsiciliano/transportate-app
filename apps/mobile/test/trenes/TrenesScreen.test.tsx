// Raíz de Trenes: carga, las 6 líneas con su estado, fuente caída, error, dato viejo y búsqueda.
import { act, userEvent } from '@testing-library/react-native';
import { screen } from 'expo-router/testing-library';

import { light } from '@/shared/theme';

import { errorBody, jsonResponse, type Routes } from '../subtes/fixtures';
import { estadoTrenes, renderTrenes, trenesRoutes } from './fixtures';

// Montan el router y los providers reales: con la máquina cargada pasan los 5 s por defecto.
jest.setTimeout(30_000);

/** `linea-roca`, sin los `-estado`/`-flecha` de cada fila. */
const FILAS = /^linea-(?!.*-(?:estado|flecha)$)[a-z-]+$/;

describe('Trenes (raíz)', () => {
  it('sin caché muestra el skeleton de las 6 líneas', async () => {
    await renderTrenes('/trenes', { ...trenesRoutes(), '/v1/trenes/estado': () => undefined });
    expect(await screen.findByTestId('trenes-skeleton')).toBeOnTheScreen();
    expect(screen.queryByTestId('linea-roca')).toBeNull();
  });

  it('lista las 6 líneas en orden fijo con insignia, cabeceras o ramales, estado y resumen', async () => {
    await renderTrenes('/trenes', {
      ...trenesRoutes(),
      '/v1/trenes/estado': () =>
        jsonResponse(
          estadoTrenes({
            sarmiento: {
              estado: 'demorada',
              resumen: 'El tren de las 08:11 hs. hacia Moreno se encuentra demorado.',
              alertaIds: ['99284'],
            },
            roca: { estado: 'interrumpida', resumen: 'El servicio a La Plata está interrumpido.' },
          }),
        ),
    });
    const filas = await screen.findAllByTestId(FILAS);
    expect(filas.map((f) => f.props.testID as string)).toEqual([
      'linea-roca',
      'linea-sarmiento',
      'linea-mitre',
      'linea-san-martin',
      'linea-belgrano-sur',
      'linea-tren-de-la-costa',
    ]);
    // Siglas en la insignia y nombre «Línea Roca»; Tren de la Costa es nombre propio.
    for (const siglas of ['R', 'S', 'M', 'SM', 'BS', 'TC']) {
      expect(screen.getByText(siglas)).toBeOnTheScreen();
    }
    expect(screen.getByText('Tren de la Costa')).toBeOnTheScreen();
    // Un solo ramal: las cabeceras; varios: la cantidad.
    expect(screen.getByText('Maipú – Delta')).toBeOnTheScreen();
    expect(screen.getByText('2 ramales')).toBeOnTheScreen();
    expect(screen.getByTestId('linea-sarmiento-estado')).toHaveTextContent('Con demoras');
    expect(screen.getByTestId('linea-roca-estado')).toHaveTextContent('Interrumpida');
    expect(screen.getByTestId('linea-mitre-estado')).toHaveTextContent('Normal');
    expect(screen.getByText('El servicio a La Plata está interrumpido.')).toHaveStyle({
      color: light.role.danger.text,
    });
    expect(screen.getByTestId('trenes-lineas')).toHaveStyle({ backgroundColor: light.bg.card });
    expect(
      screen.getByRole('button', {
        name: 'Línea Sarmiento, con demoras. 2 ramales. El tren de las 08:11 hs. hacia Moreno se encuentra demorado.',
      }),
    ).toBeOnTheScreen();
    // Sin mapa en esta fase (S34).
    expect(screen.queryByText('Mapa de la red')).toBeNull();
    expect(screen.getByText(/Actualizado hace/)).toBeOnTheScreen();
  });

  it('503 sin caché: las filas en «Sin información» y ErrorState con el copy de trenes', async () => {
    let falla = true;
    await renderTrenes('/trenes', {
      ...trenesRoutes(),
      '/v1/trenes/estado': () =>
        falla ? jsonResponse(errorBody('upstream_unavailable'), 503) : jsonResponse(estadoTrenes()),
    });
    expect(await screen.findByText('Servicio no disponible')).toBeOnTheScreen();
    expect(
      screen.getByText('El servicio de trenes no responde en este momento.'),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('Sin información')).toHaveLength(6);

    falla = false;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(await screen.findAllByText('Normal')).toHaveLength(6);
  });

  it('sin_datos en todas (fuente caída o apagada): «Sin información» y aviso, nunca «Normal»', async () => {
    await renderTrenes('/trenes', {
      ...trenesRoutes(),
      '/v1/trenes/estado': () => {
        const body = estadoTrenes(
          Object.fromEntries(
            ['roca', 'sarmiento', 'mitre', 'san-martin', 'belgrano-sur', 'tren-de-la-costa'].map(
              (id) => [id, { estado: 'sin_datos', ramales: [] }],
            ),
          ),
          { stale: true, sourceTimestamp: null, ageSeconds: null },
        );
        return jsonResponse(body);
      },
    });
    expect(await screen.findAllByText('Sin información')).toHaveLength(6);
    expect(screen.getByText('La fuente de datos de trenes no responde.')).toBeOnTheScreen();
    expect(screen.queryByText('Normal')).toBeNull();
  });

  it('con datos y actualización fallida, se queda el contenido y aparece la Alert', async () => {
    let falla = false;
    const harness = await renderTrenes('/trenes', {
      ...trenesRoutes(),
      '/v1/trenes/estado': () =>
        falla ? jsonResponse(errorBody('upstream_unavailable'), 503) : jsonResponse(estadoTrenes()),
    });
    expect(await screen.findAllByText('Normal')).toHaveLength(6);
    falla = true;
    await act(() => harness.queryClient.refetchQueries({ queryKey: ['trenes', 'estado'] }));
    expect(
      await screen.findByText('No pudimos actualizar. Mostramos lo último que sabemos.'),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('Normal')).toHaveLength(6);
  });

  it('dato viejo: la frescura pasa a warning', async () => {
    await renderTrenes('/trenes', {
      ...trenesRoutes(),
      '/v1/trenes/estado': () =>
        jsonResponse(
          estadoTrenes(
            {},
            { sourceTimestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(), stale: true },
          ),
        ),
    });
    expect(await screen.findByText(/Dato de hace 4 min/)).toBeOnTheScreen();
  });

  it('busca estaciones sin tildes ni mayúsculas, con sus líneas, y navega a la estación', async () => {
    const routes: Routes = {
      ...trenesRoutes(),
      '/v1/trenes/estaciones/248/arribos': () => undefined,
    };
    await renderTrenes('/trenes', routes);
    await screen.findAllByText('Normal');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Buscá una estación'), 'MAIPU');
    expect(screen.queryByTestId('linea-roca')).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Maipú, Tren de la Costa' }));
    expect(screen).toHavePathname('/trenes/estacion/248');
  });

  it('búsqueda sin resultados', async () => {
    await renderTrenes('/trenes');
    await screen.findAllByText('Normal');
    await userEvent.setup().type(screen.getByLabelText('Buscá una estación'), 'Plaza Italia');
    expect(
      screen.getByText('No encontramos «Plaza Italia». Probá con otro nombre de estación.'),
    ).toBeOnTheScreen();
  });

  it('tocar una fila abre la línea', async () => {
    await renderTrenes('/trenes');
    await screen.findAllByText('Normal');
    await userEvent.setup().press(screen.getByTestId('linea-san-martin'));
    expect(screen).toHavePathname('/trenes/san-martin');
  });
});
