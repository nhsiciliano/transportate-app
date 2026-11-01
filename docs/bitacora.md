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

## Fase 2 — Proxy

_Sin iniciar._

## Fase 3 — Base de la app

_Sin iniciar._

## Fase 4 — Features

_Sin iniciar._

## Fase 5 — Pulido y escalado

_Sin iniciar._
