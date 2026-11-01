# 01a — Inventario de endpoints según la spec RAML oficial

> **Fuente única:** `docs/fuentes/api-transporte-v1.raml` (RAML 1.0, descargada de <https://apitransporte.buenosaires.gob.ar/console/api/?raml>). Las referencias `L123` apuntan a líneas de ese archivo.
> **Alcance:** esto es lo que la spec **declara**. No se hizo ninguna llamada a la API; la verificación empírica (status, tamaño, formato real, suspensiones) va en `docs/01-api-transporte.md` (tarea 1.3, otro worker). Donde la spec y la realidad difieran, manda la realidad.

## Datos generales

| Dato | Valor | Línea |
|---|---|---|
| Versión de la spec | RAML 1.0, `version: v1` | L1, L3 |
| Base URI | `https://apitransporte.buenosaires.gob.ar/` | L7 |
| `mediaType` por defecto | `application/json` | L6 |
| Métodos | Solo `GET` en todos los recursos | — |
| Paginación / rate limit / errores | **No declarados** en la spec (ningún `responses` distinto de `200`) | — |

### Traits

| Trait | Params | Línea |
|---|---|---|
| `client-id-required` | `client_id` (string), `client_secret` (string). La spec **no** los marca `required`, pero en RAML el default es `required: true`. Van por query string. | L10–L15 |
| `transito-estacionamiento-params` | `x` (float, **req**, longitud), `y` (float, **req**, latitud), `srid` (string, def. `"4326"`), `radio` (int 1–100 m, def. 1), `orden` (`nombre`\|`distancia`, def. `distancia`), `limite` (int, def. 10), `formato` (`json`\|`geojson`, def. `json`), `fullInfo` (bool, def. false; se ignora con `geojson`), `callback` (string, JSONP) | L16–L66 |

**Convenciones de formato:** los feeds GTFS-RT devuelven **protobuf por defecto** y aceptan `json=1` para JSON (L788–L791, L957–L960, L1016). El param `formato` solo existe en el trait de estacionamiento (L53–L57) y en el `/cortes` comentado (L1268–L1273, también comentado).

> En todas las tablas, **"+ trait"** = se suman `client_id` y `client_secret`. Nunca pegar valores reales de credenciales en URLs de docs ni fixtures.

## `/subtes` (L721–L847)

| Método | Path | Query params | Respuesta (mediaType · tipo) | Ejemplo resumido | Línea |
|---|---|---|---|---|---|
| GET | `/subtes/feed-gtfs` | + trait | `application/x-zip-compressed` · sin tipo (zip GTFS estático) | — | L722–L731 |
| GET | `/subtes/forecastGTFS` | + trait (sin `json` declarado) | `application/json` · **sin tipo ni ejemplo** | — (por la descripción es un TripUpdates GTFS-RT: "tiempos estimados de arribo y demoras en las paradas") | L755–L775 |
| GET | `/subtes/serviceAlerts` | + trait, `json` (int, opc.; `1` = JSON, default protobuf) | `application/octet-stream` (pb) · `application/json` con `{header: FeedHeader, entity: FeedEntityAlert}` | `header {gtfs_realtime_version:"1.0", incrementality:0, timestamp:1525802328}`, `entity {active_period[2], informed_entity[1], cause:3, effect:3, header_text[es,en] "Servicio con demoras - 60", description_text[es,en]}` | L776–L847 |

Notas:
- `forecastGTFS` es el único feed de arribos de subte; la spec no define su estructura. Hay que inferirla de la respuesta real (se espera `FeedMessage` con `entity[].trip_update`).
- El ejemplo de `serviceAlerts` de subte es copia del de colectivos (habla de "Línea 60"); no es representativo.
- En el esquema, `entity` es un objeto `FeedEntityAlert`, no un array — difiere de GTFS-RT estándar (`repeated FeedEntity`). Confirmar con la respuesta real.

## `/colectivos` (L928–L1086)

| Método | Path | Query params | Respuesta (mediaType · tipo) | Ejemplo resumido | Línea |
|---|---|---|---|---|---|
| GET | `/colectivos/feed-gtfs` | + trait | `application/zip` · GTFS estático "base horarios" (con `stop_times`), el que hay que usar con los feeds RT | — | L929–L937 |
| GET | `/colectivos/feed-gtfs-frequency` | + trait | `application/zip` · GTFS estático "base frecuencias" (simplificado, `frequencies.txt`) | — | L938–L946 |
| GET | `/colectivos/vehiclePositions` | + trait, `json` (int, opc.), `agency_id` (int, opc.), `route_id` (int, opc.), `Trip` (string, opc., **con mayúscula**) | `application/json` (ejemplos comentados) · `application/x-protobuf` con `{entity: FeedEntityVehiclePosition[], header: FeedHeader}` | Ver `FeedEntityVehiclePosition` abajo. "Actualizada cada 30 segundos"; sin params devuelve todos los vehículos | L947–L980 |
| GET | `/colectivos/vehiclePositionsSimple` | + trait, `route_id` (**string**, opc.), `agency_id` (int, opc.), `Trip` (string, opc.) | `application/json` · **sin tipo** (ejemplo `!include moovit.json` comentado) | Formato "simplificado" que agrega `route_short_name` (número de línea) | L981–L1002 |
| GET | `/colectivos/serviceAlerts` | + trait, `json` (int, opc., sin descripción), `agency_id` (string), `route_id` (string), `Trip` (string) | `application/x-protobuf` y `application/json` · `{header: FeedHeader, entity: FeedEntityAlert}` | Igual al de subtes: demoras "Línea 60", `cause:3` (TECHNICAL_PROBLEM), `effect:3` (SIGNIFICANT_DELAYS) | L1004–L1086 |

Notas:
- **No hay `/colectivos/tripUpdates`** en la spec (ni siquiera comentado), aunque la descripción de `feed-gtfs` lo menciona ("Vehicle Position, Trip Updates y Service Alerts", L931).
- Inconsistencia de tipos de `route_id`: `integer` en `vehiclePositions` (L964), `string` en `vehiclePositionsSimple` (L989) y `serviceAlerts` (L1022).
- `Trip` con mayúscula inicial en los tres (L967, L995, L1025); probablemente case-sensitive.

## `/ecobici` (L1088–L1189) — GBFS

| Método | Path | Query params | Respuesta | Ejemplo resumido | Línea |
|---|---|---|---|---|---|
| GET | `/ecobici/gbfs/systemInformation` | + trait | `application/json` (GBFS) | `{last_updated, ttl:30, data:{system_id:"bike_buenosaires", name:"Ecobici", timezone:"America/Argentina/Buenos_Aires", …}}` | L1091–L1116 |
| GET | `/ecobici/gbfs/stationStatus` | + trait | `application/json` (GBFS) | `data.stations[] {station_id, num_bikes_available, num_bikes_available_types{mechanical,ebike}, num_docks_available, is_installed, is_renting, is_returning, last_reported, status:"IN_SERVICE"}` | L1117–L1151 |
| GET | `/ecobici/gbfs/stationInformation` | + trait | `application/json` (GBFS) | `data.stations[] {station_id, name:"002 - Retiro I", lat, lon, address, capacity, rental_methods[], groups[]}` | L1152–L1189 |

Fuera del MVP; se lista por completitud.

## `/estacionamiento` (L1190–L1236)

Todos con `is: [client-id-required, transito-estacionamiento-params]` → params `x`, `y` obligatorios + opcionales del trait (incluye `formato=json|geojson`).

| Método | Path | Respuesta | Ejemplo | Línea |
|---|---|---|---|---|
| GET | `/estacionamiento/garajesComerciales` | `application/json` | `!include Examples/garage-comercialExample.json` (no incluido en el RAML descargado) | L1194–L1203 |
| GET | `/estacionamiento/cajonesCargaDescarga` | `application/json` | `!include Examples/carga-descargaExample.json` | L1205–L1214 |
| GET | `/estacionamiento/cajonesParadasColectivo` | `application/json` | `!include Examples/parada-colectivoExample.json` | L1216–L1225 |
| GET | `/estacionamiento/cajonesEstacionamientosMoto` | `application/json` | `!include Examples/estacionamiento-motoExample.json` | L1227–L1236 |

`cajonesParadasColectivo` podría servir para ubicar paradas por cercanía, pero el MVP las resuelve con el GTFS estático (plan, decisión 6).

## `/transito/v1` (L1239–L1355)

| Método | Path | Query params | Respuesta | Ejemplo | Línea |
|---|---|---|---|---|---|
| GET | `/transito/v1/estacionamientos` | + trait, + `transito-estacionamiento-params` | `application/json` · `{total: number, totalFull: number, instancias: ParkingEntity[]}` | `ParkingEntity {distancia, contenido{contenido: [{nombreId, nombre, posicion, valor}]}, claseId, clase, nombre, id}` (L485–L505); ejemplo `!include ParkingExample.json` | L1241–L1258 |
| GET | `/transito/v1/semaforos` | + trait, `lat` (opc., ej. `-34.611…`), `lon` (opc.), `radius` (m, opc., ej. `"100"`) — sin `type` declarado (string por defecto) | `application/json` · tipo `!include Examples/junctionsType.raml` (no incluido) | `!include Examples/junctionsExample.json` | L1303–L1328 |

`/transito/v1/cortes`, `/clv` y `/eventos` están comentados: ver más abajo.

## `/datos/movilidad` (L1357–L1453)

| Método | Path | Params | Respuesta | Línea |
|---|---|---|---|---|
| GET | `/datos/movilidad/transito` | + trait | `application/json` · `ConteoTransito` = `[{hora, location_code (Open Location Code), sentido: ingreso\|egreso\|interna, cantidad}]` — por hora, ventana de 35 días | L1359–L1368 (tipo L583–L616) |
| GET | `/datos/movilidad/transito/mensual` | + trait | `text/csv` · `ConteoTransito` (último mes completo) | L1369–L1378 |
| GET | `/datos/movilidad/transito/mensual/{anioMes}` | + trait, URI `anioMes` (`aaaa-mm`, desde 2020-02) | `text/csv` · `ConteoTransito` | L1379–L1392 |
| GET | `/datos/movilidad/transito/semanaTipica` | + trait | `application/json` · `ConteoTransito` | L1394–L1403 |
| GET | `/datos/movilidad/transportePublico` | + trait | `application/json` · `ConteoTransporte` = `[{fecha, parcial, cantidad, RamalTransporte{codigo_entidad, nombre_empresa, codigo_linea, nombre_linea, codigo_trayecto, descripcion_ramal_larga, tipo_transporte}}]` — SUBE diario, 35 días | L1405–L1414 (tipos L618–L689) |
| GET | `/datos/movilidad/transportePublico/mensual` | + trait | `text/csv` · `ConteoTransporte` | L1416–L1425 |
| GET | `/datos/movilidad/transportePublico/mensual/{anioMes}` | + trait, URI `anioMes` (desde 2020-03) | `text/csv` · `ConteoTransporte` | L1427–L1441 |
| GET | `/datos/movilidad/transportePublico/semanaTipica` | + trait | `application/json` · `ConteoTransporte` | L1443–L1452 |

Fuera del MVP (estadísticas agregadas). `RamalTransporte` (L618–L660) puede servir para mapear `codigo_linea` ↔ nombre de línea si el GTFS no alcanza.

## Recursos comentados en la spec

Están precedidos por `#`, así que **no forman parte del contrato publicado**. Se documentan porque el endpoint puede igual responder (terceros reportan `/transito/v1/cortes` funcionando; ver `docs/00-plan.md` L11) y conviene saber qué forma tenía.

### `/subtes/tripUpdates` (L733–L754)

- `is: [client-id-required]`, `GET`, sin query params.
- Respuesta `application/json`, ejemplo `!include trip-updates-subtes.json` (no incluido).
- Descripción idéntica a la de `forecastGTFS`: todo indica que **`forecastGTFS` lo reemplazó**.

### `/trenes/*` (L849–L926)

| Path | Params | Respuesta | Línea |
|---|---|---|---|
| `/trenes/feed-gtfs` | + trait | `application/zip` | L850–L859 |
| `/trenes/vehiclePositions` | + trait, `json` (int, opc.) | `application/x-protobuf`, `application/json` (ej. `vehicle-positions-trenes.json`, comentado) — "actualizada cada 30 s" | L861–L877 |
| `/trenes/tripUpdates` | + trait, `json` (int, opc.) | `application/x-protobuf`, `application/json` (ej. `trip-updates-trenes.json`) | L878–L905 |
| `/trenes/serviceAlerts` | + trait, `json` (int, opc.) | `application/x-protobuf`, `application/json` | L906–L926 |

Fuera del MVP.

### `/transito/v1/cortes` (L1260–L1289) — **importante para el MVP**

- `is: [client-id-required]`; descripción: "Búsqueda de información de cortes en vía pública de la Ciudad Autónoma de Buenos Aires." (L1263)
- Query params:
  - `callback` (string, opc.): "Nombre de la función donde se almacenará el response" → JSONP (L1274–L1277).
  - `formato` — **doblemente comentado** (L1268–L1273): `enum ['xml', 'cifs', 'geojson']`, default `xml`. Descripción: "Devuelve un geojson sino lo devuelve en formato xml. Opciones "xml", "geojson" y también en "Closure and Incidents Feed Specifications (CIFS V2 …)"". O sea: en algún momento hubo salida **XML** (default), **GeoJSON** y **CIFS v2 de Waze**.
- Respuestas declaradas:
  - `text/xml` → ejemplo `cortes_transito.xml` (doblemente comentado, L1281–L1282).
  - `text/javascript` → `{type: string, features: CortesEntity[]}` → es un **GeoJSON `FeatureCollection`** servido como JS (JSONP) (doblemente comentado, L1283–L1287).
  - `application/json` → ejemplo `Examples/cortesExample.json` (no incluido en el RAML descargado) (L1288–L1289). Es la única variante que quedaba "activa" dentro del bloque comentado.
- Tipos relacionados (estos **no** están comentados, siguen definidos):
  - `CortesEntity` (L523–L530): todas sus propiedades están comentadas; la forma original era un **GeoJSON `Feature`**:
    - `geometry: GeometryEntity` → `{type: string, coordinates: number[]}` (L507–L512). Ojo: `coordinates` es `number[]` plano (sirve para `Point`; para `LineString` sería `number[][]`, la spec no lo contempla).
    - `type: string` (se espera `"Feature"`).
    - `id: string`.
    - `properties: PropertyCortesEntity` → `{Nombre: string, Motivo: string, Id: string, Tipo: string}` (L514–L521), **con mayúscula inicial**.
- **Qué esperar si responde:** probablemente `FeatureCollection` con features `{type:"Feature", id, geometry:{type, coordinates}, properties:{Nombre, Motivo, Id, Tipo}}`, posiblemente envuelto en JSONP si se pasa `callback`, y con riesgo de que el default sea XML. El `TransitoAdapter` (Fase 2, tarea 2.7) debe tolerar XML/GeoJSON/CIFS y geometrías Point/LineString. A confirmar en 1.3.

### Otros comentados (fuera del MVP)

| Recurso | Qué definía | Línea |
|---|---|---|
| `/monopatines/{movo,glovo,grin}` | GBFS de monopatines, tipo `GBFS_Monopatines` (L532–L581, sigue definido) | L692–L719 |
| `/transito/v1/clv` | Carteles luminosos (gantries); ej. `gantriesExample.json`, tipo `gantriesType.raml` | L1290–L1302 |
| `/transito/v1/eventos` | Eventos en vía pública; `month` (`aaaa-mm`, regex), `provider` (**req**, enum `1` BA Tránsito, `201` Transporte Público, `769` Accidentes, solo históricos) | L1329–L1355 |

## Tipos GTFS-RT definidos en el RAML

El RAML **no sigue al pie de la letra** `gtfs-realtime.proto`: le faltan tipos y renombra campos. Opcional = `?` en el nombre o `required: false`. Recordatorio RAML: sin `required`, una propiedad es obligatoria.

| Tipo pedido | ¿Existe en el RAML? | Equivalente / nota |
|---|---|---|
| `FeedMessage` | **No** | Se arma inline en cada respuesta: `{header: FeedHeader, entity: …}` (L798–L799, L979–L980, L1033–L1038) |
| `FeedHeader` | Sí | L296–L321 |
| `FeedEntity` | Parcial | `FeedEntity` (L363–L366) solo tiene `id: integer` y `alert: FeedEntityAlert`; hay variantes `FeedEntityVehiclePosition` (L324–L362) y `FeedEntityAlert` (L367–L463) |
| `VehiclePosition` | Sí | L235–L277 |
| `TripUpdate` | Parcial | `FeedEntityTripUpdate` (L479–L483) solo `trip?`, `vehicle`; **no tiene `stop_time_update[]`**. `StopTimeEvent` (L465–L477) existe suelto. No hay `StopTimeUpdate` |
| `Alert` | Como `FeedEntityAlert` | L367–L463 (mezcla entidad y alerta: no tiene `id`) |
| `TranslatedString` | Sí | L114–L131 (+ `Translation` L95–L112) |
| `TimeRange` | Sí | L75–L93 |
| `Position` | Sí | L133–L173 |
| `TripDescriptor` | Sí | L175–L208 |
| `VehicleDescriptor` | Sí | L210–L232 |
| `EntitySelector` | Sí | L279–L293 |

### Campos

**`FeedHeader`** (L296–L321)
| Campo | Tipo | Req. | Nota |
|---|---|---|---|
| `gtfs_realtime_version` | string | **sí** | `"1.0"` |
| `incrementality` | number | no | `0` FULL_DATASET, `1` DIFFERENTIAL ("not admitted yet") |
| `timestamp` | number | no | POSIX s; creación del feed en el servidor → usar como `sourceTimestamp` |

**`FeedEntityVehiclePosition`** (L324–L362)
| Campo | Tipo | Req. | Nota |
|---|---|---|---|
| `id` | string | **sí** | |
| `is_deleted` | boolean | no | |
| `alert` | nil | sí (`nil`) | siempre `null` |
| `trip_update` | nil | sí (`nil`) | siempre `null` |
| `vehiclePos` | `VehiclePosition` | **sí** | ⚠️ En el estándar se llama `vehicle`; la spec usa `vehiclePos` (posible artefacto del JSON del backend). En protobuf se espera `vehicle` |

**`VehiclePosition`** (L235–L277): todos opcionales — `trip?: TripDescriptor`, `vehicle?: VehicleDescriptor`, `position?: Position`, `current_stop_sequence?: integer`, `stop_id?: string`, `current_status?: string` (ej. `"0"`, string aunque en proto es enum), `timestamp?: number`, `congestion_level` (number, opc.; 0 UNKNOWN … 4 SEVERE_CONGESTION, L247–L255).

**`Position`** (L133–L173)
| Campo | Tipo | Req. | Nota |
|---|---|---|---|
| `latitude` | float | **sí** | Descripción comentada (L139): con falla de GPS vale **91** |
| `longitude` | float | **sí** | Descripción comentada (L145): con falla de GPS vale **181** → filtrar |
| `bearing` | float | no | 0 = norte, 90 = este |
| `odometer` | double | no | metros; `-1` si falla |
| `speed` | float | no | m/s |

**`TripDescriptor`** (L175–L208): todos opcionales — `trip_id?`, `route_id?`, `start_time` (`hh:mm:ss`), `start_date` (`YYYYMMDD`), `schedule_relationship` (int: 0 SCHEDULED, 1 ADDED, 2 UNSCHEDULED, 3 CANCELED, 5 REPLACEMENT).

**`VehicleDescriptor`** (L210–L232): todos opcionales — `id` (único por vehículo, AVLS), `license_plate`, `label` (descripción `x`, sin documentar; ej. `"1404"`, probablemente número interno).

**`EntitySelector`** (L279–L293): al menos uno debe venir — `agency_id?: string`, `route_id?: number | string`, `route_type?: int32`, `trip?: TripDescriptor`, `stop_id?: string`.

**`FeedEntityAlert`** (L367–L463)
| Campo | Tipo | Req. | Nota |
|---|---|---|---|
| `active_period` | `TimeRange \| TimeRange[]` | **sí** (sin `required`) | objeto o array: normalizar a array |
| `informed_entity` | `EntitySelector \| EntitySelector[]` | **sí** | ídem; el ejemplo trae strings vacíos |
| `cause` | integer | no | 1 UNKNOWN_CAUSE … 12 MEDICAL_EMERGENCY (L380–L392) |
| `effect` | integer | no | 1 NO_SERVICE, 2 REDUCED_SERVICE, 3 SIGNIFICANT_DELAYS, 4 DETOUR, 5 ADDITIONAL_SERVICE, 6 MODIFIED_SERVICE, 7 OTHER_EFFECT, 8 UNKNOWN_EFFECT, 9 STOP_MOVED (L396–L406) |
| `url` | `TranslatedString` | no | |
| `header_text` | `TranslatedString \| Translation[]` | no | en el ejemplo viene como **array plano** de `Translation`, no como `{translation: [...]}` |
| `description_text` | `TranslatedString \| Translation[]` | no | ídem |

**`TimeRange`** (L75–L93): `start` (int64, opc.; ausente = −∞), `end` (number nullable, opc.; ausente = +∞).
**`Translation`** (L95–L112): `text` (string, **req**), `language` (BCP-47, opc.).
**`TranslatedString`** (L114–L131): `translation: Translation | Translation[]` (sin `required` → obligatorio).
**`StopTimeEvent`** (L465–L477): `delay?` (int s; la descripción dice "si es positivo está adelantado; si es negativo está adelantado" — errata, en GTFS-RT positivo = atrasado), `time?` (int POSIX), `uncertainty?` (int).
**`FeedEntityTripUpdate`** (L479–L483): `trip?: TripDescriptor`, `vehicle: VehicleDescriptor` (obligatorio). Sin `stop_time_update`.

**Conclusión para Fase 2:** no tipar desde el RAML. Decodificar protobuf con `gtfs-realtime-bindings` (estándar) y validar el JSON (`json=1`) con Zod tolerante (objeto-o-array, campos renombrados como `vehiclePos`). Los fixtures reales de 1.4 son la fuente de verdad.

## Lo que el MVP necesita vs lo que la spec ofrece

| Necesidad del MVP | Endpoint en la spec | Estado en la spec | Observaciones |
|---|---|---|---|
| Estado del subte por línea (normal / demorada / interrumpida) | `/subtes/serviceAlerts` (+ `/subtes/forecastGTFS`) | ✅ declarado (L776, L755) | No hay endpoint de "estado"; se **deriva**: alerta activa con `effect` NO_SERVICE → interrumpida; SIGNIFICANT_DELAYS/REDUCED_SERVICE → demorada; sin alertas y con forecast → normal. `route_id` en `informed_entity` identifica la línea |
| Arribos de subte por estación | `/subtes/forecastGTFS` | ✅ declarado, **sin esquema** (L755–L775) | Se asume TripUpdates GTFS-RT; confirmar formato real (¿JSON por defecto? no declara `json` ni protobuf) |
| Posiciones de colectivos en tiempo real | `/colectivos/vehiclePositions` (pb/JSON) y `/colectivos/vehiclePositionsSimple` (JSON) | ✅ declarado (L947, L981) | Filtros `route_id`, `agency_id`, `Trip`. `Simple` agrega `route_short_name` (útil para mostrar el número de línea sin cruzar GTFS). Actualización cada 30 s según spec → TTL de proxy ≥ 15–30 s |
| Alertas de colectivos | `/colectivos/serviceAlerts` | ✅ declarado (L1004) | Filtros `agency_id`, `route_id`, `Trip` |
| Arribos de colectivos por parada | — | ❌ **no existe** | No hay `tripUpdates` de colectivos (ni comentado). Solo se podría **estimar** con posiciones + GTFS estático (fuera de alcance del MVP; riesgo 2 del plan) |
| Cortes de tránsito | `/transito/v1/cortes` | ⚠️ **comentado** (L1260–L1289) | No es parte del contrato. Verificar en 1.3 si responde y en qué formato (XML/GeoJSON/CIFS). Si no responde, la feature Tránsito queda sin fuente |
| GTFS estático subte | `/subtes/feed-gtfs` | ✅ (L722) | zip; para estaciones, colores de líneas (tarea 1.7) |
| GTFS estático colectivos | `/colectivos/feed-gtfs` (horarios) / `/colectivos/feed-gtfs-frequency` | ✅ (L929, L938) | El de horarios es el que pega con los feeds RT (L931); ~209 MB → preprocesado offline |
