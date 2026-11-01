# tools/gtfs — preprocesado de datos estáticos → JSON versionado para R2

Tarea 2.10 de la Fase 2, con el alcance corregido tras la Fase 1 (`docs/00-plan.md`, "Correcciones tras la Fase 1"; `docs/01b-gtfs-alternativos.md` §4–5). Ya no procesa el GTFS de colectivos completo (no hay uno vigente). Lo que hace:

- toma las **paradas oficiales de BA**;
- arma un **diccionario de líneas** desde el tiempo real;
- construye una **tabla de equivalencias `stop_id` → parada**: se siembra con el GTFS 2021 y se corrige con las capturas de posiciones;
- procesa el **GTFS de subte** (vigente);
- arma **recorridos aproximados** de colectivo.

Todo sale como JSON compacto, validado con Zod y versionado por hash, listo para subir a R2 y servir en `/v1/static/*`.

Es un paquete standalone (npm, fuera del workspace pnpm). TypeScript strict se ejecuta con `tsx`.

## Cómo correr

```sh
cd tools/gtfs
npm install                          # Node ≥ 24
npm run build                        # todos los pasos → out/ + last-build.json
npm run build -- --solo paradas      # solo algunos pasos (separados por coma):
                                     #   paradas, lineas, equivalencias, subte, recorridos
npm test                             # Vitest sobre muestras chicas (no lee ~/.cache)
npm run check                        # typecheck + lint + prettier + tests
./upload-r2.sh                       # sube out/ a R2 (requiere wrangler login; ver abajo)
```

`--solo` reescribe solo los archivos de esos pasos; el `manifest.json` se regenera siempre con lo que haya en `out/`, y antes revalida cada archivo contra su esquema. Variables opcionales:

- `CAPTURAS_DIR`: carpeta de capturas (default `~/.cache/transportate/capturas`);
- `TRANSPORTATE_CACHE`: raíz de las entradas (default `~/.cache/transportate`).

**Tiempos y memoria** (esta máquina, darwin-arm64, Node 24.20, build `de43720f858b`): ~3 s en total y ~300 MB de RSS máximo.

| Paso | Tiempo |
|---|---|
| Recorridos (inflar y simplificar `shapes.txt` en streaming) | 1,1 s |
| Lectura de capturas (100 mil filas) | 1,4 s |
| Resto | < 0,1 s cada uno |

Ningún zip se carga entero: `src/lib/zip.ts` lee el directorio central e infla en streaming solo las entradas necesarias. `stop_times.txt` de colectivos (1,4 GB) nunca se abre.

## Entradas

Todas fuera del repo. Si falta alguna, el build lo dice y termina con error.

| Entrada | Ruta | Fuente | Fecha de los datos |
|---|---|---|---|
| Paradas BA | `~/.cache/transportate/gtfs/ba-paradas/paradas-de-colectivo.csv` | [BA Data "Colectivos: paradas"](https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/colectivos-paradas/paradas-de-colectivo.csv) (CC-BY-2.5-AR) | 2026-09-21 |
| GTFS colectivos 2021 | `~/.cache/transportate/gtfs/colectivos_feed-gtfs.zip` (209 MB). Se leen `stops`, `routes`, `trips` y `shapes` | API GCBA `/colectivos/feed-gtfs` | archivos 2021-02-26; servicio 2020-12-21 → 2021-06-21 |
| GTFS subte | `~/.cache/transportate/gtfs/subtes_feed-gtfs.zip` (48 KB) | API GCBA `/subtes/feed-gtfs` | descarga 2026-11-01; `feed_end_date` **2026-12-31** |
| Tiempo real | `apps/proxy/test/fixtures/colectivos/{vehiclePositions.pb, tripUpdates.pb, vehiclePositionsSimple.json}` | fixtures de la Fase 1 | 2026-11-01 17:09 UTC |
| Capturas (opcional) | `~/.cache/transportate/capturas/posiciones-*.csv.gz` | `tools/captura-posiciones` (otro worker) | las que haya |
| Colores de subte | `src/config.ts` (`COLORES_SUBTE`) | `docs/02b-colores-subte.md` §3 | 2026-11-01 |

Las capturas se leen por nombre de columna: `snapshot_ts, vehicle_id, trip_id, route_id, stop_id, current_stop_sequence, current_status, lat, lon, speed, vehicle_ts`. Se aceptan gzip con varios miembros concatenados. Sin capturas, la herramienta igual corre y genera solo la semilla.

## Salidas (`out/`, no se commitea)

Todas son JSON sin espacios, con coordenadas de 6 decimales y validadas contra `src/schemas.ts` antes de escribirse. Tamaños del build `de43720f858b`:

| Archivo | Bytes | gzip -9 | Contenido |
|---|---:|---:|---|
| `paradas.json` | 1.696.448 | 212.692 | 6.961 paradas de CABA: `id`, `calle`, `altura`, `nombre` ("Defensa 1524"), `lat`, `lon`, `comuna`, `barrio`, `lineas[{linea, numero, sentido}]` |
| `lineas-colectivos.json` | 162.149 | 20.209 | 936 `route_id` → `linea`, `numero`, `ramal`, `empresa`, `agencyId`, `cabeceras[]`, `enCaba` |
| `equivalencias-paradas.json` | 1.251.483 | 120.154 | 5.119 `stop_id` → `paradaId` (o `null`), `origen`, `confianza`, `lat`, `lon`, `distanciaM`, `observaciones` |
| `subte-lineas.json` | 4.823 | 1.072 | 8 líneas (A–H y los 2 ramales del Premetro): `color`, `colorTexto`, `estaciones[]` ordenadas, `sentidos[{directionId, cabecera, estaciones}]` |
| `subte-estaciones.json` | 17.379 | 3.550 | 108 estaciones: `nombre` (con tildes), `nombreGtfs`, `lat`, `lon`, `lineas`, `andenes`, `accesible` |
| `subte-red.geojson` | 7.260 | 2.002 | `FeatureCollection` de 8 `LineString` simplificados a 5 m, con `linea`, `routeId` y `color` |
| `recorridos-colectivos.geojson` | 742.203 | 100.514 | 170 líneas (por número), `MultiLineString` recortado a CABA y simplificado a 10 m, `aproximado: true` |
| `manifest.json` | ~2.000 | — | `version` (sha256 de 12 hex del contenido concatenado), `generatedAt`, `archivos{bytes, sha256}`, `omitidos`, `fuentes{nombre, url, fecha, licencia, nota}` |

- **`version` es determinista:** las mismas entradas dan la misma versión (verificado con dos corridas sobre capturas congeladas) y no depende de `generatedAt`.
- **Recorridos:** si `recorridos-colectivos.geojson` pasara de 5 MB, se omite y se anota en `manifest.omitidos`.
- **Estadísticas:** cada build deja las suyas en `last-build.json` (se commitea como referencia; no tiene datos ni rutas absolutas).

## Estadísticas (build `de43720f858b`)

Capturas usadas: 18 snapshots entre 2026-11-01 23:31 y 23:50 UTC (~19 minutos, 100.607 lecturas). **Es muy poco:** el plan pide 24–48 h. Los números de aprendizaje van a crecer al volver a correr el build con más captura.

**Paradas**

| | |
|---|---:|
| Filas del CSV | 7.027 |
| Paradas (tras fusionar 66 filas repetidas: misma calle, altura y punto a 1 m) | 6.961 |
| Líneas distintas | 132 (incluye `EBUS` sin número) |
| Comunas inválidas corregidas (una parada de Saavedra con `COMUNA=76` → 12, la comuna mayoritaria del barrio) | 1 |
| Sentidos no reconocidos (`A-B` → `null`) | 1 |

Además se normalizan los 51 valores de barrio a los 48 oficiales (`VILLA ORTUZA` → Villa Ortúzar, `VILLA GRAL. MITRE` → Villa General Mitre, `VELEZ SARFIELD` → Vélez Sarsfield).

**Líneas**

| | |
|---|---:|
| `route_id` | 936 |
| Números de línea | 216 |
| Empresas | 124 |
| Empresas con mojibake reparado | 79 |
| `route_id` con algún vehículo en CABA | 379 |

**Equivalencias por origen** (5.119 en total, todas dentro de CABA)

| Origen | Cantidad | Qué es |
|---|---:|---|
| `ajustada-ba` | 3.709 | Con parada BA asignada |
| `gtfs2021` | 1.275 | Coordenada 2021 validada, sin parada BA a ≤ 40 m con la misma línea |
| `aprendida` | 135 | Coordenada aprendida de capturas, sin parada BA |

| Detalle de la semilla y el aprendizaje | |
|---|---:|
| `stop_id` numéricos del tiempo real | 31.710 |
| …que existen en el GTFS 2021 | 14.187 |
| Descartados a más de 1 km de los vehículos que los informan (ID reasignado) | 371 |
| Validados con un vehículo a ≤ 1 km | 2.248 |
| Fuera de CABA (descartados a propósito) | 9.279 |
| Aprendidos de capturas | 1.497 (887 con parada BA) |
| Semillas confirmadas por las capturas | 480 |
| Semillas corregidas por las capturas | 12 |
| Equivalencias nuevas sin semilla | 582 |

**Validación del aprendizaje:** donde hay una semilla ajustada a BA y una parada aprendida (553 casos), coinciden en el **86,8 %**.

**Cobertura sobre `tripUpdates`** (105.325 predicciones de arribo, todo el AMBA)

| Predicciones | Cantidad | % |
|---|---:|---:|
| Con parada BA | 17.174 | 16,3 |
| Con coordenada en CABA | 23.012 | 21,8 |
| Ubicadas fuera de CABA | 22.574 | 21,4 |
| Sin ubicar | 59.739 | 56,7 |

La métrica útil para la app: **de las predicciones ubicadas en CABA, el 74,6 % tiene parada BA**. Las "sin ubicar" son `stop_id` sin semilla válida que todavía no aprendió la captura: es lo que tiene que cubrir la captura de 24–48 h.

**Subte**

| | |
|---|---:|
| Líneas | 8 |
| Estaciones | 108 |
| Andenes | 214 |
| Puntos de la red (de 1.192 originales) | 259 |
| Colores distintos entre el GTFS y `docs/02b` | 0 |

**Recorridos**

| | |
|---|---:|
| Shapes 2021 | 2.143 (784 mil puntos) |
| Shapes que tocan CABA | 1.362 |
| Tramos únicos | 905 |
| Puntos finales | 30.348 |

## Decisiones y métodos

### Ids de parada

`p` + 10 hex de `sha256(CALLE | ALT PLANO | lat 5 dec | lon 5 dec)`, calculado con los valores crudos normalizados (mayúsculas, sin mojibake). No depende del orden de las filas ni del formato del nombre. Si el dataset BA mueve una parada más de ~1 m o cambia su calle o altura, la parada cambia de id: la app debería guardar en los favoritos también el nombre y las líneas para poder re-mapearlos (`docs/01-api-transporte.md`, riesgos).

### Mojibake

El texto de la API no es latin-1 mal leído sino **UTF-8 decodificado como Windows-1252**: `Ñ` (C3 91) llega como `Ã‘`, porque 0x91 es `‘` en cp1252. `repairMojibake` (`src/lib/text.ts`):

- reconstruye los bytes de cada secuencia rota con la tabla cp1252 y la vuelve a decodificar como UTF-8, sin tocar las partes sanas del string;
- los bytes 0x81, 0x8D, 0x8F, 0x90 y 0x9D no existen en cp1252, y la API los convierte en `?`. Para `Ã?` se asume `Í` (0xC3 0x8D), el único de esos que aparece en español (`COMPAÃ‘Ã?A` → `COMPAÑÍA`).

### Líneas

Salen solo del tiempo real. Los `route_id` 2021 están reasignados: de 252 compartidos, **ninguno** corresponde a la misma línea (`docs/01b` §3). Por eso:

- `numero` es la parte numérica de `route_short_name` y `ramal` es el resto sin separadores (`10A` → 10/A, `247-5` → 247/5, `1 B` → 1/B);
- **en runtime el proxy regenera este diccionario desde el feed en cada lectura**; el archivo es solo la semilla para la búsqueda offline;
- siempre se une por empresa + número, nunca por `route_id`.

### Equivalencias `stop_id` → parada

1. **Semilla GTFS 2021.** Los `stop_id` numéricos del tiempo real que existen en `stops.txt` 2021 toman esa coordenada.
   - **Validación:** se descarta si queda a más de 1 km de todos los vehículos que lo informan. Cuentan dos fuentes: los vehículos de `vehiclePositions` con ese `stop_id`, y el vehículo del `tripUpdate` para la primera parada pendiente de su viaje.
   - **Ajuste:** se asigna la parada BA más cercana a ≤ 40 m que comparta número de línea con quien informa el `stop_id`. Si no se conoce la línea, se toma la más cercana y se resta confianza.
2. **Aprendizaje por transiciones (capturas).** El método de "posición de mínima velocidad" de `docs/01b` §4 **se midió y no sirve**: las lecturas detenidas o lentas quedan a una mediana de **224 m** de la parada validada y solo ~20 % a ≤ 40 m. El `stop_id` de un vehículo es su **próxima** parada, y los vehículos frenan en semáforos antes de llegar. `STOPPED_AT` aparece en menos del 2 % de las lecturas. Lo que sí funciona:
   - **Transición simple:** si un vehículo pasa de informar `s` (secuencia k) a k+1 en ≤ 180 s y ≤ 1,5 km, la parada `s` quedó en ese tramo. Se vota (1 voto repartido) por las paradas BA de esa línea a ≤ 40 m del tramo.
   - **Saltos de 2 a 4 paradas:** son frecuentes, porque en 60 s se pasan varias. Votan con medio voto solo por la primera candidata desde la posición anterior.
   - **Lecturas `STOPPED_AT`:** votan por las paradas a ≤ 40 m del punto.
   - **Decisión:** gana la parada con más votos (mínimo 3 pasadas). Lo aprendido confirma la semilla, o la reemplaza si la contradice con ≥ 3 votos y ≥ 50 % de acuerdo. Si ninguna pasada tiene una parada candidata, queda como `aprendida` con el punto medio de los tramos (≥ 6 pasadas).
   - **Memoria:** O(vehículos), con un solo recorrido en streaming.
3. **`confianza`** (0–1, heurística en `confianza()` de `src/steps/equivalencias.ts`):

   | Caso | Valor |
   |---|---|
   | Semilla ajustada a BA | 0,70–0,95 según distancia (−0,20 sin línea conocida; +0,05 validada con vehículo, −0,10 si no) |
   | Aprendida con parada | 0,50 + 0,30·min(1, votos/10) + 0,15·acuerdo |
   | Solo coordenada | 0,35 o 0,25 |
   | Semilla y capturas coinciden | +0,10 |

   La app debería mostrar arribos solo con `paradaId` y confianza ≥ ~0,6 (a definir en la Fase 4).
4. **Área:** solo CABA. La máscara está formada por celdas de ~550 m que contienen paradas BA, más una celda de margen (`AreaMask`); sigue el borde mejor que el bbox, que incluye esquinas de provincia.

### Subte

- **Colores:** salen de `docs/02b-colores-subte.md` §3. El build compara contra `route_color` y `route_text_color` del GTFS y reporta cualquier diferencia en `last-build.json` (`subte.coloresDistintosDelGtfs`).
- **Orden por sentido:** viaje más largo (más `stop_times`) de cada `direction_id`, con andenes mapeados a su estación (`parent_station`).
- **Orden de la línea:** unión de los dos sentidos. Si una estación falta en un sentido, se inserta donde menos alarga el recorrido. Es el caso de Alberti y Pasco en la A, donde cada sentido saltea una.
- **Nombres:** GTFS con tildes restituidas por una lista curada de palabras (`TILDES` en `src/steps/subte.ts`). No se usan los nombres de `forecastGTFS` porque traen errores ("Carlos Pelegrini", "Scalabrini Ortíz") y recortes ("Moreno" en vez de "Jose Maria Moreno"). Queda `Humberto 1` tal cual lo trae el GTFS.

### Recorridos de colectivo

`shapes.txt` 2021 → `trips.txt` (shape → `route_id` 2021) → `routes.txt` (número de línea). Cada shape se recorta a la máscara de CABA y se simplifica con Douglas-Peucker a 10 m. Después se agrupa por número de línea y se deduplican los tramos casi idénticos (ida/vuelta, ramales) con una grilla de ~50 m. Son de 2021 y se unen solo por número: van con `aproximado: true` y la app debe rotularlos como "recorrido aproximado".

## Subida a R2

Con `./upload-r2.sh` (`DRY_RUN=1` para ver los comandos) se sube a `transportate-static` (binding `STATIC` del proxy):

- **`<version>/<archivo>`** y **`<version>/manifest.json`**: con `Cache-Control: public, max-age=31536000, immutable`.
- **`latest/manifest.json`**: con `max-age=300`, y se sube al final para que el puntero nunca quede apuntando a una versión incompleta.

Requisitos: `npx wrangler@4.156.1 login`, o `CLOUDFLARE_API_TOKEN` con permiso R2 Edit. El script no se ejecutó (no hay cuenta logueada en esta tarea).

## Pendientes

- Volver a correr el build con 24–48 h de capturas y actualizar estas estadísticas (`docs/01b` §7.1).
- Definir dónde corre el aprendizaje en producción: este paquete lo hace offline; un cron de Worker con D1/R2 es la opción del plan.
- Migrar `src/schemas.ts` (sobre todo `ManifestSchema`) a `packages/contracts` cuando exista, para que el proxy y la app validen lo mismo.
- No se usa OSM, así que no aplica ODbL. Las fuentes son todas CC-BY-2.5-AR (atribución en "Acerca de").
- El GTFS de subte vence el 2026-12-31: el build lo deja en `subte-lineas.json` (`feedEndDate`) para que el proxy pueda avisar.
