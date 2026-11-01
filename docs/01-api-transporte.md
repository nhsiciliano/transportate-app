# 01 — API Transporte GCBA: verificación empírica

> Fase 1, tareas 1.3 y 1.4. Mediciones del **2026-11-01 entre 16:44 y 17:16 UTC** (domingo, 13:44–14:16 hora de Buenos Aires) con `tools/api-probe/probe.mjs`: 4 corridas completas, 3 de ellas con observación de 5 minutos (`--watch=300`). Las cifras salen de la última corrida (17:09–17:16 UTC), guardada en [`tools/api-probe/last-run.json`](../tools/api-probe/last-run.json) (en adelante `LR`). Spec oficial: [`docs/fuentes/api-transporte-v1.raml`](fuentes/api-transporte-v1.raml). Fixtures crudos: [`apps/proxy/test/fixtures/`](../apps/proxy/test/fixtures/README.md).
>
> Medir un domingo al mediodía subestima la carga de días hábiles: las latencias y la cantidad de vehículos en hora pico pueden ser mayores.

## Resumen ejecutivo

**La API responde hoy, pese al aviso de suspensión.** El portal sigue mostrando "Se informa a los usuarios de BA DATA que todos los datasets con Formato API y GTFS, están suspendidos" ([data.buenosaires.gob.ar/dataset/colectivos-gtfs](https://data.buenosaires.gob.ar/dataset/colectivos-gtfs), fecha de actualización 1 de julio de 2026, consultado 2026-11-01). Aun así, `apitransporte.buenosaires.gob.ar` autentica con nuestras credenciales y entrega datos de tiempo real **vivos** para colectivos y ecobici. La "suspensión" se nota en otro lado: la calidad y vigencia de varios feeds está rota.

| | Estado hoy | Impacto en el MVP |
|---|---|---|
| 🟢 Colectivos — posiciones (`vehiclePositions`, `vehiclePositionsSimple`) | Vivos, dato nuevo cada **60 s** | Se puede: mapa de colectivos por línea. |
| 🟢 Colectivos — arribos (`tripUpdates`, no documentado en el RAML) | **Vivo**: 3.904 viajes, 105 mil predicciones por parada, cada 60 s | Hay arribos de colectivos, pero ver 🔴 GTFS estático. |
| 🟢 Subte — alertas (`serviceAlerts?json=1`) | Vivo, se regenera cada 30 s | Se puede: estado por línea. **El protobuf por defecto llega corrupto**: hay que usar `json=1`. |
| 🔴 Subte — arribos (`forecastGTFS`) | Responde 200 pero **congelado desde 2026-10-24 13:08 UTC** (8 días), solo líneas A, B, D, E | Arribos de subte detrás de un flag, con detección de dato viejo. |
| 🔴 GTFS estático de colectivos (`feed-gtfs`, 209 MB) | Descarga OK, pero es **de 2021** (`calendar_dates` 2020-12-21 → 2021-06-21) | Solo el 32 % de los `route_id` y el 40 % de los `stop_id` del tiempo real existen en él. Para nombres y ubicación de paradas hace falta otra fuente. |
| 🟡 GTFS estático de subte (48 KB) | OK, colores de línea presentes | `feed_end_date` = **2026-12-31**: vence en 2 meses. |
| 🔴 Tránsito — cortes (`/transito/v1/cortes`) | **500** en todas las variantes | No hay feature de cortes con esta API. |
| 🔴 Trenes (`vehiclePositions`, `tripUpdates`, `serviceAlerts`) | **404** "No listener for endpoint" | No existe. |
| ⚪ Colectivos — alertas | 200, siempre **0 entities** | Inútil. |
| ⚪ Semáforos, estacionamientos, ecobici GBFS | Funcionan | Fuera del MVP (ecobici es candidato a feature extra). |

**Fiabilidad:** en ninguna corrida apareció un 429 ni un header de cuota, pero **falla entre el 1 y el 9 % de los requests** según la corrida (8,7 % en la de referencia), por timeout a 20 s o `ECONNRESET` a ~12 s, en rachas que afectan a varios endpoints a la vez. No hay `Cache-Control`, `ETag`, `Last-Modified` ni gzip. El proxy tiene que absorber todo eso (ver [Recomendaciones para el proxy](#rate-limiting-fiabilidad-y-recomendaciones-para-el-proxy)).

## Autenticación y comportamiento HTTP común

- **Auth:** query params `client_id` y `client_secret` en todos los endpoints (trait `client-id-required`, `api-transporte-v1.raml:9-15`). Sin credenciales responde `401 {"error": "Authentication denied."}`; con secret inválido, `401 {"error": "Invalid Client"}`. Fixtures: `subtes/serviceAlerts.noauth.error.txt`, `subtes/serviceAlerts.badsecret.error.txt`. **Riesgo:** al viajar en la URL, el secret aparece en cualquier log que registre URLs. El proxy nunca debe loguear la URL upstream.
- **Headers:** solo `content-type`, `content-length` o `transfer-encoding: chunked`, `date` y dos cookies de afinidad de F5 BIG-IP (`BIGipServerPool_esb-transporte`, `BIGipServerPool_apitransporte-BSAS-prd`). **No hay** `cache-control`, `etag`, `last-modified`, `expires`, CORS ni headers de rate limit (`LR.endpoints[].variantes[].headerNames`). Un `If-None-Match` o `If-Modified-Since` devuelve 200 completo, sin 304.
- **Compresión:** no comprime. `vehiclePositionsSimple` con `Accept-Encoding: gzip` baja igual 1.087.731 B por el cable (medido con curl).
- **HEAD:** `405 Method Not Allowed` en los zips GTFS, así que no se puede conocer el tamaño ni la fecha sin descargar.
- **Errores heterogéneos** (el proxy tiene que normalizarlos):
  - `404 application/json {"error": "No listener endpoint for: /tripUpdates", "message": ""}` (subtes).
  - `404 text/plain No listener for endpoint: /trenes/vehiclePositions` (trenes).
  - `500 text/plain /v1/cortes` (cortes).
  - `500 text/plain Required query parameter x not specified` (estacionamientos sin `x`; debería ser 400).
- **Content-Type poco confiable:** siempre agrega `charset=UTF-8`, incluso en binarios; `forecastGTFS` devuelve JSON con o sin `json=1`.
- **Filtros upstream:** `route_id` y `agency_id` funcionan en `vehiclePositions`, `vehiclePositionsSimple` y `tripUpdates`. Por ejemplo, `vehiclePositions?route_id=1858` devuelve 826 B y 7 vehículos, contra 575 KB del feed completo (`api-transporte-v1.raml:956-1000`).

## Tabla por endpoint

Latencia = tiempo hasta el último byte; rango observado entre la primera muestra de `LR` y las muestras de la observación larga. Cadencia = cada cuánto cambia el **dato** upstream según la observación de 5 min cada 15 s (`LR.observacionLarga`), no el header.

| Endpoint | RAML | Params probados | Formato real | Status | Bytes | Latencia | Cadencia observada | Semántica de timestamps | Problemas de calidad | Utilidad MVP |
|---|---|---|---|---|---:|---:|---|---|---|---|
| `/subtes/feed-gtfs` | activo (`:722`) | — | zip (`application/x-zip-compressed`) | 200 (HEAD 405) | 48.443 | ~70–100 ms | estático | `feed_info.feed_end_date` = 20261231 | Vence 2026-12-31; `calendar.start_date` de 2014 | **Alta**: estaciones, colores de línea (`routes.txt`) |
| `/subtes/forecastGTFS` | activo (`:755`) | default, `json=1` | JSON propio, no GTFS-RT (`Header`/`Entity`/`Linea`/`Estaciones`) | 200 | 42.725 | ~40–110 ms | **no cambia** (1 valor en 5 min) | `Header.timestamp` = 1792847325 (2026-10-24T13:08:45Z) | **Congelado hace 8 días**; 8 viajes (A, B, D, E ×2), sin C ni H; los 136 arribos están en el pasado | **Bloqueada**: arribos de subte solo si revive |
| `/subtes/serviceAlerts` | activo (`:776`) | default | protobuf **corrupto** | 200 | 607–611 | ~40–85 ms | — | — | 8 secuencias `EF BF BD`: el servidor re-codificó el binario como UTF-8. No decodifica (`index out of range`) | No usar |
| `/subtes/serviceAlerts?json=1` | activo | `json=1` | GTFS-RT JSON snake_case, enums numéricos | 200 | 2.901 | ~30–75 ms | header cada **30 s**; contenido sin cambios en 5 min | `header.timestamp` = hora de regeneración del snapshot (edad al leer ≤ 30 s) | `active_period` vacío; solo `es`; `cause`/`effect` genéricos (`OTHER_CAUSE`/`OTHER_EFFECT`) en 2 de 3 alertas | **Alta**: estado por línea |
| `/subtes/tripUpdates` | comentado (`:733`) | default, `json=1` | JSON de error | **404** | 72 | ~35 ms | — | — | "No listener endpoint" | No existe |
| `/colectivos/feed-gtfs` | activo (`:929`) | — | zip | 200 (HEAD 405) | 209.488.251 | ~30 s (~56 Mbps) | estático | sin `feed_info`; `calendar_dates` 20201221 → 20210621 | **Datos de 2021**; 32 % de los `route_id` RT y 40 % de los `stop_id` RT presentes | **Baja**: no cruza con el tiempo real |
| `/colectivos/feed-gtfs-frequency` | activo (`:938`) | — | zip | 200 (HEAD 405) | 13.670.441 | ~2 s | estático | `feed_end_date` = 20211231 | Vencido desde 2021; mojibake (`ValentÃ­n`); mismos 1.076 routes | Baja |
| `/colectivos/vehiclePositions` | activo (`:947`) | default | GTFS-RT protobuf | 200 | ~590.000 | ~200 ms (p90 690 ms) | dato cada **60 s**; cada vehículo reporta cada 60 s (p50) | `header.timestamp` = **hora del request** (no sirve para frescura); usar `vehicle.timestamp` | 5.839 entities; **1.979 (33,9 %) sin trip ni route**; 441 (7,6 %) fuera del AMBA (p. ej. −28,47/−65,77); 274 con más de 30 min de antigüedad; **sin `bearing`**; sin lat/lon 0 ni 91/181 | **Media**: posiciones, falta el número de línea |
| `/colectivos/vehiclePositions?json=1` | activo | `json=1` | JSON con claves `_prefijadas` + `extensionObject` (serialización Java) | 200 | ~3.530.000 | ~780–900 ms | igual al pb | igual al pb | 6× más pesado que el pb, enums numéricos | No usar |
| `/colectivos/vehiclePositionsSimple` | activo (`:981`) | default (filtros probados aparte) | JSON array plano | 200 | ~1.091.000 | **1,1–5 s** | dato cada **60 s** | `timestamp` por vehículo (epoch s) | 3.073 vehículos (solo los que tienen viaje); 29 fuera del AMBA; 68 con más de 30 min; campo `tip_id` (sic, es `trip_id`); `direction` = `direction_id` (0/1), no rumbo | **Alta**: trae `route_short_name` ("10"), `agency_name`, `trip_headsign` |
| `/colectivos/serviceAlerts` | activo (`:1004`) | default, `json=1` | GTFS-RT pb / JSON `_prefijado` | 200 | 13 / 147 | ~30–110 ms | header cada 15 s | `header.timestamp` = hora del request | **Siempre 0 entities** | Ninguna |
| `/colectivos/tripUpdates` | **no documentado** (el RAML solo lo tiene comentado para subtes y trenes) | default | GTFS-RT protobuf | 200 | ~3.635.000 | **1–4,7 s** | dato cada **60 s** | `trip_update.timestamp` por viaje; `arrival.time` absoluto (epoch) + `delay` + `uncertainty` | 3.904 viajes, 105.325 `stop_time_update` (p50 23 por viaje); 336 viajes con más de 30 min sin actualizar; 335 predicciones ya pasadas (hasta −65 s); `schedule_relationship=NO_DATA` en parte de las paradas; `stop_id` cruza con el estático solo en 40 % | **Alta, condicionada**: arribos por parada si conseguimos un GTFS estático vigente |
| `/colectivos/tripUpdates?json=1` | — | `json=1` | JSON `_prefijado` | 200 | ~22.570.000 | 7–12 s | — | — | 22 MB: inviable (no se guardó fixture por exceder 5 MB) | No usar |
| `/trenes/vehiclePositions` · `/trenes/tripUpdates` · `/trenes/serviceAlerts` | comentados (`:849-926`) | default, `json=1` | `text/plain` | **404** | 45–50 | ~20 ms | — | — | "No listener for endpoint" | No existe |
| `/transito/v1/cortes` | comentado (`:1260`) | sin params; `x/y/radio/formato=geojson`; `formato=xml/cifs/geojson` | `text/plain` | **500** | 10 | ~30 ms | — | — | El cuerpo es solo el path (`/v1/cortes`) | No existe hoy |
| `/transito/v1/estacionamientos` | activo (`:1241`) | sin params; Obelisco r=100 geojson; Palermo (−58,4351/−34,5884) geojson y `fullInfo` | GeoJSON (`MultiLineString`) o JSON `{total, totalFull, instancias}` | 500 sin `x` / 200 | 40 / 45 (Obelisco: 0 features) / 2.069 (6 features) / 3.167 | 0,03–9 s, timeouts frecuentes | estático | — | `500` en vez de 400 sin `x`; el punto del Obelisco (sobre la 9 de Julio) no tiene tramos; latencia muy variable | Fuera del MVP |
| `/transito/v1/semaforos` | activo (`:1303`) | sin params; `x/y/radio/formato`; `lat/lon/radius` (RAML) | JSON `{list: [...]}` | 200 | 632.838 (idéntico en las 3 variantes) | ~200–320 ms | — | sin timestamp | **Ignora todos los params**: siempre devuelve los 3.723 cruces; estados: Conectado 3.433, Red caída 144, Error de conexión 110, Error en proxy remoto 34 | Fuera del MVP |
| `/ecobici/gbfs/systemInformation` | activo (`:1091`) | — | GBFS JSON | 200 | 394 | ~120–200 ms | — | `last_updated`, `ttl` ≈ 29 | Claves no estándar con `_` (`_vehicle_count`, `_station_count`) | Extra |
| `/ecobici/gbfs/stationStatus` | activo (`:1117`) | — | GBFS JSON | 200 | ~122.000 | ~75–450 ms | `last_updated` cada ~18 s (p50); cada estación reporta cada **181 s** (p50) | `last_updated` + `ttl` (17–29 s) + `last_reported` por estación | 392 estaciones; alguna con `last_reported` de casi 2 h | Extra |
| `/ecobici/gbfs/stationInformation` | activo (`:1152`) | — | GBFS JSON | 200 | 183.671 | ~160–300 ms | estático | `last_updated`, `ttl` ≈ 27 | `_ride_code_support` no estándar | Extra |

No se probaron (fuera de alcance): `/estacionamiento/*` (`:1190-1237`), `/datos/movilidad/*` (`:1357-1453`), y `/monopatines/*` y `/trenes/feed-gtfs`, comentados.

### Detalle de hallazgos clave

**`subtes/serviceAlerts` en protobuf está corrupto en origen.** Los primeros bytes son `0a0d 0a03 322e 3010 0018 efbf bdd9 9def bfbd 06…`: el varint del timestamp (bytes ≥ 0x80) aparece reemplazado por `EF BF BD` (U+FFFD). El servidor serializa el protobuf como si fuera texto UTF-8, así que la pérdida de información es irreversible. El fixture `subtes/serviceAlerts.pb` queda guardado como caso de "upstream corrupto". **El adaptador de subte usa `json=1`.**

**Alertas de subte vigentes** (`subtes/serviceAlerts.json=1.json`):

| `id` | Alerta | `cause` | `effect` |
|---|---|---|---|
| `Alert_LineaB` | "Estación Medrano cerrada por obras de renovación integral." | 2 `OTHER_CAUSE` | 7 `OTHER_EFFECT` |
| `Alert_LineaC` | "El 02/11 cierra Independencia por obras…" | 10 `CONSTRUCTION` | 2 `REDUCED_SERVICE` |
| `Alert_LineaE` | "Entre Ríos y Urquiza cerradas por obras…" | 2 `OTHER_CAUSE` | 7 `OTHER_EFFECT` |

Todas tienen `informed_entity.route_id` = `LineaX`, y ese ID cruza al 100 % con el `routes.txt` de subte. Una línea sin alerta se puede asumir normal. Para distinguir "demorada" de "interrumpida" no alcanza con `effect`, porque casi siempre viene `OTHER_EFFECT`: la regla de la Fase 2 (tarea 2.5) va a tener que combinar `effect` con palabras clave del texto. Esto queda como deuda de diseño.

**`forecastGTFS` no es GTFS-RT**, aunque el RAML lo describe como tal (`:755-775`). Su estructura es `{"Header":{"timestamp"},"Entity":[{"ID":"LineaA_A12","Linea":{"Trip_Id","Route_Id","Direction_ID","start_time","start_date","Estaciones":[{"stop_id":"1059N","stop_name","arrival":{"time","delay"},"departure":{...}}]}}]}`. Los `stop_id` (136/136), `Route_Id` y `Trip_Id` cruzan al 100 % con el GTFS de subte. Hoy está congelado: `start_date` = 20261024, `Header.timestamp` sin cambios en 20 muestras durante 5 min.

**Colectivos: `header.timestamp` no indica frescura.** En `vehiclePositions`, `tripUpdates` y `serviceAlerts`, `header.timestamp` es la hora en que se generó la respuesta: las 3 muestras separadas 20 s dan deltas exactos `[20, 20]` (`LR.endpoints[].cadencia`). El dato real cambia cada 60 s (`max(vehicle.timestamp)`: deltas `[60, 60, 60, 60, 60]` en 5 min, `LR.observacionLarga`). La edad del dato al leerlo fue de 13–69 s (p50 ≈ 40 s). El `sourceTimestamp` del contrato tiene que salir de `max(vehicle.timestamp)` o `max(trip_update.timestamp)`, nunca del header.

**Cruce tiempo real ↔ GTFS estático de colectivos** (`LR.cruceTiempoRealEstatico`):

| Dato | Presente en el estático |
|---|---|
| Vehículos con `route_id` | 31,6 % (1.219 de 3.860) |
| `route_id` distintos | 31 % (412 de 1.326) |
| Predicciones con `stop_id` | 40,5 % (42.501 de 104.920) |
| `stop_id` distintos | 40 % (13.919 de 34.929) |

Los `trip_id` "cruzan" al 100 %, pero es una coincidencia: ambos usan IDs secuenciales `<n>-1`. Los archivos internos del zip tienen fecha de febrero de 2021. Sin un estático vigente no hay nombre ni ubicación para el 60 % de las paradas de los arribos, ni nombre de línea para el feed protobuf. **Mitigación para la tarea 2.10:** buscar un GTFS vigente de colectivos AMBA (p. ej. el que publica el Ministerio de Transporte de la Nación). **No está verificado.** Para posiciones, `vehiclePositionsSimple` ya trae `route_short_name` y no necesita el estático.

**Identificadores de línea.** En colectivos, `route_id` es un **ramal**, no una línea. Por ejemplo, `route_id=1858` devuelve 7 vehículos y `agency_id=17` (LINEA 10 S.A.) devuelve 16. El número que ve el usuario es `route_short_name` ("10"). En `vehiclePositions`, `vehicle.label` viene como "90-70" (línea-interno) y `license_plate` trae la patente: el proxy no debería reenviarla porque el MVP no la necesita.

## Endpoints que el MVP va a usar

TTL = tiempo en la Cache API del proxy (capa A). SWR = ventana de `stale-while-revalidate`. "Dato viejo" = umbral a partir del cual la app muestra el aviso, calculado sobre `sourceTimestamp`.

| Feed upstream | Para qué | Cadencia medida | TTL | SWR | Dato viejo | Notas |
|---|---|---|---:|---:|---:|---|
| `/subtes/serviceAlerts?json=1` | Estado por línea + alertas | snapshot cada 30 s; contenido estable | 30 s | 300 s | > 10 min | Liviano (2,9 KB, ~30 ms). Nunca la variante protobuf. |
| `/subtes/forecastGTFS` | Próximos arribos de subte | **congelado** | 30 s | 120 s | > 5 min → "sin datos de arribos" | Feature flag apagado hasta que el feed reviva; el adaptador descarta arribos en el pasado. |
| `/colectivos/vehiclePositionsSimple` | Mapa de colectivos por línea | 60 s | 30 s | 60 s | > 3 min por vehículo | 1 MB y 1,1–5 s: siempre en background, nunca en el camino del cliente. Slices por `route_short_name`. Descartar vehículos con más de 5 min (≈ 4 %) o fuera del AMBA. |
| `/colectivos/tripUpdates` | Arribos por parada (flag) | 60 s | 60 s | 120 s | > 3 min por viaje | 3,6 MB pb, 1–4,7 s. Depende de un estático vigente para nombrar paradas. Descartar viajes con `trip_update.timestamp` de más de 10 min. |
| `/subtes/feed-gtfs` | Estaciones, colores, mapa de red | estático | 24 h | 7 d | `feed_end_date` < hoy | Se procesa offline (`tools/gtfs`); vigilar el vencimiento 2026-12-31. |

Alternativa: `/colectivos/vehiclePositions` en protobuf pesa la mitad (575 KB) y es ~7× más rápido (~200 ms), pero no trae número de línea ni `bearing`, y un 34 % de sus entities no tienen viaje. Conviene si se consigue un estático vigente para resolver `route_id` → línea. La decisión se toma en la Fase 2 midiendo el CPU del Worker. El plan Free tiene un límite de CPU por invocación bajo, y parsear 1 MB de JSON o 3,6 MB de protobuf puede excederlo. Eso refuerza la capa B (Durable Object que procesa una vez por TTL).

**Sin `bearing`:** ningún feed de colectivos lo trae. `position.bearing` no aparece en las 5.839 entities; los campos presentes son `latitude`, `longitude`, `speed` (≈ m/s) y `odometer`. La tarea 4.6 ("rotación por `bearing`") tiene dos opciones: derivarlo entre posiciones consecutivas del mismo vehículo, o no rotar.

### Contrato mínimo que el proxy debería exponer

Todos los endpoints devuelven `generatedAt` (cuando el proxy armó la respuesta) y `sourceTimestamp` (dato upstream, según las reglas de arriba), además de `stale: boolean`. Los nombres son tentativos para la tarea 2.3.

| Ruta proxy | Fuente | Campos mínimos |
|---|---|---|
| `GET /v1/subtes/estado` | `subtes/serviceAlerts?json=1` + `routes.txt` subte | `lineas[]: { id: "A", routeId: "LineaA", color, estado: "normal" \| "con_alertas" \| "interrumpida", alertas[]: { id, titulo, descripcion, causa, efecto } }` |
| `GET /v1/subtes/arribos?estacion=<stop_id>` | `subtes/forecastGTFS` | `disponible: boolean`, `arribos[]: { linea, tripId, sentido, stopId, llegada (epoch s), demoraSeg }` |
| `GET /v1/colectivos/posiciones?linea=<route_short_name>` | `colectivos/vehiclePositionsSimple` | `vehiculos[]: { id, linea, routeId, tripId, destino, lat, lon, velocidad, ts }` (sin patente) |
| `GET /v1/colectivos/arribos?parada=<stop_id>` (flag) | `colectivos/tripUpdates` | `arribos[]: { routeId, linea?, tripId, vehiculoId, llegada, demoraSeg, incertidumbreSeg }` |
| `GET /v1/transito/cortes` | — | Responde `503 { error: "fuente_no_disponible" }` hasta que exista una fuente. |
| `GET /v1/health` | todas | Estado por feed: `ok \| degradado \| caido`, edad del último dato bueno, tasa de error reciente. |

## Lo que no existe o no responde

- **Arribos de colectivos:** a diferencia de lo que se suponía en el plan (riesgo 2), **sí existen** vía `/colectivos/tripUpdates`, aunque el RAML no lo documenta para colectivos. El bloqueo real es el GTFS estático de 2021 (ver el cruce más arriba).
- **Cortes de tránsito:** `/transito/v1/cortes` responde `500` con cuerpo `/v1/cortes` en todas las variantes (sin params, con `x/y/radio/formato=geojson`, y con `formato=xml`, `cifs` o `geojson`; con `cifs` además se cortó la conexión a los 12 s). El RAML lo tiene comentado (`:1260-1289`). **La pestaña Tránsito del MVP no tiene fuente de datos con esta API.** Opciones para el usuario: quitarla del MVP, buscar otra fuente o mostrar solo estacionamientos y semáforos (bajo valor).
- **Trenes:** los 3 feeds dan `404 No listener for endpoint`. No están desplegados.
- **`/subtes/tripUpdates`:** `404 No listener endpoint`; lo reemplaza `forecastGTFS`, hoy congelado.
- **Alertas de colectivos:** el endpoint existe pero nunca trae alertas.

## Rate limiting, fiabilidad y recomendaciones para el proxy

**Rate limiting observado:** ninguno. 15 requests secuenciales sin pausa a `/subtes/serviceAlerts?json=1` dieron 15 × 200 (latencia p50 40 ms, máx. 52 ms), y la corrida completa hizo 230 requests en ~6,5 minutos sin ningún 429 ni header `x-ratelimit-*`, `ratelimit-*`, `retry-after` o similar (`LR.burst`, `LR.fiabilidad`). Que no se vea no significa que no exista: el gateway (MuleSoft, por el formato del RAML y la consola) puede tener políticas por `client_id` que no se dispararon con este volumen.

**Fiabilidad:** en la corrida de referencia falló el 8,7 % de los intentos (20 de 230: 12 timeouts a 20 s y 8 `ECONNRESET` a ~12 s; `LR.fiabilidad`). Las corridas anteriores dieron 1,4 %, 5,1 % y 8,9 %. Las dos descargas grandes de GTFS fallaron en el primer intento (subte: sin headers en 30 s; colectivos: `ECONNRESET`) y bajaron en el segundo. Los fallos llegan en rachas que pegan a varios endpoints en el mismo minuto, lo que sugiere un nodo del pool F5 degradado más que un endpoint puntual. Con requests secuenciales aislados no se reprodujeron; en ráfagas concurrentes de 8 requests fallaron 2 de 24.

Recomendaciones para el proxy (Fase 2):

1. **Timeout upstream de 8 s** (la latencia sana más alta es ~4,7 s en `tripUpdates`) y **1 reintento** con jitter de 0,5–1,5 s. Nunca esperar 20 s con un cliente colgado.
2. **Servir el último dato bueno** (`stale-while-revalidate` + copia "last good" sin vencimiento en KV/DO), marcando `stale: true`. Un fallo upstream no debe convertirse en error para la app mientras el dato tenga menos de N minutos.
3. **Coalescing:** una sola request en vuelo por feed; con 7 feeds y TTL de 30–60 s, el proxy hace menos de 1 request por segundo upstream por colo.
4. **Circuit breaker por feed:** después de 3 fallos seguidos, pausa de 30 s.
5. **Sin caché HTTP upstream:** `ETag` y `Last-Modified` no existen, así que el proxy calcula su propio `ETag` (hash del contrato) para servir `304` a la app.
6. **No pedir `json=1` en colectivos** (6× más pesado y con claves `_prefijadas`). En subtes, siempre `json=1` para alertas.
7. **Ignorar las cookies** `BIGipServer*` (afinidad de F5): no usarlas fijaría el tráfico a un nodo que podría ser el degradado.
8. **No loguear URLs upstream** (contienen el secret) y normalizar todos los errores (`404 text/plain`, `500 text/plain`, `401 JSON`) a errores tipados propios.
9. **Validar y filtrar en el adaptador:** coordenadas fuera del AMBA, vehículos o viajes con más de 5 o 10 min, entities sin viaje, arribos en el pasado y feeds con `sourceTimestamp` viejo (`forecastGTFS`).

## Riesgos para la API v2.0 y la continuidad

- **Suspensión anunciada:** el portal dice que los datasets API/GTFS están "suspendidos, en revisión y corrección". Hoy responden, pero pueden cortarse o cambiar sin aviso. Los adaptadores aislados (decisión 7 del plan) son la mitigación.
- **Formatos inestables:** el JSON de colectivos es una serialización Java cruda (`_entity`, `extensionObject`), `forecastGTFS` tiene un esquema propio y el protobuf de subte está roto. Una v2.0 probablemente cambie estos formatos: los tests con fixtures reales van a detectar las roturas.
- **Datos estáticos vencidos:** el GTFS de colectivos es de 2021 y el de subte vence el 2026-12-31. Si la v2.0 trae un GTFS nuevo, puede cambiar los `route_id`/`stop_id` y romper favoritos guardados por ID. Los favoritos deberían guardar también `route_short_name` y nombre de parada para poder re-mapearlos.
- **Credenciales en query string** y sin SLA ni cuota documentada.
- **Feeds congelados sin señal de error:** `forecastGTFS` devuelve 200 con datos de hace 8 días. Solo se detecta mirando el timestamp, así que el proxy tiene que vigilar la edad del dato, no solo el status.

## Cómo correr el sondeo

```sh
cp .env.example .env            # completar GCBA_CLIENT_ID y GCBA_CLIENT_SECRET
cd tools/api-probe && npm install --no-package-lock && node probe.mjs
node probe.mjs --watch=300      # + observación de 5 min para medir cadencia real
```

Requiere Node ≥ 22. Tarda ~3 min, o ~8 min con `--watch=300`; los GTFS se bajan a `~/.cache/transportate/gtfs/`. Regenera `tools/api-probe/last-run.json` y `apps/proxy/test/fixtures/` (con su README). Detalle de flags en [`tools/api-probe/README.md`](../tools/api-probe/README.md).
