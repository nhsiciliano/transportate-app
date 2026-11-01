# captura-posiciones

Captura continua de los feeds de colectivos de la API Transporte GCBA (Fase 2, tarea 2.0). Sirve para **medir cuántos `stop_id` de `tripUpdates` se pueden ubicar** aprendiendo de las posiciones de los vehículos (plan B de `docs/01b-gtfs-alternativos.md`, ADR-0006). Otro worker consume estos CSV para armar la tabla de equivalencias `stop_id → parada`.

Es un paquete standalone (npm, Node ≥ 22, ESM) y no forma parte del build del monorepo.

## Uso

```sh
cd tools/captura-posiciones
npm install --no-package-lock     # una sola dependencia: gtfs-realtime-bindings 2.2.0
./start.sh                         # lanza con nohup, guarda el PID
./status.sh                        # PID vivo, snapshots por día, tamaño
./stop.sh                          # detiene (SIGTERM) y borra el PID
node captura.mjs --once            # prueba: un snapshot de cada feed y termina
```

Lee `GCBA_CLIENT_ID` y `GCBA_CLIENT_SECRET` del `.env` de la raíz del repo (gitignored). Todo se escribe **fuera del repo**, en `~/.cache/transportate/capturas/` (se cambia con `CAPTURA_DIR=… ./start.sh` o `--dir=`).

| Archivo | Contenido |
|---|---|
| `posiciones-YYYY-MM-DD.csv.gz` | una fila por vehículo y snapshot (cada ~60 s) |
| `viajes-YYYY-MM-DD.csv.gz` | muestra de `tripUpdates` (cada ~10 min) |
| `captura.log` | una línea por snapshot; **sin URLs ni credenciales** |
| `captura.pid`, `captura.out` | PID y salida estándar del proceso (crashes) |

El día del nombre de archivo es el de **Buenos Aires** (UTC−3, sin horario de verano). Con macOS, `start.sh` también lanza `caffeinate -i` atado al proceso para que el equipo no se duerma por inactividad; **cerrar la tapa suspende igual** y deja un hueco en la captura (se ve en el log).

## Formato de los CSV

Compresión: cada snapshot se agrega como un **miembro gzip** al final del archivo del día (el encabezado se escribe una sola vez, al crear el archivo). Un archivo con varios miembros se lee de corrido con `gzip -dc archivo.csv.gz` (en macOS `zcat` busca `.Z`: usar `gzip -dc`; en Linux `zcat` también anda). CSV con coma como separador, `\n`, UTF-8; los campos se entrecomillan solo si hace falta. Un campo vacío significa "el feed no lo trae".

### `posiciones-YYYY-MM-DD.csv.gz`

Fuente: `/colectivos/vehiclePositions` (GTFS-RT protobuf, ≈ 5.700 vehículos, ≈ 150 KB comprimidos por snapshot, ≈ 200 MB por día).

```
snapshot_ts,vehicle_id,trip_id,route_id,stop_id,current_stop_sequence,current_status,lat,lon,speed,vehicle_ts
```

| Columna | Qué es |
|---|---|
| `snapshot_ts` | Epoch en segundos (UTC) en que **se pidió** el feed. Todas las filas de un snapshot lo comparten. No usar `header.timestamp` del feed: es la hora del request (`docs/01-api-transporte.md`). |
| `vehicle_id` | `vehicle.vehicle.id` (interno del sistema AVL, p. ej. `3762`). **No se guardan** `label` ni `licensePlate` (patente). |
| `trip_id` | `vehicle.trip.trip_id`. Vacío en ≈ 34 % de los vehículos (sin viaje asignado). |
| `route_id` | `vehicle.trip.route_id` (es un **ramal**, no el número de línea; no cruza con el GTFS estático de 2021). |
| `stop_id` | `vehicle.stop_id`: la parada a la que se refiere `current_status`. Texto: conserva ceros a la izquierda (`06497000089`); no lo conviertas a número. |
| `current_stop_sequence` | `vehicle.current_stop_sequence`. |
| `current_status` | `INCOMING_AT`, `STOPPED_AT` o `IN_TRANSIT_TO`. **En las muestras relevadas el feed no lo informa** (columna vacía). |
| `lat`, `lon` | WGS84 con precisión de float32 (≈ 7 decimales significativos). Hay ≈ 7,6 % de vehículos fuera del AMBA; no se filtraron. |
| `speed` | `position.speed` (≈ m/s). |
| `vehicle_ts` | Epoch en segundos (UTC) de la posición del vehículo (`vehicle.timestamp`). Frescura = `snapshot_ts − vehicle_ts`. |

### `viajes-YYYY-MM-DD.csv.gz`

Fuente: `/colectivos/tripUpdates` (GTFS-RT protobuf, ≈ 3,6 MB, ≈ 3.700–3.900 viajes y ≈ 105.000 `stop_time_update` por snapshot).

```
snapshot_ts,trip_id,route_id,stop_id,stop_sequence,arrival_time,delay
```

| Columna | Qué es |
|---|---|
| `snapshot_ts` | Igual que arriba. |
| `trip_id`, `route_id` | `trip_update.trip.trip_id` / `route_id`. |
| `stop_id` | `stop_time_update.stop_id` (texto). Es lo que hay que ubicar. |
| `stop_sequence` | `stop_time_update.stop_sequence`. Se puede cruzar con `current_stop_sequence` de `posiciones` por `(trip_id, stop_sequence)`. |
| `arrival_time` | Epoch en segundos (UTC) de `arrival.time`, o de `departure.time` si no hay arribo. Vacío en las paradas con `schedule_relationship=NO_DATA`. |
| `delay` | `arrival.delay` (o `departure.delay`) en segundos. Vacío si no hay. Trae valores extremos (p. ej. 85.874 s): filtrar al analizar. |

**Muestreo (documentado a propósito):** de cada `tripUpdates` se guardan **1 de cada 3 viajes**, elegidos con un hash estable del `trip_id` (FNV-1a de 32 bits módulo 3, `TRIP_SAMPLE=3`). Es estable: un viaje que entra en la muestra entra en todos los snapshots, así que se puede seguir su evolución. Con eso cada snapshot guarda ≈ 1.200 viajes y ≈ 29.000 filas (≈ 290 KB comprimidos, ≈ 40 MB por día). Las filas son únicas por `(trip_id, stop_sequence, stop_id)` dentro de cada snapshot; **entre snapshots se repite** la misma parada con su `arrival_time` actualizado (no se deduplica para conservar la evolución de la predicción). Para medir cobertura de `stop_id` alcanza con `SELECT DISTINCT stop_id`; el muestreo puede subestimar paradas poco frecuentes, así que la cobertura medida es una cota inferior (para ver todas: `TRIP_SAMPLE=1 ./start.sh`, ≈ 120 MB por día).

### Ejemplos de lectura

```sh
gzip -dc ~/.cache/transportate/capturas/posiciones-2026-11-01.csv.gz | head -3
# stop_id distintos informados por los vehículos (quitar la fila de encabezado repetida si hubiera)
gzip -dc ~/.cache/transportate/capturas/posiciones-*.csv.gz | awk -F, 'NR>1 && $1!="snapshot_ts" && $5!="" {print $5}' | sort -u | wc -l
# snapshots capturados en un día
gzip -dc ~/.cache/transportate/capturas/posiciones-2026-11-01.csv.gz | awk -F, 'NR>1 {print $1}' | sort -u | wc -l
```

## Comportamiento

- **Cadencia:** `vehiclePositions` cada 60 s y `tripUpdates` cada 10 min, ambos con **jitter de ±5 s**. La espera se cuenta desde el final del snapshot anterior, así que el período real es algo mayor a 60 s cuando el upstream es lento.
- **Fallos:** el upstream falla entre 1 y 9 % de las requests (`docs/01-api-transporte.md`). Cada request tiene timeout de 20 s y **1 reintento** a los 2 s; si también falla, se loguea y se sigue con el próximo snapshot (queda un hueco en el CSV, nunca se escriben filas parciales). Un error inesperado se captura y no mata el proceso.
- **Red de protección:** `SIGTERM`/`SIGINT` cierran limpio y borran el PID. Si el proceso muere por otra causa, `status.sh` lo marca "NO está corriendo".
- **Cabeceras:** `User-Agent: transportate-tools/0.1`, sin datos personales.
- **Log:** una línea por snapshot, p. ej. `2026-11-01T23:31:07Z vehiclePositions ok vehiculos=5676 bytes=567675 ms=268 intento=1`. En los fallos se registra solo la clase de error (`TimeoutError`, `ECONNRESET`, `http_500`, `decode`); nunca la URL (lleva el secret) ni las credenciales. Antes de loguear cualquier texto de error se redactan el secret, el id y las URLs.

## Privacidad

No se guardan patentes ni etiquetas de los vehículos, ni ningún dato de personas. Los CSV son datos públicos de la flota, pero igual quedan **fuera del repo** (`~/.cache/transportate/`). Los `*.log` están en `.gitignore`; los `*.csv.gz` nunca se commitean.
