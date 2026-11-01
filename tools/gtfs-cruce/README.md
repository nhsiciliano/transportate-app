# tools/gtfs-cruce

Cruza fuentes estáticas candidatas (GTFS y datasets de paradas) con los IDs reales del tiempo real de colectivos. Es una herramienta de investigación de la Fase 1; el análisis está en [`docs/01b-gtfs-alternativos.md`](../../docs/01b-gtfs-alternativos.md).

## Uso

```sh
cd tools/gtfs-cruce && npm install   # solo gtfs-realtime-bindings, dentro de esta carpeta
node tools/gtfs-cruce/cruce.mjs      # desde la raíz del repo (o `npm run cruce` acá)
```

- Requiere Node ≥ 22 y `unzip` en el PATH: lee los `.zip` en streaming y **nunca** abre `stop_times.txt` (1,4 GB).
- No descarga nada ni usa credenciales. Las fuentes se bajan a mano a `~/.cache/transportate/gtfs/` (o a `GTFS_CACHE`); si falta una, se marca como "no descargado" y el resto sigue.
- Tiempo real: `apps/proxy/test/fixtures/colectivos/{vehiclePositions.pb,tripUpdates.pb,vehiclePositionsSimple.json}`.
- Salida: tabla en consola + [`last-run.json`](last-run.json).

## Fuentes esperadas en la caché

| Ruta en `~/.cache/transportate/gtfs/` | De dónde sale |
|---|---|
| `colectivos_feed-gtfs.zip` | API GCBA `/colectivos/feed-gtfs` (la baja `tools/api-probe`; requiere credenciales) |
| `colectivos_feed-gtfs-frequency.zip` | API GCBA `/colectivos/feed-gtfs-frequency` (ídem) |
| `ba-cdn/colectivos-gtfs.zip` | <https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/colectivos-gtfs/colectivos-gtfs.zip> |
| `ba-paradas/paradas-de-colectivo.csv` | <https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/colectivos-paradas/paradas-de-colectivo.csv> |
| `nacion/lineas_jn_rmba_cnrt.kml` | <https://datos.transporte.gob.ar/dataset/recorridos-de-servicios-de-colectivos-amba> |
| `osm/bus_stops.json` | Overpass: `node["highway"="bus_stop"](-34.71,-58.54,-34.52,-58.33);out body;` |

## Qué mide

| Métrica (`cruce.*` en el JSON) | Significado |
|---|---|
| `routeId`, `tripId`, `stopId` | % de IDs distintos del tiempo real que existen en el estático |
| `prediccionesConStop` | % de `stop_time_update` de `tripUpdates` cuyo `stop_id` existe (ponderado por uso) |
| `routeIdMismoShortName` | De los `route_id` que cruzan, cuántos son **la misma línea** según `vehiclePositionsSimple`. 0 % = IDs reasignados: el cruce es casual |
| `stopIdPorFormato` | Cruce de `stop_id` separado por formato (numérico vs `S…`) |
| `vehiculosConStopIdAMenosDe1km`, `distanciaVehiculoAStopId_m` | Prueba de cordura: un vehículo debería estar cerca del `stop_id` que informa |
| `agencyName` | % de empresas del tiempo real (nombre normalizado) presentes en el estático |
| `shortNameEnCABAPorNumero` | % de líneas con vehículos en CABA cuyo número existe en la fuente |
| `coberturaEspacial` | Para fuentes sin IDs: % de `stop_id` del tiempo real (ubicados con el GTFS que más cruza) que tienen una parada de la fuente a ≤ 40 m |
