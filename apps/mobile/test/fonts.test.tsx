// `useAppFonts`. jest-expo mockea el módulo nativo de expo-font (`ExpoFontLoader`) y, desde
// jest-expo 58.0.14, también el registro de assets de React Native, así que los `.ttf` cargan en
// Jest (antes `loadAsync` rechazaba con "Module … is missing from the asset registry" y eso
// servía de camino de error real). Los dos caminos se prueban mockeando `useFonts`: jest-expo
// crea una instancia nueva del módulo nativo en cada `requireNativeModule`, así que no se puede
// hacer fallar el `loadAsync` que usa expo-font desde el test.
import { renderHook, waitFor } from '@testing-library/react-native';
import type * as ExpoFont from 'expo-font';
import { useFonts } from 'expo-font';

import { fontAssets, fontFamilies, useAppFonts } from '@/shared/fonts';

jest.mock('expo-font', () => {
  const actual = jest.requireActual<typeof ExpoFont>('expo-font');
  return { ...actual, useFonts: jest.fn(actual.useFonts) };
});

const useFontsMock = jest.mocked(useFonts);

describe('fuentes', () => {
  it('carga exactamente los 3 pesos de Fira Sans y cada fontFamily tiene su asset', () => {
    const families = new Set([
      ...Object.values(fontFamilies.heading),
      ...Object.values(fontFamilies.body),
    ]);
    expect([...families].sort()).toEqual([
      'FiraSans_400Regular',
      'FiraSans_600SemiBold',
      'FiraSans_700Bold',
    ]);
    expect([...families].sort()).toEqual(Object.keys(fontAssets).sort());
  });

  it('useAppFonts devuelve loaded cuando expo-font termina de cargar', async () => {
    useFontsMock.mockReturnValueOnce([true, null]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toEqual({ loaded: true, error: null });
    expect(useFontsMock).toHaveBeenCalledWith(fontAssets);
  });

  it('si la carga falla, devuelve el error (la app sigue con la fuente del sistema)', async () => {
    const error = new Error('No se pudo registrar la fuente');
    useFontsMock.mockReturnValueOnce([false, error]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toEqual({ loaded: false, error });
  });

  it('con la carga real de Jest (assets mockeados por jest-expo) termina cargada y sin error', async () => {
    const { result } = await renderHook(() => useAppFonts());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    expect(result.current.error).toBeNull();
  });
});
