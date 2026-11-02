// Query keys tipadas por recurso. Jerarquía `[dominio, recurso, id?]`: invalidar `['subtes']`
// alcanza a todo lo de subtes (https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation).
import type { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  subtes: {
    all: ['subtes'] as const,
    estado: () => ['subtes', 'estado'] as const,
    alertas: () => ['subtes', 'alertas'] as const,
    arribos: (estacionId: string) => ['subtes', 'arribos', estacionId] as const,
  },
  colectivos: {
    all: ['colectivos'] as const,
    lineas: () => ['colectivos', 'lineas'] as const,
    posiciones: (lineaId: string) => ['colectivos', 'posiciones', lineaId] as const,
    arribos: (paradaId: string) => ['colectivos', 'arribos', paradaId] as const,
  },
  static: {
    all: ['static'] as const,
    manifest: () => ['static', 'manifest'] as const,
  },
} as const;

/** Todo lo de subtes (estado, alertas y arribos). */
export function invalidateSubtes(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: queryKeys.subtes.all });
}

/** Todo lo de colectivos (líneas, posiciones y arribos). */
export function invalidateColectivos(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: queryKeys.colectivos.all });
}

/**
 * Solo el tiempo real (estado, alertas, arribos y posiciones): lo que se refresca al tocar
 * "Reintentar" o al volver la conexión. Las líneas y el manifiesto (estáticos) quedan.
 */
export function invalidateRealtime(client: QueryClient): Promise<void> {
  return client.invalidateQueries({
    predicate: (query) => {
      const [domain, resource] = query.queryKey;
      if (domain === 'subtes') return true;
      return domain === 'colectivos' && resource !== 'lineas';
    },
  });
}
