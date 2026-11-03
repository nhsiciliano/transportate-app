// Prueba de humo de las dependencias nativas de la Fase 4 (tarea 4.0): que cada mock cargue en
// Jest y se comporte como dicen sus comentarios, y que `app.config.ts` pida solo ubicación
// "mientras se usa". Las pantallas (4.3, 4.6, 4.7, 4.9) prueban su propio uso.
import { Camera, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ConfigContext } from 'expo/config';
import * as Location from 'expo-location';
import { useRef, type ComponentRef } from 'react';
import { Text } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import buildConfig, { LOCATION_WHEN_IN_USE_PERMISSION } from '../../app.config';
import { locationMock } from './expo-location';
import { mapLibreMock } from './maplibre';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';

describe('MapLibre (mock)', () => {
  it('renderiza mapa, cámara, fuente, capa y ubicación como View con testID', async () => {
    await render(
      <Map mapStyle={STYLE}>
        <Camera initialViewState={{ center: [-58.38, -34.6], zoom: 12 }} />
        <GeoJSONSource id="lineas" data={{ type: 'FeatureCollection', features: [] }}>
          <Layer id="lineas-trazo" type="line" paint={{ 'line-width': 4 }} />
        </GeoJSONSource>
        <UserLocation />
      </Map>,
    );
    expect(screen.getByTestId('maplibre-Map')).toBeOnTheScreen();
    expect(screen.getByTestId('maplibre-Camera')).toBeOnTheScreen();
    expect(screen.getByTestId('maplibre-GeoJSONSource-lineas')).toBeOnTheScreen();
    expect(screen.getByTestId('maplibre-UserLocation')).toBeOnTheScreen();
    expect(screen.getByTestId('maplibre-Layer-lineas-trazo').props).toMatchObject({
      type: 'line',
      paint: { 'line-width': 4 },
    });
  });

  it('expone los métodos del ref de la cámara como jest.fn', async () => {
    function Probe() {
      const camera = useRef<ComponentRef<typeof Camera>>(null);
      return (
        <Map mapStyle={STYLE}>
          <Camera ref={camera} />
          <Text onPress={() => camera.current?.flyTo({ center: [-58.4, -34.6], duration: 500 })}>
            volar
          </Text>
        </Map>
      );
    }
    await render(<Probe />);
    expect(mapLibreMock.camera.flyTo).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('volar'));
    expect(mapLibreMock.camera.flyTo).toHaveBeenCalledWith({
      center: [-58.4, -34.6],
      duration: 500,
    });
  });
});

describe('expo-location (mock)', () => {
  it('arranca sin preguntar y, al pedir, devuelve la respuesta configurada', async () => {
    expect(await Location.getForegroundPermissionsAsync()).toMatchObject({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
    });
    await expect(Location.getCurrentPositionAsync()).rejects.toThrow();

    expect(await Location.requestForegroundPermissionsAsync()).toMatchObject({
      status: 'granted',
      granted: true,
      ios: { scope: 'whenInUse' },
    });
    expect((await Location.getCurrentPositionAsync()).coords).toMatchObject({
      latitude: -34.6037,
      longitude: -58.3816,
    });
  });

  it('un rechazo queda sin volver a preguntar', async () => {
    locationMock.setRequestAnswer('denied');
    expect(await Location.requestForegroundPermissionsAsync()).toMatchObject({
      status: 'denied',
      canAskAgain: false,
    });
    locationMock.setRequestAnswer('granted');
    expect((await Location.requestForegroundPermissionsAsync()).status).toBe('denied');
  });

  it('watchPositionAsync recibe las posiciones emitidas hasta que se suelta', async () => {
    locationMock.setPermission('granted');
    const received: Location.LocationObject[] = [];
    const callback = (location: Location.LocationObject) => {
      received.push(location);
    };
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced },
      callback,
    );
    locationMock.emitPosition({ latitude: -34.61, longitude: -58.41 });
    expect(received[0]?.coords).toMatchObject({ latitude: -34.61, longitude: -58.41 });
    subscription.remove();
    expect(locationMock.activeWatchers).toBe(0);
  });

  it('se reinicia entre tests (setup-after-env.ts)', async () => {
    expect((await Location.getForegroundPermissionsAsync()).status).toBe('undetermined');
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('no permite ubicación en segundo plano', () => {
    expect(() => Location.requestBackgroundPermissionsAsync()).toThrow(
      /mientras la app está abierta/,
    );
  });
});

describe('Reanimated y Gesture Handler', () => {
  it('renderizan con valores compartidos y un detector de gestos', async () => {
    function Probe() {
      const offset = useSharedValue(12);
      const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));
      const pan = usePanGesture({});
      return (
        <GestureHandlerRootView>
          <GestureDetector gesture={pan}>
            <Animated.View testID="arrastrable" style={style} />
          </GestureDetector>
        </GestureHandlerRootView>
      );
    }
    await render(<Probe />);
    expect(screen.getByTestId('arrastrable')).toHaveStyle({ transform: [{ translateY: 12 }] });
  });
});

describe('app.config.ts: permisos de ubicación', () => {
  const config = buildConfig({
    projectRoot: __dirname,
    staticConfigPath: null,
    packageJsonPath: null,
    config: {},
  } satisfies ConfigContext);
  const plugins = config.plugins ?? [];
  const location = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location');

  it('declara MapLibre y expo-location', () => {
    expect(plugins).toContain('@maplibre/maplibre-react-native');
    expect(location).toBeDefined();
  });

  it('solo "mientras se usa", en voseo, sin segundo plano', () => {
    expect(Array.isArray(location) ? location[1] : null).toMatchObject({
      locationWhenInUsePermission: LOCATION_WHEN_IN_USE_PERMISSION,
      locationAlwaysAndWhenInUsePermission: false,
      locationAlwaysPermission: false,
      isIosBackgroundLocationEnabled: false,
      isAndroidBackgroundLocationEnabled: false,
      isAndroidForegroundServiceEnabled: false,
    });
    expect(LOCATION_WHEN_IN_USE_PERMISSION).toBe(
      'Transportate usa tu ubicación solo mientras la app está abierta, para mostrarte paradas cercanas. No sale de tu teléfono.',
    );
  });
});
