// `useAppFonts`. jest-expo mockea el módulo nativo de expo-font (`ExpoFontLoader`), pero los
// `.ttf` no quedan en el registro de assets de Jest y `loadAsync` rechaza ("Module … is missing
// from the asset registry"). Eso sirve para probar el camino de error real; el de éxito se prueba
// mockeando `useFonts` (verificamos qué mapa de fuentes recibe).
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
  it('carga exactamente los 6 pesos y cada fontFamily tiene su asset', () => {
    const families = [...Object.values(fontFamilies.heading), ...Object.values(fontFamilies.body)];
    expect(families).toHaveLength(6);
    expect([...families].sort()).toEqual(Object.keys(fontAssets).sort());
  });

  it('useAppFonts devuelve loaded cuando expo-font termina de cargar', async () => {
    useFontsMock.mockReturnValueOnce([true, null]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toEqual({ loaded: true, error: null });
    expect(useFontsMock).toHaveBeenCalledWith(fontAssets);
  });

  it('si la carga falla, devuelve el error (la app sigue con la fuente del sistema)', async () => {
    const { result } = await renderHook(() => useAppFonts());
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.loaded).toBe(false);
  });
});
