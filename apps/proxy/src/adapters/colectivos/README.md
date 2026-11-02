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

Lee el paquete de `tools/gtfs` desde R2 (binding `STATIC`, solo lectura, con los helpers de `src/static/r2.ts` y la Cache API delante). Primero `latest/manifest.json` y después `<version>/<archivo>`; todo se valida con los contratos v1 (`ManifestV1`, `*ArchivoV1`).

- **Por isolate y por `version`:** el manifiesto se revisa como máximo cada `STATIC_TTL_SECONDS`. Si cambió la versión, se descartan los índices.
- **Carga perezosa por archivo:**

  | Ruta | Archivos que carga |
  |---|---|
  | `lineas()` | solo `lineas-colectivos.json` |
  | `posiciones()` | ese y `equivalencias-paradas.json` (para `paradaId`) |
  | `arribos()` | los tres, incluido `paradas.json` (1,7 MB) |

  El primer request de cada isolate paga el parseo una sola vez. **Riesgo pendiente de medir en producción:** parsear y validar `paradas.json` puede pasar los 10 ms de CPU del plan Free en ese primer request.
- **Índices:**

  | Índice | Contenido |
  |---|---|
  | `porId` | `lineaId` → línea |
  | `porNumeroEmpresa` | `numero\|empresa normalizada` → `lineaIds` (para unir por nombre; nunca por `route_id` 2021) |
  | `porNumeroCaba` | número → `lineaIds` con vehículos en CABA |
  | paradas | `paradaId` → `{ parada, stopIds (inversa de equivalencias), lineaIds }` |

  Los `lineaIds` de una parada salen de los números de línea del dataset BA (`L1…L6`) vía `porNumeroCaba`, intercalados por número: así una línea con muchos ramales no acapara el tope de 8.
- **Sin manifiesto en el bucket:** `ApiError('upstream_unavailable', 'Datos estáticos no cargados', 503)`.

## Rutas

**`lineas()`:** el diccionario del índice como `LineaColectivoV1`, con `meta.ttlSeconds = STATIC_TTL_SECONDS` y `sourceTimestamp` = `generatedAt` del manifiesto.

**`posiciones(lineaId)`:**

- 404 `not_found` si la línea no está en el índice; en ese caso no se pide nada upstream.
- Por cada vehículo: `rumbo: null` (el feed no trae bearing), `velocidad` solo si vino en el mensaje, `edadSegundos` desde `vehicle.timestamp` y `paradaId` si su `stop_id` tiene equivalencia.
- Se descartan los vehículos con más de 30 min sin reportar o fuera del bbox AMBA (lat −35,2…−34,2; lon −59,2…−58,0).
- `sourceTimestamp` = `max(vehicle.timestamp)`. El `header.timestamp` de colectivos no sirve: es la hora del request.

**`arribos(paradaId)`:**

- 404 si la parada no existe.
- Si no tiene equivalencia `stop_id` → lista vacía con `meta` normal, sin pedir nada upstream (la app oculta los arribos).
- Si tiene: pide `tripUpdates?route_id=` para hasta 8 líneas en paralelo (`Promise.allSettled`) y filtra los `stop_time_update` cuyo `stop_id` está entre los de la parada.
- **Por arribo:** `enSegundos` desde `arrival.time` (o `departure.time`); `retrasoSegundos` = `delay` e `incertidumbre` = `uncertainty`, solo si vinieron en el mensaje (protobufjs devuelve 0 para campos ausentes).
- **Filtros y orden:** se descartan los de hace más de 60 s. Un viaje cuenta **una sola vez**, aunque pase por dos `stop_id` que apuntan a la misma parada (pasa con códigos AVL consecutivos). Máximo 10 por línea, todo ordenado por `enSegundos`.
- **Fallos:** las líneas que fallan se omiten y la respuesta va con `meta.stale: true`. Si fallan **todas**, responde 503: una lista vacía se leería como "no viene ninguno".
