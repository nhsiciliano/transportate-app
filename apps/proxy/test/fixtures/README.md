# Fixtures reales de la API Transporte GCBA

Capturados por `tools/api-probe/probe.mjs` entre 2026-11-01T17:09:01.847Z y 2026-11-01T17:15:39.854Z (UTC) contra `https://apitransporte.buenosaires.gob.ar`. Son los cuerpos **crudos** de la primera muestra de cada endpoint/variante, sin credenciales. Se regeneran corriendo el probe (ver [`tools/api-probe/README.md`](../../../../tools/api-probe/README.md)); análisis en [`docs/01-api-transporte.md`](../../../../docs/01-api-transporte.md).

Convención: `<servicio>/<endpoint>[.<variante>].<ext>`. Variantes: `json=1` (mismo feed en JSON), `geo` (`x=-58.3816&y=-34.6037&radio=100&formato=geojson`), `latlon` (`lat/lon/radius` del RAML), `noauth` / `badsecret` (casos de auth). `.error.txt` = respuesta no-200, cuerpo vacío o formato inesperado, con cabecera `#` de metadatos seguida del cuerpo crudo.

| Archivo | Endpoint | Params | Status | Content-Type | Bytes | Capturado (UTC) | Nota |
|---|---|---|---|---|---:|---|---|
| `colectivos/serviceAlerts.json=1.json` | `/colectivos/serviceAlerts` | `json=1` | 200 | `application/json; charset=UTF-8` | 147 | 2026-11-01T17:09:06.887Z |  |
| `colectivos/serviceAlerts.pb` | `/colectivos/serviceAlerts` | — | 200 | `application/x-protobuf; charset=UTF-8` | 13 | 2026-11-01T17:09:06.858Z |  |
| `colectivos/tripUpdates.pb` | `/colectivos/tripUpdates` | — | 200 | `application/x-protobuf; charset=UTF-8` | 3635006 | 2026-11-01T17:09:07.859Z |  |
| `colectivos/vehiclePositions.json=1.json` | `/colectivos/vehiclePositions` | `json=1` | 200 | `application/json; charset=UTF-8` | 3529543 | 2026-11-01T17:09:05.151Z |  |
| `colectivos/vehiclePositions.pb` | `/colectivos/vehiclePositions` | — | 200 | `application/x-protobuf; charset=UTF-8` | 589766 | 2026-11-01T17:09:04.860Z |  |
| `colectivos/vehiclePositionsSimple.json` | `/colectivos/vehiclePositionsSimple` | — | 200 | `application/json; charset=UTF-8` | 1090934 | 2026-11-01T17:09:05.858Z |  |
| `ecobici/stationInformation.json` | `/ecobici/gbfs/stationInformation` | — | 200 | `application/json; charset=UTF-8` | 183671 | 2026-11-01T17:09:16.859Z |  |
| `ecobici/stationStatus.json` | `/ecobici/gbfs/stationStatus` | — | 200 | `application/json; charset=UTF-8` | 122312 | 2026-11-01T17:09:15.858Z |  |
| `ecobici/systemInformation.json` | `/ecobici/gbfs/systemInformation` | — | 200 | `application/json; charset=UTF-8` | 394 | 2026-11-01T17:09:14.858Z |  |
| `subtes/forecastGTFS.json` | `/subtes/forecastGTFS` | — | 200 | `application/json; charset=UTF-8` | 42725 | 2026-11-01T17:09:22.916Z |  |
| `subtes/forecastGTFS.json=1.json` | `/subtes/forecastGTFS` | `json=1` | 200 | `application/json; charset=UTF-8` | 42725 | 2026-11-01T17:09:56.999Z |  |
| `subtes/serviceAlerts.badsecret.error.txt` | `/subtes/serviceAlerts` | `json=1` | 401 | `application/json; charset=UTF-8` | 300 | 2026-11-01T17:10:46.283Z |  |
| `subtes/serviceAlerts.json=1.json` | `/subtes/serviceAlerts` | `json=1` | 200 | `application/json; charset=UTF-8` | 2901 | 2026-11-01T17:09:02.950Z |  |
| `subtes/serviceAlerts.noauth.error.txt` | `/subtes/serviceAlerts` | `json=1` | 401 | `application/json; charset=UTF-8` | 308 | 2026-11-01T17:10:46.159Z |  |
| `subtes/serviceAlerts.pb` | `/subtes/serviceAlerts` | — | 200 | `application/octet-stream; charset=UTF-8` | 608 | 2026-11-01T17:09:02.858Z | protobuf corrupto en origen (bytes >= 0x80 reemplazados por U+FFFD); no decodifica |
| `subtes/tripUpdates.error.txt` | `/subtes/tripUpdates` | — | 404 | `application/json; charset=UTF-8` | 326 | 2026-11-01T17:09:03.860Z |  |
| `subtes/tripUpdates.json=1.error.txt` | `/subtes/tripUpdates` | `json=1` | 404 | `application/json; charset=UTF-8` | 336 | 2026-11-01T17:09:03.895Z |  |
| `transito/cortes.error.txt` | `/transito/v1/cortes` | — | 500 | `text/plain; charset=UTF-8` | 261 | 2026-11-01T17:09:11.859Z |  |
| `transito/cortes.geo.error.txt` | `/transito/v1/cortes` | `x=-58.3816&y=-34.6037&radio=100&formato=geojson` | 500 | `text/plain; charset=UTF-8` | 324 | 2026-11-01T17:09:11.882Z |  |
| `transito/estacionamientos.error.txt` | `/transito/v1/estacionamientos` | — | 500 | `text/plain; charset=UTF-8` | 301 | 2026-11-01T17:09:33.865Z |  |
| `transito/estacionamientos.geo.geojson` | `/transito/v1/estacionamientos` | `x=-58.3816&y=-34.6037&radio=100&formato=geojson` | 200 | `application/json; charset=UTF-8` | 45 | 2026-11-01T17:09:33.896Z |  |
| `transito/estacionamientos.palermo.fullInfo.json` | `/transito/v1/estacionamientos` | `x=-58.4351&y=-34.5884&radio=100&fullInfo=true&limite=3` | 200 | `application/json; charset=UTF-8` | 3167 | 2026-11-01T17:10:17.125Z |  |
| `transito/estacionamientos.palermo.geo.geojson` | `/transito/v1/estacionamientos` | `x=-58.4351&y=-34.5884&radio=100&formato=geojson` | 200 | `application/json; charset=UTF-8` | 2069 | 2026-11-01T17:10:08.044Z |  |
| `transito/semaforos.geo.json` | `/transito/v1/semaforos` | `x=-58.3816&y=-34.6037&radio=100&formato=geojson` | 200 | `application/json; charset=UTF-8` | 632847 | 2026-11-01T17:09:27.244Z |  |
| `transito/semaforos.json` | `/transito/v1/semaforos` | — | 200 | `application/json; charset=UTF-8` | 632847 | 2026-11-01T17:09:13.858Z |  |
| `transito/semaforos.latlon.json` | `/transito/v1/semaforos` | `lat=-34.6037&lon=-58.3816&radius=100` | 200 | `application/json; charset=UTF-8` | 632847 | 2026-11-01T17:09:48.470Z |  |
| `trenes/serviceAlerts.error.txt` | `/trenes/serviceAlerts` | — | 404 | `text/plain` | 282 | 2026-11-01T17:09:10.859Z |  |
| `trenes/serviceAlerts.json=1.error.txt` | `/trenes/serviceAlerts` | `json=1` | 404 | `text/plain` | 292 | 2026-11-01T17:09:10.881Z |  |
| `trenes/tripUpdates.error.txt` | `/trenes/tripUpdates` | — | 404 | `text/plain` | 278 | 2026-11-01T17:09:09.859Z |  |
| `trenes/tripUpdates.json=1.error.txt` | `/trenes/tripUpdates` | `json=1` | 404 | `text/plain` | 288 | 2026-11-01T17:09:09.880Z |  |
| `trenes/vehiclePositions.error.txt` | `/trenes/vehiclePositions` | — | 404 | `text/plain` | 288 | 2026-11-01T17:09:08.858Z |  |
| `trenes/vehiclePositions.json=1.error.txt` | `/trenes/vehiclePositions` | `json=1` | 404 | `text/plain` | 298 | 2026-11-01T17:09:08.879Z |  |

## No guardados

- `colectivos/tripUpdates.json=1.json` (`/colectivos/tripUpdates`): excede 5242880 bytes (22573264).

## Particularidades que los tests del proxy tienen que cubrir

- `subtes/serviceAlerts.pb`: protobuf **corrupto en origen**, no decodifica. Sirve para testear el camino de "upstream inválido"; el adaptador real usa `serviceAlerts.json=1.json`.
- `subtes/forecastGTFS*.json`: formato propio (`Header`/`Entity`/`Linea`/`Estaciones`), no GTFS-RT. En esta captura está **congelado** (`Header.timestamp` 2026-10-24): sirve para testear la detección de dato viejo.
- `colectivos/*.json=1.json`: claves con prefijo `_` y `extensionObject` (serialización Java), enums numéricos.
- `colectivos/*.pb`: `header.timestamp` = hora del request; la frescura sale de `vehicle.timestamp` o `trip_update.timestamp`. Incluyen vehículos sin viaje, fuera del AMBA y con timestamps de horas atrás.
- `transito/cortes*.error.txt`: `500 text/plain` con el path como cuerpo; `transito/estacionamientos.error.txt`: `500` por falta de `x` (debería ser 400).
- `trenes/*.error.txt` y `subtes/tripUpdates*.error.txt`: `404` "No listener…" en dos formatos distintos (`text/plain` y JSON).

Los zips GTFS estáticos no se guardan acá (pesan decenas/cientos de MB); el probe los baja a `~/.cache/transportate/gtfs/`.

## Fixtures de la API comunitaria de trenes (SOFSE)

Capturados por `tools/sofse-probe/probe.mjs --fixtures` el **2026-11-05 entre 11:56 y 11:57 UTC** (08:56 hora de Buenos Aires, día hábil) contra `https://ariedro.dev/api-trenes`, la instancia pública comunitaria que reenvía a la API interna de SOFSE (Trenes Argentinos). Cuerpos **crudos**, sin credenciales (la fuente no usa). Se regeneran con:

```sh
node tools/sofse-probe/probe.mjs --fixtures
```

| Archivo | Endpoint | Bytes | Nota |
|---|---|---:|---|
| `sofse/gerencias.json` | `/infraestructura/gerencias?idEmpresa=1` | 4366 | 7 gerencias (incluye Regionales 501, que el proxy ignora); una alerta informativa por línea; `estado.mensaje` «Alertas por ramal» en todas |
| `sofse/ramales.11.json` | `/infraestructura/ramales?idGerencia=11` (Roca) | 9489 | 12 ramales; Cañuelas-Lobos con alerta «interrumpido por obras» |
| `sofse/ramales.1.json` | `…?idGerencia=1` (Sarmiento) | 4793 | 4 ramales; Moreno-Mercedes con dos alertas `SIGNIFICANT_DELAYS` (una vence 09:36) |
| `sofse/ramales.5.json` | `…?idGerencia=5` (Mitre) | 2970 | 5 ramales, sin alertas |
| `sofse/ramales.31.json` | `…?idGerencia=31` (San Martín) | 1179 | 2 ramales, sin alertas |
| `sofse/ramales.21.json` | `…?idGerencia=21` (Belgrano Sur) | 2358 | 3 ramales; M.C.G. Belgrano con «recorrido limitado» |
| `sofse/ramales.41.json` | `…?idGerencia=41` (Tren de la Costa) | 571 | 1 ramal, `alerta: null` |
| `sofse/estaciones.ramal=1.json` | `/infraestructura/estaciones?idRamal=1` (Once-Moreno) | 4947 | Ids, coordenadas y orden como strings |
| `sofse/arribos.332.json` | `/arribos/estacion/332?cantidad=8` (Retiro LGM) | 65099 | Terminal: `llegada: {}`, solo `salida.programada`; dos servicios sin `anden` |
| `sofse/arribos.50.json` | `/arribos/estacion/50?cantidad=8` (Caballito) | 82055 | Intermedia: `llegada`/`salida` con `programada` y a veces `estimada`; sentidos 1 y 2 |
| `sofse/arribos.inexistente.json` | `/arribos/estacion/999999?cantidad=8` | 48 | `{"timestamp":…,"results":[],"total":0}` con status 200 |

Particularidades que los tests del adaptador de trenes cubren:

- Los ISO de los arribos son **UTC reales** (`segundos` = `programada − timestamp` o `estimada − timestamp`); las `vigencia_*` de las alertas son **hora de Buenos Aires sin offset**.
- Ningún arribo de esta captura está cancelado ni en el pasado: los tests los fabrican sobre la fixture.
- `efecto_gtfs` llega como nombre (`OTHER_EFFECT`, `SIGNIFICANT_DELAYS`), nunca como número.
