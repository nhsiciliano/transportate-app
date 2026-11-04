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
    // Banda fija arriba: la línea con su estado (sin flecha: ya estás ahí).
    expect(
      await screen.findByText('Línea B · Leandro N. Alem – Juan Manuel de Rosas', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(await screen.findByText('Estaciones cerradas')).toBeOnTheScreen();
    // Nunca truncada, con la hora de Buenos Aires.
    expect(screen.getByText(`${descripcion}\nDesde las 14:05`)).toBeOnTheScreen();
    expect(screen.queryByText('Otra línea')).toBeNull();
    const banda = screen.getByTestId('linea-banda');
    expect(banda.props.accessibilityRole).toBeUndefined();
    expect(banda.props.accessibilityLabel).toBe(
      'Línea B, Leandro N. Alem – Juan Manuel de Rosas. Estado: con demoras. 1 alerta',
    );
    expect(screen.getByText('Con demoras', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('1 alerta', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId('linea-banda-flecha', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByRole('button', { name: 'Medrano, con novedades' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Leandro N. Alem' })).toBeOnTheScreen();
  });

  it('con título y descripción iguales y sin período, el texto sale una sola vez', async () => {
    const texto = 'Línea B: servicio limitado entre Leandro N. Alem y Federico Lacroze.';
    await renderSubtes('/subtes/B', {
      ...defaultRoutes(),
      '/v1/subtes/alertas': () =>
        jsonResponse(
          alertas([{ id: 'al-b', lineas: ['B'], titulo: texto, descripcion: `${texto} ` }]),
        ),
    });
    await screen.findByTestId('alerta-al-b');
    expect(screen.getAllByText(texto)).toHaveLength(1);
  });

  it('sin alertas: "Sin novedades informadas" y estaciones en orden de recorrido', async () => {
    await renderSubtes('/subtes/A');
    expect(await screen.findByText('Sin novedades informadas')).toBeOnTheScreen();
    const estaciones = screen.getAllByTestId(/^estacion-\d+$/).map((e) => e.props.testID as string);
    expect(estaciones).toEqual(['estacion-1001', 'estacion-1002', 'estacion-1059']);
  });

  it('Premetro: una sola línea con los dos ramales', async () => {
    await renderSubtes('/subtes/PM');
    // El ramal se nombra como subtítulo de la primera estación de cada uno.
    expect(await screen.findByText('Ramal Centro Cívico')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Centro Cívico, Ramal Centro Cívico' }),
    ).toBeOnTheScreen();
    const estaciones = screen.getAllByTestId(/^estacion-\d+$/).map((e) => e.props.testID as string);
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
    // Contexto bajo el header nativo: la línea con su recorrido, que abre la línea.
    const contexto = await screen.findByRole('button', {
      name: 'Línea B · Leandro N. Alem – Juan Manuel de Rosas',
    });
    expect(contexto.props.accessibilityHint).toBe('Abre la línea');
    // Una silueta de banda por sentido.
    expect(screen.getByTestId('arribos-skeleton')).toBeOnTheScreen();
    await userEvent.setup().press(contexto);
    expect(screen).toHavePathname('/subtes/B');
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
    // Banda fija (sin flecha ni botón): «Próximo», el minuto monumental y los siguientes.
    expect(alem.props.accessibilityRole).toBeUndefined();
    expect(
      screen.queryByTestId('bloque-Leandro N. Alem-flecha', { includeHiddenElements: true }),
    ).toBeNull();
    expect(screen.getByText('Llegando', { includeHiddenElements: true })).toHaveStyle({
      fontSize: 56,
    });
    expect(
      screen.getByText('Después 7 y 15 min', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Único informado', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getAllByText('Próximo', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryByText('25 min', { includeHiddenElements: true })).toBeNull();
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
    // Dato de días: más de 10 min, así que la banda dice la antigüedad (S30).
    expect(
      await screen.findByText('Dato de hace 8 días', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/⚠ Dato de hace 8 días/)).toBeOnTheScreen();
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
    const banda = await screen.findByLabelText(
      'Hacia Plaza de Mayo: dato de hace 12 min. Puede no reflejar la situación actual.',
    );
    expect(banda).toBeOnTheScreen();
    expect(screen.getByText('Dato de hace 12 min', { includeHiddenElements: true })).toHaveStyle({
      fontSize: 28,
    });
    expect(screen.queryByText('2 min', { includeHiddenElements: true })).toBeNull();
    // Terminal: solo el sentido que sale.
    expect(screen.queryByText('Hacia San Pedrito', { includeHiddenElements: true })).toBeNull();
  });

  it('un sentido sin arribos: «Sin trenes informados» en escala texto', async () => {
    await renderSubtes('/subtes/estacion/2002', {
      ...defaultRoutes(),
      '/v1/subtes/estaciones/2002/arribos': () =>
        jsonResponse(
          arribos('2002', [
            { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 240 },
          ]),
        ),
    });
    expect(
      await screen.findByLabelText('Hacia Juan Manuel de Rosas: sin trenes informados.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Sin trenes informados', { includeHiddenElements: true })).toHaveStyle({
      fontSize: 28,
    });
    expect(screen.getByText('4 min', { includeHiddenElements: true })).toHaveStyle({
      fontSize: 56,
    });
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
    expect(await screen.findByText('2 min', { includeHiddenElements: true })).toBeOnTheScreen();
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
