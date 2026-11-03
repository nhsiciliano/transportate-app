// Raíz de Subtes: carga, datos, error, dato viejo con actualización fallida, búsqueda y mapa.
import { act, userEvent } from '@testing-library/react-native';
import { screen } from 'expo-router/testing-library';

import {
  defaultRoutes,
  errorBody,
  estado,
  jsonResponse,
  renderSubtes,
  type Routes,
} from './fixtures';

// Montan el router y los providers reales: con la máquina cargada pasan los 5 s por defecto.
jest.setTimeout(30_000);

describe('Subtes (raíz)', () => {
  it('sin caché muestra el skeleton de las líneas', async () => {
    await renderSubtes('/subtes', { ...defaultRoutes(), '/v1/subtes/estado': () => undefined });
    expect(await screen.findByTestId('subtes-skeleton')).toBeOnTheScreen();
    expect(screen.queryByTestId('linea-A')).toBeNull();
  });

  it('lista las 7 líneas en orden fijo, con Premetro como una sola fila', async () => {
    await renderSubtes('/subtes', {
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        jsonResponse(
          estado({
            C: { estado: 'demorada', resumen: 'Servicio con demoras por obras', alertaIds: ['a1'] },
            'PM-S': { estado: 'interrumpida', resumen: 'Ramal Savio sin servicio' },
          }),
        ),
    });
    const filas = await screen.findAllByTestId(/^linea-/);
    expect(filas.map((f) => f.props.testID as string)).toEqual([
      'linea-A',
      'linea-B',
      'linea-C',
      'linea-D',
      'linea-E',
      'linea-H',
      'linea-PM',
    ]);
    expect(screen.getByText('Plaza de Mayo – San Pedrito')).toBeOnTheScreen();
    expect(
      screen.getByText('Intendente Saguier – General Savio / Centro Cívico'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Servicio con demoras por obras')).toBeOnTheScreen();
    // La fila se lee como una unidad: línea, estado, cabeceras y alerta.
    expect(
      screen.getByRole('button', {
        name: 'Línea C, con demoras. Retiro – Constitución. Servicio con demoras por obras',
      }),
    ).toBeOnTheScreen();
    // Premetro toma el estado más severo de sus dos ramales.
    expect(screen.getByRole('button', { name: /^Premetro, interrumpida/ })).toBeOnTheScreen();
    expect(screen.getByText(/Actualizado hace/)).toBeOnTheScreen();
  });

  it('sin estado ni caché: líneas en "Sin información" y ErrorState con reintento', async () => {
    let falla = true;
    const routes: Routes = {
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        falla ? jsonResponse(errorBody('upstream_unavailable'), 503) : jsonResponse(estado()),
    };
    await renderSubtes('/subtes', routes);
    expect(await screen.findByText('Servicio no disponible')).toBeOnTheScreen();
    expect(screen.getAllByText('Sin información')).toHaveLength(7);

    falla = false;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(await screen.findAllByText('Normal')).toHaveLength(7);
    expect(screen.queryByText('Servicio no disponible')).toBeNull();
  });

  it('con datos y actualización fallida, se queda el contenido y aparece la Alert', async () => {
    let falla = false;
    const harness = await renderSubtes('/subtes', {
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        falla ? jsonResponse(errorBody('upstream_unavailable'), 503) : jsonResponse(estado()),
    });
    expect(await screen.findAllByText('Normal')).toHaveLength(7);

    falla = true;
    await act(() => harness.queryClient.refetchQueries({ queryKey: ['subtes', 'estado'] }));
    expect(
      await screen.findByText('No pudimos actualizar. Mostramos lo último que sabemos.'),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('Normal')).toHaveLength(7);

    falla = false;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.queryByTestId('refresh-error')).toBeNull();
  });

  it('dato viejo: la frescura pasa a warning', async () => {
    await renderSubtes('/subtes', {
      ...defaultRoutes(),
      '/v1/subtes/estado': () => {
        const body = estado();
        body.meta.sourceTimestamp = new Date(Date.now() - 4 * 60 * 1000).toISOString();
        body.meta.stale = true;
        return jsonResponse(body);
      },
    });
    expect(await screen.findByText(/Dato de hace 4 min/)).toBeOnTheScreen();
  });

  it('busca estaciones sin tildes ni mayúsculas y navega a la estación', async () => {
    await renderSubtes('/subtes', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/3002/arribos': () => undefined,
    });
    await screen.findAllByText('Normal');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Buscá una estación'), 'CONSTITUCION');
    expect(screen.queryByTestId('linea-A')).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Constitución, Línea C' }));
    expect(screen).toHavePathname('/subtes/estacion/3002');
  });

  it('búsqueda sin resultados', async () => {
    await renderSubtes('/subtes');
    await screen.findAllByText('Normal');
    await userEvent.setup().type(screen.getByLabelText('Buscá una estación'), 'Obelisco');
    expect(
      screen.getByText('No encontramos «Obelisco». Probá con otro nombre de estación.'),
    ).toBeOnTheScreen();
  });

  it('"Ver mapa" abre /subtes/mapa y una fila abre su línea', async () => {
    await renderSubtes('/subtes');
    await screen.findAllByText('Normal');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Ver mapa' }));
    expect(screen).toHavePathname('/subtes/mapa');
  });

  it('tocar una fila abre el detalle de la línea', async () => {
    await renderSubtes('/subtes');
    await screen.findAllByText('Normal');
    await userEvent.setup().press(screen.getByTestId('linea-PM'));
    expect(screen).toHavePathname('/subtes/PM');
  });
});
