import { screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { AcercaScreen, describeVersion, PRIVACIDAD_BULLETS } from '@/features/ajustes';

import { renderThemed } from '../../../shared/ui/__fixtures__/renderThemed';
import { CC_LICENSE_URL, DATOS_ABIERTOS_URL } from '../AcercaScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockConstants: { expoConfig: { version: string } | null; nativeBuildVersion: string | null } =
  {
    expoConfig: { version: '1.2.3' },
    nativeBuildVersion: '45',
  };
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockConstants.expoConfig;
    },
    get nativeBuildVersion() {
      return mockConstants.nativeBuildVersion;
    },
  },
}));

afterEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
  mockConstants.expoConfig = { version: '1.2.3' };
  mockConstants.nativeBuildVersion = '45';
});

describe('describeVersion', () => {
  it('con y sin build', () => {
    expect(describeVersion('0.1.0', '12')).toBe('Versión 0.1.0 (build 12)');
    expect(describeVersion('0.1.0', null)).toBe('Versión 0.1.0');
    expect(describeVersion(undefined, null)).toBe('Versión —');
  });
});

describe('AcercaScreen', () => {
  it('muestra nombre, versión y build', async () => {
    await renderThemed(<AcercaScreen />);
    expect(screen.getByText('Transportate')).toBeOnTheScreen();
    expect(screen.getByTestId('acerca-version')).toHaveTextContent('Versión 1.2.3 (build 45)');
  });

  it('sin build nativo (Expo Go, web) muestra solo la versión', async () => {
    mockConstants.nativeBuildVersion = null;
    await renderThemed(<AcercaScreen />);
    expect(screen.getByTestId('acerca-version')).toHaveTextContent(/^Versión 1\.2\.3$/);
  });

  it('atribuye los datos al GCBA, con la licencia, y aclara que no es app oficial', async () => {
    await renderThemed(<AcercaScreen />);
    expect(
      screen.getByText(/Gobierno de la Ciudad de Buenos Aires \(API de Transporte\)/),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Creative Commons Atribución 2\.5 Argentina/)).toBeOnTheScreen();
    expect(screen.getByText(/Colectivos: paradas/)).toBeOnTheScreen();
    expect(
      screen.getByText('Transportate no es una app oficial del Gobierno de la Ciudad.'),
    ).toBeOnTheScreen();
  });

  it('lista la privacidad en bullets, el mapa y el diseño', async () => {
    await renderThemed(<AcercaScreen />);
    for (const bullet of PRIVACIDAD_BULLETS) expect(screen.getByText(bullet)).toBeOnTheScreen();
    expect(PRIVACIDAD_BULLETS).toHaveLength(4);
    expect(
      screen.getByText(
        'Mapa base: © OpenStreetMap contributors, © OpenMapTiles, tiles de OpenFreeMap.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Basado en Obelisco, el sistema de diseño de la Ciudad de Buenos Aires.'),
    ).toBeOnTheScreen();
  });

  it('los enlaces abren la licencia y los datos abiertos en el navegador', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderThemed(<AcercaScreen />);

    await user.press(screen.getByRole('link', { name: 'Licencia CC BY 2.5 Argentina' }));
    expect(open).toHaveBeenLastCalledWith(CC_LICENSE_URL);
    await user.press(screen.getByRole('link', { name: 'Datos abiertos de la Ciudad' }));
    expect(open).toHaveBeenLastCalledWith(DATOS_ABIERTOS_URL);
    expect(CC_LICENSE_URL).toBe('https://creativecommons.org/licenses/by/2.5/ar/');
  });

  it('un enlace que el sistema no puede abrir no rompe la pantalla', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sin navegador'));
    const user = userEvent.setup();
    await renderThemed(<AcercaScreen />);
    await user.press(screen.getByRole('link', { name: 'Licencia CC BY 2.5 Argentina' }));
    expect(screen.getByText('Transportate')).toBeOnTheScreen();
  });

  it('"Licencias de software de terceros" navega a /inicio/licencias', async () => {
    const user = userEvent.setup();
    await renderThemed(<AcercaScreen />);
    await user.press(screen.getByRole('button', { name: 'Licencias de software de terceros' }));
    expect(mockPush).toHaveBeenCalledWith('/inicio/licencias');
  });

  it('es una lectura corta: entre 150 y 250 palabras de contenido', async () => {
    await renderThemed(<AcercaScreen />);
    const texto = collectText(screen.toJSON());
    const palabras = texto.split(/\s+/).filter(Boolean).length;
    expect(palabras).toBeGreaterThanOrEqual(150);
    expect(palabras).toBeLessThanOrEqual(250);
  });
});

/** Junta el texto visible del árbol renderizado (sin los íconos, que no tienen texto). */
function collectText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  if (node && typeof node === 'object' && 'children' in node) {
    return collectText(node.children);
  }
  return '';
}
