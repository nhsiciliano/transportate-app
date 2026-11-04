// Detalle de línea de colectivos (tarea 4.6) con el router, los providers reales, `fetch` mockeado,
// el descargador falso de archivos grandes y los mocks de MapLibre y expo-location (test/mocks).
import { fireEvent, waitFor } from '@testing-library/react-native';
import { screen } from 'expo-router/testing-library';
import * as Location from 'expo-location';

import {
  FEED_VIEJO_S,
  POSICIONES_NO_DISPONIBLES,
  POSICIONES_VIEJAS,
  SIN_VEHICULOS,
} from '@/features/colectivos/lineaModel';
import { LAYER, SOURCE } from '@/features/colectivos/MapaLinea';
import { PARADA_ZOOM } from '@/features/colectivos/LineaScreen';

import { locationMock } from '../mocks/expo-location';
import { mapLibreMock } from '../mocks/maplibre';
import { errorBody, isoAgo, jsonResponse } from '../subtes/fixtures';
import { lineaRoutes, posicionesDe, renderLinea, RUTA_601, RUTA_602 } from './lineaFixtures';

// Router, providers reales y descarga del índice: con la máquina cargada pasan los 5 s.
jest.setTimeout(30_000);

type Props = Record<string, unknown>;
const props = (testID: string): Props => screen.getByTestId(testID).props as Props;
const source = (id: string) => screen.getByTestId(`maplibre-GeoJSONSource-${id}`);

interface VehiculosData {
  data: { features: { properties: { id: string; atenuado: boolean; seleccionado: boolean } }[] };
}
const vehiculosData = () => (source(SOURCE.vehiculos).props as VehiculosData).data.features;

/** Toque en un `GeoJSONSource` del mock con las `properties` de las features tocadas. */
function pressEvent(...properties: Record<string, unknown>[]) {
  return {
    nativeEvent: {
      lngLat: [-58.38, -34.6],
      point: [100, 100],
      features: properties.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-58.39, -34.6] },
        properties: p,
      })),
    },
  };
}

describe('Detalle de línea: datos', () => {
  it('dibuja recorrido, paradas y vehículos, con el encabezado de la línea', async () => {
    await renderLinea();
    expect(await screen.findByLabelText(/2 colectivos en servicio/)).toBeOnTheScreen();
    // La banda fija del panel: línea y ramal, rótulo, conteo monumental y antigüedad del dato.
    const banda = screen.getByTestId('linea-banda');
    expect(banda).toHaveTextContent(/Línea 60 · Ramal A/);
    expect(banda).toHaveTextContent(/En servicio/);
    expect(banda).toHaveTextContent(/2.*hace \d+ s/);
    // El chip del ramal elegido sigue en el cuerpo del panel.
    expect(screen.getAllByText('Ramal A · a Constitución')).toHaveLength(1);

    await waitFor(() => {
      expect(source(SOURCE.recorrido)).toBeOnTheScreen();
    });
    expect(source(SOURCE.paradas)).toBeOnTheScreen();
    expect(props(`maplibre-Layer-${LAYER.recorrido}`)).toMatchObject({
      paint: { 'line-dasharray': [2, 1] },
    });
    expect(props(`maplibre-Layer-${LAYER.numero}`)).toMatchObject({
      layout: { 'text-field': ['get', 'etiqueta'] },
    });
    // Rumbo: la flecha se filtra a los vehículos que lo traen.
    expect(props(`maplibre-Layer-${LAYER.rumbo}`)).toMatchObject({
      layout: { 'text-rotate': ['coalesce', ['get', 'rumbo'], 0] },
    });
    expect(vehiculosData().map((f) => f.properties.id)).toEqual(['1404', '1410']);
    expect(source(SOURCE.vehiculos).props).toMatchObject({ cluster: false });

    // Lista accesible en el panel.
    expect(
      screen.getByRole('button', { name: 'Interno 1404, actualizado hace 25 segundos' }),
    ).toBeOnTheScreen();
    // La cámara se encuadra una vez en el recorrido.
    await waitFor(() => {
      expect(mapLibreMock.camera.fitBounds).toHaveBeenCalled();
    });
  });

  it('el polling pide solo la línea abierta (S10)', async () => {
    const { fetchMock } = await renderLinea();
    await screen.findByLabelText(/2 colectivos en servicio/);
    const urls = fetchMock.mock.calls.map(([url]) => new URL(url).pathname);
    expect(urls).toContain(RUTA_601);
    expect(urls).not.toContain(RUTA_602);
  });

  it('0 vehículos es un vacío real: mensaje y frescura', async () => {
    await renderLinea(
      '/colectivos/601',
      lineaRoutes({ [RUTA_601]: () => jsonResponse(posicionesDe('601', [])) }),
    );
    // El vacío lo dice la banda («Sin colectivos con GPS ahora»), sin repetirlo abajo.
    const banda = await screen.findByTestId('linea-banda');
    expect(banda).toHaveTextContent(/Sin colectivos con GPS ahora/);
    expect(banda.props).toMatchObject({
      accessibilityLabel: expect.stringContaining(SIN_VEHICULOS) as string,
    });
    expect(screen.getByText(/Actualizado hace/)).toBeOnTheScreen();
  });

  it('con más de 80 vehículos los agrupa', async () => {
    const muchos = Array.from({ length: 81 }, (_, i) => ({ id: String(3000 + i) }));
    await renderLinea(
      '/colectivos/601',
      lineaRoutes({ [RUTA_601]: () => jsonResponse(posicionesDe('601', muchos)) }),
    );
    await screen.findByLabelText(/81 colectivos en servicio/);
    expect(source(SOURCE.vehiculos).props).toMatchObject({ cluster: true });
  });
});

describe('Detalle de línea: frescura y errores', () => {
  it('un vehículo con más de 5 min se atenúa solo (S31)', async () => {
    await renderLinea(
      '/colectivos/601',
      lineaRoutes({
        [RUTA_601]: () =>
          jsonResponse(
            posicionesDe('601', [
              { id: '1404', edad: 30 },
              { id: '1499', edad: 6 * 60 },
            ]),
          ),
      }),
    );
    await screen.findByLabelText(/2 colectivos en servicio/);
    expect(vehiculosData().map((f) => [f.properties.id, f.properties.atenuado])).toEqual([
      ['1404', false],
      ['1499', true],
    ]);
    expect(screen.queryByText(POSICIONES_VIEJAS)).toBeNull();
    // Sin aviso, el estado de la banda es la antigüedad del dato más viejo.
    expect(screen.getByTestId('linea-banda')).toHaveTextContent(/hace 6 min/);
  });

  it('feed de más de 10 min: todos atenuados y aviso', async () => {
    await renderLinea(
      '/colectivos/601',
      lineaRoutes({
        [RUTA_601]: () =>
          jsonResponse(
            posicionesDe('601', [{ id: '1404', edad: 30 }], {
              sourceTimestamp: isoAgo(FEED_VIEJO_S + 60),
            }),
          ),
      }),
    );
    // El aviso vive en la banda como estado de advertencia, con su cuadrado ámbar y el texto.
    expect(await screen.findByText(POSICIONES_VIEJAS)).toBeOnTheScreen();
    expect(screen.getByTestId('linea-banda')).toHaveTextContent(new RegExp(POSICIONES_VIEJAS));
    expect(screen.getByTestId('signband-estado-cuadrado')).toBeOnTheScreen();
    expect(vehiculosData().every((f) => f.properties.atenuado)).toBe(true);
  });

  it('sin datos y con falla: mapa sin marcadores, ErrorState y reintento', async () => {
    let falla = true;
    await renderLinea(
      '/colectivos/601',
      lineaRoutes({
        [RUTA_601]: () =>
          falla
            ? jsonResponse(errorBody('upstream_unavailable'), 503)
            : jsonResponse(posicionesDe('601', [{ id: '1404' }])),
      }),
    );
    expect(await screen.findByText('Servicio no disponible')).toBeOnTheScreen();
    expect(vehiculosData()).toHaveLength(0);
    falla = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(await screen.findByLabelText(/1 colectivo en servicio/)).toBeOnTheScreen();
  });

  it('feed no disponible (sin reintento): lo dice y no ofrece reintentar', async () => {
    await renderLinea(
      '/colectivos/601',
      lineaRoutes({ [RUTA_601]: () => jsonResponse(errorBody('not_found'), 404) }),
    );
    expect(await screen.findByText(POSICIONES_NO_DISPONIBLES)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Volver a intentar' })).toBeNull();
  });
});

describe('Detalle de línea: interacción', () => {
  it('tocar un vehículo en el mapa lo resalta y "Seguir" mueve la cámara con él', async () => {
    await renderLinea();
    await screen.findByLabelText(/2 colectivos en servicio/);
    await fireEvent.press(source(SOURCE.vehiculos), pressEvent({ id: '1410' }));

    // La banda se vuelve a señalizar con el vehículo elegido.
    await screen.findByTestId('linea-seleccionado');
    const banda = screen.getByTestId('linea-banda');
    expect(banda).toHaveTextContent(/Interno 1410/);
    expect(banda).toHaveTextContent(/Actualizado/);
    expect(banda).toHaveTextContent(/hace 50 s/);
    expect(vehiculosData().find((f) => f.properties.id === '1410')?.properties.seleccionado).toBe(
      true,
    );
    mapLibreMock.camera.easeTo.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: 'Seguir' }));
    await waitFor(() => {
      expect(mapLibreMock.camera.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [expect.closeTo(-58.391, 6), expect.closeTo(-34.599, 6)],
        }),
      );
    });
    expect(screen.getByRole('button', { name: 'Dejar de seguir' })).toBeOnTheScreen();
  });

  it('elegir un vehículo de la lista lo muestra en el mapa', async () => {
    await renderLinea();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Interno 1404, actualizado hace 25 segundos' }),
    );
    expect(screen.getByTestId('linea-seleccionado')).toBeOnTheScreen();
    expect(screen.getByTestId('linea-banda')).toHaveTextContent(/Interno 1404/);
    // La fila elegida lo dice al lector; la lista selecciona, no navega: ninguna fila lleva flecha.
    expect(
      screen.getByRole('button', {
        name: 'Interno 1404, actualizado hace 25 segundos, Seleccionado',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('linea-vehiculo-1404-flecha')).toBeNull();
    expect(screen.queryByTestId('linea-vehiculo-1410-flecha')).toBeNull();
    // «Cerrar» devuelve la banda al conteo.
    await fireEvent.press(screen.getByRole('button', { name: 'Dejar de mostrar Interno 1404' }));
    expect(screen.queryByTestId('linea-seleccionado')).toBeNull();
    expect(screen.getByTestId('linea-banda')).toHaveTextContent(/En servicio/);
  });

  it('tocar un grupo acerca la cámara', async () => {
    await renderLinea();
    await screen.findByLabelText(/2 colectivos en servicio/);
    await fireEvent.press(
      source(SOURCE.vehiculos),
      pressEvent({ cluster: true, point_count: 12, cluster_id: 1 }),
    );
    expect(mapLibreMock.camera.flyTo).toHaveBeenCalled();
  });

  it('cambiar de ramal pide las posiciones del otro', async () => {
    const { fetchMock } = await renderLinea();
    await screen.findByLabelText(/2 colectivos en servicio/);
    await fireEvent.press(await screen.findByTestId('linea-ramal-602'));
    expect(await screen.findByLabelText(/1 colectivo en servicio/)).toBeOnTheScreen();
    expect(fetchMock.mock.calls.map(([url]) => new URL(url).pathname)).toContain(RUTA_602);
  });

  it('abierta desde una parada, centra la cámara en ella', async () => {
    await renderLinea('/colectivos/601?parada=p-corrientes');
    await waitFor(() => {
      expect(mapLibreMock.camera.flyTo).toHaveBeenCalledWith(
        expect.objectContaining({ center: [-58.3804, -34.6035], zoom: PARADA_ZOOM }),
      );
    });
  });

  it('"Centrar en mí" pide el permiso en contexto y, con permiso, suma la distancia', async () => {
    await renderLinea();
    await screen.findByLabelText(/2 colectivos en servicio/);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Centrar en mi ubicación' }));
    await waitFor(() => {
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });
    expect(
      await screen.findByRole('button', { name: /Interno 1404, actualizado hace .*, a .* de vos/ }),
    ).toBeOnTheScreen();
  });

  it('con permiso de ubicación, el colectivo más cercano va primero en la lista', async () => {
    locationMock.setPermission('granted');
    // Al lado del interno 1410 (el fixture lo ubica un paso al noroeste del 1404).
    locationMock.setPosition({ latitude: -34.599, longitude: -58.391 });
    await renderLinea();
    await screen.findByRole('button', { name: /Interno 1410, actualizado hace .*, a .* de vos/ });
    const ids = screen
      .getAllByTestId(/^linea-vehiculo-/)
      .map((el) => (el.props as { testID: string }).testID);
    expect(ids).toEqual(['linea-vehiculo-1410', 'linea-vehiculo-1404']);
  });

  it('"Actualizar" vuelve a pedir las posiciones', async () => {
    const { fetchMock } = await renderLinea();
    await screen.findByLabelText(/2 colectivos en servicio/);
    const antes = fetchMock.mock.calls.filter(([u]) => new URL(u).pathname === RUTA_601).length;
    await fireEvent.press(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([u]) => new URL(u).pathname === RUTA_601).length,
      ).toBeGreaterThan(antes);
    });
  });

  it('el panel tiene un botón que lo sube y lo baja', async () => {
    await renderLinea();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver más' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver la lista completa' }));
    expect(screen.getByRole('button', { name: 'Ver menos', expanded: true })).toBeOnTheScreen();
  });
});

beforeEach(() => {
  locationMock.setRequestAnswer('granted');
});
