// Tarea 2.7 diferida: `/transito/v1/cortes` devuelve 500 upstream y el tab Tránsito
// está oculto (docs/00-plan.md, "Correcciones tras la Fase 1"). Se conserva el patrón
// de adaptador para cuando vuelva la fuente.
import { ApiError, type TransitoAdapter } from '../types';

export function createTransitoAdapter(): TransitoAdapter {
  return {
    cortes(): Promise<never> {
      return Promise.reject(
        new ApiError('upstream_unavailable', 'Fuente de cortes no disponible', 503),
      );
    },
  };
}
