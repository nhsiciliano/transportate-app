// Dato vivo por tipo de favorito: datos, carga, error y dato viejo. Reutiliza las queries de
// cada feature (misma query key) con el cliente mockeado del harness de Subtes.
import { render, renderHook, screen, waitFor } from '@testing-library/react-native';

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
import { FavoritoLiveData, SIN_ARRIBOS, SIN_INFORMACION, useFavoritoLiveData } from '..';
import type { FavoritoV1 } from '../model';

jest.setTimeout(30_000);

type Fav = Pick<FavoritoV1, 'tipo' | 'refId' | 'subtitulo'>;

async function live(favorito: Fav, routes: Routes = defaultRoutes(), enabled = true) {
  const h = createHarness(routes);
  const hook = await renderHook(() => useFavoritoLiveData(favorito, { enabled }), {
    wrapper: h.Wrapper,
  });
  return { ...hook, h };
}

describe('useFavoritoLiveData', () => {
  it('linea_subte: estado de la línea (Premetro, el más severo de los ramales)', async () => {
    const { result } = await live(
      { tipo: 'linea_subte', refId: 'PM' },
      {
        ...defaultRoutes(),
        '/v1/subtes/estado': () => jsonResponse(estado({ 'PM-S': { estado: 'demorada' } })),
      },
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ok');
    });
    expect(result.current.estado).toBe('demorada');
    expect(result.current.spoken).toBe('Estado: con demoras');
  });

  it('linea_subte: mientras no llega el estado, loading', async () => {
    // Respuesta que nunca llega: el estado de carga no depende del timing del mock.
    const { result } = await live(
      { tipo: 'linea_subte', refId: 'A' },
      { ...defaultRoutes(), '/v1/subtes/estado': () => undefined },
    );
    expect(result.current.status).toBe('loading');
  });

  it('linea_subte: dato viejo → atenuado con la antigüedad', async () => {
    const { result } = await live(
      { tipo: 'linea_subte', refId: 'A' },
      {
        ...defaultRoutes(),
        '/v1/subtes/estado': () => {
          const body = estado();
          body.meta.sourceTimestamp = isoAgo(6 * 60);
          return jsonResponse(body);
        },
      },
    );
    await waitFor(() => {
      expect(result.current.status).toBe('stale');
    });
    expect(result.current.tone).toBe('muted');
    expect(result.current.ageText).toBe('hace 6 min');
  });

  it('linea_subte: error → "Sin información"', async () => {
    const { result } = await live(
      { tipo: 'linea_subte', refId: 'A' },
      {
        ...defaultRoutes(),
        '/v1/subtes/estado': () => jsonResponse(errorBody('upstream_unavailable'), 503),
      },
    );
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.text).toBe(SIN_INFORMACION);
    expect(result.current.tone).toBe('muted');
  });

  it('estacion_subte: próximo arribo por sentido', async () => {
    const { result } = await live(
      { tipo: 'estacion_subte', refId: '2002' },
      {
        ...defaultRoutes(),
        '/v1/subtes/estaciones/2002/arribos': () =>
          jsonResponse(
            arribos('2002', [
              { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 420 },
              { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 120 },
              { linea: 'B', estacion: 'Medrano', destino: 'Juan Manuel de Rosas', enSegundos: 300 },
            ]),
          ),
      },
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ok');
    });
    expect(result.current.text).toBe('→ Leandro N. Alem 2 min · → Juan Manuel de Rosas 5 min');
    expect(result.current.spoken).toBe(
      'Hacia Leandro N. Alem en 2 minutos. Hacia Juan Manuel de Rosas en 5 minutos',
    );
  });

  it('estacion_subte: forecast congelado → "Sin arribos informados" y la antigüedad', async () => {
    const { result } = await live(
      { tipo: 'estacion_subte', refId: '2002' },
      {
        ...defaultRoutes(),
        '/v1/subtes/estaciones/2002/arribos': () =>
          jsonResponse(
            arribos(
              '2002',
              [{ linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 120 }],
              { stale: true, sourceTimestamp: isoAgo(8 * 24 * 3600) },
            ),
          ),
      },
    );
    await waitFor(() => {
      expect(result.current.status).toBe('stale');
    });
    expect(result.current.text).toBe(`${SIN_ARRIBOS} · hace 8 días`);
  });

  it('estacion_subte: sin habilitar no pide los arribos', async () => {
    const { result, h } = await live(
      { tipo: 'estacion_subte', refId: '2002' },
      defaultRoutes(),
      false,
    );
    await waitFor(() => {
      expect(h.fetchMock).toHaveBeenCalled();
    });
    const paths = h.fetchMock.mock.calls.map(([url]) => new URL(url).pathname);
    expect(paths).not.toContain('/v1/subtes/estaciones/2002/arribos');
    expect(result.current.status).toBe('loading');
  });

  it('linea_colectivo: vehículos en servicio', async () => {
    const { result } = await live(
      { tipo: 'linea_colectivo', refId: '1234' },
      {
        ...defaultRoutes(),
        '/v1/colectivos/lineas/1234/posiciones': () => jsonResponse(posiciones('1234', 3)),
      },
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ok');
    });
    expect(result.current.text).toBe('3 en servicio');
    expect(result.current.spoken).toBe('3 colectivos en servicio');
  });

  it('linea_colectivo: error → "Sin información"', async () => {
    const { result } = await live(
      { tipo: 'linea_colectivo', refId: '1234' },
      {
        ...defaultRoutes(),
        '/v1/colectivos/lineas/1234/posiciones': () =>
          jsonResponse(errorBody('upstream_unavailable'), 503),
      },
    );
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
  });

  it('parada_colectivo: el subtítulo guardado mientras carga el índice; después, sus líneas', async () => {
    const con = await live({
      tipo: 'parada_colectivo',
      refId: 'p-corrientes',
      subtitulo: 'Líneas viejas',
    });
    expect(con.result.current).toMatchObject({ status: 'static', text: 'Líneas viejas' });
    await waitFor(() => {
      expect(con.result.current.text).toBe('Líneas 10, 60, 152');
    });
    const sin = await live({ tipo: 'parada_colectivo', refId: 'p-corrientes' });
    expect(sin.result.current.status).toBe('none');
  });
});

describe('FavoritoLiveData', () => {
  it('muestra skeleton, después el chip de estado; oculto al lector', async () => {
    const h = createHarness(defaultRoutes());
    await render(
      <h.Wrapper>
        <FavoritoLiveData favorito={{ tipo: 'linea_subte', refId: 'B' }} testID="dato" />
      </h.Wrapper>,
    );
    expect(screen.getByTestId('dato', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(await screen.findByText('Normal', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText('Normal')).toBeNull();
  });

  it('texto atenuado con error', async () => {
    const h = createHarness({
      ...defaultRoutes(),
      '/v1/colectivos/lineas/1234/posiciones': () =>
        jsonResponse(errorBody('upstream_unavailable'), 503),
    });
    await render(
      <h.Wrapper>
        <FavoritoLiveData favorito={{ tipo: 'linea_colectivo', refId: '1234' }} />
      </h.Wrapper>,
    );
    expect(
      await screen.findByText(SIN_INFORMACION, { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });
});
