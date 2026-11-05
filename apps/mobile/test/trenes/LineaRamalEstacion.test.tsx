// Detalles de Trenes: línea → ramales (sin estrella), ramal con estrella y estaciones, y estación
// con una banda por destino, cancelados, demora, dato viejo y error de la fuente.
import { userEvent } from '@testing-library/react-native';
import { screen } from 'expo-router/testing-library';

import { errorBody, jsonResponse } from '../subtes/fixtures';
import { alertasTrenes, arribosTren, estadoTrenes, renderTrenes, trenesRoutes } from './fixtures';

jest.setTimeout(30_000);

const alertaRamal = {
  id: '99144',
  linea: 'sarmiento' as const,
  ramalId: '1',
  sentido: '1' as const,
  titulo: 'Hasta el 6/11 el último tren Once - Moreno partirá a las 23:02 h por obras.',
  descripcion: 'Hasta el 6/11 el último tren Once - Moreno partirá a las 23:02 h por obras.',
  hasta: '2026-11-06T04:13:00.000Z',
};
const alertaLinea = {
  id: '98462',
  linea: 'sarmiento' as const,
  titulo: 'Las personas con CUD pueden viajar en tren sin costo con SUBE.',
  descripcion:
    'Las personas con CUD pueden viajar en tren sin costo con SUBE. Para acceder al beneficio, deben asociar el CUD a su SUBE.',
};

describe('Línea de tren', () => {
  it('banda con el estado, alertas de la línea y placa de ramales (sin estrella)', async () => {
    await renderTrenes('/trenes/sarmiento', {
      ...trenesRoutes(),
      '/v1/trenes/estado': () =>
        jsonResponse(
          estadoTrenes({
            sarmiento: {
              estado: 'demorada',
              resumen: 'Demoras en Once – Bragado.',
              ramales: [
                { ramalId: '1', nombre: 'Once-Moreno', estado: 'normal', alertaIds: [] },
                { ramalId: '111', nombre: 'Once-Bragado', estado: 'demorada', alertaIds: [] },
              ],
            },
          }),
        ),
      '/v1/trenes/alertas': () => jsonResponse(alertasTrenes([alertaLinea, alertaRamal])),
    });
    expect(await screen.findByText('Línea Sarmiento · 2 ramales')).toBeOnTheScreen();
    expect(screen.getByTestId('linea-banda')).toHaveTextContent(/Con demoras/);
    // Solo la alerta general de la línea; la del ramal se ve en el ramal.
    expect(await screen.findByTestId('alerta-98462')).toBeOnTheScreen();
    expect(screen.queryByTestId('alerta-99144')).toBeNull();
    expect(screen.getByTestId('ramal-111-estado')).toHaveTextContent('Con demoras');
    expect(screen.getByTestId('ramal-1-estado')).toHaveTextContent('Normal');
    // Se guarda el ramal o la estación, nunca la línea.
    expect(screen.queryByRole('button', { name: /en favoritos$/ })).toBeNull();
    await userEvent.setup().press(screen.getByTestId('ramal-111'));
    expect(screen).toHavePathname('/trenes/ramal/111');
  });

  it('línea desconocida', async () => {
    await renderTrenes('/trenes/urquiza');
    expect(await screen.findByText('No encontramos esta línea')).toBeOnTheScreen();
  });
});

describe('Ramal', () => {
  it('banda, estrella que guarda el ramal, alertas con sentido y estaciones en orden', async () => {
    const harness = await renderTrenes('/trenes/ramal/111', {
      ...trenesRoutes(),
      '/v1/trenes/alertas': () => jsonResponse(alertasTrenes([alertaLinea, alertaRamal])),
    });
    expect(await screen.findByText('Once – Bragado · Línea Sarmiento')).toBeOnTheScreen();
    // Estaciones en orden de recorrido; Flores no opera en este ramal y no abre.
    const filas = await screen.findAllByTestId(/^estacion-\d+$/);
    expect(filas.map((f) => f.props.testID as string)).toEqual([
      'estacion-293',
      'estacion-50',
      'estacion-139',
      'estacion-400',
    ]);
    expect(screen.getByText('Sin servicio en este ramal')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Flores/ })).toBeNull();
    // La alerta de Once – Moreno no aparece acá; la de la línea sí.
    expect(await screen.findByTestId('alerta-98462')).toBeOnTheScreen();
    expect(screen.queryByTestId('alerta-99144')).toBeNull();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    expect(harness.repository.list()).toEqual([
      expect.objectContaining({
        tipo: 'ramal_tren',
        refId: '111',
        nombre: 'Once – Bragado',
        subtitulo: 'Línea Sarmiento',
      }),
    ]);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Caballito' }));
    expect(screen).toHavePathname('/trenes/estacion/50');
  });

  it('las alertas de un sentido dicen hacia dónde (S39)', async () => {
    await renderTrenes('/trenes/ramal/1', {
      ...trenesRoutes(),
      '/v1/trenes/alertas': () => jsonResponse(alertasTrenes([alertaRamal])),
    });
    expect(
      await screen.findByText(
        'Hacia Moreno: Hasta el 6/11 el último tren Once - Moreno partirá a las 23:02 h por obras.',
      ),
    ).toBeOnTheScreen();
  });

  it('ramal sin estado en la respuesta: «Sin información», no «Normal»', async () => {
    await renderTrenes('/trenes/ramal/1', {
      ...trenesRoutes(),
      '/v1/trenes/estado': () => jsonResponse(estadoTrenes({ sarmiento: { ramales: [] } })),
    });
    expect(await screen.findByTestId('ramal-banda')).toHaveTextContent(/Sin información/);
  });
});

describe('Estación de tren', () => {
  it('una banda por destino (máximo 2), el resto en la placa, y el cancelado no es el próximo', async () => {
    const harness = await renderTrenes('/trenes/estacion/50', {
      ...trenesRoutes(),
      '/v1/trenes/estaciones/50/arribos': () =>
        jsonResponse(
          arribosTren('50', [
            {
              ramalId: '1',
              ramal: 'Once-Moreno',
              destino: 'Once',
              sentido: '2',
              enSegundos: 240,
              anden: '2',
              cancelado: false,
              demora: 180,
            },
            {
              ramalId: '1',
              ramal: 'Once-Moreno',
              destino: 'Moreno',
              sentido: '1',
              enSegundos: 100,
              anden: '1',
              cancelado: true,
            },
            {
              ramalId: '1',
              ramal: 'Once-Moreno',
              destino: 'Moreno',
              sentido: '1',
              enSegundos: 420,
              anden: '1',
              cancelado: false,
            },
            {
              ramalId: '1',
              ramal: 'Once-Moreno',
              destino: 'Moreno',
              sentido: '1',
              enSegundos: 720,
              anden: '1',
              cancelado: false,
            },
            {
              ramalId: '1',
              ramal: 'Once-Moreno',
              destino: 'Moreno',
              sentido: '1',
              enSegundos: 1020,
              anden: '1',
              cancelado: false,
            },
            {
              ramalId: '111',
              ramal: 'Once-Bragado',
              destino: 'Bragado',
              sentido: '1',
              enSegundos: 1500,
              cancelado: true,
            },
          ]),
        ),
    });
    // Moreno va primero (su primer tren, aunque cancelado, es el más próximo).
    const moreno = await screen.findByTestId('destino-Moreno');
    expect(moreno).toHaveTextContent(/Hacia Moreno/);
    expect(moreno).toHaveTextContent(/Próximo/);
    expect(moreno).toHaveTextContent(/7 min/);
    expect(moreno).toHaveTextContent(/Andén 1 · Ramal Once – Moreno/);
    expect(moreno).toHaveTextContent(/Después 12 y 17 min/);
    expect(moreno).toHaveTextContent(/1 cancelado/);
    // Once: 4 min con 3 min de demora → la hora programada al lado (S38).
    const once = screen.getByTestId('destino-Once');
    expect(once).toHaveTextContent(/4 min/);
    expect(once).toHaveTextContent(/Programado \d\d:\d\d/);
    // Tercer destino: a la placa, y como solo tiene un cancelado dice «Cancelado».
    expect(screen.getByTestId('otros-destinos')).toBeOnTheScreen();
    expect(screen.getByTestId('destino-Bragado')).toHaveTextContent(/Cancelado/);
    // Insignia de la línea y estrella que guarda la estación con sus líneas.
    expect(screen.getByTestId('estacion-contexto-sarmiento')).toHaveTextContent(/Línea Sarmiento/);
    expect(screen.getByLabelText(/Hacia Moreno: próximo en 7 minutos/)).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    expect(harness.repository.list()).toEqual([
      expect.objectContaining({
        tipo: 'estacion_tren',
        refId: '50',
        nombre: 'Caballito',
        subtitulo: 'Línea Sarmiento',
      }),
    ]);
  });

  it('sin arribos: lo dice', async () => {
    await renderTrenes('/trenes/estacion/278', {
      ...trenesRoutes(),
      '/v1/trenes/estaciones/278/arribos': () => jsonResponse(arribosTren('278', [])),
    });
    expect(
      await screen.findByText('No hay próximos trenes informados para esta estación.'),
    ).toBeOnTheScreen();
  });

  it('dato de más de 10 min: los tiempos se reemplazan por la antigüedad (S30)', async () => {
    await renderTrenes('/trenes/estacion/50', {
      ...trenesRoutes(),
      '/v1/trenes/estaciones/50/arribos': () =>
        jsonResponse(
          arribosTren(
            '50',
            [
              {
                ramalId: '1',
                ramal: 'Once-Moreno',
                destino: 'Once',
                sentido: '2',
                enSegundos: 240,
                cancelado: false,
              },
            ],
            { sourceTimestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(), stale: true },
          ),
        ),
    });
    const once = await screen.findByTestId('destino-Once');
    expect(once).toHaveTextContent(/Dato de hace 12 min/);
    expect(once).not.toHaveTextContent(/4 min/);
  });

  it('503 de la fuente: ErrorState con el copy de trenes y reintento', async () => {
    let falla = true;
    await renderTrenes('/trenes/estacion/50', {
      ...trenesRoutes(),
      '/v1/trenes/estaciones/50/arribos': () =>
        falla
          ? jsonResponse(errorBody('upstream_unavailable'), 503)
          : jsonResponse(arribosTren('50', [])),
    });
    expect(
      await screen.findByText('El servicio de trenes no responde en este momento.'),
    ).toBeOnTheScreen();
    falla = false;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(
      await screen.findByText('No hay próximos trenes informados para esta estación.'),
    ).toBeOnTheScreen();
  });

  it('ramal interrumpido: aviso rojo arriba de los arribos', async () => {
    await renderTrenes('/trenes/estacion/278', {
      ...trenesRoutes(),
      '/v1/trenes/estado': () =>
        jsonResponse(
          estadoTrenes({
            sarmiento: {
              estado: 'interrumpida',
              ramales: [
                { ramalId: '1', nombre: 'Once-Moreno', estado: 'interrumpida', alertaIds: [] },
              ],
            },
          }),
        ),
      '/v1/trenes/estaciones/278/arribos': () => jsonResponse(arribosTren('278', [])),
    });
    expect(
      await screen.findByText('Hay un ramal interrumpido en esta estación.'),
    ).toBeOnTheScreen();
  });

  it('estación desconocida', async () => {
    await renderTrenes('/trenes/estacion/999999', {
      ...trenesRoutes(),
      '/v1/trenes/estaciones/999999/arribos': () => jsonResponse(arribosTren('999999', [])),
    });
    expect(await screen.findByText('No encontramos esta estación')).toBeOnTheScreen();
  });
});
