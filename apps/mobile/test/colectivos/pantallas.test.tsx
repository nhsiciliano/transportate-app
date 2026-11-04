// Raíz y detalle de parada de Colectivos con el router, los providers reales, `fetch` mockeado,
// descargador falso del índice y el mock de `expo-location` (test/mocks).
import { ArribosParadaResponseV1 } from '@transportate/contracts';
import { act, renderHook, userEvent, waitFor, within } from '@testing-library/react-native';
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
import { ARCHIVOS_TEXTO, OBELISCO, paradasArchivo } from './data';

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
    expect(screen.getByText('Activá la ubicación para ver paradas cerca tuyo')).toBeOnTheScreen();
    expect(
      screen.getByText('Solo se usa mientras la app está abierta y no sale de tu teléfono.'),
    ).toBeOnTheScreen();
    // El bloque va dentro de la placa «Paradas cercanas».
    expect(
      within(screen.getByTestId('cercanas')).getByTestId('permiso-ubicacion'),
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
    // Calle y altura en el título nativo; en el cuerpo, barrio y la placa «Líneas que paran».
    expect(await screen.findByRole('header', { name: 'Líneas que paran' })).toBeOnTheScreen();
    expect(screen.getByTestId('parada-barrio')).toHaveTextContent(/^San Nicolás$/);
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

    // Una fila por línea; sin arribos no hay tiempos a la derecha, y la flecha va porque abre algo.
    const fila = screen.getByRole('button', { name: 'Línea 60. Ramal A · a Constitución' });
    expect(fila).toHaveProp('accessibilityHint', 'Ver en el mapa');
    expect(screen.getByTestId('linea-parada-60-flecha')).toBeOnTheScreen();
    await user.press(fila);
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
    // El primero a 24 pt a la derecha de su fila y los siguientes (hasta 3) debajo, chicos.
    const l60 = await screen.findByTestId('linea-parada-60');
    expect(l60).toHaveProp(
      'accessibilityLabel',
      'Línea 60. Ramal A · a Constitución. Próximo en 2 minutos, después en 10 minutos y en 15 minutos',
    );
    expect(within(l60).getByText('2 min')).toBeOnTheScreen();
    expect(within(l60).getByText('10 min · 15 min')).toBeOnTheScreen();
    expect(within(l60).queryByText(/25 min/)).toBeNull();
    const l152 = screen.getByTestId('linea-parada-152');
    expect(l152).toHaveProp('accessibilityLabel', expect.stringContaining('Próximo en 5 minutos'));
    // Sin sección aparte de arribos: están en las filas. La frescura sí aparece.
    expect(screen.queryByText('Próximos arribos')).toBeNull();
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
    await screen.findByRole('header', { name: 'Líneas que paran' });
    await waitFor(() => {
      expect(h.fetchMock.mock.calls.some(([u]) => u.includes('/arribos'))).toBe(true);
    });
    // Sin tiempos en las filas ni frescura (N4).
    expect(within(screen.getByTestId('linea-parada-60')).queryByText(/min/)).toBeNull();
    expect(screen.queryByText(/Actualizado hace/)).toBeNull();
    expect(screen.queryByText('Servicio no disponible')).toBeNull();
  });

  it('una línea que no está en el listado: fila sin destino, sin flecha ni botón', async () => {
    await renderColectivos('/colectivos/parada/9002', {
      routes: {
        ...defaultRoutes(),
        '/v1/colectivos/paradas/9002/arribos': () => jsonResponse(arribosParada('9002', [])),
      },
    });
    // La parada 9002 nombra las líneas 1, 25 y 132, que no figuran en el listado de líneas.
    const fila = await screen.findByTestId('linea-parada-25');
    expect(fila).toBeOnTheScreen();
    expect(screen.queryByTestId('linea-parada-25-flecha')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Línea 25/ })).toBeNull();
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

describe('Colectivos (raíz): placas de tablero', () => {
  /** 12 paradas a menos de 1,5 km del Obelisco, cada una con 7 líneas (se resume). */
  function muchasParadas() {
    const base = paradasArchivo.paradas[0];
    if (base === undefined) throw new Error('fixture sin paradas');
    const paradas = Array.from({ length: 12 }, (_, i) => ({
      ...base,
      id: `m${String(i)}`,
      nombre: `Calle ${String(i)} 100`,
      lat: base.lat - i * 0.0006,
      lineas: [10, 60, 152, 168, 5, 7, 9].map((n) => ({
        linea: String(n),
        numero: n,
        sentido: 'ida' as const,
      })),
    }));
    return createFakeDownloader({
      ...ARCHIVOS_TEXTO,
      'paradas.json': JSON.stringify({ ...paradasArchivo, paradas }),
    }).downloader;
  }

  it('cercanas: pictograma, líneas que paran, distancia a la derecha y flecha; 10 y «Ver más»', async () => {
    locationMock.setPermission('granted');
    await renderColectivos('/colectivos', { downloader: muchasParadas() });
    const placa = await screen.findByTestId('cercanas');
    expect(await screen.findByTestId('parada-m0')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Paradas cercanas' })).toBeOnTheScreen();

    const fila = within(placa).getByTestId('parada-m0');
    expect(within(fila).getByText('Calle 0 100')).toBeOnTheScreen();
    // Más de 6 líneas: se nombran 3 y el resto se resume.
    expect(within(fila).getByText('5 · 7 · 9 y 4 más')).toBeOnTheScreen();
    expect(within(fila).getByText(/^a \d+ m$/)).toBeOnTheScreen();
    expect(within(placa).getByTestId('parada-m0-flecha')).toBeOnTheScreen();

    // Hasta 10 filas y la fila final «Ver más» (con flecha) que muestra el resto.
    expect(within(placa).getAllByTestId(/^parada-m\d+$/)).toHaveLength(10);
    const user = userEvent.setup();
    await user.press(within(placa).getByRole('button', { name: 'Ver más' }));
    expect(within(placa).getAllByTestId(/^parada-m\d+$/)).toHaveLength(12);
    expect(within(placa).queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('recientes: una placa con la insignia, «Línea 152» y el ramal; la flecha abre la línea', async () => {
    const kv = new MemoryKeyValueStore();
    createHarness(defaultRoutes(), { kv }).recientes.add({
      lineaId: '601',
      linea: '60 A',
      numero: '60',
      descripcion: 'Ramal A · a Constitución',
    });
    await renderColectivos('/colectivos', { kv });
    const fila = await screen.findByTestId('reciente-601');
    expect(screen.getByRole('header', { name: 'Recientes' })).toBeOnTheScreen();
    expect(within(fila).getByText('Línea 60')).toBeOnTheScreen();
    expect(within(fila).getByText('Ramal A · a Constitución')).toBeOnTheScreen();
    expect(screen.getByTestId('reciente-601-flecha')).toBeOnTheScreen();
  });

  it('tus favoritos: una banda `next` con flecha por favorito de colectivo; los de subte no', async () => {
    const kv = new MemoryKeyValueStore();
    const repo = new MmkvFavoritosRepository(kv);
    const linea = repo.add({
      tipo: 'linea_colectivo',
      refId: '601',
      nombre: 'Línea 60',
      subtitulo: 'Ramal A',
    });
    repo.add({ tipo: 'linea_subte', refId: 'B', nombre: 'Línea B' });
    await renderColectivos('/colectivos', { kv });
    const banda = await screen.findByTestId(`favorito-${linea.id}`);
    expect(screen.getByRole('header', { name: 'Tus favoritos' })).toBeOnTheScreen();
    expect(within(banda).getByText('Línea 60 · Ramal A')).toBeOnTheScreen();
    expect(screen.getByTestId(`favorito-${linea.id}-flecha`)).toBeOnTheScreen();
    expect(screen.queryByText(/Línea B/)).toBeNull();
    await userEvent.setup().press(banda);
    expect(screen).toHavePathname('/colectivos/601');
  });

  it('resultados: líneas y paradas son filas de una sola placa, y no queda la de cercanas', async () => {
    await renderColectivos();
    await screen.findByText('Paradas cercanas');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Buscá una línea o parada'), 'corrientes');
    const placa = await screen.findByTestId('resultados');
    const parada = within(placa).getByTestId('parada-p-corrientes');
    expect(within(parada).getByText('10 · 60 · 152')).toBeOnTheScreen();
    expect(within(placa).getByTestId('parada-p-corrientes-flecha')).toBeOnTheScreen();
    expect(screen.queryByTestId('cercanas')).toBeNull();

    await user.clear(screen.getByLabelText('Buscá una línea o parada'));
    await user.type(screen.getByLabelText('Buscá una línea o parada'), '60');
    const lineas = await screen.findByTestId('resultados');
    const fila = within(lineas).getByTestId('linea-601');
    expect(within(fila).getByText('Línea 60')).toBeOnTheScreen();
    expect(within(fila).getByText('Ramal A · a Constitución')).toBeOnTheScreen();
  });
});
