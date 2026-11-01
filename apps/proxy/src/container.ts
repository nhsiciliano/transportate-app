// Composición de dependencias de la app: qué adaptadores usa cada request y el reloj.
import type { ColectivosAdapter, SubtesAdapter, TransitoAdapter } from './adapters/types';

export interface Adapters {
  subtes: SubtesAdapter;
  colectivos: ColectivosAdapter;
  transito: TransitoAdapter;
}

/** Arma los adaptadores para una request. Debe ser barato: se llama una vez por request. */
export type AdaptersFactory = (env: CloudflareBindings, ctx?: ExecutionContext) => Adapters;

export interface AppDeps {
  /** Adaptadores fijos (tests) o una fábrica que los arma por request (producción). */
  adapters: Adapters | AdaptersFactory;
  /** Reloj inyectable, en milisegundos desde epoch. */
  now?: () => number;
}

export interface AppVariables {
  adapters: Adapters;
  now: () => number;
}

export type AppEnv = { Bindings: CloudflareBindings; Variables: AppVariables };

export function resolveAdapters(
  deps: AppDeps['adapters'],
  env: CloudflareBindings,
  ctx?: ExecutionContext,
): Adapters {
  return typeof deps === 'function' ? deps(env, ctx) : deps;
}
