# Bitácora

Resumen por fase: qué se hizo, decisiones, riesgos y qué queda. Cada fase se cierra acá antes de pasar a la siguiente (el plan exige frenar y validar al final de cada una).

## Fase 1 — Investigación · **completada, pendiente de validación del usuario**

**Inicio:** 2026-11-01 · **Cierre técnico:** 2026-11-01 · **Alcance:** solo `docs/`, fixtures y contexto de diseño; sin código de producto.

### Cómo se trabajó

Coordinación con Orca (run `run_71a886f27b3e`) desde la sesión `planner`. Las tareas se repartieron por dificultad: 🟢 low-dev (1.1, 1.7, 1.8), 🟡 mid-dev (1.2, 1.5, 1.6, 1.9), 🔴 high-dev (1.3, 1.4). Cada worker trabajó en su worktree y branch (`nhsiciliano/Low-Dev`, `Mid-Dev`, `High-Dev`); el coordinador revisó cada entrega (commits, ausencia de credenciales, tamaño de fixtures) y la integró a `main`. No hubo pedidos de imágenes, así que la sesión Dev Images no se usó.

### Qué se entregó

| Doc | Tarea | Contenido |
|---|---|---|
| `01-api-transporte.md` | 1.3/1.4 | Verificación empírica de 19 endpoints con credenciales reales (4 corridas, 3 con observación de 5 min), tabla por endpoint con status, bytes, latencia, cadencia y calidad; recomendaciones de TTL y de manejo de fallos para el proxy. Script reproducible en `tools/api-probe/`. 32 fixtures reales en `apps/proxy/test/fixtures/`. |
| `01a-api-console.md` | 1.2 | Inventario completo de la spec RAML oficial (descargada de `/console/api/?raml`), incluidos los recursos comentados, tipos GTFS-RT y matriz "MVP vs spec". |
| `02-obelisco-tokens.md` | 1.5/1.6 | Tokens con `archivo:línea`, tokens por componente, propuesta de `tokens.ts`, paleta oscura derivada y tablas de contraste WCAG calculadas con `tools/contraste/contraste.py`. |
| `02b-colores-subte.md` | 1.7 | Colores de línea desde `routes.txt` del GTFS (HTTP 200) cruzados con fuentes públicas; estaciones por línea. |
| `PRODUCT.md`, `briefs/` | 1.8/1.9 | Contexto de producto (Impeccable `init`) y 6 briefs de pantalla (Impeccable `shape`) con estados, rangos y 33 suposiciones + 4 decisiones abiertas consolidadas en `briefs/README.md`. |
| `03`, `04`, `05`, `versiones.md`, ADR-0001…0005 | 1.1 | Arquitectura, escalabilidad con cifras verificadas, privacidad, versiones, decisiones. |

### Hallazgos que cambian el plan

1. **La API responde** pese al aviso de suspensión del portal, pero varios feeds están rotos o viejos (detalle en `01-api-transporte.md`).
2. **Hay arribos de colectivos:** `/colectivos/tripUpdates` existe aunque no esté en el RAML (3.904 viajes, 105 mil predicciones, dato nuevo cada 60 s). El plan los daba por inexistentes.
3. **Arribos de subte bloqueados:** `/subtes/forecastGTFS` está congelado desde 2026-10-24 y solo trae líneas A, B, D y E. Va detrás de un flag con detección de dato viejo.
4. **Alertas de subte solo con `json=1`:** el protobuf llega corrupto (re-codificado como UTF-8).
5. **Cortes de tránsito no existen hoy:** `/transito/v1/cortes` devuelve 500 en todas las variantes. El brief de Tránsito ya contempla el estado "Fuente no disponible"; decisión N3 pendiente (ocultar el tab o mantenerlo).
6. **GTFS estático de colectivos es de 2021:** solo el 32 % de los `route_id` y el 40 % de los `stop_id` del tiempo real existen en él. Para nombres y ubicación de paradas hace falta otra fuente vigente (riesgo para 2.10 y para arribos por parada).
7. **Fiabilidad upstream:** 1–9 % de requests fallan (timeouts/ECONNRESET), sin 429, sin `Cache-Control`/`ETag`/gzip, cadencia real de 60 s en colectivos. El proxy debe absorber fallos (último dato bueno, reintentos, TTL ≥ 20 s) y comprimir.
8. **Obelisco v2 tiene dos identidades:** la vigente (src/dist: `#1d3343`, `#035c80`, `#009688`, Archivo + Open Sans) y la histórica (`app/out`: `#336ACC`, Nunito). Decisión: colores vigentes; tipografía Nunito + Open Sans por mandato del brief (desvío consciente).
9. **Costos:** Free alcanza para ~1.100 usuarios activos con 1 request por tick de 20 s (no 300 como decía el plan); la Cache API protege al upstream pero no reduce requests facturadas.
10. **Sin `bearing`** en ningún feed: el mapa no puede rotar íconos por rumbo real.

### Decisiones tomadas por el coordinador (a confirmar por el usuario)

- Paleta vigente de Obelisco + tipografía Nunito/Open Sans (hallazgo 8).
- Los briefs no prometen arribos de colectivos hasta resolver el estático (hallazgo 6); el punto de entrada queda marcado.
- Tránsito se diseña con "Fuente no disponible" como estado de primera clase.

### Riesgos abiertos que pasan a Fase 2

- Conseguir un GTFS de colectivos vigente (AMBA) o una fuente alternativa de paradas; sin eso, arribos por parada y búsqueda por parada quedan limitados.
- `forecastGTFS` congelado: arribos de subte solo si revive; el proxy debe exponer `sourceTimestamp` y la app marcar el dato como viejo.
- GTFS de subte vence el 2026-12-31.
- El proveedor de tiles (OpenFreeMap) recibe la IP del teléfono: hay que declararlo en privacidad o self-hostear.

### Cierre de Fase 1

- **Fecha de cierre técnico:** 2026-11-01
- **Validado por:** usuario, 2026-11-01. Decisiones: (a) **paleta vigente de Obelisco confirmada** (tipografía Nunito + Open Sans se mantiene); (b) **tab Tránsito oculto por ahora** por falta de fuente de cortes (brief diferido, N3 resuelta); (c) **buscar fuentes alternativas de GTFS** de colectivos → tarea 1.11 (mid-dev) hecha el 2026-11-01: 6 fuentes evaluadas, ninguna vigente; plan B = paradas oficiales BA + tabla de equivalencias aprendida del tiempo real (`01b-gtfs-alternativos.md`, script `tools/gtfs-cruce/`). Pasa a Fase 2: medir cobertura del aprendizaje (24–48 h), ADR-0006 sobre paradas y licencia OSM, y pedir el GTFS vigente a la Secretaría de Transporte.
- **Incidente menor de privacidad del equipo:** durante la tarea 1.11 un worker envió el email del usuario en el `User-Agent` de una consulta a Overpass (OSM). No quedó en el repo. Regla desde ahora: ningún script usa datos personales en headers; `User-Agent` genérico `transportate-tools`.
- **Pendientes de decisión del usuario:** suposiciones S1–S33 y decisiones N1–N4 de `briefs/README.md`; tipografía (Nunito vs Archivo); qué hacer con Tránsito sin cortes; fuente alternativa de GTFS de colectivos.

## Fase 2 — Proxy · **completada, pendiente de validación del usuario**

**Inicio:** 2026-11-01 · **Cierre técnico:** 2026-11-02 · **Alcance:** `apps/proxy`, `packages/contracts`, `tools/gtfs`, tests, despliegue y documentación del proxy. Sin código de la app.

### Cómo se trabaja

Mismo esquema que en la Fase 1: coordinación con Orca desde `planner`, workers por dificultad en sus worktrees (`nhsiciliano/Low-Dev`, `Mid-Dev`, `High-Dev`) y el coordinador integra a `main`. A `main` ya llegaron el scaffold, los contratos, el esqueleto y las rutas del proxy, los tests, el despliegue, el preprocesado estático y las tareas de low-dev (captura, versiones, ADR-0006, solicitud). Los adaptadores reales, la fuente con caché y las correcciones de la prueba de humo los hizo high-dev; mid-dev hizo rutas, ETag, carga y `06-proxy.md`; low-dev captura, versiones, ADRs y READMEs.

### Hecho hasta ahora

| Qué | Tarea | Dónde |
|---|---|---|
| Scaffold del monorepo pnpm (TS 6.0.3 estricto, ESLint 10, Prettier, `.editorconfig`, CI de lint/typecheck/test) | 2.2 | raíz, `.github/workflows/ci.yml` |
| Contratos Zod v1 (sobre `EnvelopeV1` con `generatedAt`/`sourceTimestamp`, esquemas de subte, colectivos, tránsito, manifiesto estático y esquemas upstream laxos) | 2.3 | `packages/contracts` |
| Esqueleto del Worker con Hono 4, `/v1/health`, errores tipados e interfaces de fuentes y adaptadores | 2.2/2.8 | `apps/proxy` |
| Rutas `/v1/*` con ETag débil y 304, `Cache-Control` con `stale-while-revalidate`, rate limit con el binding nativo (clave = hash de la IP, sin persistirla) y estáticos desde R2 con Cache API; Tránsito como stub que responde 503 | 2.8/2.9 | `apps/proxy`, [`apps/proxy/README.md`](../apps/proxy/README.md) |
| Tests Vitest dentro de workerd (`@cloudflare/vitest-plugin`): rutas, ETag/304, rate limit, estáticos y ausencia de fugas de secrets. Al 2026-11-02: 43 tests en `packages/contracts` y 37 en `apps/proxy`, `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde | 2.11 (parcial) | `docs/09-testing.md` |
| Despliegue: entornos `preview` y `production`, buckets R2 y secrets, workflow manual de GitHub Actions | 2.12 (parcial) | [`10-deploy.md`](10-deploy.md), `.github/workflows/deploy-proxy.yml` |
| Preprocesado estático (paradas BA, líneas, subte, equivalencias `stop_id`, recorridos) a JSON versionado y script de subida a R2 | 2.10 | `tools/gtfs` |
| Captura continua de `vehiclePositions` y muestras de `tripUpdates` (lanzada el 2026-11-01 a las 23:31 UTC; objetivo 24–48 h) | 2.0 | `tools/captura-posiciones` |
| Versiones verificadas con Context7 y npm | 2.1 | [`versiones.md`](versiones.md) |
| Límites de CPU y memoria de Workers (con medición local de decodificación) | 2.1 | [`04-escalabilidad.md`](04-escalabilidad.md) §9 |
| ADR-0006 de paradas de colectivo (**Propuesta**) y borrador de solicitud del GTFS vigente al GCBA (**sin enviar**) | 2.0/2.1 | [`adr/ADR-0006-paradas-colectivos.md`](adr/ADR-0006-paradas-colectivos.md), [`solicitud-gtfs-gcba.md`](solicitud-gtfs-gcba.md) |
| README raíz, índice de `docs/`, README de `tools/` y `.env.example` | 2.12 (parcial) | [`../README.md`](../README.md), [`README.md`](README.md), [`../tools/README.md`](../tools/README.md) |

### Hallazgos y decisiones técnicas

1. **Tests de Workers:** se usa `@cloudflare/vitest-plugin` 1.4.12, que reemplaza al deprecado `@cloudflare/vitest-pool-workers` (0.23.0, con peer `vitest ^4.1.0` y wrangler 4.124.0 desfasado). Versiones fijadas hoy en los `package.json`: Vitest 5.0.5, wrangler 4.156.1, Zod 4.6.7, Hono 4.13.16.
2. **TypeScript 6.0.3**, no la 7.0.2: `typescript-eslint` 8.72.1 declara soporte `<6.1.0`.
3. **`compatibility_date`:** `nodejs_compat` ya viene activado desde 2026-08-04 y `workerd` rechaza el flag con fechas posteriores; no se declara.
4. **CPU en Workers Free:** decodificar `tripUpdates` completo (3,6 MB) costó 14–86 ms en una medición local en Node, contra un límite de 10 ms. El proxy filtra por `route_id` upstream y el feed completo se procesa solo en la capa B o fuera de línea (`04-escalabilidad.md` §9). La medición en `workerd` real sigue pendiente.
5. **La compresión la hace el runtime de Cloudflare**, no el Worker (`hono/compress` queda fuera): evita gastar CPU sin beneficio (`apps/proxy/README.md`).
6. **Paradas de colectivo:** catálogo oficial de BA + tabla de equivalencias aprendida; **sin OSM en el MVP** para no heredar ODbL (ADR-0006, a confirmar por el usuario).
7. **Primer build de `tools/gtfs` con solo ~19 minutos de captura:** de las predicciones de `tripUpdates` ubicadas en CABA, el 74,6 % ya tiene parada BA; el 56,7 % de todas las predicciones sigue sin ubicar. Estas cifras mejoran al rehacer el build con las 24–48 h de captura (`tools/gtfs/README.md`).
8. **Fallos de la captura:** en los primeros 40 minutos fallaron 2 de 35 snapshots de posiciones y 1 de 4 de `tripUpdates` (tras timeout de 20 s y un reintento), coherente con el 1–9 % de la Fase 1.

### Completado al cierre (2026-11-02)

| Qué | Tarea | Dónde |
|---|---|---|
| `EdgeCachedFeedSource` (capa A): Cache API con clave ficticia sin credenciales, copia en memoria del isolate, refresco con lock por timestamp (sin compartir promesas entre requests), último dato bueno ≤ 300 s, timeout 5 s configurable (`UPSTREAM_TIMEOUT_MS`) | 2.4 | `apps/proxy/src/sources/`, `src/cache/` |
| `SubtesAdapter`: estado por línea con reglas documentadas desde `serviceAlerts?json=1`, alertas, arribos desde `forecastGTFS` con detección de feed congelado | 2.5 | `apps/proxy/src/adapters/subtes/` |
| `ColectivosAdapter`: siempre con filtro upstream `route_id` (nunca el feed completo), índice estático compacto desde R2 (`indice-colectivos.json`, ~5 ms de CPU en el primer request), posiciones y arribos por parada con fan-out con presupuesto de 5 s | 2.6 | `apps/proxy/src/adapters/colectivos/` |
| Tránsito como stub 503 (diferido) | 2.7 | `src/adapters/transito/` |
| ETag estable sobre `data` + `sourceTimestamp` + `stale` (304 real), log `upstream_fetch` sin credenciales | 2.8 | `src/middleware/envelope.ts` |
| Tests: 67 en contratos, 87 en el proxy (fuente, adaptadores con fixtures `.pb` reales en workerd, rutas, ETag, rate limit, R2, CPU) y 79 en `tools/gtfs` (incluida validación contra contratos) | 2.11 | `docs/09-testing.md` |
| Prueba de carga `tools/carga` (autocannon): 50 conexiones × 45 s → 29.286 requests, 0 errores, 8 fetches upstream en 2 claves; rate limit 60 × 200 / 40 × 429 con `Retry-After` | 2.12 | `tools/carga/README.md` |
| `docs/06-proxy.md` (referencia del Worker) y READMEs por carpeta | 2.12 | [`06-proxy.md`](06-proxy.md) |
| ADR-0007 (**Propuesta**): dónde corre el aprendizaje de paradas | — | [`adr/ADR-0007-aprendizaje-paradas.md`](adr/ADR-0007-aprendizaje-paradas.md) |

**Verificación del coordinador en `main` (2026-11-02):** `pnpm lint`, `pnpm typecheck`, `pnpm test` en verde; `tools/gtfs` desde cero (`npm ci && npm test && npm run build`) sin ensuciar el árbol; `wrangler dev` con credenciales reales y el paquete estático en el R2 local: `/v1/subtes/estado` (B, C y E demoradas), `/v1/subtes/alertas` (3), `/v1/subtes/estaciones/1059/arribos` (`stale`, forecast congelado), `/v1/colectivos/lineas` (936), `/v1/colectivos/lineas/1858/posiciones` (4 vehículos), `/v1/colectivos/paradas/pfee923c699/arribos` (3 arribos en 0,7 s; 5,0 s `stale` cuando una línea upstream no responde), `/v1/transito/cortes` 503, `If-None-Match` → 304 con 0 bytes; cero credenciales en logs y respuestas.

### Hallazgos adicionales (cierre)

9. **En workerd no se pueden compartir promesas de I/O entre requests:** el coalescing con una `Promise` a nivel de módulo produjo 57 respuestas 500 "Worker's code had hung" bajo carga. Se reemplazó por datos compartidos + flag de refresco; la prueba de carga quedó en 0 errores.
10. **CPU del primer request de colectivos por isolate:** 25–27 ms con Zod sobre `paradas.json` (supera los 10 ms de Free) → `tools/gtfs` publica `indice-colectivos.json` compacto y el proxy no valida con Zod en runtime (el archivo viene firmado por sha256 en el manifest): ~5 ms.
11. **`wrangler types` genera literales** para las vars (`"5000"`): los helpers que leen `env` usan tipos estructurales.
12. **Arribos de colectivos existen y funcionan** vía `tripUpdates?route_id=` (5 KB por línea) con equivalencias `stop_id → parada`; el 1–9 % de fallos upstream se absorbe con presupuesto de 5 s y `stale`.

### Riesgos abiertos que pasan a Fase 3

- La cobertura de arribos por parada depende de la tabla de equivalencias; la captura de 24–48 h sigue corriendo (PID vivo, 74 snapshots al cierre) y hay que rehacer `tools/gtfs` al terminar y actualizar `01b` y el README de la herramienta.
- Nadie desplegó todavía a `preview`: requiere `wrangler login` y `wrangler secret put` del usuario (`10-deploy.md`). La Cache API no actúa en `*.workers.dev`: hace falta dominio propio para la capa A en producción.
- `forecastGTFS` sigue congelado (arribos de subte vacíos con `stale`).
- Dónde corre el aprendizaje de paradas en producción (ADR-0007, Propuesta).

### Pendiente de decisión del usuario

- Confirmar ADR-0006 (paradas BA + equivalencias aprendidas, sin OSM) y ADR-0007 (aprendizaje fuera de Workers para el MVP).
- Enviar (o no) la solicitud del GTFS vigente al GCBA (`solicitud-gtfs-gcba.md`): se manda desde su casilla, con sus datos.
- Licencia del proyecto (el README raíz dice "a definir").
- Siguen abiertas las suposiciones S1–S33 y decisiones N1–N4 de `briefs/README.md`, heredadas de la Fase 1.

## Fase 3 — Base de la app

_Sin iniciar._

## Fase 4 — Features

_Sin iniciar._

## Fase 5 — Pulido y escalado

_Sin iniciar._
