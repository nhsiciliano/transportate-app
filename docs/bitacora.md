# Bitácora

Resumen por fase: qué se hizo, decisiones, riesgos y qué queda. Cada fase se cierra acá antes de pasar a la siguiente (el plan exige frenar y validar al final de cada una).

## Fase 1 — Investigación · **en curso**

**Fecha de inicio:** 2026-11-01 · **Alcance:** solo `docs/` y contexto de diseño (`PRODUCT.md`, `DESIGN.md`); sin código de producto.

### Hecho hasta ahora (lote "LOW": tareas 1.1, 1.7, 1.8)

- **1.1 Esqueleto de documentación:** índice (`README.md`), arquitectura, escalabilidad, privacidad, versiones, bitácora y cinco ADRs iniciales (monorepo, mapas, almacenamiento, íconos, proxy en dos capas).
- **1.7 Colores de líneas de subte:** el GTFS de subtes respondió HTTP 200 (48 KB, 8 rutas, 108 estaciones). Los colores del GTFS son la fuente de la app; se cruzaron con Wikipedia (no hay hex en fuentes oficiales). Ver `02b-colores-subte.md`.
- **1.8 `PRODUCT.md`:** generado con el flujo `init` de Impeccable respondiendo desde el plan, sin entrevista; las suposiciones están marcadas en el archivo y esperan confirmación.

### Decisiones tomadas

- ADR-0001 a ADR-0005 en estado *Aceptada* (provenientes del plan maestro).
- Colores de línea de subte = `route_color` del GTFS (ver `02b-colores-subte.md`, sección 3).

### Hallazgos y riesgos nuevos

- El plan estimaba que Free (100k req/día) alcanza para ~300 usuarios activos; con 30 min diarios en primer plano y una request por tick de 20 s, alcanza para ~1.100; con tres requests por tick, ~370. Ver `04-escalabilidad.md`.
- La Cache API **no evita** la facturación de requests al Worker: solo protege al upstream. Escalar usuarios implica pagar el plan Paid aunque el caché funcione perfecto.
- El mapa (OpenFreeMap) hace que el teléfono hable directo con un tercero: expone IP y zona vista a ese proveedor. Hay que decidirlo y declararlo (ver `05-privacidad.md`).
- El feed GTFS de subtes vence el 2026-12-31 (`feed_info.txt`); hay que vigilar su renovación.
- Los hex del GTFS para A, E y H difieren de la señalética real (ver discrepancias en `02b-colores-subte.md`).

### Pendiente en esta fase (a cargo de otros lotes)

- 1.2–1.4: consola de la API, verificación empírica de endpoints y fixtures → `01-api-transporte.md`, `01a-api-console.md`.
- 1.5–1.6: tokens de Obelisco y paleta oscura → `02-obelisco-tokens.md`.
- 1.9–1.10: briefs de `shape` y entrega para validación → `briefs/`.

### Cierre de Fase 1

> _Pendiente. Completar al validar con el usuario:_
>
> - **Fecha de cierre:** `AAAA-MM-DD`
> - **Validado por:** _(usuario)_
> - **Qué se entregó:** _(lista de documentos)_
> - **Decisiones confirmadas / cambiadas:** _(…)_
> - **Riesgos abiertos que pasan a Fase 2:** _(…)_
> - **Cambios al plan maestro:** _(…)_

## Fase 2 — Proxy

_Sin iniciar._

## Fase 3 — Base de la app

_Sin iniciar._

## Fase 4 — Features

_Sin iniciar._

## Fase 5 — Pulido y escalado

_Sin iniciar._
