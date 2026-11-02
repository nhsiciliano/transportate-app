# cache

Utilidades de Cache API y coalescing que usa `src/sources/edge-cached.ts`:

- `feed-cache.ts`: clave sintética `https://cache.transportate.internal/feed/<key>` (nunca la URL upstream) y codificación de la entrada (cuerpo crudo + `x-fetched-at` + `x-upstream-status`).
- `coalesce.ts`: `Coalescer`, una promesa en vuelo por clave a nivel de isolate.
