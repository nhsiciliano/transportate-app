# 01c — Portal `datosabiertos-apis.buenosaires.gob.ar` y el host nuevo de la API Transporte

> Revisión del **2026-11-02 (11:30–11:45 UTC)**, antes de arrancar la Fase 3. Pedido del usuario: revisar <https://datosabiertos-apis.buenosaires.gob.ar/BA_Root/Documentacion?schema_name=Transporte_3> y <https://datosabiertos-apis.buenosaires.gob.ar:443/>.
> Spec descargada: [`docs/fuentes/transporte-3-openapi.json`](fuentes/transporte-3-openapi.json) (OpenAPI 3.0.0, 52 KB, desde `/swagger/spec/Transporte_3.json`). Las pruebas con credenciales se hicieron con `curl` contra los dos hosts, sin loguear URLs.

## TL;DR

1. **La API Transporte tiene un segundo host oficial:** `https://datosabiertos-transporte-apis.buenosaires.gob.ar/`. Es el `servers[0].url` de la spec `Transporte_3`. Corre detrás de un gateway **3scale/APIcast** (`server: openresty`, error `No Mapping Rule matched`), distinto del MuleSoft de `apitransporte.buenosaires.gob.ar`.
2. **Nuestras credenciales actuales (`client_id`/`client_secret`) funcionan en los dos hosts** con el mismo esquema por query string. Sin credenciales, el host nuevo responde `401 {"error":"Authentication denied."}` con `www-authenticate: Client-ID-Enforcement`, igual que el viejo.
3. **Los datos son los mismos:** `subtes/serviceAlerts?json=1`, `subtes/forecastGTFS`, `colectivos/vehiclePositionsSimple?route_id=1858` y `transito/v1/semaforos` devolvieron bytes **idénticos** (mismo md5) en ambos hosts. Es la misma aplicación upstream con dos puertas de entrada.
4. **El host nuevo NO expone `/colectivos/tripUpdates`** (404 `No Mapping Rule matched`), que es el feed de arribos de colectivos que usa el proxy. En el host viejo sigue respondiendo 200. **Por eso no conviene migrar el proxy al host nuevo hoy.**
5. **Lo que la spec declara como activo pero no existe:** `/trenes/*` (404 en ambos hosts), `/transito/v1/cortes` y `/transito/v1/eventos` (500 en ambos, cuerpo = el path). La spec `Transporte_3` es la versión OpenAPI del RAML viejo, con los bloques comentados "destapados", no un catálogo de lo que realmente corre.
6. **`forecastGTFS` sigue congelado** también en el host nuevo: `Header.timestamp` = 2026-10-24T13:08:45Z (8,9 días al medir).
7. El portal es un **developer portal 3scale** (`badatos-tenant`) con `/signup` y `/login` propios. No dice cómo se obtienen credenciales ni qué planes hay (`/#plans` no renderiza nada). Para el MVP no hace falta tocarlo.

## 1. Qué es el portal

| Ruta | Qué devuelve | Nota |
|---|---|---|
| `/` → `/Data/Home` → `https://data.buenosaires.gob.ar/` | Home de BA Data (CKAN 2.11.0) | El portal de APIs es un tenant 3scale colgado del CKAN. |
| `/Data/APIs` | Lista de 11 esquemas: `echo`, `echoprueba`, `usig_geocoder`, `Transporte_3`, `datos_utiles`, `catastro`, `busqueda_lugares`, `normalizador`, `procesos_geograficos`, `API_CALLEJERO`, `ba_data` | HTML estático. |
| `/BA_Root/Documentacion?schema_name=X` y `/docs?schema_name=X` | Página con `SwaggerUI({url: "/swagger/spec/X.json"})` | El contenido real está en el JSON; sin JS la página está vacía. |
| `/swagger/spec/Transporte_3.json` | OpenAPI 3.0.0 "Transporte v1", 31 paths | Guardada en `docs/fuentes/`. `echo.json` y `API_CALLEJERO.json` dan 404. |
| `/signup`, `/login` | Formularios del developer portal 3scale ("Powered by 3scale") | Pide organización, usuario, mail y contraseña. No probado. |
| `/Data/Acerca_de` | 301 a `data.buenosaires.gob.ar/Acerca`, que da 404 | Enlace roto. |

**Hosts por esquema** (todos `datosabiertos-*-apis.buenosaires.gob.ar`): `transporte`, `usig` (geocoder y datos útiles), `catastro` (catastro y búsqueda de lugares), `normalizador`, `procesos-geograficos`. `ba_data` apunta a `https://data.buenosaires.gob.ar` (API CKAN).

## 2. Spec `Transporte_3` vs. RAML vs. realidad

La spec declara 31 `GET`, todos con `client_id` y `client_secret` **required** en query. No declara `securitySchemes`, ni respuestas distintas de `200`, ni rate limit, ni ejemplos. `schemes: ["http"]` pero `servers[0]` es `https://…:443/`. Descripciones idénticas a las del RAML (`docs/01a-api-console.md`), incluyendo "actualizada cada 30 segundos" cuando lo medido es 60 s.

| Recurso | RAML (`01a`) | Spec `Transporte_3` | Host nuevo (medido 2026-11-02) | Host viejo (medido 2026-11-02) |
|---|---|---|---|---|
| `/subtes/feed-gtfs` | activo | activo | 200, 48.443 B | 200 |
| `/subtes/forecastGTFS` | activo | activo | 200, **congelado** (2026-10-24) | idem, mismo md5 |
| `/subtes/serviceAlerts` (`json=1`) | activo | activo | 200, 2.871 B | idem, mismo md5 |
| `/subtes/tripUpdates` | comentado | **no figura** | 404 | 404 |
| `/trenes/feed-gtfs`, `vehiclePositions`, `tripUpdates`, `serviceAlerts` | comentados | **activos** | **404** `No Mapping Rule matched` | 404 `No listener for endpoint` |
| `/colectivos/feed-gtfs` | activo | activo | 200, 209.488.251 B (~30 s) | 200 |
| `/colectivos/feed-gtfs-frequency` | activo | activo | no probado | 200 |
| `/colectivos/vehiclePositions` | activo | activo (`route_id` tipado como integer) | 200 pb | 200 pb (difieren solo por `header.timestamp`) |
| `/colectivos/vehiclePositionsSimple` | activo | activo | 200 | idem, mismo md5 |
| `/colectivos/tripUpdates` | **no documentado** | **no figura** | **404** `No Mapping Rule matched` (probado con y sin `route_id`, con `json=1`, y variantes de mayúsculas) | **200**, 17.590 B con `route_id=1858` |
| `/colectivos/serviceAlerts` | activo | activo | 200, 0 entities | idem |
| `/ecobici/gbfs/*` | activos | activos | 200 | 200 |
| `/estacionamiento/garajesComerciales` (+3 "cajones") | activos | activos | **400** `{"message":"Bad request"}` con `x,y,radio` | no probado |
| `/transito/v1/estacionamientos` | activo | activo | 200 GeoJSON (Palermo, 2.069 B) | 200 |
| `/transito/v1/cortes` | comentado | **activo** | **500**, cuerpo `/v1/cortes` | 500 |
| `/transito/v1/semaforos` | activo | activo | 200, 632.765 B (ignora `lat/lon/radius`) | idem, mismo md5 |
| `/transito/v1/eventos` (`provider` 1 y 201) | comentado | **activo** | **500**, cuerpo `/v1/eventos` | 500 |
| `/datos/movilidad/transito` | activo | activo | 200, `[]` | 200, `[]` |
| `/datos/movilidad/transito/semanaTipica` | activo | activo | 200, 350 KB, datos de **2020-03** | no probado |
| `/datos/movilidad/transportePublico` | activo | activo | **504** Gateway Time-out a 30 s | no probado |

**Conclusión:** nada de lo que faltaba (arribos de subte vivos, cortes, trenes) aparece por el host nuevo. Lo único que cambia es que el host nuevo **pierde** `colectivos/tripUpdates`.

## 3. Comportamiento HTTP del host nuevo

- **Headers:** `server: openresty`, `date`, `content-type`, `transfer-encoding: chunked`, dos cookies de afinidad (`1539f39…` del router OpenShift y `BIGipServerocp4_pi_wk_https` del F5). Igual que el viejo: **sin** `cache-control`, `etag`, `last-modified`, `content-encoding`, CORS ni headers de cuota.
- **Cuota:** 20 requests seguidos a `serviceAlerts?json=1` sin pausa: 19 × 200 y **1 × 502** (el primero), sin `429` ni `retry-after`. El 502 del gateway es un modo de fallo nuevo a normalizar si algún día se usa este host.
- **Latencias** (una muestra, sin carga): `serviceAlerts` 98 ms, `forecastGTFS` 149 ms, `vehiclePositionsSimple?route_id` 141 ms, `semaforos` 263 ms, `stationStatus` 188 ms. Comparables al host viejo.
- **Errores:** `404 text/plain "No Mapping Rule matched"` (ruta no publicada en el gateway), `500 text/plain "<path>"` (upstream roto, igual que el viejo), `400 application/json {"message":"Bad request"}`, `504 text/html` del gateway. Formatos distintos del host viejo: el normalizador de errores del proxy tendría que contemplarlos.
- **Content-Type:** el pb de `vehiclePositions` llega como `application/x-protobuf; charset=UTF-8`; el zip de subte como `application/x-zip-compressed; charset=UTF-8` y el de colectivos como `application/zip; charset=UTF-8`. Mismas rarezas que el viejo.

## 4. Impacto en Transportate

| Tema | Decisión / acción |
|---|---|
| `UPSTREAM_BASE` del proxy (`apps/proxy/src/sources/upstream.ts`) | **Se queda en `apitransporte.buenosaires.gob.ar`.** Es el único host con `colectivos/tripUpdates`. Volver a evaluar si el GCBA apaga el host viejo o publica `tripUpdates` en el nuevo. |
| Resiliencia | El host nuevo sirve como **fallback** de los feeds que sí expone (subtes, posiciones de colectivos, ecobici) si el viejo cae. Es un cambio chico: `UPSTREAM_BASE` configurable por env y una lista de feeds soportados por host. No se implementa ahora; queda como tarea candidata de Fase 5. |
| Credenciales | Las mismas sirven en ambos hosts. No hace falta registrarse en el portal 3scale para el MVP. |
| Riesgo de la "API v2.0" (`00-plan.md`) | La spec `Transporte_3` **no es** una v2: es el RAML v1 pasado a OpenAPI. El riesgo de cambio de formatos no cambia. |
| Fase 3 | **Sin bloqueos.** La app consume los contratos del proxy, no el upstream. |
| Otras APIs del portal | `usig_geocoder` (`/geocoder/2.2/geocoding`, `reversegeocoding`), `busqueda_lugares` (`/buscar?texto=…`) y `procesos_geograficos` (`/normalizar_y_geocodificar_direcciones`) podrían servir para **buscar direcciones** en la app en una fase posterior (no está en el MVP). Sus specs no declaran auth; falta verificar si piden `client_id`. |

## 5. Cómo se verificó

```sh
# Spec
curl -sS "https://datosabiertos-apis.buenosaires.gob.ar/swagger/spec/Transporte_3.json" -o docs/fuentes/transporte-3-openapi.json
# Comparación de hosts (credenciales desde .env; el script no imprime URLs)
# ver tools/api-probe para la versión completa de Fase 1; esta revisión usó curl + md5 por endpoint
```

Las cifras de este documento son de una sola corrida el 2026-11-02 a las 11:32–11:45 UTC (lunes, 8:32–8:45 hora de Buenos Aires). Para medir cadencia o tasa de fallos del host nuevo habría que extender `tools/api-probe/probe.mjs` con un flag `--base`.
