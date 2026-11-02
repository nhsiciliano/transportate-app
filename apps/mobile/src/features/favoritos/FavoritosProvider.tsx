// Contexto de favoritos: el repositorio llega por prop (default MMKV; los tests pasan uno sobre
// `MemoryKeyValueStore`). Todavía no se monta en `src/app/_layout.tsx`: lo hace la tarea de
// integración 3.11 junto con el ThemeProvider y el QueryClient.
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import type { FavoritoV1 } from './model';
import { getDefaultFavoritosRepository, type FavoritosRepository } from './repository';

const FavoritosContext = createContext<FavoritosRepository | null>(null);

export interface FavoritosProviderProps {
  repository?: FavoritosRepository;
  children: ReactNode;
}

export function FavoritosProvider({ repository, children }: FavoritosProviderProps) {
  const [value] = useState(() => repository ?? getDefaultFavoritosRepository());
  return <FavoritosContext.Provider value={value}>{children}</FavoritosContext.Provider>;
}

/** Repositorio del contexto (para las acciones: add, remove, setAlias…). */
export function useFavoritosRepository(): FavoritosRepository {
  const repository = useContext(FavoritosContext);
  if (!repository) throw new Error('useFavoritos necesita un <FavoritosProvider> más arriba.');
  return repository;
}

export interface UseFavoritosResult {
  favoritos: readonly FavoritoV1[];
  repository: FavoritosRepository;
}

/** Lista de favoritos que se re-renderiza con cada cambio del repositorio. */
export function useFavoritos(): UseFavoritosResult {
  const repository = useFavoritosRepository();
  const favoritos = useSyncExternalStore(
    (callback) => repository.subscribe(callback),
    () => repository.list(),
  );
  return { favoritos, repository };
}
