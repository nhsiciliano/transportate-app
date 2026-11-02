// Tipo de error por defecto de TanStack Query en toda la app: los `queryFn` de `shared/api`
// normalizan cualquier falla a `ApiError` (`toApiError`), así que `query.error` siempre lo es.
// https://tanstack.com/query/v5/docs/framework/react/typescript#registering-a-global-error
import type { ApiError } from '../api/errors';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError;
  }
}
