// `useStaticArchivo`: resuelve la versión con el manifiesto, cachea por versión y usa la última
// versión conocida (MMKV) cuando no hay manifiesto.
import { renderHook, waitFor } from '@testing-library/react-native';

import {
  createLastKnownStore,
  lastKnownKey,
  useStaticArchivo,
  versionFromManifest,
} from '@/shared/static';
import { MemoryKeyValueStore } from '@/shared/storage/kv';

import {
  createHarness,
  errorBody,
  estaciones,
  jsonResponse,
  lineas,
  manifest,
  VERSION,
  type Routes,
} from './fixtures';

const routes = (extra: Routes = {}): Routes => ({
  '/v1/static/manifest': () => jsonResponse(manifest()),
  [`/v1/static/${VERSION}/subte-lineas.json`]: () => jsonResponse(lineas),
  '/v1/static/v2xyz/subte-lineas.json': () => jsonResponse({ ...lineas, fuente: 'versión nueva' }),
  ...extra,
});

const paths = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.map(([url]) => new URL(url as string).pathname);

// Montan el router y los providers reales: con la máquina cargada pasan los 5 s por defecto.
jest.setTimeout(30_000);

describe('useStaticArchivo', () => {
  it('resuelve la versión con el manifiesto, baja el archivo y lo guarda como última conocida', async () => {
    const h = createHarness(routes());
    const { result } = await renderHook(() => useStaticArchivo('subte-lineas.json'), {
      wrapper: h.Wrapper,
    });
    // Sin afirmar el `isPending` inicial: con el `fetch` mockeado la respuesta puede llegar antes
    // de la primera lectura (dependía del orden de los tests).
    await waitFor(() => {
      expect(result.current.data?.lineas).toHaveLength(8);
    });
    expect(result.current.version).toBe(VERSION);
    expect(result.current.fromLastKnown).toBe(false);
    expect(paths(h.fetchMock)).toEqual([
      '/v1/static/manifest',
      `/v1/static/${VERSION}/subte-lineas.json`,
    ]);
    // La versión es parte de la query key.
    expect(h.queryClient.getQueryData(['static', 'archivo', 'subte-lineas.json', VERSION])).toEqual(
      lineas,
    );
    expect(createLastKnownStore(h.kv).read('subte-lineas.json')?.version).toBe(VERSION);
  });

  it('con la última conocida de la misma versión no vuelve a bajar el archivo', async () => {
    const kv = new MemoryKeyValueStore();
    createLastKnownStore(kv).write('subte-lineas.json', {
      version: VERSION,
      savedAt: Date.now(),
      data: lineas,
    });
    const h = createHarness(routes(), { kv });
    const { result } = await renderHook(() => useStaticArchivo('subte-lineas.json'), {
      wrapper: h.Wrapper,
    });
    // Disponible al instante, sin esperar al manifiesto.
    expect(result.current.data).toEqual(lineas);
    await waitFor(() => {
      expect(paths(h.fetchMock)).toEqual(['/v1/static/manifest']);
    });
    expect(result.current.fromLastKnown).toBe(false);
  });

  it('sin manifiesto (offline o caído) usa la última versión conocida', async () => {
    const kv = new MemoryKeyValueStore();
    createLastKnownStore(kv).write('subte-lineas.json', {
      version: 'vieja',
      savedAt: Date.now() - 30 * 24 * 3600 * 1000,
      data: lineas,
    });
    const h = createHarness(
      routes({
        '/v1/static/manifest': () => jsonResponse(errorBody('upstream_unavailable'), 503),
      }),
      { kv },
    );
    const { result } = await renderHook(() => useStaticArchivo('subte-lineas.json'), {
      wrapper: h.Wrapper,
    });
    await waitFor(() => {
      expect(h.fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(result.current.data).toEqual(lineas);
    expect(result.current.version).toBe('vieja');
    expect(result.current.fromLastKnown).toBe(true);
    expect(result.current.isLoadingError).toBe(false);
  });

  it('sin manifiesto ni copia guardada: error con reintento', async () => {
    let falla = true;
    const h = createHarness(
      routes({
        '/v1/static/manifest': () =>
          falla ? jsonResponse(errorBody('upstream_unavailable'), 503) : jsonResponse(manifest()),
      }),
    );
    const { result } = await renderHook(() => useStaticArchivo('subte-lineas.json'), {
      wrapper: h.Wrapper,
    });
    await waitFor(() => {
      expect(result.current.isLoadingError).toBe(true);
    });
    expect(result.current.error?.retryable).toBe(true);
    falla = false;
    await result.current.refetch();
    await waitFor(() => {
      expect(result.current.data?.lineas).toHaveLength(8);
    });
  });

  it('versión nueva en el manifiesto: muestra la vieja mientras baja la nueva', async () => {
    const kv = new MemoryKeyValueStore();
    createLastKnownStore(kv).write('subte-lineas.json', {
      version: VERSION,
      savedAt: Date.now(),
      data: lineas,
    });
    const h = createHarness(
      routes({ '/v1/static/manifest': () => jsonResponse(manifest('v2xyz')) }),
      { kv },
    );
    const { result } = await renderHook(() => useStaticArchivo('subte-lineas.json'), {
      wrapper: h.Wrapper,
    });
    expect(result.current.data?.fuente).toBe('prueba');
    await waitFor(() => {
      expect(result.current.data?.fuente).toBe('versión nueva');
    });
    expect(result.current.version).toBe('v2xyz');
    expect(createLastKnownStore(kv).read('subte-lineas.json')?.version).toBe('v2xyz');
  });

  it('cada archivo tiene su propia versión resuelta', async () => {
    const h = createHarness({
      ...routes(),
      [`/v1/static/${VERSION}/subte-estaciones.json`]: () => jsonResponse(estaciones),
    });
    const { result } = await renderHook(() => useStaticArchivo('subte-estaciones.json'), {
      wrapper: h.Wrapper,
    });
    await waitFor(() => {
      expect(result.current.data?.estaciones.length).toBeGreaterThan(0);
    });
  });
});

describe('versionFromManifest y lastKnown', () => {
  it('saca la versión de la url del archivo', () => {
    expect(versionFromManifest(manifest('abc'), 'subte-lineas.json')).toBe('abc');
    expect(versionFromManifest(manifest('abc'), 'equivalencias-paradas.json')).toBeUndefined();
    expect(versionFromManifest(undefined, 'subte-lineas.json')).toBeUndefined();
  });

  it('ignora una copia rota o fuera de contrato', () => {
    const kv = new MemoryKeyValueStore({
      [lastKnownKey('subte-lineas.json')]: '{no es json',
      [lastKnownKey('subte-estaciones.json')]: JSON.stringify({
        version: 'x',
        savedAt: 1,
        data: { version: 2 },
      }),
    });
    const store = createLastKnownStore(kv);
    expect(store.read('subte-lineas.json')).toBeUndefined();
    expect(store.read('subte-estaciones.json')).toBeUndefined();
  });
});
