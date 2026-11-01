# routes

Una ruta Hono por servicio, montada en `src/app.ts` bajo `/v1/<servicio>`. Valida parámetros, llama al adaptador y fija `Cache-Control`/ETag. Nunca conoce el formato upstream. Por ahora: `health.ts`.
