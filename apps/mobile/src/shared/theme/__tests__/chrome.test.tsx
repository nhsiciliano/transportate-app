// Chrome nativo desde el tema (F5-HIGH-C): la preferencia llega a lo nativo y los headers de las
// Stack de los tabs toman los colores del esquema elegido.
import { act, renderHook } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Appearance, Text, type ColorSchemeName } from 'react-native';

import FavoritosLayout from '@/app/(tabs)/favoritos/_layout';
import InicioLayout from '@/app/(tabs)/inicio/_layout';
import SubtesLayout from '@/app/(tabs)/subtes/_layout';
import { FavoritosProvider, MmkvFavoritosRepository } from '@/features/favoritos';
import { MemoryKeyValueStore } from '@/shared/storage/kv';
import {
  ChromeNativo,
  createMemoryPreferenceStore,
  dark,
  light,
  nativeColorScheme,
  navigationTheme,
  stackScreenOptions,
  ThemeProvider,
  useTheme,
  type ThemePreference,
} from '@/shared/theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const useColorSchemeMock = jest.mocked(
  jest.requireMock<{ default: () => ColorSchemeName }>(
    'react-native/Libraries/Utilities/useColorScheme',
  ).default,
);

let setColorScheme: jest.SpyInstance;
beforeEach(() => {
  setColorScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
  useColorSchemeMock.mockReturnValue('light');
});
afterEach(() => {
  setColorScheme.mockRestore();
});

describe('preferencia → lo nativo', () => {
  it('nativeColorScheme: claro y oscuro fuerzan; sistema quita el override', () => {
    expect(nativeColorScheme('light')).toBe('light');
    expect(nativeColorScheme('dark')).toBe('dark');
    expect(nativeColorScheme('system')).toBe('auto');
  });

  it('ThemeProvider llama a Appearance.setColorScheme al montar y al cambiar la preferencia', async () => {
    const store = createMemoryPreferenceStore('dark');
    const { result } = await renderHook(useTheme, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ThemeProvider store={store}>{children}</ThemeProvider>
      ),
    });
    expect(setColorScheme).toHaveBeenLastCalledWith('dark');
    expect(result.current.scheme).toBe('dark');
    await act(() => {
      result.current.setPreference('system');
    });
    expect(setColorScheme).toHaveBeenLastCalledWith('auto');
    expect(result.current.scheme).toBe('light');
    await act(() => {
      result.current.setPreference('light');
    });
    expect(setColorScheme).toHaveBeenLastCalledWith('light');
    // Un render más con la misma preferencia no vuelve a llamar.
    const calls = setColorScheme.mock.calls.length;
    await act(() => {
      result.current.setPreference('light');
    });
    expect(setColorScheme.mock.calls.length).toBe(calls);
  });

  it('sin bucle: con «Oscuro» forzado el sistema reporta dark y con «Sistema» vuelve a mandar el sistema', async () => {
    useColorSchemeMock.mockReturnValue('dark'); // lo que devuelve con el override activo
    const store = createMemoryPreferenceStore('dark');
    const { result } = await renderHook(useTheme, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ThemeProvider store={store}>{children}</ThemeProvider>
      ),
    });
    expect(result.current.scheme).toBe('dark');
    useColorSchemeMock.mockReturnValue('light'); // sin override, el sistema está en claro
    await act(() => {
      result.current.setPreference('system');
    });
    expect(result.current.scheme).toBe('light');
  });
});

describe('tema de navegación y opciones de header', () => {
  it('navigationTheme: colores de Obelisco y `dark` según el esquema', () => {
    const d = navigationTheme({ scheme: 'dark', colors: dark });
    expect(d.dark).toBe(true);
    expect(d.colors).toMatchObject({
      primary: dark.text.link,
      background: dark.bg.base,
      card: dark.bg.card,
      text: dark.text.primary,
      border: dark.border.subtle,
    });
    const l = navigationTheme({ scheme: 'light', colors: light });
    expect(l.dark).toBe(false);
    expect(l.colors.background).toBe(light.bg.elevated);
  });

  it('stackScreenOptions: «Atrás» en text.link, títulos en text.primary con la fuente del sistema y fondo de pantalla', () => {
    const opciones = stackScreenOptions({ scheme: 'dark', colors: dark });
    expect(opciones).toMatchObject({
      headerBackTitle: 'Atrás',
      headerTintColor: dark.text.link,
      headerTitleStyle: { color: dark.text.primary },
      headerLargeTitleStyle: { color: dark.text.primary },
      headerStyle: { backgroundColor: dark.bg.base },
      headerLargeStyle: { backgroundColor: dark.bg.base },
    });
    // Sin `fontFamily`: con Fira Sans el header nativo de iOS 26 no dibujaba el título.
    expect(opciones.headerTitleStyle).not.toHaveProperty('fontFamily');
    expect(opciones.headerLargeTitleStyle).not.toHaveProperty('fontFamily');
  });
});

describe('headers reales de los tabs', () => {
  function wrapper(preference: ThemePreference) {
    const store = createMemoryPreferenceStore(preference);
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <ThemeProvider store={store}>
          <FavoritosProvider repository={new MmkvFavoritosRepository(new MemoryKeyValueStore())}>
            {children}
          </FavoritosProvider>
        </ThemeProvider>
      );
    };
  }

  /** Props del header nativo (react-native-screens) de la pantalla visible. */
  function header(): Record<string, unknown> {
    interface Nodo {
      type: string;
      props: Record<string, unknown>;
      children: (Nodo | string)[] | null;
    }
    const buscar = (n: Nodo | string | null): Nodo | undefined => {
      if (n === null || typeof n === 'string') return undefined;
      if (n.type === 'RNSScreenStackHeaderConfig') return n;
      for (const c of n.children ?? []) {
        const r = buscar(c);
        if (r !== undefined) return r;
      }
      return undefined;
    };
    const raiz = screen.toJSON() as Nodo | Nodo[] | null;
    const config = (Array.isArray(raiz) ? raiz : [raiz]).map(buscar).find((x) => x !== undefined);
    if (config === undefined) throw new Error('no hay header nativo');
    return config.props;
  }

  function RaizConChrome() {
    return (
      <ChromeNativo>
        <Slot />
      </ChromeNativo>
    );
  }

  const layouts = [
    ['subtes', SubtesLayout],
    ['favoritos', FavoritosLayout],
    ['inicio', InicioLayout],
  ] as const;

  it.each(layouts)('%s con «Oscuro» y el sistema en claro: header oscuro', async (tab, Layout) => {
    await renderRouter(
      {
        // Como en la app: `ChromeNativo` vive en el layout raíz, dentro del router.
        _layout: RaizConChrome,
        [`${tab}/_layout`]: Layout,
        [`${tab}/index`]: () => <Text>contenido</Text>,
      },
      { initialUrl: `/${tab}`, wrapper: wrapper('dark') },
    );
    expect(header()).toMatchObject({
      color: dark.text.link,
      titleColor: dark.text.primary,
      largeTitleColor: dark.text.primary,
      backgroundColor: dark.bg.base,
      titleFontFamily: undefined,
      userInterfaceStyle: 'dark',
    });
  });

  it.each(layouts)('%s con «Sistema» y el sistema en claro: header claro', async (tab, Layout) => {
    await renderRouter(
      {
        // Como en la app: `ChromeNativo` vive en el layout raíz, dentro del router.
        _layout: RaizConChrome,
        [`${tab}/_layout`]: Layout,
        [`${tab}/index`]: () => <Text>contenido</Text>,
      },
      { initialUrl: `/${tab}`, wrapper: wrapper('system') },
    );
    expect(header()).toMatchObject({
      color: light.text.link,
      titleColor: light.text.primary,
      backgroundColor: light.bg.elevated,
      userInterfaceStyle: 'light',
    });
  });
});
