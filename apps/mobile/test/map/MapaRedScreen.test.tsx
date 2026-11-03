// Mapa de la red de subte (4.3) con el cliente del proxy mockeado: carga, datos (fuentes y
// capas), navegación al tocar, error con reintento, sin conexión, vacío y tema oscuro.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import {
  LAYER,
  MAPA_RED_LABEL,
  MapaRedScreen,
  SOURCE_ESTACIONES,
  SOURCE_LINEAS,
} from '@/features/subtes/MapaRedScreen';
import { queryKeys } from '@/shared/api';
import { MAP_STYLE_URLS, staticFileKey } from '@/shared/map';
import { dark, light } from '@/shared/theme';

import { errorBody, jsonResponse, manifest } from '../api/fixtures';
import { subteEstaciones, subteRed } from './fixtures';
import { okResponder, renderMap, type Responder } from './harness';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  mockPush.mockClear();
});

const source = (id: string) => screen.getByTestId(`maplibre-GeoJSONSource-${id}`);
/** Props de una capa del mock (las mismas que recibió `Layer`). */
const layer = (id: string): Record<string, unknown> =>
  screen.getByTestId(`maplibre-Layer-${id}`).props as Record<string, unknown>;

/** Evento de toque de un `GeoJSONSource` con las `properties` de las features tocadas. */
function pressEvent(...properties: Record<string, string>[]) {
  return {
    nativeEvent: {
      lngLat: [-58.38, -34.6],
      point: [100, 100],
      features: properties.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-58.38, -34.6] },
        properties: p,
      })),
    },
  };
}

describe('MapaRedScreen', () => {
  it('mientras baja el GeoJSON muestra el skeleton (no un spinner)', async () => {
    const never: Responder = () => new Promise<Response>(() => undefined);
    await renderMap(<MapaRedScreen />, { fetch: never });
    expect(screen.getByTestId('mapa-red-cargando')).toBeOnTheScreen();
    expect(screen.getByLabelText('Cargando el mapa de la red…')).toBeOnTheScreen();
    expect(screen.queryByTestId('mapa-red-map')).toBeNull();
  });

  it('con datos dibuja trazos con color GTFS, contorno, letra y estaciones', async () => {
    const { fetchMock } = await renderMap(<MapaRedScreen />);
    const map = await screen.findByTestId('mapa-red-map');
    expect(map.props.accessibilityLabel).toBe(MAPA_RED_LABEL);
    expect(map.props.mapStyle).toBe(MAP_STYLE_URLS.light);

    const lineas = source(SOURCE_LINEAS).props as { data: { features: unknown[] } };
    expect(lineas.data.features).toHaveLength(2);
    expect(layer(LAYER.trazo)).toMatchObject({ paint: { 'line-color': ['get', 'color'] } });
    expect(layer(LAYER.contorno)).toMatchObject({ paint: { 'line-color': light.text.primary } });
    expect(layer(LAYER.letra)).toMatchObject({ layout: { 'text-field': ['get', 'linea'] } });

    const estaciones = source(SOURCE_ESTACIONES).props as {
      data: { features: { properties: { id: string; nombre: string } }[] };
    };
    expect(estaciones.data.features.map((f) => f.properties)).toEqual([
      { id: '1078', nombre: 'Plaza de Mayo' },
      { id: '1090', nombre: 'Leandro N. Alem' },
    ]);
    expect(layer(LAYER.nombre)).toMatchObject({ minzoom: 14 });

    // Cámara inicial: la extensión de la red del fixture.
    expect(screen.getByTestId('maplibre-Camera').props).toMatchObject({
      initialViewState: { bounds: [-58.4635, -34.6295, -58.3708, -34.5776] },
    });
    // Manifiesto → `<version>/<archivo>` (versión `abc123` del fixture).
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://proxy.test/v1/static/abc123/subte-red.geojson',
        'https://proxy.test/v1/static/abc123/subte-estaciones.json',
      ]),
    );
  });

  it('tocar una estación abre su detalle', async () => {
    await renderMap(<MapaRedScreen />);
    await screen.findByTestId('mapa-red-map');
    await fireEvent.press(source(SOURCE_ESTACIONES), pressEvent({ id: '1078' }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/subtes/estacion/[id]',
        params: { id: '1078' },
      });
    });
  });

  it('tocar un trazo abre la línea', async () => {
    await renderMap(<MapaRedScreen />);
    await screen.findByTestId('mapa-red-map');
    await fireEvent.press(source(SOURCE_LINEAS), pressEvent({ linea: 'B' }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/subtes/[linea]',
        params: { linea: 'B' },
      });
    });
  });

  it('si el toque cae sobre una estación y su línea, navega una sola vez a la estación', async () => {
    await renderMap(<MapaRedScreen />);
    await screen.findByTestId('mapa-red-map');
    await fireEvent.press(source(SOURCE_LINEAS), pressEvent({ linea: 'A' }));
    await fireEvent.press(source(SOURCE_ESTACIONES), pressEvent({ id: '1078' }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/subtes/estacion/[id]',
      params: { id: '1078' },
    });
  });

  it('si falla sin datos muestra ErrorState y "Volver a intentar" recupera el mapa', async () => {
    let failing = true;
    const responder: Responder = (url) => {
      if (failing && url.endsWith('/subte-red.geojson')) {
        return jsonResponse(errorBody('upstream_unavailable'), { status: 503 });
      }
      return okResponder(url);
    };
    await renderMap(<MapaRedScreen />, { fetch: responder });
    expect(await screen.findByText('Servicio no disponible')).toBeOnTheScreen();
    failing = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(await screen.findByTestId('mapa-red-map')).toBeOnTheScreen();
  });

  it('un GeoJSON fuera de contrato no se dibuja: error sin reintento', async () => {
    const responder: Responder = (url) =>
      url.endsWith('/subte-red.geojson')
        ? jsonResponse({ type: 'FeatureCollection', features: [{ type: 'Feature' }] })
        : okResponder(url);
    await renderMap(<MapaRedScreen />, { fetch: responder });
    expect(await screen.findByText('Algo falló de nuestro lado.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Volver a intentar' })).toBeNull();
    expect(screen.queryByTestId('mapa-red-map')).toBeNull();
  });

  it('sin conexión y sin nada guardado avisa en vez de quedarse cargando', async () => {
    await renderMap(<MapaRedScreen />, { online: false });
    expect(await screen.findByTestId('mapa-red-offline')).toBeOnTheScreen();
    expect(screen.getByText('Sin conexión')).toBeOnTheScreen();
  });

  it('sin conexión con el estático guardado dibuja el mapa sin pedir nada a la red', async () => {
    const result = <T,>(data: T) => ({ data, stale: false, fromCache: false, receivedAt: 0 });
    const { fetchMock } = await renderMap(<MapaRedScreen />, {
      online: false,
      seed: (client) => {
        client.setQueryData(queryKeys.static.manifest(), result(manifest));
        client.setQueryData(staticFileKey('abc123', 'subte-red.geojson'), result(subteRed));
        client.setQueryData(
          staticFileKey('abc123', 'subte-estaciones.json'),
          result(subteEstaciones),
        );
      },
    });
    expect(await screen.findByTestId('mapa-red-map')).toBeOnTheScreen();
    expect(source(SOURCE_LINEAS)).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('una red vacía muestra EmptyState y no un mapa en blanco', async () => {
    const responder: Responder = (url) =>
      url.endsWith('/subte-red.geojson')
        ? jsonResponse({ type: 'FeatureCollection', features: [] })
        : okResponder(url);
    await renderMap(<MapaRedScreen />, { fetch: responder });
    expect(await screen.findByTestId('mapa-red-vacio')).toBeOnTheScreen();
  });

  it('con tema oscuro usa el estilo oscuro y el contorno claro', async () => {
    await renderMap(<MapaRedScreen />, { theme: 'dark' });
    const map = await screen.findByTestId('mapa-red-map');
    expect(map.props.mapStyle).toBe(MAP_STYLE_URLS.dark);
    expect(layer(LAYER.contorno)).toMatchObject({ paint: { 'line-color': dark.text.primary } });
    expect(layer(LAYER.estacion)).toMatchObject({ paint: { 'circle-color': dark.bg.base } });
  });
});
