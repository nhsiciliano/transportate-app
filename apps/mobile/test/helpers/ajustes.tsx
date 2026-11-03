// Armado común de los tests de Ajustes: providers reales (tema, datos, intervalo, favoritos)
// sobre un `MemoryKeyValueStore`, un cliente del proxy con `fetch` mockeado y nada de red.
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Text } from 'react-native';

import { MmkvFavoritosRepository, FavoritosProvider } from '@/features/favoritos';
import { ApiClientProvider, createApiClient } from '@/shared/api';
import { RefreshIntervalProvider } from '@/shared/query';
import { MemoryKeyValueStore } from '@/shared/storage/kv';
import {
  createRefreshIntervalStore,
  createThemePreferenceStore,
} from '@/shared/storage/preferences';
import { ThemeProvider, useTheme } from '@/shared/theme';

/** Muestra el esquema vigente para poder afirmar que el cambio de tema llegó a la UI. */
function SchemeProbe() {
  const { scheme, preference } = useTheme();
  return <Text testID="scheme-probe">{`${scheme}/${preference}`}</Text>;
}

export interface AjustesHarnessOptions {
  fetch?: (url: string) => Response | Promise<Response>;
  /** Favoritos iniciales (se agregan antes de montar). */
  favoritos?: readonly { tipo: 'linea_subte'; refId: string; nombre: string }[];
  online?: boolean;
}

export function renderWithApp(ui: ReactElement, options: AjustesHarnessOptions = {}) {
  const kv = new MemoryKeyValueStore();
  const favoritosRepo = new MmkvFavoritosRepository(kv, {
    now: () => new Date('2026-11-03T12:00:00Z'),
  });
  for (const f of options.favoritos ?? []) favoritosRepo.add(f);

  const fetchMock = jest.fn((url: string) =>
    Promise.resolve(options.fetch ? options.fetch(url) : new Response('{}', { status: 500 })),
  );
  const api = createApiClient({
    baseUrl: 'https://proxy.test',
    fetch: fetchMock as unknown as typeof fetch,
    now: () => Date.now(),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  onlineManager.setOnline(options.online ?? true);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider store={createThemePreferenceStore(kv)}>
        <QueryClientProvider client={queryClient}>
          <ApiClientProvider client={api}>
            <RefreshIntervalProvider store={createRefreshIntervalStore(kv)}>
              <FavoritosProvider repository={favoritosRepo}>
                {children}
                <SchemeProbe />
              </FavoritosProvider>
            </RefreshIntervalProvider>
          </ApiClientProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return {
    kv,
    favoritosRepo,
    queryClient,
    fetchMock,
    Wrapper,
    render: () => render(ui, { wrapper: Wrapper }),
  };
}

export function resetOnline() {
  onlineManager.setOnline(true);
}
