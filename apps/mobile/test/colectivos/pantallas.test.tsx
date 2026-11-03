// Raíz y detalle de parada de Colectivos con el router, los providers reales, `fetch` mockeado,
// descargador falso del índice y el mock de `expo-location` (test/mocks).
import { ArribosParadaResponseV1 } from '@transportate/contracts';
import { act, renderHook, userEvent, waitFor } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import ColectivosLayout from '@/app/(tabs)/colectivos/_layout';
import ColectivosRoute from '@/app/(tabs)/colectivos/index';
import ParadaRoute from '@/app/(tabs)/colectivos/parada/[id]';
import { HUERFANO, MmkvFavoritosRepository, useFavoritoLiveData } from '@/features/favoritos';
import { MemoryKeyValueStore } from '@/shared/storage/kv';

import { locationMock } from '../mocks/expo-location';
import {
  createFakeDownloader,
  createHarness,
  defaultRoutes,
  errorBody,
  jsonResponse,
  meta,
  type Routes,
} from '../subtes/fixtures';
import { OBELISCO } from './data';

jest.setTimeout(30_000);

function LineaFalsa() {
  return <Text>Detalle de línea</Text>;
}

async function renderColectivos(
  initialUrl = '/colectivos',
  {
    routes = defaultRoutes(),
    downloader,
    kv = new MemoryKeyValueStore(),
  }: {
    routes?: Routes;
    downloader?: ReturnType<typeof createFakeDownloader>['downloader'];
    kv?: MemoryKeyValueStore;
  } = {},
) {
  const harness = createHarness(routes, { kv, ...(downloader ? { downloader } : {}) });
  await renderRouter(
    {
      'colectivos/_layout': ColectivosLayout,
      'colectivos/index': ColectivosRoute,
      // El detalle de línea (mapa, tarea 4.6) es de otra tarea: acá alcanza con saber que se abre.
      'colectivos/[linea]': LineaFalsa,
      'colectivos/parada/[id]': ParadaRoute,
    },
    { initialUrl, wrapper: harness.Wrapper },
  );
  return harness;
}

function arribosParada(paradaId: string, lista: { linea: string; enSegundos: number }[]) {
  const now = Date.now();
  return ArribosParadaResponseV1.parse({
    meta: meta(),
    data: {
      paradaId,
      arribos: lista.map((a, i) => ({
        paradaId,
        lineaId: `l${a.linea}`,
        linea: a.linea,
        enSegundos: a.enSegundos,
        horaEstimada: new Date(now + a.enSegundos * 1000).toISOString(),
        viajeId: `v${String(i)}`,
      })),
    },
  });
}

describe('Colectivos (raíz): índice', () => {
  it('primer uso: "Preparando…" con barra de progreso y la búsqueda deshabilitada', async () => {
    const gate = new Promise<void>(() => undefined);
    await renderColectivos('/colectivos', {
      downloader: createFakeDownloader(undefined, { gate }).downloader,
    });
    expect(await screen.findByText('Preparando el listado de líneas y paradas…')).toBeOnTheScreen();
    const barra = await screen.findByTestId('indice-barra');
    // El descargador falso queda a mitad de camino (50 %).
    expect(barra).toHaveAccessibilityValue({ min: 0, max: 100, now: 50 });
    expect(screen.getByLabelText('Buscá una línea o parada')).toHaveProp('editable', false);
  });

  it('descarga fallida: ErrorState y reintento', async () => {
    let falla = true;
    const caido = createFakeDownloader(undefined, { fail: true }).downloader;
    const ok = createFakeDownloader().downloader;
    const downloader = {
      download: (v: string, a: string) => (falla ? caido : ok).download(v, a),
    };
    await renderColectivos('/colectivos', { downloader });
    expect(await screen.findByText('No pudimos descargar las líneas y paradas')).toBeOnTheScreen();
    falla = false;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(await screen.findByText('Paradas cercanas')).toBeOnTheScreen();
  });
});

describe('Colectivos (raíz): búsqueda', () => {
  it('líneas y paradas mezcladas; tocar una línea la guarda en recientes y la abre', async () => {
    const h = await renderColectivos();
    const user = userEvent.setup();
    await screen.findByText('Paradas cercanas');
    await user.type(screen.getByLabelText('Buscá una línea o parada'), '60');
    expect(screen.getByTestId('linea-601')).toBeOnTheScreen();
    expect(screen.getByTestId('linea-602')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Línea 60. Ramal A · a Constitución' }));
    expect(screen).toHavePathname('/colectivos/601');
    expect(h.recientes.list()[0]).toMatchObject({ lineaId: '601', numero: '60' });
  });

  it('paradas por calle, sin tildes', async () => {
    await renderColectivos();
    await screen.findByText('Paradas cercanas');
    await userEvent.setup().type(screen.getByLabelText('Buscá una línea o parada'), 'CORRIENTES');
    expect(
      screen.getByRole('button', { name: 'Parada Av. Corrientes 1000. Líneas 10, 60, 152' }),
    ).toBeOnTheScreen();
  });

  it('sin resultados', async () => {
    await renderColectivos();
    await screen.findByText('Paradas cercanas');
    await userEvent.setup().type(screen.getByLabelText('Buscá una línea o parada'), '608');
    expect(
      screen.getByText(
        'No encontramos «608». Probá con el número de línea o el nombre de una calle.',
      ),
    ).toBeOnTheScreen();
  });

  it('las recientes guardadas aparecen y se abren', async () => {
    const kv = new MemoryKeyValueStore();
    const h0 = createHarness(defaultRoutes(), { kv });
    h0.recientes.add({ lineaId: '1521', linea: '152', numero: '152', descripcion: 'a Olivos' });
    await renderColectivos('/colectivos', { kv });
    await userEvent.setup().press(await screen.findByTestId('reciente-1521'));
    expect(screen).toHavePathname('/colectivos/1521');
  });
});

describe('Colectivos (raíz): paradas cercanas', () => {
  it('sin permiso: bloque con "Activar"; al permitir, muestra las cercanas con distancia', async () => {
    await renderColectivos();
    expect(await screen.findByTestId('permiso-ubicacion')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono.',
      ),
    ).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Activar' }));
    expect(
      await screen.findByRole('button', { name: /^Parada Av\. Corrientes 1000\. a 1\d0 m\./ }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('parada-p-9dejulio')).toBeOnTheScreen();
    // Fuera del radio de 1,5 km.
    expect(screen.queryByTestId('parada-p-plazaitalia')).toBeNull();
  });

  it('con permiso concedido de antes: cercanas sin preguntar', async () => {
    locationMock.setPermission('granted');
    await renderColectivos();
    expect(await screen.findByTestId('parada-p-corrientes')).toBeOnTheScreen();
  });

  it('negado sin poder volver a preguntar: "Abrir configuración"', async () => {
    locationMock.setPermission('denied', { canAskAgain: false });
    await renderColectivos();
    expect(await screen.findByRole('button', { name: 'Abrir configuración' })).toBeOnTheScreen();
  });

  it('fuera de CABA', async () => {
    locationMock.setPermission('granted');
    locationMock.setPosition({ latitude: -34.9205, longitude: -57.9536 });
    await renderColectivos();
    expect(
      await screen.findByText(
        'No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires.',
      ),
    ).toBeOnTheScreen();
  });

  it('"Buscar a mano" enfoca la búsqueda', async () => {
    await renderColectivos();
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Buscar a mano' }));
    expect(screen.getByLabelText('Buscá una línea o parada')).toHaveProp('autoFocus', true);
    expect(OBELISCO.lat).toBeLessThan(0);
  });
});

describe('Parada', () => {
  it('información estática, favorito y líneas que llevan al mapa con ?parada', async () => {
    const h = await renderColectivos('/colectivos/parada/p-corrientes', {
      routes: {
        ...defaultRoutes(),
        '/v1/colectivos/paradas/p-corrientes/arribos': () =>
          jsonResponse(arribosParada('p-corrientes', [])),
      },
    });
    expect(await screen.findByRole('header', { name: 'Av. Corrientes 1000' })).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Guardar en favoritos' }));
    expect(h.repository.list()[0]).toMatchObject({
      tipo: 'parada_colectivo',
      refId: 'p-corrientes',
      nombre: 'Av. Corrientes 1000',
      subtitulo: 'Líneas 10, 60, 152',
    });
    // Arribos vacíos: la sección no existe.
    await waitFor(() => {
      expect(h.fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/v1/colectivos/paradas/p-corrientes/arribos'),
        expect.anything(),
      );
    });
    expect(screen.queryByText('Próximos arribos')).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Línea 60. Ver en el mapa' }));
    expect(screen).toHavePathname('/colectivos/601');
    // expo-router testing arrastra el `id` de la ruta anterior; lo que importa es `parada`.
    expect(screen).toHaveSearchParams({ id: 'p-corrientes', linea: '601', parada: 'p-corrientes' });
  });

  it('con arribos: sección por línea, hasta 3 tiempos, con frescura', async () => {
    await renderColectivos('/colectivos/parada/p-corrientes', {
      routes: {
        ...defaultRoutes(),
        '/v1/colectivos/paradas/p-corrientes/arribos': () =>
          jsonResponse(
            arribosParada('p-corrientes', [
              { linea: '60', enSegundos: 600 },
              { linea: '60', enSegundos: 120 },
              { linea: '60', enSegundos: 900 },
              { linea: '60', enSegundos: 1500 },
              { linea: '152', enSegundos: 300 },
            ]),
          ),
      },
    });
    expect(await screen.findByText('Próximos arribos')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Línea 60: en 2 minutos, en 10 minutos, en 15 minutos.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Línea 152: en 5 minutos.')).toBeOnTheScreen();
    expect(screen.getByText(/Actualizado hace/)).toBeOnTheScreen();
  });

  it('arribos con error y sin datos: sin sección', async () => {
    const h = await renderColectivos('/colectivos/parada/p-corrientes', {
      routes: {
        ...defaultRoutes(),
        '/v1/colectivos/paradas/p-corrientes/arribos': () =>
          jsonResponse(errorBody('upstream_unavailable'), 503),
      },
    });
    await screen.findByRole('header', { name: 'Av. Corrientes 1000' });
    await waitFor(() => {
      expect(h.fetchMock.mock.calls.some(([u]) => u.includes('/arribos'))).toBe(true);
    });
    expect(screen.queryByText('Próximos arribos')).toBeNull();
    expect(screen.queryByText('Servicio no disponible')).toBeNull();
  });

  it('parada inexistente', async () => {
    await renderColectivos('/colectivos/parada/no-existe');
    expect(await screen.findByText('No encontramos esta parada')).toBeOnTheScreen();
  });
});

describe('favorito de parada', () => {
  it('muestra las líneas del índice; si la parada ya no está, es huérfano', async () => {
    const h = createHarness(defaultRoutes());
    await act(() => h.largeFiles.ensure('paradas.json', 'v1abc'));
    const { result } = await renderHook(
      () => [
        useFavoritoLiveData({ tipo: 'parada_colectivo', refId: 'p-9dejulio', subtitulo: 'viejo' }),
        useFavoritoLiveData({ tipo: 'parada_colectivo', refId: 'p-borrada', subtitulo: 'Línea 5' }),
      ],
      { wrapper: h.Wrapper },
    );
    await waitFor(() => {
      expect(result.current[0]?.text).toBe('Líneas 10, EBUS');
    });
    expect(result.current[1]).toMatchObject({
      status: 'orphan',
      text: 'Esta parada ya no figura en los datos oficiales',
      tone: 'muted',
    });
    expect(HUERFANO).toBe('Ya no figura en los datos oficiales');
    expect(new MmkvFavoritosRepository(new MemoryKeyValueStore()).list()).toEqual([]);
  });
});
