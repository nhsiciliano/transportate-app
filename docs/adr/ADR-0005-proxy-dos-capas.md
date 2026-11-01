# ADR-0005 — Proxy en dos capas con Durable Object `FeedHub`

- **Estado:** Aceptada (2026-11-01). Capa A: Fase 2. Capa B: Fase 5, detrás de flag.
- **Origen:** `docs/00-plan.md`, decisión de arquitectura 5. Detalle numérico en `04-escalabilidad.md`.

## Contexto

El upstream (API Transporte del GCBA) exige credenciales, no documenta límites de tasa en su spec RAML (`docs/fuentes/api-transporte-v1.raml`) y está bajo aviso oficial de suspensión/revisión (junio de 2026). La app **no puede** hablarle directo: filtraría credenciales y cada usuario sumaría carga al upstream. Además los feeds son grandes (por ejemplo `vehiclePositionsSimple` ronda 1,1 MB y ~3.200 vehículos) y cambian cada ~15–30 s.

Se necesita un diseño que **empiece barato para cientos de usuarios** y **escale a millones sin reescribirse**, de modo que la carga sobre el upstream **no dependa de la cantidad de usuarios**.

## Decisión

Un Worker Hono con una abstracción común **`FeedSource`**, implementable de dos maneras sin cambiar rutas ni contratos:

- **Capa A (MVP, cientos → miles):** Cache API por colo (TTL 15–30 s para tiempo real, horas para estático) + *coalescing* de requests dentro del isolate (una promesa en vuelo por clave) + `stale-while-revalidate`. El upstream recibe como máximo `colos × 1 req/TTL` por feed.
- **Capa B (miles → millones):** un **Durable Object `FeedHub` por feed**, con **alarm** cada TTL, como **único** fetcher del upstream (1 req/TTL/feed global). Precalcula **slices por línea** para colectivos (el feed completo nunca viaja al teléfono). Los Workers leen del DO y cachean en el edge. SQLite-backed DOs existen en Free.
- **Rate limiting** con el binding nativo de Workers (en memoria, por ubicación, sin persistir IPs).

La capa B se implementa en Fase 5 detrás de un flag de entorno; la Fase 2 deja la interfaz y el diseño documentados.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **App llama directo al upstream** | Expone credenciales, multiplica la carga por usuario y deja a la app sin protección ante cambios o suspensión de la API. |
| **Proxy sin caché (passthrough)** | El upstream recibe una request por usuario por tick: no escala y se lo bloquea. |
| **Solo capa A, siempre** | Con N ubicaciones (colos) el upstream recibe N requests por TTL por feed; suficiente al inicio, pero crece con la dispersión geográfica y no permite precalcular slices. |
| **Cron Trigger que refresca y guarda en KV/R2** | La granularidad de un cron es de un minuto: sirve para estático, no para TTL de 15–30 s. KV es eventualmente consistente y su cuota de escritura gratuita es baja (1.000/día en Free). |
| **Servidor tradicional (VM/contenedor) con Redis** | Más operación y costo fijo; pierde el despliegue global y el escalado automático de Workers. |
| **WebSockets/SSE desde el DO a cada teléfono** | Costo de duración por conexión abierta y complejidad; el polling con caché en el edge alcanza y es más simple de razonar. Reevaluar si se necesita push. |

## Consecuencias

- (+) La carga al upstream queda acotada e **independiente de los usuarios**: de `colos × req/TTL` (capa A) a `1 req/TTL` (capa B).
- (+) Pasar de A a B es un **cambio de implementación detrás de `FeedSource`** y de un flag, sin cambios en app ni contratos.
- (+) Slices por línea: el teléfono baja kilobytes, no 1 MB.
- (−) **El caché no reduce las requests facturadas al Worker**, solo protege al upstream. Escalar usuarios implica el plan Paid (ver `04-escalabilidad.md`).
- (−) Capa B introduce estado y un punto único por feed: hay que capturar excepciones en `alarm()` y reprogramar (los reintentos del runtime son 6 con backoff desde 2 s) y tener *fallback* a la capa A.
- (−) Los DOs generan requests (alarms y lecturas) y duración (GB-s) propios; el peor caso está estimado en `04-escalabilidad.md` y debe medirse en Fase 5.
- (−) Cache API es **por centro de datos** y no se replica (documentado por Cloudflare): el caché frío por colo es inevitable; el DO reduce el impacto de esos fallos.
