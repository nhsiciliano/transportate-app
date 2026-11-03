// Archivos grandes del estático: descarga con progreso, persistencia por archivo en MMKV (una
// versión), relectura sin descargar, cambio de versión y errores.
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  LargeFileManager,
  largeFileKeys,
  useStaticArchivoGrande,
  type StaticDownloader,
} from '@/shared/static';
import { MemoryKeyValueStore } from '@/shared/storage/kv';

import {
  createFakeDownloader,
  createHarness,
  defaultRoutes,
  jsonResponse,
  manifest,
} from '../subtes/fixtures';
import { ARCHIVOS_TEXTO, paradasArchivo } from './data';

jest.setTimeout(30_000);

describe('LargeFileManager', () => {
  it('baja con progreso, valida y guarda por archivo (meta al final)', async () => {
    const kv = new MemoryKeyValueStore();
    const { downloader, calls } = createFakeDownloader();
    const manager = new LargeFileManager(kv, downloader, () => 1000);
    const progresos: (number | null)[] = [];
    manager.subscribe('paradas.json', () => {
      progresos.push(manager.getState('paradas.json').progress);
    });
    manager.loadStored('paradas.json');
    const text = ARCHIVOS_TEXTO['paradas.json'] ?? '';
    await manager.ensure('paradas.json', 'v1', text.length);
    expect(calls).toEqual(['v1/paradas.json']);
    // 0 al empezar, 0,5 a mitad (con los bytes del manifiesto), null al terminar.
    expect(progresos).toEqual(expect.arrayContaining([0, expect.closeTo(0.5, 2), null]));
    const s = manager.getState('paradas.json');
    expect(s.version).toBe('v1');
    expect(s.data?.paradas).toHaveLength(paradasArchivo.paradas.length);
    const keys = largeFileKeys('paradas.json');
    expect(kv.getString(keys.data)).toBe(text);
    expect(JSON.parse(kv.getString(keys.meta) ?? '{}')).toEqual({
      version: 'v1',
      savedAt: 1000,
      bytes: text.length,
    });
    // La misma versión no se vuelve a bajar.
    await manager.ensure('paradas.json', 'v1');
    expect(calls).toHaveLength(1);
  });

  it('otra sesión lee la copia guardada sin descargar', async () => {
    const kv = new MemoryKeyValueStore();
    await new LargeFileManager(kv, createFakeDownloader().downloader).ensure('paradas.json', 'v1');
    const { downloader, calls } = createFakeDownloader();
    const otra = new LargeFileManager(kv, downloader);
    otra.loadStored('paradas.json');
    expect(otra.getState('paradas.json').version).toBe('v1');
    await otra.ensure('paradas.json', 'v1');
    expect(calls).toEqual([]);
  });

  it('versión nueva: la vieja sigue hasta que termina y la pisa (una sola versión guardada)', async () => {
    const kv = new MemoryKeyValueStore();
    await new LargeFileManager(kv, createFakeDownloader().downloader).ensure('paradas.json', 'v1');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const manager = new LargeFileManager(kv, createFakeDownloader(undefined, { gate }).downloader);
    manager.loadStored('paradas.json');
    const pending = manager.ensure('paradas.json', 'v2');
    expect(manager.getState('paradas.json')).toMatchObject({ version: 'v1', downloading: true });
    expect(manager.getState('paradas.json').data).toBeDefined();
    release();
    await pending;
    expect(manager.getState('paradas.json')).toMatchObject({ version: 'v2', downloading: false });
    expect(JSON.parse(kv.getString(largeFileKeys('paradas.json').meta) ?? '{}')).toMatchObject({
      version: 'v2',
    });
  });

  it('error de descarga: no se reintenta solo; `retry` sí', async () => {
    const kv = new MemoryKeyValueStore();
    const falla = createFakeDownloader(undefined, { fail: true });
    const manager = new LargeFileManager(kv, falla.downloader);
    await manager.ensure('paradas.json', 'v1');
    expect(manager.getState('paradas.json').error?.kind).toBe('http');
    await manager.ensure('paradas.json', 'v1');
    expect(falla.calls).toHaveLength(1);
    await manager.retry('paradas.json', 'v1');
    expect(falla.calls).toHaveLength(2);
  });

  it('contenido fuera de contrato: ContractError y no guarda nada', async () => {
    const kv = new MemoryKeyValueStore();
    const roto: StaticDownloader = {
      download: () => Promise.resolve('{"version":1,"paradas":[{}]}'),
    };
    const manager = new LargeFileManager(kv, roto);
    await manager.ensure('paradas.json', 'v1');
    expect(manager.getState('paradas.json').error?.kind).toBe('contract');
    expect(kv.getString(largeFileKeys('paradas.json').data)).toBeUndefined();
  });

  it('una copia guardada rota se borra', () => {
    const keys = largeFileKeys('paradas.json');
    const kv = new MemoryKeyValueStore({
      [keys.data]: '{no es json',
      [keys.meta]: '{"version":"v1","savedAt":1}',
    });
    const manager = new LargeFileManager(kv, createFakeDownloader().downloader);
    manager.loadStored('paradas.json');
    expect(manager.getState('paradas.json')).toMatchObject({ loaded: true, data: undefined });
    expect(kv.getString(keys.data)).toBeUndefined();
  });
});

describe('useStaticArchivoGrande', () => {
  it('primer uso: pending con progreso y después el dato', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const h = createHarness(defaultRoutes(), {
      downloader: createFakeDownloader(undefined, { gate }).downloader,
    });
    const { result } = await renderHook(() => useStaticArchivoGrande('paradas.json'), {
      wrapper: h.Wrapper,
    });
    await waitFor(() => {
      expect(result.current.isDownloading).toBe(true);
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.progress).toBeCloseTo(0.5, 1);
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.data?.paradas.length).toBe(paradasArchivo.paradas.length);
    });
    expect(result.current).toMatchObject({
      isDownloading: false,
      progress: null,
      fromLastKnown: false,
    });
  });

  it('sin manifiesto pero con copia guardada: usa la copia', async () => {
    const kv = new MemoryKeyValueStore();
    await new LargeFileManager(kv, createFakeDownloader().downloader).ensure(
      'paradas.json',
      'vieja',
    );
    const h = createHarness(
      {
        ...defaultRoutes(),
        '/v1/static/manifest': () =>
          jsonResponse({ error: { code: 'upstream_unavailable', message: 'x' } }, 503),
      },
      { kv },
    );
    const { result } = await renderHook(() => useStaticArchivoGrande('paradas.json'), {
      wrapper: h.Wrapper,
    });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.version).toBe('vieja');
    expect(result.current.isLoadingError).toBe(false);
  });

  it('descarga fallida sin copia: error con reintento', async () => {
    const falla = createFakeDownloader(undefined, { fail: true });
    const h = createHarness(defaultRoutes(), { downloader: falla.downloader });
    const { result } = await renderHook(() => useStaticArchivoGrande('paradas.json'), {
      wrapper: h.Wrapper,
    });
    await waitFor(() => {
      expect(result.current.isLoadingError).toBe(true);
    });
    expect(result.current.error?.retryable).toBe(true);
    await act(() => result.current.refetch());
    expect(falla.calls).toHaveLength(2);
  });

  it('con enabled: false no carga ni baja', async () => {
    const { downloader, calls } = createFakeDownloader();
    const h = createHarness(defaultRoutes(), { downloader });
    const { result } = await renderHook(
      () => useStaticArchivoGrande('paradas.json', { enabled: false }),
      { wrapper: h.Wrapper },
    );
    expect(result.current.data).toBeUndefined();
    expect(calls).toEqual([]);
    expect(manifest().archivos['paradas.json']).toBeDefined();
  });
});

describe('archivos .geojson (GEOJSON_ESTATICOS_V1)', () => {
  const recorridos = JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'r-601',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-58.38, -34.6],
            [-58.39, -34.61],
          ],
        },
        properties: { lineaId: '601' },
      },
    ],
  });

  it('baja, valida con su esquema y guarda igual que los JSON', async () => {
    const kv = new MemoryKeyValueStore();
    const { downloader, calls } = createFakeDownloader({
      'recorridos-colectivos.geojson': recorridos,
    });
    const manager = new LargeFileManager(kv, downloader);
    manager.loadStored('recorridos-colectivos.geojson');
    await manager.ensure('recorridos-colectivos.geojson', 'v1');
    expect(calls).toEqual(['v1/recorridos-colectivos.geojson']);
    expect(manager.getState('recorridos-colectivos.geojson').data?.features).toHaveLength(1);
    expect(kv.getString(largeFileKeys('recorridos-colectivos.geojson').data)).toBe(recorridos);
    // Otra sesión: lo lee de MMKV sin bajarlo.
    const otra = new LargeFileManager(kv, createFakeDownloader({}).downloader);
    otra.loadStored('recorridos-colectivos.geojson');
    expect(otra.getState('recorridos-colectivos.geojson').version).toBe('v1');
  });

  it('un .geojson fuera de esquema es ContractError', async () => {
    const malo = createFakeDownloader({
      'recorridos-colectivos.geojson': '{"type":"FeatureCollection","features":[{"type":"Nope"}]}',
    });
    const manager = new LargeFileManager(new MemoryKeyValueStore(), malo.downloader);
    await manager.ensure('recorridos-colectivos.geojson', 'v1');
    expect(manager.getState('recorridos-colectivos.geojson').error?.kind).toBe('contract');
  });

  it('con el hook: misma API (data, progress, isPending)', async () => {
    const h = createHarness(
      {
        ...defaultRoutes(),
        '/v1/static/manifest': () => {
          const m = manifest();
          m.archivos['recorridos-colectivos.geojson'] = {
            url: 'v1abc/recorridos-colectivos.geojson',
            bytes: recorridos.length,
            sha256: 'e'.repeat(64),
          };
          return jsonResponse(m);
        },
      },
      {
        downloader: createFakeDownloader({ 'recorridos-colectivos.geojson': recorridos })
          .downloader,
      },
    );
    const { result } = await renderHook(
      () => useStaticArchivoGrande('recorridos-colectivos.geojson'),
      { wrapper: h.Wrapper },
    );
    await waitFor(() => {
      expect(result.current.data?.type).toBe('FeatureCollection');
    });
    expect(result.current).toMatchObject({ version: 'v1abc', isPending: false, progress: null });
  });
});
