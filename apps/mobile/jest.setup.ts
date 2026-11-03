// Setup de Jest para apps/mobile.
//
// react-native-mmkv 4 usa su propio mock en memoria cuando detecta Jest (`createMMKV()` →
// `createMockMMKV`), pero igual importa `react-native-nitro-modules`, que al cargarse busca el
// TurboModule nativo `NitroModules` y tira si no existe. En Jest no hay módulo nativo: se
// reemplaza por un stub. Si algo llegara a pedir un HybridObject real, falla con un mensaje claro.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: (name: string) => {
      throw new Error(`NitroModules no está disponible en Jest (se pidió "${name}").`);
    },
  },
}));

// NetInfo (onlineManager de TanStack Query, src/shared/query) busca su módulo nativo y, sin él,
// tira el proceso de Jest apenas se registra un listener. Se usa el mock oficial de la librería
// (README de @react-native-community/netinfo, "Errors while running Jest tests"): siempre conectado.
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual<object>('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// Reanimated 4 + Worklets: la guía oficial ("Testing with Jest") usa el resolver de
// `react-native-reanimated/jest/resolver` (fuerza la implementación web, ver jest.config.js) y
// `setUpTests()`, que agrega los matchers `toHaveAnimatedStyle` y compañía.
jest.mock('react-native-worklets', () =>
  jest.requireActual<object>('react-native-worklets/lib/module/mock'),
);
jest
  .requireActual<typeof import('react-native-reanimated')>('react-native-reanimated')
  .setUpTests();

// Gesture Handler: su `jestSetup.js` oficial reemplaza el módulo nativo y los componentes por mocks.
jest.requireActual('react-native-gesture-handler/jestSetup');

// MapLibre v11 no publica mock: `test/mocks/maplibre.tsx` (componentes como `View` con `testID`).
jest.mock('@maplibre/maplibre-react-native', () =>
  jest.requireActual<object>('./test/mocks/maplibre'),
);

// expo-location con permiso y posición controlables (`locationMock` en test/mocks/expo-location.ts).
jest.mock(
  'expo-location',
  () =>
    jest.requireActual<{ mockedExpoLocation: object }>('./test/mocks/expo-location')
      .mockedExpoLocation,
);

// react-native-reorderable-list (arrastre en Favoritos) llama a `useAnimatedRef()` como función,
// pero en Jest Reanimated resuelve su implementación web, que devuelve un objeto ("flatListRef is
// not a function"). Mock: `test/mocks/reorderable-list.tsx` (un FlatList con las props a la vista).
jest.mock('react-native-reorderable-list', () =>
  jest.requireActual<object>('./test/mocks/reorderable-list'),
);
