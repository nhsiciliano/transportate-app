// Corre después de cargar Jest en cada archivo de test (`setupFilesAfterEnv`): vuelve los mocks
// nativos con estado (ubicación, refs del mapa) al estado inicial antes de cada test, así ningún
// test depende del orden en que corren los otros.
import { locationMock } from './expo-location';
import { resetMapLibreMock } from './maplibre';

beforeEach(() => {
  locationMock.reset();
  resetMapLibreMock();
});
