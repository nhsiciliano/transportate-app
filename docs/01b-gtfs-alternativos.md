# 01b — Fuentes alternativas de GTFS estático de colectivos

> Tarea F1-MID-3 (Fase 1). Consultas y descargas: **2026-11-01** (UTC−3). Descargas en `~/.cache/transportate/gtfs/` (fuera del repo).
> Cruce calculado por [`tools/gtfs-cruce/cruce.mjs`](../tools/gtfs-cruce/cruce.mjs); números exactos en [`tools/gtfs-cruce/last-run.json`](../tools/gtfs-cruce/last-run.json).
> Contexto: `docs/01-api-transporte.md` §"Cruce tiempo real ↔ GTFS estático de colectivos" mostró que el `feed-gtfs` de la API es de 2021 y cruza 31 % de `route_id` y 40 % de `stop_id`.

## TL;DR

1. **No existe hoy un GTFS de colectivos vigente y público.** Los tres GTFS que hay son de 2019–2021 y la API sirve el de 2021. El Ministerio de Transporte de la Nación no publica GTFS (su CKAN da 0 resultados para "gtfs"). Mobility Database y Transitland solo tienen la copia de 2019 o nada.
2. **El 31 % de `route_id` que "cruza" es casual:** de 252 `route_id` que existen en ambos lados, **0** son la misma línea (por ejemplo, RT `1663` = línea 130; GTFS 2021 `1663` = 134B de otra empresa). Los `trip_id` también cruzan por casualidad (`<n>-1` secuenciales). **No se puede unir líneas por `route_id`.**
3. **Los `stop_id` numéricos sí parecen estables:** el 44,7 % de los numéricos existe en el GTFS 2021, y el 79 % de los vehículos está a menos de 1 km del `stop_id` que informa (p50 234 m). Los 3.613 `stop_id` con formato `S…` (10 %) son nuevos: 0 % de cruce.
4. **Las líneas se pueden unir por nombre:** empresa (89,5 %) + número de línea (93,6 % de las líneas con vehículos en CABA) contra el estático. `vehiclePositionsSimple` ya trae `route_short_name`, `agency_name` y `trip_headsign` por `route_id`.
5. **Para paradas en CABA hay una fuente oficial vigente:** el dataset "Colectivos: paradas" de BA Data, **actualizado el 2026-09-21**. Tiene 7.027 paradas con calle, altura, coordenadas y hasta 6 líneas con sentido, pero **no trae `stop_id`**. El 69,5 % de los `stop_id` del tiempo real que se pueden ubicar en CABA tiene una de esas paradas a ≤ 40 m (p50 8 m). OSM llega al 78,8 % (p50 11 m).
6. **Recomendación:** no buscar un GTFS que no existe. Construir una **tabla de equivalencias propia** `stop_id RT → coordenadas → parada BA` (plan B, abajo). Se siembra con el GTFS 2021 y se completa aprendiendo de las posiciones de los vehículos. Los arribos por parada (4.7) se habilitan solo en las paradas con equivalencia confirmada.

## 1. Candidatos relevados

| # | Fuente | URL | Publicador | Licencia | Última actualización declarada | Tamaño | Formato | Credenciales | Vigencia real de los datos |
|---|---|---|---|---|---|---:|---|---|---|
| A | API GCBA `/colectivos/feed-gtfs` | `https://apitransporte.buenosaires.gob.ar/colectivos/feed-gtfs` (RAML `:929-937`) | GCBA (Secretaría de Transporte) | CC-BY-2.5-AR (términos de BA Data) | Sin `feed_info`; archivos internos 26–27/02/2021 | 209.488.251 B | GTFS (sin `calendar.txt`, con `shapes`) | **Sí** (`client_id`/`client_secret`) | `calendar_dates` 2020-12-21 → 2021-06-21 |
| B | API GCBA `/colectivos/feed-gtfs-frequency` | `https://apitransporte.buenosaires.gob.ar/colectivos/feed-gtfs-frequency` (RAML `:938-946`) | `feed_publisher_name` = NSSA (Nación Servicios / SUBE), `https://www.argentina.gob.ar/sube` | ídem | Archivos internos 15–16/12/2020; `feed_version` v1.0 | 13.670.441 B | GTFS con `frequencies.txt` | **Sí** | `feed_start/end_date` 2018-01-01 → **2021-12-31** |
| C | BA Data "Colectivos: GTFS" (CDN) = **Mobility Database `mdb-1220`** | <https://data.buenosaires.gob.ar/dataset/colectivos-gtfs> → `https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/colectivos-gtfs/colectivos-gtfs.zip`; MDB: <https://mobilitydatabase.org/feeds/gtfs/mdb-1220> | Secretaría de Transporte y Obras Públicas (GCBA) | CC-BY-2.5-AR | Página: "actualización 1 de julio de 2026", frecuencia "cada dos años", **aviso de suspensión** de datasets API/GTFS. CDN: `Last-Modified: 2019-10-31`. MDB: última descarga 2025-06-17 | 209.195.824 B | GTFS | No | `calendar_dates` 2019-09-28 → 2019-12-31. El zip del CDN y el de MDB son **idénticos** (md5 `b4ef9e94…0414`) |
| D | BA Data "Colectivos: paradas" | <https://data.buenosaires.gob.ar/dataset/colectivos-paradas> → `…/colectivos-paradas/paradas-de-colectivo.csv` (también XLSX, GeoJSON, SHP) | Secretaría de Transporte y Obras Públicas (GCBA) | CC-BY-2.5-AR | **2026-09-21** (página y `Last-Modified` del CDN); frecuencia "cada medio año"; sin aviso de suspensión | 826.120 B | CSV: `CALLE, ALT PLANO, DIRECCION, coord_X, coord_Y, COMUNA, BARRIO, L1…L6, l1_sen…l6_sen` | No | Vigente; solo CABA |
| E | Nación "Recorridos de servicios de colectivos AMBA" | <https://datos.transporte.gob.ar/dataset/recorridos-de-servicios-de-colectivos-amba> → `lineas_jn_rmba_cnrt.kml` | Ministerio de Transporte / CNRT | CC-BY-4.0 | Recurso 2022-06-15; dataset modificado 2023-04-12 | 9.609.740 B | KML: 1.128 trazados (línea, ramal, sentido, razón social) | No | 2022; solo líneas de **jurisdicción nacional**; sin paradas |
| F | OpenStreetMap `highway=bus_stop` | Overpass API, bbox `(-34.71,-58.54,-34.52,-58.33)` | Colaboradores de OSM | **ODbL 1.0** (share-alike) | Base OSM al 2026-11-01T23:04Z | 2.345.625 B (JSON) | 8.687 nodos; 8.666 con `name`, 26 con `ref`, 1 con `route_ref` | No | Vigente pero sin líneas por parada (las líneas viven en relaciones `route`, no relevadas) |

**Descartados después de buscarlos:**

- **Transitland atlas:** `feeds/data.buenosaires.gob.ar.dmfr.json` solo tiene subte (`f-69y7-recursosdatabuenosairesgobar`) y trenes (`f-buenosaires~trenes`). No hay feed de colectivos (<https://github.com/transitland/transitland-atlas>, consultado 2026-11-01).
- **datos.transporte.gob.ar (CKAN):** `package_search?q=gtfs` y `q=paradas` dan **0 resultados**. Con `q=colectivos` aparecen 12 datasets, ninguno GTFS. "Líneas de transporte de RMBA" (`lineas_nacional.csv`) es un listado SUBE línea ↔ empresa cuyo último período es **09/2019**.
- **SUBE / CNRT:** no publican GTFS propio. NSSA (SUBE) figura como publicador del feed B, que es de 2021.
- **TUMI Data Hub** (`hub.tumidata.org/dataset/buses_gtfs_buenos_aires`): es un espejo del mismo dataset de BA Data, sin versión más nueva.

## 2. Verificación de los GTFS (A, B, C)

| | A — API `feed-gtfs` | B — API `feed-gtfs-frequency` | C — BA Data / MDB |
|---|---|---|---|
| `feed_info` | no tiene | NSSA, v1.0, 2018-01-01 → 2021-12-31 | no tiene |
| Rango real de servicio | 2020-12-21 → 2021-06-21 | 2018-01-01 → 2021-12-31 | 2019-09-28 → 2019-12-31 |
| `agency` / `routes` / `stops` / `trips` | 193 / 1.076 / 43.201 / 453.075 | 192 / 1.076 / 43.213 / 7.173 | 192 / 1.052 / 43.594 / 436.407 |
| Paradas dentro de CABA | 11.331 | 11.342 | 11.493 |
| bbox de `stops` | lat −35,18…−34,04; lon −60,98…−57,73 (AMBA ampliado) | ídem | ídem |
| Mojibake | no detectado | **7 empresas** en `agency.txt` (`ValentÃ­n`…) | no detectado |
| Convención de IDs | `route_id` numérico (`4167`), `stop_id` numérico de 9–10 dígitos (`6441111945`), `trip_id` `<n>-1`, `route_short_name` con ramal (`505R3`) | `route_id` numérico, mismos `stop_id`, `trip_id` propios (`311DI1`) | igual que A |

El tiempo real (fixtures del 2026-11-01) trae 1.357 `route_id`, 3.276 `trip_id`, 35.447 `stop_id` (31.636 numéricos, 3.613 `S…`, 198 de otro formato), 538 `route_short_name` y 124 empresas. Ojo: el propio tiempo real tiene mojibake en nombres de empresa (`OÂ´HIGGINS`).

## 3. Cruce con el tiempo real

Salida de `node tools/gtfs-cruce/cruce.mjs` (2026-11-01). En las columnas de IDs, % sobre los IDs distintos del tiempo real; en "predicciones", % de los 105.325 `stop_time_update`.

| Candidato | `route_id` | …y es la misma línea | `trip_id`* | `stop_id` | `stop_id` numéricos | `stop_id` `S…` | predicciones con `stop_id` | vehículo a < 1 km de su `stop_id` | empresa (nombre) | línea en CABA (número) | cobertura espacial ≤ 40 m |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A — API `feed-gtfs` | 31,1 % | **0 %** (0/252) | 100 %* | 39,9 % | 44,7 % | 0 % | 40,5 % | 78,9 % (p50 234 m) | 89,5 % | 93,6 % | — |
| B — API `feed-gtfs-frequency` | 31,1 % | **0 %** | 0 % | 39,9 % | 44,7 % | 0 % | 40,5 % | 78,9 % | 93,5 % | 93,6 % | — |
| C — BA Data / MDB (2019) | 30,4 % | **0 %** | 100 %* | 14,1 % | 15,8 % | 0 % | 19,6 % | 82,8 % | 89,5 % | 92,4 % | — |
| D — BA "Colectivos: paradas" | — | — | — | sin IDs | — | — | — | — | — | 78,7 % | **69,5 %** (p50 8 m, p90 17 m) |
| E — Nación KML (CNRT) | — | — | — | sin paradas | — | — | — | — | 21,8 % | 78,7 % | — |
| F — OSM `bus_stop` | — | — | — | sin IDs | — | — | — | — | — | — | **78,8 %** (p50 11 m, p90 23 m) |

\* `trip_id` "cruza" en A y C porque ambos lados numeran `1-1`, `2-1`…; no es el mismo viaje.
"Cobertura espacial" = de los 5.425 `stop_id` del tiempo real que se pueden ubicar en CABA con el GTFS A, cuántos tienen una parada de la fuente a ≤ 40 m.
"Línea en CABA" = de las 249 `route_short_name` con al menos un vehículo en el bbox de CABA, cuántas existen por número (`228B` → `228`) en la fuente.

**Cómo se leen los números:**

- **`route_id`:** fueron reasignados. El 0 % de coincidencia de nombre en los 252 IDs compartidos prueba que el 31 % es ruido. Rescatar por nombre funciona: 55,6 % de los `route_id` sin match tienen su `route_short_name` en A, y con número + empresa se cubre el 93,6 % de las líneas de CABA.
- **`stop_id`:** los códigos numéricos sobrevivieron parcialmente entre 2019, 2021 y hoy (C 15,8 % → A 44,7 %), con distancias plausibles. Parecen códigos de parada persistentes del sistema (SUBE/AVL). Los `S…` son paradas dadas de alta después de 2021. En la práctica, el **60 % de los `stop_id` no se puede ubicar** con ningún GTFS público (y el 59,5 % de las predicciones).
- **Paradas BA (D):** describen las mismas paradas físicas (p50 8 m) para 7 de cada 10 `stop_id` ubicables. Las que no cubre son, en buena parte, paradas que no están en la lista oficial o están a más de 40 m. A validar en Fase 2.

## 4. Recomendación

| Necesidad | Fuente recomendada | Cómo |
|---|---|---|
| **Líneas y ramales** (nombre visible, empresa, cabeceras) | El propio tiempo real: `vehiclePositionsSimple` (`route_short_name`, `agency_name`, `trip_headsign` por `route_id`) | El proxy arma y cachea un diccionario `route_id → {línea, ramal, empresa, cabecera}` en cada lectura. No depende de ningún GTFS |
| **Búsqueda por línea** (4.5) | Ese diccionario + número de línea | Unir por **empresa normalizada + número**, nunca por `route_id` |
| **Paradas: ubicación, calle y altura, líneas** (4.5/4.7) | **D — BA "Colectivos: paradas"** (oficial, 2026, CABA) | Es el catálogo de paradas que ve el usuario. OSM (F) solo como respaldo, y revisando licencia (riesgos) |
| **`stop_id` RT → parada** (necesario para arribos) | **Tabla de equivalencias propia** (plan B) | Semilla: coordenadas del GTFS A para los `stop_id` numéricos que cruzan; ajuste al punto de D a ≤ 40 m. Resto: aprendido de posiciones (abajo) |
| **Recorridos / shapes** | `shapes.txt` de A (2021), unido por número de línea; E (KML 2022) para líneas nacionales | Solo para dibujar en el mapa, marcado como "recorrido aproximado". Alternativa: trazar con las posiciones acumuladas |
| **Horarios teóricos** | Ninguna | No hay fuente vigente: el MVP no muestra horarios programados |

**Sí hace falta una tabla de equivalencias**, y conviene combinar id + nombre: id donde el `stop_id` es estable, nombre (empresa + número) para líneas, y espacio (≤ 40 m) para unir con las paradas oficiales.

### Plan B: tabla de paradas aprendida del tiempo real

1. **Semilla (offline, una vez):** los `stop_id` numéricos del tiempo real que existen en A toman sus coordenadas. Se descartan los que quedan a más de 1 km de vehículos que los informan (el 21 % de los casos tiene distancias de varios km: IDs reasignados).
2. **Aprendizaje (proxy o job programado):** `vehiclePositions` trae por vehículo `stopId`, `currentStopSequence` y la posición. Acumulando lecturas cada 60 s durante varios días, cada `stop_id` junta una nube de posiciones del vehículo cuando informa esa parada. El punto de la parada se estima con la posición de mínima distancia/velocidad, y se ajusta a la parada oficial (D) más cercana a ≤ 40 m que tenga el mismo número de línea (columnas `L1…L6`). En una sola captura, 3.366 `stop_id` aparecen en `vehiclePositions` (el 8,4 % de los de `tripUpdates`). La cobertura en días **no está medida**: es el primer paso de la Fase 2.
3. **Nombres:** calle y altura de D ("Defensa 1524"). Si no hay parada D cerca, la calle se toma de OSM o de geocodificación inversa, siempre offline en el preprocesado y nunca desde el teléfono.
4. **Confianza:** cada fila guarda su origen (`gtfs2021`, `aprendida`, `ajustada-BA`) y la cantidad de observaciones. La app solo muestra arribos de paradas con confianza suficiente.

## 5. Impacto en tareas

- **2.10 (preprocesado a R2):** deja de ser "procesar el GTFS de 209 MB". Las entradas pasan a ser:
  - D (paradas BA);
  - de A, solo `stops.txt` y `shapes.txt` (ya no `stop_times`, de 1,4 GB);
  - la tabla de equivalencias aprendida.

  La salida sigue siendo JSON compacto versionado en R2, más chico que lo estimado. Se agrega un **job de aprendizaje** que alimente la tabla (Fase 2: definir dónde corre, por ejemplo cron de Worker + D1/R2, y su costo).
- **4.5 (búsqueda local por línea y parada):** viable. Las líneas salen del diccionario del tiempo real y las paradas de D (7.027 en CABA, con calle y altura buscables). No depende del GTFS.
- **4.7 (paradas cercanas y arribos por parada):** las paradas cercanas son viables desde D. Los **arribos por parada** quedan condicionados a la tabla de equivalencias:
  - hoy, sin aprendizaje, ~40 % de las predicciones tienen parada ubicable (vía A);
  - de esas paradas, el 69,5 % se ajusta a una parada oficial.

  La UI tiene que ocultar los arribos en paradas sin equivalencia (es coherente con el brief `docs/briefs/02-colectivos.md`, punto de entrada N4).
- **`docs/briefs/02-colectivos.md` y `05-favoritos.md`:** se escribieron suponiendo que no había arribos. Hay que revisar ese supuesto en el `shape` de Fase 4, porque `tripUpdates` existe (`docs/01-api-transporte.md`) pero la cobertura será parcial.

## 6. Riesgos

| Riesgo | Detalle | Mitigación |
|---|---|---|
| **Licencia OSM (ODbL)** | Una base derivada que mezcle OSM con datos propios queda alcanzada por share-alike | Usar OSM solo como respaldo para nombres, o publicar la tabla derivada bajo ODbL. Decidir en un ADR antes de usarlo |
| **Atribución CC-BY-2.5-AR** (BA Data) | Obligatoria | Ya prevista en "Acerca de" (`docs/briefs/06-ajustes.md`) |
| **Frecuencia de actualización** | D es semestral y el tiempo real agrega paradas `S…` en cualquier momento | El aprendizaje continuo cubre el desfase. Revisar D cada 6 meses (`Last-Modified` del CDN) |
| **AMBA vs CABA** | El tiempo real cubre el AMBA (solo 1.334 de 3.073 vehículos están en CABA). D cubre solo CABA | Filtrar a CABA (decisión del plan). Las líneas que salen de CABA muestran sus paradas solo dentro de la Ciudad |
| **IDs reasignados** | `route_id` reasignados (probado). `stop_id` posiblemente reasignados en parte (21 % con distancias > 1 km) | Validación espacial en la semilla. Nunca confiar en un id sin verificar su posición |
| **Suspensión de datasets** | BA Data avisa que los datasets API/GTFS están "en revisión y corrección" | Si publican un GTFS nuevo, `cruce.mjs` lo evalúa en minutos (agregarlo a `CANDIDATOS`) |
| **Mojibake** | En nombres de empresa del tiempo real (`OÂ´HIGGINS`) y en B | Normalizar en el adaptador (reparar latin-1 mal decodificado) |

## 7. Pasos siguientes

1. **Fase 2:** capturar `vehiclePositions` cada 60 s durante 24–48 h y medir cuántos `stop_id` de `tripUpdates` quedan ubicados (confirma o descarta el plan B con números).
2. Pedir a la Secretaría de Transporte (GCBA) o a NSSA el GTFS vigente que usa el sistema AVL. Si aparece, se vuelve a correr `cruce.mjs` y este doc se reemplaza.
3. ADR: "Paradas de colectivo: BA paradas + tabla aprendida" (incluida la decisión sobre OSM y su licencia).
4. Ajustar el alcance de la tarea 2.10 en `docs/00-plan.md` (fuera de los archivos de esta tarea).
