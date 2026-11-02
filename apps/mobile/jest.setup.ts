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
