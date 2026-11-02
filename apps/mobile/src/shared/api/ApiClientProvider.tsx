// El cliente del proxy llega a los hooks por contexto: la app usa uno solo (creado a demanda con
// `EXPO_PUBLIC_API_URL`) y los tests inyectan uno con `fetch` mockeado.
import { createContext, useContext, type ReactNode } from 'react';

import { createApiClient, type ApiClient } from './client';
import { getApiBaseUrl } from './config';

const ApiClientContext = createContext<ApiClient | null>(null);

let defaultClient: ApiClient | undefined;

/** Cliente compartido de la app (una sola caché de ETags). */
export function getDefaultApiClient(): ApiClient {
  defaultClient ??= createApiClient({ baseUrl: getApiBaseUrl() });
  return defaultClient;
}

export function ApiClientProvider({
  client,
  children,
}: {
  client: ApiClient;
  children: ReactNode;
}) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

/** Cliente del contexto o, si no hay provider, el de la app. */
export function useApiClient(): ApiClient {
  return useContext(ApiClientContext) ?? getDefaultApiClient();
}
