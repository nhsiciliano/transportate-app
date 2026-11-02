# adapters/subtes

`createSubtesAdapter({ source, ttlSeconds, now })` implementa `SubtesAdapter` (tarea 2.5).

## Fuentes upstream

| Feed | Clave de caché | TTL | Notas |
|---|---|---:|---|
| `GET /subtes/serviceAlerts?json=1` | `subtes:serviceAlerts:json` | `FEED_TTL_SECONDS` (20 s) | JSON GTFS-RT en snake_case, enums numéricos. **Nunca el protobuf por defecto**: llega corrupto (bytes ≥ 0x80 reemplazados por U+FFFD, `docs/01-api-transporte.md`). Esquema laxo `UpstreamSubteAlertsJson` |
| `GET /subtes/forecastGTFS` | `subtes:forecastGTFS` | 20 s | JSON propio `Header/Entity/Linea/Estaciones` (no GTFS-RT). Esquema laxo `UpstreamSubteForecastJson`. **Congelado desde 2026-10-24** |

## Estado por línea (`estadoLineas()`)

Para cada línea `A, B, C, D, E, H, PM-C, PM-S`, el adaptador mira las alertas **activas** que la afectan. Una alerta está activa si no tiene `active_period` o si `now` cae en alguno; `end` ausente o 0 cuenta como abierto. Una alerta afecta a una línea cuando su `informed_entity.route_id` corresponde a ella:

- `LineaA`…`LineaH` → la línea correspondiente;
- `PM-Civico` → `PM-C` y `PM-Savio` → `PM-S`;
- `Premetro` o `PM` a secas → los dos ramales.

Cada alerta tiene una severidad, que sale del `effect` o del texto de `header_text` + `description_text` en español:

| Severidad | Si… | Estado de la línea |
|---|---|---|
| `interrumpida` | `effect` = `NO_SERVICE`, o el texto matchea `/sin servicio\|no (presta\|funciona)\|interrumpid\|suspendid/i` | `interrumpida` |
| `demorada` | `effect` ∈ {`SIGNIFICANT_DELAYS`, `REDUCED_SERVICE`, `DETOUR`, `MODIFIED_SERVICE`, `STOP_MOVED`}, o el texto matchea `/demor\|limitad\|lentitud\|con demoras\|servicio reducido\|no se detiene\|cerrad/i` | `demorada` |
| `informativa` | ninguna de las anteriores (p. ej. "Nuevo horario") | `normal` (con `alertaIds` y `resumen`) |

La interrumpida se evalúa primero. El estado de la línea es el de su alerta más severa. Una línea sin alertas que la afecten queda `normal`.

- **`resumen`:** `header_text` de la alerta más severa (no se incluye si la línea no tiene alertas).
- **`alertaIds`:** todas las alertas que la afectan, de la más severa a la menos, con los mismos ids que `alertas()`.
- **Colores y nombres:** tabla constante `LINEAS_SUBTE` (`lineas.ts`). Colores de `docs/02b-colores-subte.md` §3; nombres de `route_long_name` del GTFS con tildes (`tools/gtfs/out/subte-lineas.json`).

**Fallos:** si la fuente no tiene dato (upstream caído y sin último dato bueno), `estadoLineas()` responde **200** con todas las líneas en `sin_datos`, `meta.stale: true` y `sourceTimestamp: null`, para que la app pueda mostrar "sin datos" por línea. `alertas()` y `arribos()` responden **503** `upstream_unavailable`. Si la fuente sirvió el último dato bueno, `meta.stale` es `true` y los estados son los de ese dato.

Con la fixture real del 2026-11-01 el resultado es B, C y E `demorada` (estaciones cerradas por obras; E además trae `REDUCED_SERVICE`) y el resto `normal` (`test/adapters/subtes.test.ts`).

## Alertas (`alertas()`)

Cada entity activa y no borrada se traduce a `AlertaV1`:

| Campo | Origen |
|---|---|
| `lineas` | Las de `informed_entity.route_id`, en el orden de la tabla |
| `titulo`, `descripcion` | `header_text` / `description_text` en español; si falta uno, se usa el otro |
| `causa`, `efecto` | Nombres de los enums de GTFS-RT (`CONSTRUCTION`, `REDUCED_SERVICE`…) |
| `desde`, `hasta` | El menor `start` y el mayor `end` de `active_period`; `hasta` solo si todos los períodos tienen fin |
| `estacionIds` | `informed_entity.stop_id`; el andén `1087N` se reduce a la estación `1087` |

## Arribos (`arribos(estacionId)`)

- `estacionId` es el `stop_id` de estación del GTFS de subtes (4 dígitos, igual que `tools/gtfs/out/subte-estaciones.json`). Los andenes del forecast (`1059N`, `1059S`) se mapean a su estación.
- **`enSegundos`:** `arrival.time` (o `departure.time`) − `now`. Se descartan los arribos de hace más de 30 s y se ordenan por `enSegundos`.
- **`destino`:** la estación del viaje con el horario más tardío (el orden de `Estaciones` en el feed no es confiable).
- **Dato viejo:** `meta.stale = true` cuando `Header.timestamp` tiene más de 3 min (`FORECAST_STALE_SECONDS`). Hoy el feed está congelado, así que la respuesta es una lista vacía con `stale: true` y `ageSeconds` de ~8 días.
- **Estación que no está en el feed:** lista vacía, no 404.
