// Detalle de línea y de estación: alertas, diagrama, arribos por sentido, vacío, dato > 10 min,
// feed no disponible y favoritos.
import { userEvent } from '@testing-library/react-native';
import { screen } from 'expo-router/testing-library';

import {
  alertas,
  arribos,
  defaultRoutes,
  errorBody,
  estado,
  isoAgo,
  jsonResponse,
  renderSubtes,
} from './fixtures';

// Montan el router y los providers reales: con la máquina cargada pasan los 5 s por defecto.
jest.setTimeout(30_000);

describe('Línea', () => {
  it('muestra alertas completas con su período y marca las estaciones afectadas', async () => {
    const descripcion =
      'Por obras de renovación, las estaciones Medrano y Leandro N. Alem permanecen cerradas. '.repeat(
        4,
      );
    await renderSubtes('/subtes/B', {
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        jsonResponse(estado({ B: { estado: 'demorada', resumen: 'Estaciones cerradas' } })),
      '/v1/subtes/alertas': () =>
        jsonResponse(
          alertas([
            {
              id: 'al-b',
              lineas: ['B'],
              titulo: 'Estaciones cerradas',
              descripcion,
              desde: '2026-11-02T17:05:00.000Z',
              estacionIds: ['2002'],
            },
            { id: 'al-a', lineas: ['A'], titulo: 'Otra línea', descripcion: 'No es de la B' },
          ]),
        ),
    });
    expect(await screen.findByText('Leandro N. Alem – Juan Manuel de Rosas')).toBeOnTheScreen();
    expect(await screen.findByText('Estaciones cerradas')).toBeOnTheScreen();
    // Nunca truncada, con la hora de Buenos Aires.
    expect(screen.getByText(`${descripcion}\nDesde las 14:05`)).toBeOnTheScreen();
    expect(screen.queryByText('Otra línea')).toBeNull();
    expect(screen.getByText('Con demoras')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Medrano, con novedades' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Leandro N. Alem' })).toBeOnTheScreen();
  });

  it('sin alertas: "Sin novedades informadas" y estaciones en orden de recorrido', async () => {
    await renderSubtes('/subtes/A');
    expect(await screen.findByText('Sin novedades informadas')).toBeOnTheScreen();
    const estaciones = screen.getAllByTestId(/^estacion-/).map((e) => e.props.testID as string);
    expect(estaciones).toEqual(['estacion-1001', 'estacion-1002', 'estacion-1059']);
  });

  it('Premetro: una sola línea con los dos ramales', async () => {
    await renderSubtes('/subtes/PM');
    expect(await screen.findByText('Ramal Centro Cívico')).toBeOnTheScreen();
    const estaciones = screen.getAllByTestId(/^estacion-/).map((e) => e.props.testID as string);
    expect(estaciones).toEqual([
      'estacion-7001',
      'estacion-7002',
      'estacion-7005',
      'estacion-7004',
      'estacion-7003',
    ]);
  });

  it('guarda y quita la línea de favoritos', async () => {
    const harness = await renderSubtes('/subtes/A');
    await screen.findByText('Sin novedades informadas');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    expect(harness.repository.has('linea_subte', 'A')).toBe(true);
    expect(harness.repository.list()[0]).toMatchObject({
      nombre: 'Línea A',
      subtitulo: 'Plaza de Mayo – San Pedrito',
    });
    await user.press(screen.getByRole('button', { name: 'Quitar de favoritos' }));
    expect(harness.repository.has('linea_subte', 'A')).toBe(false);
  });

  it('una línea inexistente muestra un vacío', async () => {
    await renderSubtes('/subtes/Z');
    expect(await screen.findByText('No encontramos esta línea')).toBeOnTheScreen();
  });

  it('tocar una estación abre su detalle', async () => {
    await renderSubtes('/subtes/B', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/2002/arribos': () => undefined,
    });
    await screen.findByText('Sin novedades informadas');
    await userEvent.setup().press(screen.getByTestId('estacion-2002'));
    expect(screen).toHavePathname('/subtes/estacion/2002');
  });
});

describe('Estación', () => {
  it('mientras cargan los arribos muestra nombre y skeleton', async () => {
    await renderSubtes('/subtes/estacion/2002', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/2002/arribos': () => undefined,
    });
    expect(await screen.findByRole('header', { name: 'Medrano' })).toBeOnTheScreen();
    expect(screen.getByTestId('arribos-skeleton')).toBeOnTheScreen();
  });

  it('agrupa los arribos por sentido, hasta 3, con "Llegando"', async () => {
    await renderSubtes('/subtes/estacion/2002', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/2002/arribos': () =>
        jsonResponse(
          arribos('2002', [
            { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 420 },
            { linea: 'B', estacion: 'Medrano', destino: 'LEANDRO N. ALEM', enSegundos: 15 },
            { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 900 },
            { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 1500 },
            { linea: 'B', estacion: 'Medrano', destino: 'Juan Manuel de Rosas', enSegundos: 125 },
          ]),
        ),
    });
    const alem = await screen.findByLabelText(
      'Hacia Leandro N. Alem: próximo llegando, siguientes en 7 minutos y en 15 minutos.',
    );
    expect(alem).toBeOnTheScreen();
    expect(screen.getByText('Llegando')).toBeOnTheScreen();
    expect(screen.queryByText('25 min')).toBeNull();
    expect(
      screen.getByLabelText('Hacia Juan Manuel de Rosas: próximo en 3 minutos.'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Actualizado hace/)).toBeOnTheScreen();
  });

  it('sin arribos (forecast congelado): vacío + frescura', async () => {
    await renderSubtes('/subtes/estacion/1059', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/1059/arribos': () =>
        jsonResponse(arribos('1059', [], { stale: true, sourceTimestamp: isoAgo(8 * 24 * 3600) })),
    });
    expect(
      await screen.findByText('No hay próximos trenes informados para esta estación.'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Dato de hace 8 días/)).toBeOnTheScreen();
  });

  it('con dato de más de 10 min, los tiempos se reemplazan por la antigüedad', async () => {
    await renderSubtes('/subtes/estacion/1059', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/1059/arribos': () =>
        jsonResponse(
          arribos(
            '1059',
            [{ linea: 'A', estacion: 'San Pedrito', destino: 'Plaza de Mayo', enSegundos: 120 }],
            { stale: true, sourceTimestamp: isoAgo(12 * 60) },
          ),
        ),
    });
    expect(await screen.findByTestId('arribos-viejos')).toHaveTextContent('Dato de hace 12 min');
    expect(screen.queryByText('2 min')).toBeNull();
    // Terminal: solo el sentido que sale.
    expect(screen.queryByText('Hacia San Pedrito')).toBeNull();
  });

  it('feed no disponible (404): mensaje informativo sin reintento', async () => {
    await renderSubtes('/subtes/estacion/2002', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/2002/arribos': () => jsonResponse(errorBody('not_found'), 404),
    });
    expect(
      await screen.findByText('Los próximos arribos no están disponibles por ahora'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Volver a intentar' })).toBeNull();
  });

  it('servicio caído sin caché: ErrorState con reintento', async () => {
    let falla = true;
    await renderSubtes('/subtes/estacion/2002', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/2002/arribos': () =>
        falla
          ? jsonResponse(errorBody('upstream_unavailable'), 503)
          : jsonResponse(
              arribos('2002', [
                { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 120 },
              ]),
            ),
    });
    expect(await screen.findByText('Servicio no disponible')).toBeOnTheScreen();
    falla = false;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(await screen.findByText('2 min')).toBeOnTheScreen();
  });

  it('línea interrumpida: alerta arriba que lleva a la línea; estación a favoritos', async () => {
    const harness = await renderSubtes('/subtes/estacion/2002', {
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        jsonResponse(estado({ B: { estado: 'interrumpida', resumen: 'Línea B sin servicio' } })),
      '/v1/subtes/estaciones/2002/arribos': () => jsonResponse(arribos('2002', [])),
    });
    expect(await screen.findByText('Línea B sin servicio')).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    expect(harness.repository.list()[0]).toMatchObject({
      tipo: 'estacion_subte',
      refId: '2002',
      nombre: 'Medrano',
      subtitulo: 'Línea B',
    });
    await user.press(screen.getByRole('button', { name: 'Ver la línea' }));
    expect(screen).toHavePathname('/subtes/B');
  });

  it('una estación inexistente muestra un vacío', async () => {
    await renderSubtes('/subtes/estacion/9999', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/9999/arribos': () => jsonResponse(arribos('9999', [])),
    });
    expect(await screen.findByText('No encontramos esta estación')).toBeOnTheScreen();
  });
});
