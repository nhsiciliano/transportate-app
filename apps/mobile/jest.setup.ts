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
