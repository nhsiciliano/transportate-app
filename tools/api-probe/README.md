# api-probe

Sondeo empírico de la API Transporte GCBA (Fase 1, tareas 1.3 y 1.4). Llama a todos los endpoints del RAML (activos y comentados), decodifica los feeds GTFS-RT, mide cadencia de actualización, inspecciona los GTFS estáticos y guarda fixtures reales para los tests del proxy. Resultados y análisis: [`docs/01-api-transporte.md`](../../docs/01-api-transporte.md).

## Requisitos

- Node ≥ 22 (lo exige `gtfs-realtime-bindings` 2.x; probado con Node 24).
- `.env` en la raíz del repo con `GCBA_CLIENT_ID` y `GCBA_CLIENT_SECRET` (ver [`.env.example`](../../.env.example)).
- ~420 MB libres en `~/.cache/transportate/gtfs/` para los zips GTFS (fuera del repo).

## Uso

```sh
cd tools/api-probe
npm install --no-package-lock
node probe.mjs
```

Tarda ~3 min: 3 muestras de cada feed de tiempo real separadas 20 s, más la descarga en streaming de los GTFS (~209 MB colectivos, ~30 s). Con `--watch=300` suma 5 min de observación. El script reutilizaría un zip en caché si el `HEAD` devolviera `last-modified`, pero hoy el upstream responde `405` a `HEAD` y no manda ese header, así que siempre vuelve a descargar.

| Flag | Efecto |
|---|---|
| `--no-download` | Solo `HEAD` de los GTFS estáticos, sin descargar. |
| `--no-fixtures` | No escribe en `apps/proxy/test/fixtures/`. |
| `--samples=N` | Muestras por feed de tiempo real (default 3). |
| `--interval=S` | Segundos entre muestras (default 20). |
| `--only=a,b` | Solo endpoints cuyo path contenga alguno de esos textos (p. ej. `--only=subtes`). |

## Qué produce

- **Consola:** tabla por endpoint/variante con status, bytes, latencia, formato, entities y antigüedad del timestamp; cadencia; auth; ráfaga; fiabilidad.
- **`last-run.json`:** todo el detalle (headers relevantes, campos presentes por entity, entity de muestra, calidad de posiciones, conteos del GTFS estático, intentos fallidos). Sin credenciales.
- **`apps/proxy/test/fixtures/<servicio>/<endpoint>[.<variante>].<pb|json|geojson|error.txt>`:** cuerpos crudos de la primera muestra (máx. 5 MB por archivo). Las respuestas de error se guardan como `.error.txt` con una cabecera de metadatos.

## Seguridad

- Las credenciales viajan como query params (`client_id`/`client_secret`), así que todo URL, header, cuerpo de error y fixture pasa por `redact()` antes de imprimirse o escribirse. Un `.pb` que contuviera el secret no se guarda.
- Para el caso de auth inválida se usa un secret falso literal (`invalido-transportate-probe`), nunca una variación del real.
- No se agrega lockfile al repo (`--no-package-lock`); la única dependencia es `gtfs-realtime-bindings`, versión fija en `package.json`.

## Notas de implementación

- Reintenta hasta 2 veces ante timeout (20 s) o error de red, y registra cada intento fallido en `fiabilidad`: el upstream cuelga o corta conexiones de forma intermitente y un fallo aislado no significa endpoint caído. Los zips también se reintentan (3 intentos, 30 s para recibir headers).
- `--watch` deduce la cadencia real del **dato**: `max(vehicle.timestamp)`, `max(trip_update.timestamp)`, `last_updated` (GBFS) o `header.timestamp` para alertas, más un hash del contenido. El `header.timestamp` de colectivos no sirve para esto porque es la hora del request.
- Mide el cruce de `route_id`/`stop_id` del tiempo real contra el GTFS estático de colectivos (`cruceTiempoRealEstatico`).
- Los zips se leen sin librerías: se parsea el directorio central (con soporte ZIP64) y se inflan en streaming solo `agency`, `routes`, `stops`, `trips`, `feed_info` y `calendar`.
- La ráfaga de rate limit son 15 requests secuenciales a `/subtes/serviceAlerts?json=1` (2,9 KB), sin reintentos.
