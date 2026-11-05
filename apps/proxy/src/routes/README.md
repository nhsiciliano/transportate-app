# routes

Una ruta Hono por servicio, montada en `src/app.ts` bajo `/v1/<servicio>`: `index.ts` (`/v1`), `health.ts`, `subtes.ts`, `trenes.ts`, `colectivos.ts`, `transito.ts` (diferido) y `static.ts`. Validan parámetros y delegan en los adaptadores; nunca conocen el formato upstream.
