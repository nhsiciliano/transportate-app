// Mock de `@maplibre/maplibre-react-native` v11 para Jest (la librería no publica uno y su módulo
// nativo no existe en Jest). Lo registra `jest.setup.ts`.
//
// Cada componente es un `View` con `testID` y TODAS sus props, así un test puede leer
// `screen.getByTestId('maplibre-Layer-lineas').props.paint` o disparar
// `fireEvent.press(screen.getByTestId('maplibre-GeoJSONSource-paradas'), evento)`.
// - `testID`: el que pase la pantalla; si no, `maplibre-<Componente>` o, para fuentes y capas,
//   `maplibre-<Componente>-<id>` (los `id` son únicos dentro del estilo).
// - Los nombres son los de v11 (`Map`, `GeoJSONSource`, `Layer` con `type`), no los de v10
//   (`MapView`, `ShapeSource`, `LineLayer`…): ver `src/shared/map/README.md`.
// - Los refs imperativos (`MapRef`, `CameraRef`) son `jest.fn` compartidos: `mapLibreMock.camera`
//   y `mapLibreMock.map`. `setup-after-env.ts` los limpia antes de cada test.
import { useImperativeHandle, type ReactNode, type Ref } from 'react';
import { View } from 'react-native';

type MockProps = Record<string, unknown> & {
  children?: ReactNode;
  testID?: string;
  id?: string;
  ref?: Ref<unknown>;
};

function mockComponent(name: string, imperative?: () => object) {
  function MockMapLibreComponent({ children, testID, ref, ...props }: MockProps) {
    useImperativeHandle(ref, () => (imperative ? imperative() : {}), []);
    const id = typeof props.id === 'string' ? `-${props.id}` : '';
    return (
      <View {...props} testID={testID ?? `maplibre-${name}${id}`}>
        {children}
      </View>
    );
  }
  MockMapLibreComponent.displayName = `MapLibreMock(${name})`;
  return MockMapLibreComponent;
}

const LNG_LAT_OBELISCO: [number, number] = [-58.3816, -34.6037];

/** Métodos de `CameraRef` y `MapRef` (v11), compartidos por todas las instancias. */
export const mapLibreMock = {
  camera: {
    jumpTo: jest.fn(),
    easeTo: jest.fn(),
    flyTo: jest.fn(),
    fitBounds: jest.fn(),
    zoomTo: jest.fn(),
    setStop: jest.fn(),
  },
  map: {
    getCenter: jest.fn(() => Promise.resolve(LNG_LAT_OBELISCO)),
    getZoom: jest.fn(() => Promise.resolve(13)),
    getBearing: jest.fn(() => Promise.resolve(0)),
    getPitch: jest.fn(() => Promise.resolve(0)),
    getBounds: jest.fn(() => Promise.resolve([-58.53, -34.71, -58.33, -34.53])),
    project: jest.fn(() => Promise.resolve([0, 0])),
    unproject: jest.fn(() => Promise.resolve(LNG_LAT_OBELISCO)),
    queryRenderedFeatures: jest.fn(() => Promise.resolve([])),
    takeSnap: jest.fn(() => Promise.resolve('')),
    setSourceVisibility: jest.fn(),
    showAttribution: jest.fn(),
  },
};

export function resetMapLibreMock(): void {
  for (const group of [mapLibreMock.camera, mapLibreMock.map]) {
    for (const fn of Object.values(group)) fn.mockClear();
  }
}

const noop = () => undefined;

// Componentes exportados por `@maplibre/maplibre-react-native` 11.5.1 (`lib/typescript/module/index.d.ts`).
export const Map = mockComponent('Map', () => mapLibreMock.map);
export const Camera = mockComponent('Camera', () => mapLibreMock.camera);
export const GeoJSONSource = mockComponent('GeoJSONSource', () => ({
  getData: jest.fn(() => Promise.resolve({ type: 'FeatureCollection', features: [] })),
  getClusterExpansionZoom: jest.fn(() => Promise.resolve(14)),
  getClusterLeaves: jest.fn(() => Promise.resolve([])),
  getClusterChildren: jest.fn(() => Promise.resolve([])),
}));
export const VectorSource = mockComponent('VectorSource');
export const RasterSource = mockComponent('RasterSource');
export const RasterDEMSource = mockComponent('RasterDEMSource');
export const ImageSource = mockComponent('ImageSource');
export const Layer = mockComponent('Layer');
export const Images = mockComponent('Images');
export const UserLocation = mockComponent('UserLocation');
export const NativeUserLocation = mockComponent('NativeUserLocation');
export const Marker = mockComponent('Marker');
export const ViewAnnotation = mockComponent('ViewAnnotation');
export const LayerAnnotation = mockComponent('LayerAnnotation');
export const Callout = mockComponent('Callout');

/** La ubicación de la app sale de `expo-location` (mockeado aparte), no de MapLibre. */
export function useCurrentPosition(): undefined {
  return undefined;
}

export const LocationManager = {
  getCurrentPosition: jest.fn(() => Promise.resolve(undefined)),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  setMinDisplacement: jest.fn(),
  requestPermissions: jest.fn(() => Promise.resolve(false)),
};
export const LogManager = { onLog: noop, setLogLevel: noop, start: noop, stop: noop };
export const NetworkManager = { setConnected: noop };
export const TransformRequestManager = {
  addUrlTransform: () => '',
  removeUrlTransform: noop,
  clearUrlTransforms: noop,
  addUrlSearchParam: () => '',
  removeUrlSearchParam: noop,
  clearUrlSearchParams: noop,
  addHeader: () => '',
  removeHeader: noop,
  clearHeaders: noop,
  clear: noop,
};
export const OfflineManager = {
  createPack: jest.fn(() => Promise.resolve(undefined)),
  getPacks: jest.fn(() => Promise.resolve([])),
  deletePack: jest.fn(() => Promise.resolve(undefined)),
};
export const StaticMapImageManager = { createImage: jest.fn(() => Promise.resolve('')) };
