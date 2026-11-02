# sources

Acceso al upstream detrás de la interfaz `FeedSource` (`types.ts`, no cambia). La capa B (Durable Object `FeedHub`, Fase 5) va a implementar la misma interfaz.

## Capa A: `EdgeCachedFeedSource` (`edge-cached.ts`, tarea 2.4)

`fetch(req, opts?)` es compatible con `FeedSource`. Agrega `opts.signal` (plazo del llamador) y `opts.retry` (default `true`); las dos juntas forman `DeadlineFeedSource`.

**Lectura:** memoria del isolate (si está fresca) → `caches.default` → upstream.

| Situación | Resultado |
|---|---|
| Entrada con edad < `ttlSeconds` | `fromCache: true, stale: false` |
| Vencida o inexistente | Una request toma el flag de refresco y va al upstream: timeout por intento `UPSTREAM_TIMEOUT_MS` (default **5 s**, `AbortSignal.timeout`), **1 reintento** ante timeout, 5xx o error de red (salvo `retry: false`), `User-Agent: transportate-proxy/0.1`. Si sale bien se guarda en memoria y en la Cache API (con `ctx.waitUntil` si hay ctx) |
| Otra request ya está refrescando | No se la espera: se sirve la copia vencida, o en frío se sondea la memoria hasta 500 ms y después se hace un fetch propio (ver `src/cache/README.md`) |
| Falla, o se vence `opts.signal`, y hay entrada vencida con edad ≤ `maxStaleSeconds` (300) | Se devuelve con `stale: true` (último dato bueno) |
| Falla sin entrada | `ApiError('upstream_unavailable', 'Servicio del GCBA no disponible', 503, retryAfterSeconds = ttl)` |

Los 4xx (401 credenciales, 404 "No listener") no se reintentan. Si se vence el plazo del llamador, el fetch sigue dentro de la **misma** request y llena la caché al terminar.

- **Clave de caché:** `https://cache.transportate.internal/feed/<key>` (`src/cache/feed-cache.ts`), derivada de `req.key` (p. ej. `colectivos:vehiclePositions:route=1858`). **Nunca la URL upstream**, que lleva el secret.
- **Qué se guarda:** el cuerpo crudo, con headers propios `x-fetched-at` (epoch ms) y `x-upstream-status`, y `max-age` = TTL + ventana de dato viejo.
- **Un refresco por clave y por isolate, sin promesas compartidas** (regla de workerd en `src/cache/README.md`). A nivel de módulo solo hay datos (copias de hasta 256 claves) y un flag de refresco con vencimiento. La copia en memoria hace falta además porque la Cache API no tiene efecto en `*.workers.dev`.
- **Credenciales:** la fuente recibe `{ clientId, clientSecret }` y las agrega a la URL solo dentro del intento de fetch. No aparecen en claves, errores ni logs.
- **Logs** (sin URL ni datos de la request):
  - `{ event: 'upstream_fetch', key, status, ms }` por cada fetch real;
  - `{ event: 'upstream_error' | 'upstream_deadline', key, status, ms }` por cada fallo.

## Configuración

| Variable | Default | Uso |
|---|---|---|
| `FEED_TTL_SECONDS` | 20 | TTL de los feeds de tiempo real |
| `STATIC_TTL_SECONDS` | 86400 | Cada cuánto se revisa el manifiesto estático |
| `UPSTREAM_TIMEOUT_MS` | 5000 | Timeout por intento upstream. **Todavía no está en `wrangler.jsonc`**: `createAdapters` la lee opcional (mid-dev: agregarla en `vars` de cada entorno como string, p. ej. `"5000"`, y regenerar los tipos) |

## `upstream.ts`

- `upstreamUrl(path, params)`: URL sin credenciales.
- `feedTtl()`: lee las vars numéricas, que en `wrangler.jsonc` son strings.
- `buildMeta()`: arma `MetaV1`. `ageSeconds` sale del timestamp del dato upstream, y `stale` si alguna fuente lo fue o si se fuerza.

Tests: `test/sources/edge-cached.test.ts`, con `fetch` mockeado y Cache API real (un cache por caso). Incluye requests separadas (una refresca y la otra no la espera), arranque en frío con espera corta y plazo vencido con y sin último dato bueno.
