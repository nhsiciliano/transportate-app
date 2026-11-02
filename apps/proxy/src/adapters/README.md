# adapters

Traducen upstream → contrato v1 (`@transportate/contracts`). Las interfaces (`SubtesAdapter`, `ColectivosAdapter`, `TransitoAdapter`) y `ApiError` están en `types.ts`. Leen el upstream con los esquemas laxos de `@transportate/contracts/upstream` y el paquete estático con los contratos v1 (`static.ts`).

| Carpeta | Qué hace | Detalle |
|---|---|---|
| `subtes/` | Estado por línea, alertas y arribos (tarea 2.5) | [`subtes/README.md`](subtes/README.md) |
| `colectivos/` | Líneas, posiciones y arribos por parada, siempre con el filtro `route_id` (tarea 2.6) | [`colectivos/README.md`](colectivos/README.md) |
| `transito/` | Stub diferido: siempre 503 (tarea 2.7) | — |

`index.ts` → `createAdapters(env, ctx?)` arma por request una `EdgeCachedFeedSource` y el `StaticStore` sobre el bucket `STATIC`. La fuente recibe las credenciales de `env` y estas variables:

| Variable | Default |
|---|---:|
| `FEED_TTL_SECONDS` | 20 |
| `STATIC_TTL_SECONDS` | 86400 |
| `UPSTREAM_TIMEOUT_MS` | 5000 |

`UPSTREAM_TIMEOUT_MS` es opcional y **todavía no está en `wrangler.jsonc`**: mid-dev la agrega en `vars`. Armar los adaptadores es barato, porque las copias en memoria, los flags de refresco y los índices estáticos viven por isolate y son solo datos.

## CPU del primer request por isolate (colectivos)

**Límite:** el plan Free da 10 ms de CPU por request. **Cómo se mide:** `test/adapters/cpu-static.test.ts`, en workerd local (los timers avanzan durante el cómputo; desplegado no), con el paquete real de `tools/gtfs/out` (versión `4a6eba8c435f`). Mediana de 7 corridas en frío, en esta máquina (darwin-arm64). El test se saltea si no hay build.

| | Archivos | Bytes | CPU |
|---|---|---:|---:|
| **Antes** | `paradas.json`: `JSON.parse` + Zod | 1.695.168 | 19 ms (4 de parse + ~14 de Zod) |
| | `equivalencias-paradas.json`: `JSON.parse` + Zod | 501.281 | 5 ms |
| | `lineas-colectivos.json`: `JSON.parse` + Zod | 160.955 | 1 ms |
| | **Primer request de `arribos()`** | | **~25 ms** (más indexación: ~27 ms medidos en la versión anterior) |
| **Después** | `lineas-colectivos.json`: `JSON.parse` + chequeo estructural + índice | 160.955 | 1 ms |
| | `indice-colectivos.json`: `JSON.parse` + chequeo + `stop_id → paradaId` | 230.680 | 4 ms |
| | **Primer request de `arribos()`** | | **~5 ms** |

El test falla si el primer request supera los 10 ms. Los requests siguientes del isolate no repiten este costo. Detalles en `colectivos/README.md`.

## Latencia ante fallos upstream

- **`arribos(paradaId)`:** presupuesto total de 5 s para el fan-out. Antes demoraba 16,4 s cuando una línea hacía timeout (8 s) más el reintento (8 s); ahora responde en ≤ 5 s, sin la línea que no llegó y con `meta.stale: true`. Lo cubre el test "fan-out con una línea que nunca responde", que tarda unos 5,0 s.
- **`posiciones()` y subtes:** una sola request upstream, con timeout de 5 s y 1 reintento.
- **Verificado en `wrangler dev`** con upstream real: `/v1/colectivos/paradas/pfee923c699/arribos` respondió 200 en 5,03 s con una línea colgada.

## Verificación manual (2026-11-02, `wrangler dev` local con `.dev.vars`)

Paquete estático: `cd tools/gtfs && npm run build` (versión `c4c00838b8f6`) y carga en el R2 local. En `wrangler dev` el binding `STATIC` apunta a `transportate-static-preview`:

```sh
cd apps/proxy
V=<version de out/manifest.json>
for f in <archivos del manifest>; do
  npx wrangler r2 object put "transportate-static-preview/$V/$f" --file ../../tools/gtfs/out/$f --local
done
npx wrangler r2 object put transportate-static-preview/latest/manifest.json --file ../../tools/gtfs/out/manifest.json --local
pnpm --filter transportate-proxy dev
```

Tiempo de `curl` a `localhost:8787` desde esta máquina; la latencia upstream real va incluida en la primera llamada de cada clave.

| Ruta | Status | Bytes | Tiempo | Resultado |
|---|---:|---:|---:|---|
| `/v1/subtes/estado` | 200 | 1.480 | 139 ms | B, C y E `demorada` (obras); el resto `normal`; `ageSeconds` 6 |
| `/v1/subtes/alertas` | 200 | 916 | 4 ms (caché) | 3 alertas (`Alert_LineaB`, `Alert_LineaC`, `Alert_LineaE`) |
| `/v1/subtes/estaciones/1059/arribos` | 200 | 187 | 105 ms | `arribos: []`, `stale: true`, `ageSeconds` 731.499 (forecast congelado desde 2026-10-24 13:08 UTC) |
| `/v1/static/manifest` | 200 | 2.367 | 13 ms | Manifiesto `c4c00838b8f6` (valida `ManifestV1`) |
| `/v1/colectivos/lineas` | 200 | 120.151 | 16 ms | 936 líneas |
| `/v1/colectivos/lineas/1858/posiciones` (línea 10) | 200 | 1.046 | 86 ms / 4 ms (2.ª, caché) | 4 vehículos, `rumbo: null`, `edadSegundos` 55, con `paradaId` por equivalencia |
| `/v1/colectivos/paradas/pfee923c699/arribos` (Av. Entre Ríos 2178, líneas 37 y 150) | 200 | 1.462 | 308 ms / 5 ms (caché) | Arribos de 150 y 37 (ramales R3/R4) con `retrasoSegundos` e `incertidumbre`, un arribo por viaje |
| `/v1/colectivos/paradas/p1e674500c6/arribos` (sin equivalencia) | 200 | 169 | 3 ms | `arribos: []`, sin pedir upstream |
| `/v1/colectivos/lineas/99999/posiciones` | 404 | 61 | 4 ms | `not_found` |
| `/v1/colectivos/paradas/pnoexiste00/arribos` | 404 | 61 | 3 ms | `not_found` |

- Ninguna respuesta ni línea del log de `wrangler dev` contiene `client_secret` ni las credenciales (verificado con `grep`). El log solo muestra el binding `GCBA_CLIENT_SECRET ("(hidden)")`.
- Las segundas llamadas dentro del TTL (20 s) salen de la copia en memoria del isolate.
- Antes de deduplicar por viaje, la respuesta de arribos de esa parada pesaba 3.377 B: el viaje `271522-1` aparecía dos veces, por dos `stop_id` consecutivos que apuntan a la misma parada.
