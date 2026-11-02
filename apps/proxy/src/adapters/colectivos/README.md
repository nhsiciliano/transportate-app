# adapters/colectivos

`createColectivosAdapter({ source, store, ttlSeconds, staticTtlSeconds, now })` implementa `ColectivosAdapter` (tarea 2.6).

## Nunca el feed completo

El feed completo de colectivos pesa 580 KB (`vehiclePositions`) y 3,6 MB (`tripUpdates`). Decodificarlo excede el CPU del plan Free (`docs/04-escalabilidad.md` §9), así que **siempre se pide filtrado por `route_id`**:

| Feed | Clave de caché | TTL | Tamaño medido |
|---|---|---:|---|
| `GET /colectivos/vehiclePositions?route_id=<lineaId>` | `colectivos:vehiclePositions:route=<lineaId>` | 20 s (upstream: 60 s) | 363–587 B |
| `GET /colectivos/tripUpdates?route_id=<lineaId>` | `colectivos:tripUpdates:route=<lineaId>` | 20 s | 4,2–5,0 KB |

**Verificación del filtro en `tripUpdates`** (llamada real con `.dev.vars`, 2026-11-02 00:0x UTC): con `route_id=1858` (línea 10) llegaron 5 viajes con 154 `stop_time_update`, y con `route_id=1553` (228B), 4 viajes con 124. Todos los viajes tenían el `route_id` pedido. El filtro funciona igual que en `vehiclePositions` (1858: 5 vehículos, 587 B). El primer intento a `tripUpdates?route_id=1858` hizo timeout a 25 s y el reintento respondió en 0,12 s: es el fallo intermitente conocido del upstream (`docs/01-api-transporte.md`), que la fuente absorbe con 1 reintento y el último dato bueno.

## Índice estático (`static-index.ts`)

Lee el paquete de `tools/gtfs` desde R2 (binding `STATIC`, solo lectura, con los helpers de `src/static/r2.ts` y la Cache API delante): primero `latest/manifest.json` (validado con `ManifestV1`) y después `<version>/<archivo>`.

- **Por isolate y por `version`:** el manifiesto se revisa como máximo cada `STATIC_TTL_SECONDS`. Si cambió la versión, se descartan los índices. Se guardan **datos ya parseados**, nunca la promesa de una lectura de R2 (regla de workerd, `src/cache/README.md`).
- **Solo dos archivos, cargados cuando hacen falta:**

  | Archivo | Bytes | Lo usan |
  |---|---:|---|
  | `lineas-colectivos.json` | 161 KB | `lineas()`, `posiciones()`, `arribos()` |
  | `indice-colectivos.json` | 231 KB | `posiciones()` (`stop_id` → `paradaId`) y `arribos()` |

  `indice-colectivos.json` (contrato `IndiceColectivosArchivoV1`) lo genera `tools/gtfs` ya indexado: `paradaId → [stopIds, números de línea]` y `número → lineaIds` con vehículos en CABA. El proxy **ya no carga** `paradas.json` (1,7 MB) ni `equivalencias-paradas.json`; esos quedan para la app.
- **Sin Zod en runtime:** `JSON.parse` + chequeo estructural mínimo (`version === 1` y tipo de las raíces). La validación completa contra los contratos la hace `tools/gtfs` antes de publicar, y cada archivo va con su sha256 en el manifiesto. Cifras de CPU antes y después: `../README.md`.
- **Índices:**

  | Índice | Contenido |
  |---|---|
  | `porId` | `lineaId` → línea |
  | `porNumeroEmpresa` | `numero\|empresa normalizada` → `lineaIds` (para unir por nombre; nunca por `route_id` 2021) |
  | `paradaDeStop` | `stop_id` → `paradaId` |
  | `get(paradaId)` | `{ stopIds, lineaIds }`, resuelto al pedirla |

  Los `lineaIds` de una parada salen de sus números de línea del dataset BA vía `lineasPorNumero`, intercalados por número: así una línea con muchos ramales no acapara el tope de 8.
- **Sin manifiesto en el bucket:** `ApiError('upstream_unavailable', 'Datos estáticos no cargados', 503)`.

## Rutas

**`lineas()`:** el diccionario del índice como `LineaColectivoV1`, con `meta.ttlSeconds = STATIC_TTL_SECONDS` y `sourceTimestamp` = `generatedAt` del manifiesto.

**`posiciones(lineaId)`:** una sola request upstream, con el timeout de la fuente (5 s) + 1 reintento.

- 404 `not_found` si la línea no está en el índice; en ese caso no se pide nada upstream.
- Por cada vehículo: `rumbo: null` (el feed no trae bearing), `velocidad` solo si vino en el mensaje, `edadSegundos` desde `vehicle.timestamp` y `paradaId` si su `stop_id` tiene equivalencia.
- Se descartan los vehículos con más de 30 min sin reportar o fuera del bbox AMBA (lat −35,2…−34,2; lon −59,2…−58,0).
- `sourceTimestamp` = `max(vehicle.timestamp)`. El `header.timestamp` de colectivos no sirve: es la hora del request.

**`arribos(paradaId)`:**

- 404 si la parada no existe.
- Si no tiene equivalencia `stop_id` → lista vacía con `meta` normal, sin pedir nada upstream (la app oculta los arribos).
- Si tiene: pide `tripUpdates?route_id=` para hasta 8 líneas en paralelo (`Promise.allSettled`) con un **presupuesto total de 5 s** (`FANOUT_BUDGET_MS`). Es un solo `AbortSignal.timeout` compartido: dentro del fan-out no hay reintento y el adaptador también compite contra el plazo, por si la fuente no lo respeta. Antes, una línea con timeout + reintento demoró la respuesta 16,4 s; ahora la respuesta sale en ≤ 5 s y a esa línea se la omite. Después filtra los `stop_time_update` cuyo `stop_id` está entre los de la parada.
- **Por arribo:** `enSegundos` desde `arrival.time` (o `departure.time`); `retrasoSegundos` = `delay` e `incertidumbre` = `uncertainty`, solo si vinieron en el mensaje (protobufjs devuelve 0 para campos ausentes).
- **Filtros y orden:** se descartan los de hace más de 60 s. Un viaje cuenta **una sola vez**, aunque pase por dos `stop_id` que apuntan a la misma parada (pasa con códigos AVL consecutivos). Máximo 10 por línea, todo ordenado por `enSegundos`.
- **Fallos:** las líneas que fallan se omiten y la respuesta va con `meta.stale: true`. Si fallan **todas**, responde 503: una lista vacía se leería como "no viene ninguno".
