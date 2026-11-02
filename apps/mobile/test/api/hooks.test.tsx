// Hooks de datos con TanStack Query real, cliente real y `fetch` mockeado (sin red).
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { AppStateStatus } from 'react-native';

import {
  ApiClientProvider,
  createApiClient,
  useArribosParada,
  useEstadoSubtes,
  useLineasColectivo,
  usePosicionesLinea,
} from '@/shared/api';
import {
  connectQueryManagers,
  createAppQueryClient,
  createMemoryRefreshIntervalStore,
  RefreshIntervalProvider,
  type RefreshIntervalSeconds,
} from '@/shared/query';

import * as fx from './fixtures';

type Responder = (url: string) => Response | Promise<Response>;

function setup(
  responder: Responder,
  { client: qc, interval = 20 }: { client?: QueryClient; interval?: RefreshIntervalSeconds } = {},
) {
  const fetchMock = jest.fn((url: string) => Promise.resolve(responder(url)));
  const api = createApiClient({
    baseUrl: 'https://proxy.test',
    fetch: fetchMock as unknown as typeof fetch,
    now: () => Date.now(),
  });
  // Cliente de test: sin reintentos salvo que el test pase el de la app.
  const queryClient = qc ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createMemoryRefreshIntervalStore(interval);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={api}>
          <RefreshIntervalProvider store={store}>{children}</RefreshIntervalProvider>
        </ApiClientProvider>
      </QueryClientProvider>
    );
  }
  return { fetchMock, queryClient, Wrapper, store };
}

/** AppState falso: guarda el listener para simular primer/segundo plano. */
function fakeAppState() {
  let listener: ((s: AppStateStatus) => void) | undefined;
  return {
    addEventListener: (_type: 'change', l: (s: AppStateStatus) => void) => {
      listener = l;
      return { remove: () => (listener = undefined) };
    },
    emit: (s: AppStateStatus) => listener?.(s),
  };
}
const fakeNetInfo = { addEventListener: () => () => undefined };

afterEach(() => {
  // Los managers de TanStack son globales: se vuelven a un estado neutro.
  focusManager.setEventListener(() => undefined);
  focusManager.setFocused(undefined);
  onlineManager.setEventListener(() => undefined);
  onlineManager.setOnline(true);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('hooks de datos', () => {
  it('useEstadoSubtes devuelve datos y la frescura para FreshnessLabel', async () => {
    const { Wrapper, queryClient } = setup(() =>
      fx.jsonResponse(fx.estado, { headers: { 'X-Transportate-Stale': '1' } }),
    );
    const { result } = await renderHook(() => useEstadoSubtes(), { wrapper: Wrapper });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(result.current.data?.lineas.map((l) => l.linea)).toEqual(['A', 'C']);
    expect(result.current.sourceTimestamp).toBe(fx.SOURCE_TS);
    expect(result.current.stale).toBe(true);
    expect(typeof result.current.ageSeconds).toBe('number');
    expect(result.current.error).toBeNull();
    queryClient.clear();
  });

  it('staleTime = meta.ttlSeconds del dato (24 h en líneas de colectivo)', async () => {
    const { Wrapper, queryClient } = setup(() => fx.jsonResponse(fx.lineasColectivo));
    const { result } = await renderHook(() => useLineasColectivo(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    const query = queryClient.getQueryCache().find({ queryKey: ['colectivos', 'lineas'] });
    expect(query?.isStale()).toBe(false);
    queryClient.clear();
  });

  it('sin id no consulta (enabled)', async () => {
    const { Wrapper, fetchMock, queryClient } = setup(() => fx.jsonResponse(fx.arribosParada));
    const { result } = await renderHook(() => useArribosParada(''), { wrapper: Wrapper });
    expect(result.current.isPending).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    const { result: posiciones } = await renderHook(
      () => usePosicionesLinea('1234', { enabled: false }),
      { wrapper: Wrapper },
    );
    expect(posiciones.current.isPending).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('mantiene el último dato bueno cuando falla una actualización', async () => {
    let fail = false;
    const { Wrapper, queryClient } = setup(() =>
      fail
        ? fx.jsonResponse(fx.errorBody('upstream_unavailable'), { status: 503 })
        : fx.jsonResponse(fx.estado),
    );
    const { result } = await renderHook(() => useEstadoSubtes(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    fail = true;
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data?.lineas).toHaveLength(2); // el dato anterior sigue
    expect(result.current.error?.kind).toBe('http');
    expect(result.current.isRefreshError).toBe(true); // → Alert en línea, no ErrorState
    expect(result.current.isLoadingError).toBe(false);
    queryClient.clear();
  });
});

describe('reintentos (QueryClient de la app)', () => {
  function appClient() {
    const qc = createAppQueryClient();
    // Misma política de `retry`, sin esperar el backoff real.
    qc.setDefaultOptions({ queries: { ...qc.getDefaultOptions().queries, retryDelay: 1 } });
    return qc;
  }

  it('reintenta un 503 (retryable) y termina con datos', async () => {
    let calls = 0;
    const { Wrapper, fetchMock, queryClient } = setup(
      () =>
        calls++ === 0
          ? fx.jsonResponse(fx.errorBody('upstream_unavailable'), { status: 503 })
          : fx.jsonResponse(fx.estado),
      { client: appClient() },
    );
    const { result } = await renderHook(() => useEstadoSubtes(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    queryClient.clear();
  });

  it('como mucho 3 reintentos', async () => {
    const { Wrapper, fetchMock, queryClient } = setup(
      () => fx.jsonResponse(fx.errorBody('upstream_unavailable'), { status: 503 }),
      { client: appClient() },
    );
    const { result } = await renderHook(() => useEstadoSubtes(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 + 3 reintentos
    expect(result.current.isLoadingError).toBe(true); // sin datos → ErrorState
    queryClient.clear();
  });

  it.each([
    ['404', () => fx.jsonResponse(fx.errorBody('not_found'), { status: 404 }), 'http'],
    ['contrato roto', () => fx.jsonResponse({ meta: 1 }), 'contract'],
  ] as const)('no reintenta un error no retryable (%s)', async (_name, respond, kind) => {
    const { Wrapper, fetchMock, queryClient } = setup(respond, { client: appClient() });
    const { result } = await renderHook(() => useEstadoSubtes(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.error?.kind).toBe(kind);
    expect(result.current.error?.retryable).toBe(false);
    queryClient.clear();
  });
});

describe('polling solo en primer plano', () => {
  it('refresca cada intervalo (± jitter) en primer plano y se detiene en segundo plano', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // jitter 0 → exactamente el intervalo
    const appState = fakeAppState();
    connectQueryManagers(appState, fakeNetInfo);
    await act(() => {
      appState.emit('active');
    });

    const { Wrapper, fetchMock, queryClient } = setup(() => fx.jsonResponse(fx.estado), {
      interval: 15,
    });
    const { result } = await renderHook(() => useEstadoSubtes(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // A segundo plano: AppState 'background' → focusManager sin foco → el intervalo no corre.
    await act(() => {
      appState.emit('background');
    });
    expect(focusManager.isFocused()).toBe(false);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Vuelta a primer plano: refetch inmediato (dato vencido) y el polling sigue.
    await act(() => {
      appState.emit('active');
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    queryClient.clear();
  });

  it('el intervalo sale del RefreshIntervalProvider (S17)', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const { Wrapper, fetchMock, queryClient, store } = setup(() => fx.jsonResponse(fx.estado), {
      interval: 60,
    });
    const { result } = await renderHook(() => useEstadoSubtes(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.get()).toBe(60);
    queryClient.clear();
  });

  it('los estáticos no hacen polling', async () => {
    jest.useFakeTimers();
    const { Wrapper, fetchMock, queryClient } = setup(() => fx.jsonResponse(fx.lineasColectivo));
    const { result } = await renderHook(() => useLineasColectivo(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });
});
