import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  createMemoryPreferenceStore,
  dark,
  light,
  resolveScheme,
  textStyle,
  ThemeProvider,
  useTheme,
  type ThemePreference,
  type ThemePreferenceStore,
} from '..';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockedScheme = jest.mocked(useColorScheme);

function withStore(store?: ThemePreferenceStore) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return store ? (
      <ThemeProvider store={store}>{children}</ThemeProvider>
    ) : (
      <ThemeProvider>{children}</ThemeProvider>
    );
  };
}

describe('resolveScheme', () => {
  it.each([
    ['system', 'dark', 'dark'],
    ['system', 'light', 'light'],
    ['system', null, 'light'],
    ['system', 'unspecified', 'light'],
    ['light', 'dark', 'light'],
    ['dark', 'light', 'dark'],
  ] as const)('preferencia %s + sistema %s → %s', (pref, system, expected) => {
    expect(resolveScheme(pref, system)).toBe(expected);
  });
});

describe('ThemeProvider', () => {
  beforeEach(() => {
    mockedScheme.mockReturnValue('light');
  });

  it('con preferencia "system" sigue al sistema', async () => {
    mockedScheme.mockReturnValue('dark');
    const { result } = await renderHook(useTheme, { wrapper: withStore() });
    expect(result.current.preference).toBe('system');
    expect(result.current.scheme).toBe('dark');
    expect(result.current.colors).toBe(dark);
  });

  it('una preferencia explícita gana sobre el sistema y se guarda en el store', async () => {
    mockedScheme.mockReturnValue('dark');
    const store = createMemoryPreferenceStore('light');
    const { result } = await renderHook(useTheme, { wrapper: withStore(store) });
    expect(result.current.scheme).toBe('light');
    expect(result.current.colors).toBe(light);

    await act(() => {
      result.current.setPreference('dark');
    });
    expect(store.get()).toBe('dark');
    expect(result.current.scheme).toBe('dark');
  });

  it('reacciona a cambios hechos en el store desde afuera (subscribe)', async () => {
    const store = createMemoryPreferenceStore('system');
    const { result } = await renderHook(useTheme, { wrapper: withStore(store) });
    expect(result.current.scheme).toBe('light');
    await act(() => {
      store.set('dark');
    });
    expect(result.current.preference).toBe('dark');
    expect(result.current.scheme).toBe('dark');
  });

  it('funciona con un store sin subscribe (p. ej. MMKV simple)', async () => {
    let value: ThemePreference = 'system';
    const store: ThemePreferenceStore = {
      get: () => value,
      set: (next) => {
        value = next;
      },
    };
    const { result } = await renderHook(useTheme, { wrapper: withStore(store) });
    await act(() => {
      result.current.setPreference('dark');
    });
    expect(value).toBe('dark');
    expect(result.current.scheme).toBe('dark');
  });

  it('fuera de un provider devuelve el tema claro (no rompe)', async () => {
    const { result } = await renderHook(useTheme);
    expect(result.current.scheme).toBe('light');
    expect(result.current.colors).toBe(light);
  });
});

describe('textStyle', () => {
  it('usa una familia por peso (sin fontWeight) y los tamaños mobile de Obelisco', () => {
    expect(textStyle('heading.h1')).toEqual({
      fontFamily: 'FiraSans_700Bold',
      fontSize: 38,
      lineHeight: 48,
    });
    expect(textStyle('headline.md')).toEqual({
      fontFamily: 'FiraSans_600SemiBold',
      fontSize: 18,
      lineHeight: 24,
    });
    expect(textStyle('text.sm')).toEqual({
      fontFamily: 'FiraSans_400Regular',
      fontSize: 14,
      lineHeight: 20,
    });
  });
});
