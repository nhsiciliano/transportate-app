import type { NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';

import { ContractError, HttpError, NetworkError, TimeoutError } from '../../api/errors';
import {
  connectQueryManagers,
  createAppQueryClient,
  GC_TIME_MS,
  isOnlineState,
  retryDelay,
  shouldRetry,
  withJitter,
} from '../queryClient';
import {
  createMemoryRefreshIntervalStore,
  DEFAULT_REFRESH_INTERVAL,
  isRefreshInterval,
  RefreshIntervalProvider,
  useRefreshInterval,
} from '../refreshInterval';
import { useIsOnline } from '../useIsOnline';

const R = '/v1/subtes/estado';

afterEach(() => {
  focusManager.setEventListener(() => undefined);
  focusManager.setFocused(undefined);
  onlineManager.setEventListener(() => undefined);
  onlineManager.setOnline(true);
});

describe('shouldRetry', () => {
  it.each([
    ['503', new HttpError(R, 503, 'upstream_unavailable', null), true],
    ['429', new HttpError(R, 429, 'rate_limited', 60), true],
    ['red', new NetworkError(R), true],
    ['timeout', new TimeoutError(R, 8000), true],
    ['400', new HttpError(R, 400, 'bad_request', null), false],
    ['404', new HttpError(R, 404, 'not_found', null), false],
    ['contrato', new ContractError(R, []), false],
  ] as const)('%s → %s', (_n, error, expected) => {
    expect(shouldRetry(0, error)).toBe(expected);
  });

  it('como mucho 3 reintentos', () => {
    const error = new NetworkError(R);
    expect([0, 1, 2, 3].map((n) => shouldRetry(n, error))).toEqual([true, true, true, false]);
  });
});

describe('retryDelay', () => {
  it('exponencial con tope de 30 s', () => {
    const error = new NetworkError(R);
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => retryDelay(n, error))).toEqual([
      1000, 2000, 4000, 8000, 16_000, 30_000, 30_000,
    ]);
  });

  it('respeta retryAfterSeconds aunque supere el tope', () => {
    expect(retryDelay(0, new HttpError(R, 429, 'rate_limited', 60))).toBe(60_000);
    expect(retryDelay(4, new HttpError(R, 503, 'upstream_unavailable', 5))).toBe(16_000);
  });
});

describe('withJitter', () => {
  it('±10 % del intervalo', () => {
    expect(withJitter(20_000, () => 0)).toBe(18_000);
    expect(withJitter(20_000, () => 0.5)).toBe(20_000);
    expect(withJitter(20_000, () => 0.999_999)).toBe(22_000);
  });
});

describe('createAppQueryClient', () => {
  it('defaults: gcTime 24 h, sin polling en segundo plano, refetch al enfocar y reconectar', () => {
    const queries = createAppQueryClient().getDefaultOptions().queries;
    expect(queries).toMatchObject({
      gcTime: GC_TIME_MS,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: shouldRetry,
      retryDelay,
    });
    expect(GC_TIME_MS).toBe(86_400_000);
  });
});

describe('connectQueryManagers', () => {
  function fakes() {
    let appListener: ((s: 'active' | 'background' | 'inactive') => void) | undefined;
    let netListener: ((s: NetInfoState) => void) | undefined;
    const remove = jest.fn();
    const unsubscribeNet = jest.fn();
    return {
      appState: {
        addEventListener: (_t: 'change', l: (s: 'active' | 'background' | 'inactive') => void) => {
          appListener = l;
          return { remove };
        },
      },
      netInfo: {
        addEventListener: (l: (s: NetInfoState) => void) => {
          netListener = l;
          return unsubscribeNet;
        },
      },
      app: (s: 'active' | 'background' | 'inactive') => appListener?.(s),
      net: (isConnected: boolean | null) => netListener?.({ isConnected } as NetInfoState),
      remove,
      unsubscribeNet,
    };
  }

  it('AppState active → enfocada; background/inactive → sin foco', () => {
    const f = fakes();
    connectQueryManagers(f.appState, f.netInfo);
    f.app('background');
    expect(focusManager.isFocused()).toBe(false);
    f.app('active');
    expect(focusManager.isFocused()).toBe(true);
    f.app('inactive');
    expect(focusManager.isFocused()).toBe(false);
  });

  it('NetInfo → onlineManager (null = todavía no se sabe = conectado)', () => {
    const f = fakes();
    connectQueryManagers(f.appState, f.netInfo);
    f.net(false);
    expect(onlineManager.isOnline()).toBe(false);
    f.net(true);
    expect(onlineManager.isOnline()).toBe(true);
    f.net(null);
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('al reemplazar los listeners se desuscribe de AppState y NetInfo', () => {
    const f = fakes();
    connectQueryManagers(f.appState, f.netInfo);
    focusManager.setEventListener(() => undefined);
    onlineManager.setEventListener(() => undefined);
    expect(f.remove).toHaveBeenCalled();
    expect(f.unsubscribeNet).toHaveBeenCalled();
  });

  it('isOnlineState', () => {
    expect(isOnlineState({ isConnected: false })).toBe(false);
    expect(isOnlineState({ isConnected: null })).toBe(true);
  });
});

describe('useIsOnline', () => {
  it('sigue al onlineManager (para el OfflineBanner)', async () => {
    const { result } = await renderHook(() => useIsOnline());
    expect(result.current).toBe(true);
    await act(() => {
      onlineManager.setOnline(false);
    });
    expect(result.current).toBe(false);
    await act(() => {
      onlineManager.setOnline(true);
    });
    expect(result.current).toBe(true);
  });
});

describe('RefreshIntervalProvider', () => {
  it('default 20 s sin provider', async () => {
    const { result } = await renderHook(() => useRefreshInterval());
    expect(result.current.seconds).toBe(DEFAULT_REFRESH_INTERVAL);
    expect(DEFAULT_REFRESH_INTERVAL).toBe(20);
  });

  it('lee y guarda en el store inyectado, y sigue cambios de afuera', async () => {
    const store = createMemoryRefreshIntervalStore(30);
    const { result } = await renderHook(() => useRefreshInterval(), {
      wrapper: ({ children }) => (
        <RefreshIntervalProvider store={store}>{children}</RefreshIntervalProvider>
      ),
    });
    expect(result.current.seconds).toBe(30);
    await act(() => {
      result.current.setSeconds(60);
    });
    expect(store.get()).toBe(60);
    expect(result.current.seconds).toBe(60);
    await act(() => {
      store.set(15);
    });
    expect(result.current.seconds).toBe(15);
  });

  it('isRefreshInterval: solo 15/20/30/60 (S17)', () => {
    expect([15, 20, 30, 60, 10, '20'].map(isRefreshInterval)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});
