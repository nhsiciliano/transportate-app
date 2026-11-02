// Provider de datos de la app: QueryClient + persistencia de la caché en el teléfono.
// - Persister de `shared/storage/queryPersister.ts` (MMKV, tarea 3.10).
// - `maxAge` 24 h (igual que `gcTime`: si no, el persister restauraría consultas ya recolectadas).
// - `buster` = versión del contrato: si cambia el esquema, la caché vieja se descarta entera.
// Solo se persisten consultas exitosas (default de `dehydrate`); los errores no se guardan.
import type { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider, type Persister } from '@tanstack/react-query-persist-client';
import { useEffect, useState, type ReactNode } from 'react';

import { createQueryPersister } from '../storage/queryPersister';
import { connectQueryManagers, createAppQueryClient, GC_TIME_MS } from './queryClient';

/** Versión del contrato JSON (`@transportate/contracts`, rutas `/v1`). */
export const CACHE_BUSTER = 'v1';
export const PERSIST_MAX_AGE_MS = GC_TIME_MS;

export interface QueryProviderProps {
  children: ReactNode;
  /** Inyectables para tests. */
  client?: QueryClient;
  persister?: Persister;
}

export function QueryProvider({ children, client, persister }: QueryProviderProps) {
  const [ownClient] = useState(() => client ?? createAppQueryClient());
  const [ownPersister] = useState(() => persister ?? createQueryPersister());

  useEffect(() => {
    connectQueryManagers();
  }, []);

  return (
    <PersistQueryClientProvider
      client={ownClient}
      persistOptions={{ persister: ownPersister, maxAge: PERSIST_MAX_AGE_MS, buster: CACHE_BUSTER }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
