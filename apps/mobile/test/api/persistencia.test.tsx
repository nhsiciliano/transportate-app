// QueryProvider con el persister real de shared/storage sobre un KeyValueStore en memoria:
// la caché se guarda en el teléfono y, al reabrir la app sin conexión, se muestra lo último.
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiClientProvider, createApiClient, useEstadoSubtes } from '@/shared/api';
import { CACHE_BUSTER, QueryProvider } from '@/shared/query';
import { MemoryKeyValueStore } from '@/shared/storage/kv';
import { createQueryPersister, QUERY_CACHE_KEY } from '@/shared/storage/queryPersister';

import * as fx from './fixtures';

function wrapper(kv: MemoryKeyValueStore, fetchMock: typeof fetch) {
  const api = createApiClient({
    baseUrl: 'https://proxy.test',
    fetch: fetchMock,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const persister = createQueryPersister(kv);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryProvider client={client} persister={persister}>
        <ApiClientProvider client={api}>{children}</ApiClientProvider>
      </QueryProvider>
    );
  };
}

afterEach(() => {
  focusManager.setEventListener(() => undefined);
  focusManager.setFocused(undefined);
  onlineManager.setEventListener(() => undefined);
  onlineManager.setOnline(true);
});

describe('persistencia de la caché', () => {
  it('guarda las consultas exitosas con el buster del contrato y las restaura sin red', async () => {
    const kv = new MemoryKeyValueStore();
    const online = jest.fn(() => Promise.resolve(fx.jsonResponse(fx.estado)));
    const first = await renderHook(() => useEstadoSubtes(), { wrapper: wrapper(kv, online) });
    await waitFor(() => {
      expect(first.result.current.status).toBe('success');
    });
    // El persister escribe con throttle (1 s).
    await waitFor(
      () => {
        expect(kv.getString(QUERY_CACHE_KEY)).toBeDefined();
      },
      { timeout: 3000 },
    );
    const saved = JSON.parse(kv.getString(QUERY_CACHE_KEY) ?? '{}') as { buster?: string };
    expect(saved.buster).toBe(CACHE_BUSTER);
    await first.unmount();

    // "Reabrir la app" sin conexión: el dato sale del teléfono y no se pide nada.
    onlineManager.setOnline(false);
    const offline = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    const second = await renderHook(() => useEstadoSubtes(), { wrapper: wrapper(kv, offline) });
    await waitFor(() => {
      expect(second.result.current.data?.lineas).toHaveLength(2);
    });
    expect(second.result.current.sourceTimestamp).toBe(fx.SOURCE_TS);
    expect(offline).not.toHaveBeenCalled();
    await second.unmount();
  }, 15_000);
});
