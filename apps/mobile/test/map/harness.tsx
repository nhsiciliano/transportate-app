// Armado de los tests del mapa: tema (claro u oscuro), áreas seguras con medidas fijas, TanStack
// Query sin reintentos y un cliente del proxy con `fetch` mockeado (nada de red).
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ApiClientProvider, createApiClient } from '@/shared/api';
import { createLastKnownStore, StaticStoreProvider } from '@/shared/static';
import { MemoryKeyValueStore } from '@/shared/storage/kv';
import { createMemoryPreferenceStore, ThemeProvider, type ThemePreference } from '@/shared/theme';

import { jsonResponse } from '../api/fixtures';
import { manifestMapa, subteEstaciones, subteRed } from './fixtures';

export const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export type Responder = (url: string) => Response | Promise<Response>;

/** Respuestas felices: manifiesto, red y estaciones del fixture. */
export const okResponder: Responder = (url) => {
  if (url.endsWith('/v1/static/manifest')) return jsonResponse(manifestMapa);
  if (url.endsWith('/subte-red.geojson')) return jsonResponse(subteRed);
  if (url.endsWith('/subte-estaciones.json')) return jsonResponse(subteEstaciones);
  return new Response('{}', { status: 404 });
};

export interface MapHarnessOptions {
  theme?: ThemePreference;
  fetch?: Responder;
  online?: boolean;
  /** Para simular la caché persistida: se llama antes de montar. */
  seed?: (client: QueryClient) => void;
}

export async function renderMap(ui: ReactElement, options: MapHarnessOptions = {}) {
  const responder = options.fetch ?? okResponder;
  const fetchMock = jest.fn((url: string) => Promise.resolve(responder(url)));
  const api = createApiClient({
    baseUrl: 'https://proxy.test',
    fetch: fetchMock as unknown as typeof fetch,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  options.seed?.(queryClient);
  onlineManager.setOnline(options.online ?? true);
  const themeStore = createMemoryPreferenceStore(options.theme ?? 'light');
  // Última versión conocida del estático en memoria: nada queda entre tests.
  const lastKnown = createLastKnownStore(new MemoryKeyValueStore());

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider store={themeStore}>
          <QueryClientProvider client={queryClient}>
            <ApiClientProvider client={api}>
              <StaticStoreProvider store={lastKnown}>{children}</StaticStoreProvider>
            </ApiClientProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  const view = await render(ui, { wrapper: Wrapper });
  return { fetchMock, queryClient, themeStore, view };
}
