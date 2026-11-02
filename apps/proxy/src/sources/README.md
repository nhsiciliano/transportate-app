# sources

Acceso al upstream detrás de la interfaz `FeedSource` (`types.ts`, no cambia). La capa B (Durable Object `FeedHub`, Fase 5) va a implementar la misma interfaz.

## Capa A: `EdgeCachedFeedSource` (`edge-cached.ts`, tarea 2.4)

**Lectura:** memoria del isolate (si está fresca) → `caches.default` → upstream.

| Situación | Resultado |
|---|---|
| Entrada con edad < `ttlSeconds` | `fromCache: true, stale: false` |
| Vencida o inexistente | Fetch upstream: timeout de 8 s por intento (`AbortController`), **1 reintento** ante timeout, 5xx o error de red, `User-Agent: transportate-proxy/0.1`. Si sale bien se guarda (con `ctx.waitUntil` si hay ctx) y se devuelve fresca |
| Falla tras el reintento, hay entrada vencida con edad ≤ `maxStaleSeconds` (300) | Se devuelve con `stale: true` (último dato bueno) |
| Falla tras el reintento, sin entrada | `ApiError('upstream_unavailable', 'Servicio del GCBA no disponible', 503, retryAfterSeconds = ttl)` |

Los 4xx (401 credenciales, 404 "No listener") no se reintentan.

- **Clave de caché:** `https://cache.transportate.internal/feed/<key>` (`src/cache/feed-cache.ts`), derivada de `req.key` (p. ej. `colectivos:vehiclePositions:route=1858`). **Nunca la URL upstream**, que lleva el secret.
- **Qué se guarda:** el cuerpo crudo, con headers propios `x-fetched-at` (epoch ms) y `x-upstream-status`, y `max-age` = TTL + ventana de dato viejo, para que la entrada vencida siga disponible como último dato bueno.
- **Coalescing por isolate** (`src/cache/coalesce.ts`): `Map<key, Promise>` a nivel de módulo, porque los adaptadores se arman por request. N llamadas concurrentes con la misma key hacen **1** fetch upstream; la entrada se limpia al resolver.
- **Copia en memoria del isolate** (hasta 256 claves): la Cache API no tiene efecto en `*.workers.dev`, donde está hoy el deploy. Sin esta copia cada request iría al upstream; con ella, cada isolate hace como máximo 1 request por TTL y por clave.
- **Credenciales:** la fuente recibe `{ clientId, clientSecret }` y las agrega a la URL solo dentro del intento de fetch. No aparecen en claves, errores ni logs. El único log es `console.error({ event: 'upstream_error', key, status, ms })`, y el mensaje de los errores de red no se propaga porque puede incluir la URL.

## `upstream.ts`

- `upstreamUrl(path, params)`: URL sin credenciales.
- `feedTtl()`: lee `FEED_TTL_SECONDS` y `STATIC_TTL_SECONDS`, que en `wrangler.jsonc` son strings.
- `buildMeta()`: arma `MetaV1`. `ageSeconds` sale del timestamp del dato upstream, y `stale` si alguna fuente lo fue o si se fuerza.

Tests: `test/sources/edge-cached.test.ts`, con `fetch` mockeado y Cache API real (un cache por caso).
