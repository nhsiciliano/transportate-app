# 04 — Escalabilidad

Cómo el proxy pasa de cientos a millones de usuarios activos sin cambiar la app ni el contrato, y cuánto cuesta cada escalón. Decisión de fondo: `adr/ADR-0005-proxy-dos-capas.md`. Arquitectura general: `03-arquitectura.md`.

> **Estado:** estimaciones de diseño de la Fase 1. Los supuestos marcados con ⚠ se miden en Fase 2 (prueba de carga, tarea 2.12) y Fase 5 (capa B). Precios y límites de Cloudflare verificados con Context7 el 2026-11-01 (fuentes en la sección 5).

## 1. Dos cosas distintas que escalan distinto

| Qué escala | Qué la protege | Depende de la cantidad de usuarios |
|---|---|---|
| **Requests al upstream (GCBA)**: fragilidad, credenciales, aviso de suspensión | Caché, *coalescing*, DO `FeedHub` | **No** (objetivo de diseño) |
| **Requests al Worker (Cloudflare)**: lo que se factura | Menos polling en la app; plan Paid | **Sí, linealmente** |

Lo segundo es fácil de pasar por alto: **servir desde la Cache API sigue invocando al Worker y sigue contando como request facturada**. El caché cuida al upstream y baja la CPU por request, no el recuento. Por eso las mitigaciones del lado de la app (sección 4) son tan importantes como el caché.

## 2. Capa A — caché en el edge (MVP: cientos → miles)

- **Cache API por colo.** Cada centro de datos de Cloudflare tiene su propio caché; **el contenido no se replica entre centros** (documentación de Cloudflare). Con TTL de 15–30 s para tiempo real y horas para estático.
- ***Coalescing* en el isolate.** Un mapa `clave → Promise` evita que N requests simultáneas al mismo feed disparen N fetches al upstream; la primera crea la promesa y las demás esperan.
- ***Stale-while-revalidate*.** Cuando el dato venció, se responde el viejo (marcado `stale`) y se refresca en segundo plano con `ctx.waitUntil`. Nota de Cloudflare: `s-maxage`, `must-revalidate` y `proxy-revalidate` **anulan** SWR; para que SWR funcione en el edge hay que usar `max-age` (o `CDN-Cache-Control`). Hono trae el middleware `cache()` (`cacheName`, `cacheControl`, `keyGenerator`) y queda a decidir en Fase 2 si lo usamos o escribimos el nuestro por el control fino del SWR.
- **Resultado:** el upstream recibe como máximo `colos_activos × (86 400 s / TTL)` requests por feed y por día, independiente de los usuarios. Con TTL = 20 s son **4.320 por colo y feed por día**; con ⚠ ~5–10 colos relevantes para tráfico de Argentina (por medir) son 22.000–43.000 por feed y día. Es poco para el upstream pero **crece con la dispersión geográfica** y con cada colo que arranca en frío: de ahí la capa B.
- **Cadencia del upstream.** La spec RAML dice que las posiciones de colectivos se actualizan **cada 30 s** (`docs/fuentes/api-transporte-v1.raml:950`). Un TTL de 15–20 s no obtiene datos nuevos más seguido: conviene que el TTL real de colectivos sea ≈ la cadencia de la fuente. A confirmar empíricamente en `01-api-transporte.md`.

## 3. Capa B — Durable Object `FeedHub` (miles → millones)

- **Un DO por feed** (colectivos, subtes-forecast, subtes-alerts, tránsito), SQLite-backed. Una **alarm** cada TTL hace el único fetch al upstream; en cada ciclo el DO decodifica, precalcula **slices por línea** (colectivos) y guarda el último resultado.
- **Los Workers leen del DO** solo en un *miss* del caché de su colo y cachean el slice en el edge. El teléfono nunca baja el feed completo (≈ 1,1 MB / ~3.200 vehículos) sino el slice de la línea que mira.
- **Upstream = 1 request por TTL por feed, global**: con TTL 20 s, **4.320 requests por día por feed**, sin importar usuarios ni colos.
- **Alarms:** una por DO a la vez, ejecución al menos una vez, reintentos con backoff desde 2 s hasta 6 veces. Como después de 6 fallas la alarm deja de reprogramarse, el `alarm()` debe **capturar excepciones y reprogramar siempre** (si el upstream está caído, sirve el último dato como `stale`).
- **Flag de entorno** para activar la capa B y volver a la A si algo falla. La interfaz `FeedSource` es la misma (ADR-0005).

### Costo de la capa B (cota superior, ⚠ a medir en Fase 5)

| Concepto | Cálculo | Resultado |
|---|---|---|
| Invocaciones por alarms | 4 feeds × 4.320/día | 17.280/día (≈ 518.000/mes) |
| Lecturas Worker → DO | solo en *miss* de caché del colo; cota: `slices_pedidos × colos × 4.320/día` | acotada por diseño: el slice se pide **bajo demanda**, no para todas las líneas |
| Duración (peor caso: los 4 DOs residentes en memoria las 24 h) | 4 × 0,125 GB (128 MB facturados) × 86.400 s × 30 días | ≈ 1.296.000 GB-s/mes |
| Costo de esa duración en Paid | (1.296.000 − 400.000 incluidos) × USD 12,50 / 1 M | ≈ **USD 11,2/mes** |
| Costo de los requests de DO en Paid | 1 M incluido, luego USD 0,15 / M | irrelevante frente al de Workers si las lecturas son bajo demanda |

En **Free**, los DOs permiten 100.000 requests/día y 13.000 GB-s/día: **un solo DO residente 24 h consume ≈ 10.800 GB-s/día**, así que cuatro DOs "siempre prendidos" no entran en Free. Hay que medir cuánto tiempo queda residente un DO que despierta cada 20 s y evaluar TTL más largos para feeds menos críticos. Por eso la capa B se piensa para el escalón Paid.

## 4. Cuántas requests por día (cálculo)

**Supuestos** (explícitos para poder cambiarlos):

- **Polling cada 20 s en primer plano**, y **30 minutos diarios** de uso en primer plano por usuario activo (dato pedido para esta estimación).
- Requests por usuario y día = 30 × 60 / 20 = **90**, asumiendo **una request por tick** (una pantalla visible, un recurso).
- Mes de 30 días. Pico estimado = 5 × el promedio ⚠ (hora pico de movilidad; a medir).
- "Usuarios activos" = personas que abren la app en el día.

| Usuarios activos/día | Requests/día | Requests/mes | Promedio req/s | Pico (×5) | % del límite Free (100 k/día) |
|---:|---:|---:|---:|---:|---:|
| 300 | 27.000 | 810.000 | 0,3 | ≈ 2 | **27 %** |
| 5.000 | 450.000 | 13,5 M | 5,2 | ≈ 26 | 450 % |
| 100.000 | 9.000.000 | 270 M | 104 | ≈ 520 | 9.000 % |
| 1.000.000 | 90.000.000 | 2.700 M | 1.042 | ≈ 5.200 | 90.000 % |

**Escenario conservador (×3):** si la pantalla principal dispara tres recursos por tick (por ejemplo estado del subte + alertas + favoritos), todo se triplica: 300 usuarios → 81.000/día (81 % de Free) y Free se agota con ~370 usuarios.

> **Diferencia con el plan.** El plan maestro estima "100 k req/día ≈ 300 usuarios activos con polling de 20 s". Con 30 min diarios y una request por tick, Free alcanza para ≈ **1.100** usuarios (100.000 / 90); el "300" del plan equivale al escenario de ×3 (≈ 370). Lo usamos como **cota prudente**: nadie sabe todavía cuántas requests dispara realmente cada pantalla. Se corrige o confirma en Fase 4 con la app real.

### Costos mensuales estimados

Plan **Workers Paid**: USD 5/mes mínimo por cuenta, 10 M requests incluidos, USD 0,30 por M adicional; CPU: 30 M ms incluidos, USD 0,02 por M ms adicional. ⚠ Supuesto de CPU: **2 ms por request** servida desde caché (a medir; el límite Free es 10 ms por invocación).

| Usuarios activos/día | Requests/mes | Plan necesario | Requests adicionales | CPU (2 ms/req) | **Total estimado/mes** |
|---:|---:|---|---:|---:|---:|
| 300 | 0,81 M | **Free** (27 % del límite diario) | — | — | **USD 0** |
| 5.000 | 13,5 M | **Paid** | USD 1,05 | incluida | **≈ USD 6** |
| 100.000 | 270 M | Paid | USD 78,00 | USD 10,20 | **≈ USD 93** |
| 1.000.000 | 2.700 M | Paid | USD 807,00 | USD 107,40 | **≈ USD 920** |

Más, en capa B, hasta ≈ USD 11 por duración de DOs (sección 3). Con el escenario ×3: ≈ USD 15 (5.000), ≈ USD 277 (100.000) y ≈ USD 2.755 (1.000.000) por mes. **No hay cargos por transferencia de datos de salida (egress)** en Workers Paid, según la documentación de precios.

> Los costos de otros servicios (R2, observabilidad con más sampling, dominio) no están incluidos. R2 y Logs tienen sus propias cuotas gratuitas y precios; revisar en Fase 2/5.

## 5. Límites y precios de Cloudflare relevantes

Verificados con Context7 el 2026-11-01. Reverificar antes de decidir el plan: Cloudflare anuncia cambios (por ejemplo, desde el 2026-12-01 Workers Logs pasa al precio de Cloudflare Observability).

| Concepto | Workers **Free** | Workers **Paid** | Fuente |
|---|---|---|---|
| Requests | 100.000/día (reinicia 00:00 UTC); al excederse, **error 1027** | 10 M/mes incluidos, + USD 0,30/M | developers.cloudflare.com/workers/platform/pricing y /limits |
| CPU por invocación | 10 ms | 30 s por defecto, hasta 5 min | /workers/platform/pricing |
| CPU facturada | — | 30 M ms/mes incluidos, + USD 0,02/M ms | /workers/platform/pricing |
| Duración | sin cargo | sin cargo | /workers/platform/pricing |
| Subrequests por invocación | 50 | 10.000 (por defecto) | /workers/wrangler/configuration |
| Costo mínimo | — | USD 5/mes por cuenta; sin cargos de egress | /workers/platform/pricing |
| Durable Objects: requests | 100.000/día | 1 M/mes incluido, + USD 0,15/M (incluye alarms y RPC) | /workers/platform/pricing |
| Durable Objects: duración | 13.000 GB-s/día | 400.000 GB-s/mes, + USD 12,50/M GB-s (128 MB facturados) | /workers/platform/pricing |
| DO SQLite: filas leídas / escritas | 5 M/día / 100.000/día (cada `setAlarm()` cuenta como 1 escritura) | 25 000 M/mes / 50 M/mes incluidos | /workers/platform/pricing (nota: la página de planes muestra 50 M/día de lecturas gratis; usar la cifra más baja) |
| Workers Logs | 200.000 eventos/día, 3 días | 20 M/mes incluidos, 7 días | /workers/observability/logs/workers-logs |
| Rate Limiting binding | `period` 10 o 60 s; contadores **por ubicación**; "permisivo y eventualmente consistente" | igual | /workers/runtime-apis/bindings/rate-limit |
| Cache API | Contenido **no se replica fuera del centro de datos de origen**; incompatible con tiered cache | igual | /workers/runtime-apis/cache |

Qué significa para el plan: **Free sirve para desarrollo y las primeras cientos de personas**; pasar a Paid es un cambio de plan en el panel de Cloudflare, no de código (sección 7). Con Free, al superar el límite diario la app recibe error 1027 hasta las 00:00 UTC: la UI debe tratarlo como "servicio no disponible" y mostrar el último dato bueno.

## 6. Mitigaciones del lado de la app

Cada request evitada vale más que cualquier caché, porque se factura aunque salga del caché.

| Mitigación | Efecto |
|---|---|
| Polling **solo con la pantalla visible** (`useFocusEffect` + `focusManager`/`AppState`); **pausa en segundo plano** y en pestañas no visibles | Elimina requests de pantallas que nadie mira |
| **Jitter** (±10–20 %) en el intervalo | Evita picos sincronizados cada 20 s en todo el país |
| **Intervalo configurable** (default 20 s) y subirlo automáticamente con ahorro de batería o sin movimiento | Menos requests por usuario |
| **Un recurso por pantalla / endpoint agregado** (por ejemplo `/v1/home`) | Una request por tick en vez de tres |
| **Slices por línea**, nunca el feed completo | Menos bytes y CPU por request (no baja el recuento) |
| **ETag / `304 Not Modified`** | Menos bytes; **no baja el recuento de requests** |
| **Backoff exponencial** en errores (por defecto de TanStack Query) y respetar `Retry-After` | Evita tormentas cuando el servicio cae |
| **Respetar la cadencia real de la fuente** (30 s en colectivos según el RAML) | Si el dato solo cambia cada 30 s, un polling de 20 s trae repetidos: evaluar 30 s para colectivos |
| **Datos estáticos una sola vez** (descarga con ETag, persistencia local) | Cero carga por búsqueda y paradas cercanas |
| **Caché persistida (MMKV)** y dato "stale" visible | Reabrir la app no dispara ráfagas; funciona offline |

## 7. Plan de migración sin cambios de código

La escalada se hace por **configuración**, en este orden:

1. **Hoy → cientos de usuarios (Free, capa A).** Nada que hacer. Alertar al 70 % del límite diario.
2. **~300–1.000 usuarios activos/día (según lo que mida la app real).** Subir a **Workers Paid** (USD 5/mes) en el panel. Sin cambios de código ni de deploy.
3. **Miles de usuarios / upstream bajo presión.** Activar el flag de la **capa B** (`FeedHub`) en `wrangler` (variable de entorno + binding del DO). La interfaz `FeedSource` no cambia; las rutas y el contrato tampoco. Mantener la capa A como *fallback* detrás del flag.
4. **Cientos de miles → millones.** Ajustes de configuración: TTL por feed, intervalo por defecto de la app (publicable como configuración remota servida por el proxy, sin nueva versión de la app), más slices y, si hiciera falta, `custom domain` y Cache Rules. Autoalojar tiles (PMTiles en R2) para sacar a OpenFreeMap del camino (ADR-0002).
5. **Siempre.** Mantener el estado `stale` y el último dato bueno: la degradación elegante es la defensa ante el límite diario, el upstream caído o el pico imprevisto.

## 8. Qué se mide y cuándo

| Qué | Dónde | Fase |
|---|---|---|
| Requests al upstream por TTL con N clientes simulados | Prueba de carga local con `autocannon` | 2 (2.12) |
| CPU real por request (hit y miss) | Métricas de Workers (sin identificadores) | 2 y 5 |
| Requests reales por pantalla y por tick | Instrumentación local en desarrollo, **sin telemetría en producción** (ver `05-privacidad.md`) | 4 |
| Tiempo de residencia y GB-s del DO | Panel de Cloudflare | 5 (5.5) |
