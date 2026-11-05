# shared/api — cliente del proxy (tarea 3.9)

Cliente tipado del proxy (`apps/proxy`, rutas en [`docs/06-proxy.md`](../../../../../docs/06-proxy.md) §2–§4) y hooks de TanStack Query para las pantallas. La política de caché, polling y reintentos está en [`../query/README.md`](../query/README.md).

```tsx
import { FreshnessLabel } from '@/shared/ui';
import { useEstadoSubtes } from '@/shared/api';

const estado = useEstadoSubtes();
if (estado.isPending) return <Skeleton… />;
if (estado.isLoadingError) return <ErrorState {...estado.error.userMessage()} onRetry={estado.refetch} />;
// Con datos: si la última actualización falló, `isRefreshError` + Alert en línea, nunca ErrorState.
<FreshnessLabel sourceTimestamp={estado.sourceTimestamp} />;
```

## Archivos

| Archivo                 | Qué hace                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`             | `createApiClient({ baseUrl, fetch?, now?, timeoutMs?, etagCacheSize? })`: un método por ruta, validación Zod, timeout, ETag/304     |
| `errors.ts`             | `ApiError` (unión por `kind`), `retryable`, `userMessage()`. Timeout y 5xx: «El servicio de la Ciudad no responde…», salvo en `/v1/trenes/*`, que dice «El servicio de trenes no responde…»                                                                         |
| `config.ts`             | `getApiBaseUrl()`: `EXPO_PUBLIC_API_URL` sin barra final; si falta, error en consola (solo en desarrollo) y `http://localhost:8787` |
| `ApiClientProvider.tsx` | El cliente por contexto (`useApiClient()`); sin provider, el de la app                                                              |
| `keys.ts`               | Query keys tipadas y `invalidateSubtes` / `invalidateTrenes` / `invalidateColectivos` / `invalidateRealtime`                                             |
| `hooks.ts`              | Un hook por recurso, con la frescura lista para `FreshnessLabel`                                                                    |

## Rutas

| Método                         | Ruta                                        | Esquema                                                                                    | Hook                                  |
| ------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| `estadoSubtes()`               | `/v1/subtes/estado`                         | `EstadoLineasResponseV1`                                                                   | `useEstadoSubtes()`                   |
| `alertasSubtes()`              | `/v1/subtes/alertas`                        | `AlertasResponseV1`                                                                        | `useAlertasSubtes()`                  |
| `arribosEstacion(id)`          | `/v1/subtes/estaciones/:estacionId/arribos` | `ArribosEstacionResponseV1`                                                                | `useArribosEstacion(id)`              |
| `estadoTrenes()` | `/v1/trenes/estado` | `EstadoLineasTrenResponseV1` (TTL 60 s) | `useEstadoTrenes({ enabled })` |
| `alertasTrenes()` | `/v1/trenes/alertas` | `AlertasTrenResponseV1` (TTL 60 s) | `useAlertasTrenes()` |
| `arribosEstacionTren(id)` | `/v1/trenes/estaciones/:estacionId/arribos` | `ArribosEstacionTrenResponseV1` (TTL 30 s) | `useArribosEstacionTren(id)` |
| `lineasColectivo()`            | `/v1/colectivos/lineas`                     | `LineasColectivoResponseV1`                                                                | `useLineasColectivo()`                |
| `posicionesLinea(id)`          | `/v1/colectivos/lineas/:lineaId/posiciones` | `PosicionesLineaResponseV1`                                                                | `usePosicionesLinea(id, { enabled })` |
| `arribosParada(id)`            | `/v1/colectivos/paradas/:paradaId/arribos`  | `ArribosParadaResponseV1`                                                                  | `useArribosParada(id)`                |
| `manifest()`                   | `/v1/static/manifest`                       | `ManifestV1`                                                                               | `useManifest()`                       |
| `staticFile(version, archivo)` | `/v1/static/:version/:archivo`              | `ARCHIVOS_ESTATICOS_V1[archivo]` (solo `.json`; los `.geojson` llegan con el mapa, Fase 4) | —                                     |
| `health()`                     | `/v1/health`                                | `HealthV1`                                                                                 | —                                     |

Los ids van con `encodeURIComponent`; el proxy valida el formato y responde 400 si no cumple.

## Resultado

Toda respuesta llega como `ApiResult<T>` (`data`, `stale`, `fromCache`, `receivedAt`). Los feeds con sobre `{ meta, data }` llegan como `FeedResult<T>`, que agrega:

- `meta` (`MetaV1`);
- `sourceTimestamp`, con el que se calcula la frescura (nunca con `generatedAt`, `docs/06-proxy.md` §3);
- `ageSeconds`: la edad al recibir el dato, calculada con `sourceTimestamp` (o `meta.ageSeconds` si no hay).

`stale` es `true` con `X-Transportate-Stale: 1` **o** con `meta.stale`.

Los hooks devuelven `FeedQuery<T>` / `ResourceQuery<T>`, un subconjunto explícito de `useQuery`:

- **Datos y frescura:** `data` (ya sin el sobre), `meta`, `sourceTimestamp`, `stale`, `ageSeconds` y `fromCache`.
- **Estado:** `status`, `isPending` (Skeleton), `isFetching`, `isPaused` (sin conexión), `isRefreshError` (hay datos y falló la actualización) e `isLoadingError` (falló sin datos: ErrorState).
- **Control:** `error`, `dataUpdatedAt` y `refetch`.

## ETag / 304

El cliente guarda en memoria, por URL, el último `ETag` y el cuerpo **ya validado**:

- Es un LRU de 64 entradas, que no se persiste: la caché persistida es la de TanStack Query.
- En el siguiente pedido manda `If-None-Match`. Con `304` devuelve ese cuerpo con `fromCache: true`.
- Si una respuesta no trae `ETag` o no valida, la entrada se borra.

En iOS, `NSURLCache` puede resolver el 304 por su cuenta y entregar un 200 con el cuerpo cacheado: el resultado es el mismo dato, solo que con `fromCache: false`.

## Errores

`ApiError = NetworkError | TimeoutError | HttpError | ContractError | AbortedError`, discriminada por `kind`:

| `kind`                       | Cuándo                                                                         | `retryable`                       | `userMessage().title`                                                              |
| ---------------------------- | ------------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------- |
| `network`                    | `fetch` rechazó sin respuesta                                                  | sí                                | "No pudimos conectarnos" ("Revisá tu conexión y volvé a intentar.")                |
| `timeout`                    | Sin respuesta en 8 s (`AbortController`)                                       | sí                                | "Servicio no disponible"                                                           |
| `http` 503 / 502 / 504 / 408 | Upstream caído                                                                 | sí                                | "Servicio no disponible" ("El servicio de la Ciudad no responde en este momento.") |
| `http` 429                   | Rate limit (`Retry-After: 60`)                                                 | sí, esperando `retryAfterSeconds` | "Servicio no disponible"                                                           |
| `http` 500                   | `internal`                                                                     | sí                                | "Algo falló de nuestro lado."                                                      |
| `http` 404                   | Línea, parada o archivo inexistente                                            | no                                | "Esta información no está disponible por ahora." (sin botón)                       |
| `http` 400                   | Parámetro inválido                                                             | no                                | "Algo falló de nuestro lado."                                                      |
| `contract`                   | JSON inválido o fuera de esquema (`issues` = rutas de los campos, sin valores) | no                                | "Algo falló de nuestro lado."                                                      |
| `aborted`                    | Cancelada (desmontar, cambiar de key)                                          | no                                | — (no se muestra)                                                                  |

`HttpError` trae `status`, `code` (de `ErrorV1`, o `null`) y `retryAfterSeconds`; este último sale del cuerpo y, si no viene ahí, del header `Retry-After`. Cualquier error que no sea `ApiError` se normaliza a `contract` (`toApiError`): es un bug nuestro.

## Privacidad

- **Headers:** el único header propio es `Accept: application/json`, más `If-None-Match` con el ETag que mandó el proxy. No hay User-Agent custom ni ids de dispositivo o de persona (`docs/05-privacidad.md`).
- **Mensajes de error:** `message` y `userMessage()` nunca llevan el host, los ids de la ruta ni el cuerpo crudo. Solo llevan la ruta plantilla (`route`, por ejemplo `/v1/colectivos/paradas/:paradaId/arribos`).
- **Tests:** usan `fetch` mockeado; no hay requests reales (`test/api/`).
