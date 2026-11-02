# cache

Utilidades de Cache API y plazos que usa `src/sources/edge-cached.ts`:

- `feed-cache.ts`: clave sintética `https://cache.transportate.internal/feed/<key>` (nunca la URL upstream) y codificación de la entrada (cuerpo crudo + `x-fetched-at` + `x-upstream-status`).
- `deadline.ts`: `raceAbort(promesa, signal)`, para que cada llamador compita contra su propio plazo (por ejemplo, el presupuesto de 5 s del fan-out de arribos) sin cancelar el trabajo de fondo.

## Regla de workerd: no compartir I/O ni promesas entre requests

Cloudflare: *"Cannot perform I/O on behalf of a different request"* y *"Do not store request-scoped state in global scope"*. Los objetos de I/O (streams, `Request`, `Response`) quedan atados a la invocación que los creó, y entre requests solo se puede compartir **el dato**, no el objeto. Fuente: [Workers errors](https://developers.cloudflare.com/workers/observability/errors/#cannot-perform-io-on-behalf-of-a-different-request) y [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), consultadas vía Context7 el 2026-11-02.

**Qué pasó:** la primera versión hacía coalescing con una `Promise` compartida a nivel de módulo (`Coalescer`, `Map<key, Promise>`). En workerd, el fetch, la Cache API y el `waitUntil` de esa promesa pertenecen a la request que la creó. Las demás requests que la esperaban quedaban colgadas si esa request terminaba antes. En la prueba de carga de mid-dev (50 conexiones × 45 s, 30.435 requests) salieron **57 respuestas 500**: *"The Workers runtime canceled this request because it detected that your Worker's code had hung"*.

**Cómo quedó (sin promesas compartidas):**

- **Estado de módulo:** solo **datos**, es decir copias `{ body, fetchedAt, upstreamStatus }` y un flag `refreshing: Map<key, hastaEpochMs>`, que es un timestamp con vencimiento y no una promesa.
- **Hay copia vencida (≤ `maxStaleSeconds`) y nadie refresca:** la request toma el flag, refresca con **su propio** I/O (`ctx.waitUntil` propio para el `cache.put`) y devuelve el dato nuevo. Las requests concurrentes no esperan: sirven la copia al instante (`stale: false` hasta 2×TTL de edad, y `true` después).
- **Arranque en frío** (nada en memoria ni en Cache API) **con otra request refrescando:** se sondea la memoria del isolate cada 25 ms, hasta 500 ms (es un dato, no I/O). Si no llega, la request hace su propio fetch. Los duplicados solo pueden aparecer en frío y por isolate.
- **El índice estático de colectivos** (`src/adapters/colectivos/static-index.ts`) sigue la misma regla: guarda índices ya parseados, nunca la promesa de una lectura de R2.

**Verificación** (2026-11-02, `wrangler dev` local con upstream real, `tools/carga` de mid-dev):

| Corrida | Requests | req/s | p50 / p99 | No-2xx | "hung" | Fetches upstream |
|---|---:|---:|---|---:|---:|---|
| 50 conexiones × 45 s, `/v1/subtes/estado` + posiciones 1858 | 35.272 | 784 | 61 / 130 ms | **0** | **0** | 5 (1 por clave y por TTL) |
| 50 conexiones × 45 s, + `/v1/colectivos/lineas` + arribos de `pfee923c699` | 28.102 | 624 | 76 / 145 ms | **0** | **0** | 27 (≤ 3 por clave en 45 s) |
