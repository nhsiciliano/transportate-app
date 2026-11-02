# tools/carga

Prueba de carga **local** del proxy (Fase 2, tarea 2.12) contra `wrangler dev`, con dos objetivos:

- demostrar que el upstream recibe ~**1 fetch por clave cada `FEED_TTL_SECONDS`**, sin importar cuántas requests lleguen (coalescing + copia en memoria + Cache API);
- demostrar que el rate limit corta con **429 + `Retry-After`**.

Es un paquete standalone (npm, Node ≥ 22, ESM) fuera del workspace pnpm. Su única dependencia es `autocannon` **8.0.0**.

## Uso

```sh
# 1. Paquete estático en el R2 local (ver apps/proxy/src/adapters/README.md):
cd tools/gtfs && npm install && npm run build && cd ../../apps/proxy
V=$(node -p "require('../../tools/gtfs/out/manifest.json').version")
for f in $(node -p "Object.keys(require('../../tools/gtfs/out/manifest.json').archivos).join(' ')"); do
  npx wrangler r2 object put "transportate-static-preview/$V/$f" --file ../../tools/gtfs/out/$f --local
done
npx wrangler r2 object put transportate-static-preview/latest/manifest.json --file ../../tools/gtfs/out/manifest.json --local

# 2. Proxy local con el log a un archivo (fuera del repo):
mkdir -p ~/.cache/transportate/carga
pnpm --filter transportate-proxy dev --port 8787 > ~/.cache/transportate/carga/wrangler-dev.log 2>&1 &

# 3. Carga:
cd tools/carga && npm install --no-package-lock
node carga.mjs --base=http://localhost:8787 --log=~/.cache/transportate/carga/wrangler-dev.log
node carga.mjs --duration=45 --out=~/.cache/transportate/carga/run-45s.json   # variante larga
```

| Flag | Default | Efecto |
|---|---|---|
| `--base` | `http://localhost:8787` | Proxy a probar (`wrangler dev`). Si el 8787 está ocupado por otro proceso, levantá el tuyo con `--port` y pasalo acá |
| `--log` | `~/.cache/transportate/carga/wrangler-dev.log` | Log de `wrangler dev` donde se cuentan los eventos `upstream_fetch`/`upstream_error` escritos durante la corrida |
| `--connections` / `--duration` | 50 / 10 | Escenario A |
| `--paths` | `/v1/subtes/estado,/v1/colectivos/lineas/1858/posiciones` | Rutas del escenario A, separadas por coma |
| `--out` | — | Guarda el JSON del resultado |

**Cómo se cuenta el upstream:** `EdgeCachedFeedSource` loguea `{"event":"upstream_fetch","key","status","ms"}` en cada fetch real y `upstream_error` en cada fallo. Nunca loguea URL ni credenciales. El script cuenta esos eventos en el tramo del log escrito durante la corrida.

**IPs sintéticas:** en el escenario A cada request lleva un `cf-connecting-ip` aleatorio (`10.x.x.x`) para que el rate limit (60/min por cliente) no corte la prueba y las requests lleguen a los adaptadores. En local, wrangler respeta ese header del cliente; en Cloudflare lo pone el edge y no se puede falsificar. El escenario B usa una sola IP de documentación (`192.0.2.x`).

## Resultados (2026-11-02, darwin-arm64, Node 24.20, wrangler 4.156.1, `wrangler dev` local con upstream real)

Paquete estático `94df4cbe025b` en el R2 local. `FEED_TTL_SECONDS=20`. Latencias medidas por autocannon desde la misma máquina; incluyen el overhead de `wrangler dev`/workerd local, no la red de Cloudflare.

### Escenario A — coalescing (50 conexiones, dos rutas alternadas)

| Corrida | Requests | req/s | p50 | p90 | p99 | máx | No-2xx | Fetches upstream (por clave) |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 10 s | 9.173 | 917 | 49 ms | 73 ms | 151 ms | 158 ms | **0** | **1**: `colectivos:vehiclePositions:route=1858` ×1. `subtes:serviceAlerts:json` ×0, porque ya estaba fresco en memoria por una request previa |
| 45 s | 30.435 | 676 | 71 ms | 95 ms | 159 ms | 245 ms | **57 × 500** (0,19 %) | **5**: `colectivos:vehiclePositions:route=1858` ×3, `subtes:serviceAlerts:json` ×2 |

- **Coalescing confirmado:** 30.435 requests generaron 5 fetches upstream en 45 s, es decir 1 por clave por TTL (45 s / 20 s ≈ 2–3 por clave). La carga sobre la API del GCBA no depende de la cantidad de requests.
- **Defecto encontrado (pendiente, código de `src/cache/`):** los 57 errores 500 de la corrida de 45 s (47 en `/v1/subtes/estado`, 3 en posiciones) son `Uncaught Error: The Workers runtime canceled this request because it detected that your Worker's code had hung`.
  - Aparecen alrededor de los refrescos upstream.
  - La causa probable es que `Coalescer` comparte una misma `Promise` entre requests, y en workerd el I/O de esa promesa (fetch, `caches.default`) pertenece a la request que la creó. Las demás requests que la esperan pueden quedar colgadas.
  - Se reportó al coordinador para que lo corrija quien mantiene `src/cache/**`.
  - Hay que **re-correr esta prueba** después del arreglo: el criterio es 0 no-2xx en la corrida de 45 s.

### Escenario B — rate limit (100 requests seguidas, misma IP, `/v1/subtes/alertas`)

| Corrida | 200 | 429 | `Retry-After` |
|---|---:|---:|---|
| tras la de 10 s | 60 | 40 | `60` |
| tras la de 45 s | 60 | 40 | `60` |

- El binding `ratelimit` **sí se aplica en `wrangler dev`**: Miniflare lo simula en memoria, con 60 requests por 60 s por clave. Pasan exactamente 60 y el resto recibe 429 `rate_limited` con `Retry-After: 60`.
- En Cloudflare los contadores son por colo y "eventualmente consistentes" (`docs/05-privacidad.md`), así que en `preview` el corte puede ser algo menos exacto. Para validarlo desplegado, hay que correr este escenario contra el Worker `preview`, cambiando `--base` y sin `cf-connecting-ip` sintético, porque el edge pone el real.

### Otras verificaciones de la misma sesión

- `curl` a `/v1/subtes/estado` dos veces seguidas, la segunda con `If-None-Match: <ETag de la primera>` → **304, 0 bytes**. Esto pasó con el ETag estable de `src/middleware/envelope.ts`; antes del arreglo daba 200.
- El log de `wrangler dev` no contiene `client_secret` ni los valores de las credenciales: solo `GCBA_CLIENT_SECRET ("(hidden)")` en la lista de bindings.
- Trampa del entorno: si el puerto 8787 ya lo usa otro `wrangler dev` (por ejemplo, de otro worktree), las requests le pegan a **ese** servidor con su código. Verificá en el log tu línea `Ready on http://localhost:<puerto>`.
