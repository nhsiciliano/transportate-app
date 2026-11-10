import { DEFAULT_API_URL, getApiBaseUrl, normalizeBaseUrl } from '../config';

describe('normalizeBaseUrl', () => {
  it('saca espacios y barras finales', () => {
    expect(normalizeBaseUrl(' https://proxy.test/// ')).toBe('https://proxy.test');
  });

  it('vacío, solo espacios o undefined → null', () => {
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl('   ')).toBeNull();
    expect(normalizeBaseUrl(undefined)).toBeNull();
  });
});

describe('getApiBaseUrl', () => {
  it('con URL: la devuelve normalizada, en desarrollo y en release', () => {
    expect(getApiBaseUrl('https://proxy.test/', true)).toBe('https://proxy.test');
    expect(getApiBaseUrl('https://proxy.test/', false)).toBe('https://proxy.test');
  });

  it('sin URL en desarrollo: avisa una sola vez y usa localhost:8787', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(getApiBaseUrl('', true)).toBe(DEFAULT_API_URL);
    expect(getApiBaseUrl(undefined, true)).toBe('http://localhost:8787');
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toContain('EXPO_PUBLIC_API_URL');
    error.mockRestore();
  });

  it('sin URL fuera de desarrollo: lanza y nombra la variable y eas.json (nunca localhost)', () => {
    for (const value of [undefined, '', '   ']) {
      expect(() => getApiBaseUrl(value, false)).toThrow(/EXPO_PUBLIC_API_URL/);
      expect(() => getApiBaseUrl(value, false)).toThrow(/eas\.json/);
    }
  });
});
