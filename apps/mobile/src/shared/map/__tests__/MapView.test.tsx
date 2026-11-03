// MapView: estilo según el tema, atribución, controles, Reducir movimiento y ref de cámara.
// MapLibre y expo-location están mockeados (test/mocks/): ver src/shared/map/README.md, "Tests".
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { createRef } from 'react';
import { AccessibilityInfo } from 'react-native';

import { renderMap } from '../../../../test/map/harness';
import { locationMock } from '../../../../test/mocks/expo-location';
import { mapLibreMock } from '../../../../test/mocks/maplibre';
import {
  CABA_BOUNDS,
  CAMERA_ANIMATION_MS,
  MAP_ATTRIBUTION,
  MAP_STYLE_URLS,
  MapView,
  USER_ZOOM,
  type MapViewHandle,
} from '..';

const LABEL = 'Mapa de prueba';

/** Espera a que `useReduceMotion` y `useLocationGranted` resuelvan sus consultas. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('MapView', () => {
  it('usa positron en tema claro y la extensión de CABA por defecto', async () => {
    await renderMap(<MapView accessibilityLabel={LABEL} />);
    const map = screen.getByTestId('map-view-map');
    expect(map.props).toMatchObject({
      mapStyle: MAP_STYLE_URLS.light,
      attribution: false,
      logo: false,
      accessibilityLabel: LABEL,
    });
    expect(screen.getByTestId('maplibre-Camera').props.initialViewState).toMatchObject({
      bounds: CABA_BOUNDS,
    });
  });

  it('usa el estilo oscuro con tema oscuro y cambia al cambiar el tema', async () => {
    const { themeStore } = await renderMap(<MapView accessibilityLabel={LABEL} />, {
      theme: 'dark',
    });
    expect(screen.getByTestId('map-view-map').props.mapStyle).toBe(MAP_STYLE_URLS.dark);
    await act(async () => {
      themeStore.set('light');
      await Promise.resolve();
    });
    expect(screen.getByTestId('map-view-map').props.mapStyle).toBe(MAP_STYLE_URLS.light);
  });

  it('muestra siempre la atribución de OSM, OpenMapTiles y OpenFreeMap', async () => {
    await renderMap(<MapView accessibilityLabel={LABEL} />);
    expect(screen.getByTestId('map-view-attribution')).toHaveTextContent(MAP_ATTRIBUTION);
    expect(MAP_ATTRIBUTION).toBe('© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap');
  });

  it('acepta un centro inicial en lugar de una extensión', async () => {
    await renderMap(
      <MapView accessibilityLabel={LABEL} initialCenter={[-58.4, -34.6]} initialZoom={14} />,
    );
    expect(screen.getByTestId('maplibre-Camera').props.initialViewState).toEqual({
      center: [-58.4, -34.6],
      zoom: 14,
    });
  });

  it('reserva el borde izquierdo para el gesto de volver de iOS', async () => {
    await renderMap(<MapView accessibilityLabel={LABEL} />);
    expect(screen.getByTestId('map-view-edge-gutter')).toBeOnTheScreen();
  });

  describe('Norte arriba', () => {
    it('es un botón con etiqueta que endereza la cámara animando', async () => {
      await renderMap(<MapView accessibilityLabel={LABEL} />);
      await settle();
      await fireEvent.press(
        screen.getByRole('button', { name: 'Orientar el mapa con el norte arriba' }),
      );
      expect(mapLibreMock.camera.setStop).toHaveBeenCalledWith({
        bearing: 0,
        pitch: 0,
        duration: CAMERA_ANIMATION_MS,
      });
    });

    it('con Reducir movimiento la cámara salta (duración 0)', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
      await renderMap(<MapView accessibilityLabel={LABEL} />);
      await settle();
      await fireEvent.press(screen.getByTestId('map-view-north-up'));
      expect(mapLibreMock.camera.setStop).toHaveBeenCalledWith({
        bearing: 0,
        pitch: 0,
        duration: 0,
      });
    });
  });

  describe('Centrar en mí', () => {
    it('no aparece si todavía no hay permiso, y el mapa nunca lo pide', async () => {
      await renderMap(<MapView accessibilityLabel={LABEL} />);
      await settle();
      expect(screen.queryByRole('button', { name: 'Centrar en mi ubicación' })).toBeNull();
      expect(screen.queryByTestId('maplibre-UserLocation')).toBeNull();
      expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('con permiso concedido aparece, dibuja la ubicación y centra la cámara', async () => {
      locationMock.setPermission('granted');
      locationMock.setPosition({ latitude: -34.62, longitude: -58.44 });
      await renderMap(<MapView accessibilityLabel={LABEL} />);
      const button = await screen.findByRole('button', { name: 'Centrar en mi ubicación' });
      expect(screen.getByTestId('maplibre-UserLocation')).toBeOnTheScreen();
      await fireEvent.press(button);
      await waitFor(() => {
        expect(mapLibreMock.camera.flyTo).toHaveBeenCalledWith({
          center: [-58.44, -34.62],
          zoom: USER_ZOOM,
          duration: CAMERA_ANIMATION_MS,
        });
      });
    });

    it('sin señal de GPS no mueve la cámara ni rompe', async () => {
      locationMock.setPermission('granted');
      locationMock.setPositionError(new Error('timeout'));
      await renderMap(<MapView accessibilityLabel={LABEL} />);
      await fireEvent.press(await screen.findByTestId('map-view-center-user'));
      await settle();
      expect(mapLibreMock.camera.flyTo).not.toHaveBeenCalled();
      expect(mapLibreMock.camera.jumpTo).not.toHaveBeenCalled();
    });

    it('showsUserLocation={false} no dibuja el punto aunque haya permiso', async () => {
      locationMock.setPermission('granted');
      await renderMap(<MapView accessibilityLabel={LABEL} showsUserLocation={false} />);
      await screen.findByTestId('map-view-center-user');
      expect(screen.queryByTestId('maplibre-UserLocation')).toBeNull();
    });
  });

  it('expone flyTo, fitBounds y resetNorth por ref, respetando Reducir movimiento', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true);
    const ref = createRef<MapViewHandle>();
    await renderMap(<MapView accessibilityLabel={LABEL} ref={ref} />);
    await settle();
    await act(() => {
      ref.current?.flyTo([-58.38, -34.6]);
      ref.current?.fitBounds([-58.5, -34.7, -58.3, -34.5]);
    });
    expect(mapLibreMock.camera.jumpTo).toHaveBeenCalledWith({
      center: [-58.38, -34.6],
      zoom: USER_ZOOM,
    });
    expect(mapLibreMock.camera.fitBounds).toHaveBeenCalledWith(
      [-58.5, -34.7, -58.3, -34.5],
      expect.objectContaining({ duration: 0 }),
    );
  });

  it('los controles miden 48 × 48 (más que el mínimo de 44)', async () => {
    await renderMap(<MapView accessibilityLabel={LABEL} />);
    expect(screen.getByTestId('map-view-north-up')).toHaveStyle({ width: 48, height: 48 });
  });
});
