# Documentación de Transportate

Transportate es una app móvil (iOS/Android, Expo) con colectivos, subte y tránsito de CABA en tiempo real, sin cuentas ni datos personales. Esta carpeta reúne todo lo que se decide, se investiga y se verifica a lo largo del proyecto. El trabajo avanza por fases con freno y validación al final de cada una (ver `00-plan.md`).

**Estado:** **Fase 4 (features) cerrada técnicamente el 2026-11-03, pendiente de validación del usuario en el iPhone ([`11-prueba-manual.md`](11-prueba-manual.md)); Fase 5 sin iniciar.** Las Fases 1, 2 y 3 se cerraron el 2026-11-01, el 2026-11-02 y el 2026-11-02 (la 3 la validó el usuario el 2026-11-03). Ver `bitacora.md`. **La Fase 6 (Trenes, fuente comunitaria de SOFSE) arrancó el 2026-11-05:** ver `00-plan.md`, `01d-api-trenes-sofse.md` y `briefs/07-trenes.md`. Para instalar y correr el proyecto, ver el [`README.md`](../README.md) de la raíz.

## Cómo leer esto

- ¿Qué vamos a construir y en qué orden? → `00-plan.md`
- ¿Qué datos hay y qué responde hoy la API? → `01-api-transporte.md`
- ¿Cómo se ve y qué tokens usamos? → `02-obelisco-tokens.md`, `02b-colores-subte.md`
- ¿Cómo está armado y cuánto aguanta? → `03-arquitectura.md`, `04-escalabilidad.md`
- ¿Qué pasa con los datos de las personas? → `05-privacidad.md`
- ¿Cómo se prueba y cómo se despliega? → `09-testing.md`, `10-deploy.md`; ¿cómo valido en el iPhone? → `11-prueba-manual.md`; ¿cómo publico en iOS? → `12-publicacion.md`
- ¿Qué herramientas hay y cómo se corren? → [Herramientas](#herramientas) y [`../tools/README.md`](../tools/README.md)
- ¿Por qué se decidió así? → `adr/`

## Índice

Leyenda: ✅ escrito · 🚧 se escribe al cierre de la fase en curso · ⏳ fases posteriores

### Plan y estado

| Documento | Contenido | Estado |
|---|---|---|
| [`00-plan.md`](00-plan.md) | Plan maestro: contexto, decisiones de arquitectura, fases, riesgos | ✅ |
| [`bitacora.md`](bitacora.md) | Resumen por fase: qué se hizo, decisiones, riesgos, cierre | ✅ (Fases 1 a 4 cerradas técnicamente; Fases 5 y 6 en curso) |
| [`versiones.md`](versiones.md) | Versiones fijadas y verificadas con Context7, y lo pendiente de fijar | ✅ |

### Investigación (Fase 1)

| Documento | Contenido | Estado |
|---|---|---|
| [`01-api-transporte.md`](01-api-transporte.md) | Endpoints verificados con credenciales: status, tamaño, formato, frecuencia, inconsistencias | ✅ |
| [`01b-gtfs-alternativos.md`](01b-gtfs-alternativos.md) | Fuentes alternativas de GTFS de colectivos evaluadas, cruce con el tiempo real (`tools/gtfs-cruce/`) y plan B de paradas | ✅ |
| [`01d-api-trenes-sofse.md`](01d-api-trenes-sofse.md) | Trenes: la instancia comunitaria no oficial de la API de SOFSE (qué es, cobertura, endpoints con sus formas, mediciones, riesgos y plan de salida) | ✅ (Fase 6) |
| [`01a-api-console.md`](01a-api-console.md) | Inventario de la spec RAML oficial (`/console/api/?raml`): endpoints, recursos comentados, tipos GTFS-RT, matriz MVP vs spec | ✅ |
| [`01c-portal-datosabiertos-apis.md`](01c-portal-datosabiertos-apis.md) | Portal 3scale `datosabiertos-apis` y host alternativo `datosabiertos-transporte-apis`: spec OpenAPI `Transporte_3` vs. realidad, comparación con `apitransporte` (2026-11-02) | ✅ |
| [`02-obelisco-tokens.md`](02-obelisco-tokens.md) | Tokens del sistema de diseño Obelisco v2 (color, tipografía, espaciado, radios, sombras, foco) con archivo y línea de origen; paleta oscura derivada | ✅ |
| [`02b-colores-subte.md`](02b-colores-subte.md) | Colores oficiales de las líneas de subte (GTFS vs. fuentes públicas) y estaciones por línea | ✅ |
| [`02c-colores-trenes.md`](02c-colores-trenes.md) | Colores de las 6 líneas de tren (**provisorios**: sin manual oficial con hex), contraste y reglas de uso | ✅ (Fase 6) |
| [`briefs/`](briefs/) | Un brief por pantalla del MVP (Impeccable `shape`), con estados y sin código | ✅ |
| [`fuentes/`](fuentes/) | Materiales de origen: `api-transporte-v1.raml` (spec RAML oficial) y `transporte-3-openapi.json` (spec OpenAPI del portal 3scale) | ✅ |
| [`../tools/api-probe/`](../tools/api-probe/README.md) | Script reproducible del sondeo de la API (`node probe.mjs`) y `last-run.json` | ✅ |
| [`solicitud-gtfs-gcba.md`](solicitud-gtfs-gcba.md) | Borrador de correo (sin enviar) al GCBA pidiendo el GTFS vigente de colectivos y consultando el estado de la API | ✅ |
| [`solicitud-datos-nacion-servicios.md`](solicitud-datos-nacion-servicios.md) | Borrador de correo (sin enviar) a Nación Servicios pidiendo el GTFS vigente de colectivos del AMBA y la autorización de uso de los datos de Cuándo SUBO | ✅ |
| [`../apps/proxy/test/fixtures/`](../apps/proxy/test/fixtures/README.md) | 32 fixtures reales (pb, json, geojson, errores) para los tests del proxy | ✅ |

### Diseño de la solución

| Documento | Contenido | Estado |
|---|---|---|
| [`03-arquitectura.md`](03-arquitectura.md) | Monorepo, flujo upstream → adaptador → contrato Zod v1 → app, patrón adaptador, cómo agregar un servicio | ✅ |
| [`04-escalabilidad.md`](04-escalabilidad.md) | Capa A / capa B, requests por día para 300 → 1.000.000 usuarios, límites y costos de Cloudflare, plan de migración | ✅ |
| [`05-privacidad.md`](05-privacidad.md) | Principios, qué se guarda y qué no sale del teléfono, rate limiting, logs, texto de "Acerca de" | ✅ |
| [`../DESIGN.md`](../DESIGN.md) | Sistema visual de la app (Obelisco v2 vigente adaptado a nativo): color claro/oscuro, tipografía, espaciado y forma, íconos, movimiento, componentes, voz y copy, accesibilidad, qué no hacer | ✅ (Fase 3, tarea 3.6) |

### Fase 2 (proxy)

| Documento | Contenido | Estado |
|---|---|---|
| [`09-testing.md`](09-testing.md) | Estrategia de tests: qué se prueba en cada pieza (Vitest en workerd con fixtures reales; Jest + RNTL en la app), cómo se corre, cómo se capturan las fixtures de SOFSE (trenes) y qué queda afuera | ✅ |
| [`10-deploy.md`](10-deploy.md) | Despliegue del proxy en Cloudflare (entornos, R2, secrets, workflow manual de GitHub Actions) y operación sin datos personales | ✅ |
| [`11-prueba-manual.md`](11-prueba-manual.md) | Checklist de prueba manual en el iPhone con el dev client (Fase 4, todas las pantallas): preparación, cómo forzar cada estado, qué tocar y qué debería verse por pantalla (incluida Trenes, sección 3b), y qué anotar si algo falla | ✅ |
| [`12-publicacion.md`](12-publicacion.md) | Publicación en iOS (Fase 7): App Store Connect paso a paso, build y submit con EAS, prueba en TestFlight, ficha y notas para el revisor, capturas, gate de dominio y freno de emergencia | ✅ (Fase 7) |
| [`../apps/proxy/README.md`](../apps/proxy/README.md) | Rutas v1, headers, composición, rate limit y estáticos del Worker | ✅ |
| [`06-proxy.md`](06-proxy.md) | Referencia del Worker: rutas, adaptadores, fuente con caché, estáticos, rate limit, límites de CPU, cómo agregar un servicio | ✅ |

### Decisiones (ADR)

| Documento | Decisión |
|---|---|
| [`adr/ADR-0001-monorepo.md`](adr/ADR-0001-monorepo.md) | Monorepo con pnpm |
| [`adr/ADR-0002-mapas-maplibre.md`](adr/ADR-0002-mapas-maplibre.md) | MapLibre en vez de react-native-maps |
| [`adr/ADR-0003-almacenamiento-mmkv.md`](adr/ADR-0003-almacenamiento-mmkv.md) | MMKV en vez de expo-sqlite |
| [`adr/ADR-0004-iconos-material-symbols.md`](adr/ADR-0004-iconos-material-symbols.md) | Material Symbols Rounded como SVG en vez de fuente variable |
| [`adr/ADR-0005-proxy-dos-capas.md`](adr/ADR-0005-proxy-dos-capas.md) | Proxy en dos capas con Durable Object `FeedHub` |
| [`adr/ADR-0007-aprendizaje-paradas.md`](adr/ADR-0007-aprendizaje-paradas.md) | Dónde corre el aprendizaje de paradas (Propuesta) |
| [`adr/ADR-0006-paradas-colectivos.md`](adr/ADR-0006-paradas-colectivos.md) | Paradas de colectivo: catálogo oficial de BA + tabla de equivalencias aprendida; sin OSM en el MVP (**Propuesta**, la confirma el usuario) |

Formato de los ADR: **Contexto / Decisión / Alternativas consideradas / Consecuencias**. Los ADR no se reescriben: si una decisión cambia, se crea uno nuevo que reemplaza al anterior y se marca el estado.

### Fases 3 y 4 (app)

| Documento | Contenido | Estado |
|---|---|---|
| [`07-app.md`](07-app.md) | Referencia de la app: estructura, navegación, providers, tema, fuentes, almacenamiento (MMKV), favoritos, estático, ubicación, mapas, cada feature de la Fase 4, el estado al cierre y Trenes (§22, Fase 6) | ✅ |
| [`08-design-system.md`](08-design-system.md) | Sistema de diseño en código: tokens, componentes de `shared/ui` y cuándo usarlos, accesibilidad, háptica e íconos (mapa curado) | ✅ |

`09-testing.md`, `10-deploy.md` y `11-prueba-manual.md` ya existen y se amplían en la Fase 5 (EAS Build y OTA, CI y la prueba manual de cada ola).

## Herramientas

Cada una es un paquete **npm standalone** dentro de `tools/` (fuera del workspace pnpm), salvo `contraste`, que es un script de Python sin dependencias. Reglas comunes, estado de la captura y detalle de entradas y salidas: [`../tools/README.md`](../tools/README.md).

| Herramienta | Qué hace | Cómo se corre (desde su carpeta) | Fase |
|---|---|---|---|
| [`tools/api-probe`](../tools/api-probe/README.md) | Sondea todos los endpoints de la API con credenciales, mide cadencia y fallos, y guarda los fixtures de `apps/proxy/test/fixtures/` | `npm install --no-package-lock && node probe.mjs` | 1 |
| [`tools/gtfs-cruce`](../tools/gtfs-cruce/README.md) | Cruza GTFS y datasets de paradas candidatos con los IDs del tiempo real | `npm install && npm run cruce` | 1 |
| [`tools/contraste`](../tools/contraste/contraste.py) | Calcula contraste WCAG de las paletas de Obelisco (clara, oscura derivada e histórica) | `python3 contraste.py` (`--check` falla si un par exigible de la paleta oscura no cumple) | 1 |
| [`tools/captura-posiciones`](../tools/captura-posiciones/README.md) | Captura continua de `vehiclePositions` (cada 60 s) y muestras de `tripUpdates` (cada 10 min) a `~/.cache/transportate/capturas/` | `./start.sh`, `./status.sh`, `./stop.sh` | 2 |
| [`tools/gtfs`](../tools/gtfs/README.md) | Preprocesa paradas BA, líneas, subte, equivalencias `stop_id` y recorridos a JSON versionado para R2 | `npm install && npm run build`; `./upload-r2.sh` sube a R2 | 2 |

## `PRODUCT.md` y `DESIGN.md` viven en la raíz

[`../PRODUCT.md`](../PRODUCT.md) (audiencia, modo de diseño, plataforma, restricciones) y [`../DESIGN.md`](../DESIGN.md) (sistema visual: color, tipografía, espaciado, íconos, componentes, voz y accesibilidad; escrito en la Fase 3 a partir de los tokens) **no están en `docs/` a propósito**: el skill de diseño **Impeccable** los lee desde la raíz del proyecto, y si estuvieran acá no los encontraría. Para no perderlos de vista, este índice los enlaza; no se duplican.

- `PRODUCT.md` → **qué** es el producto y para quién (Fase 1, tarea 1.8). Lo escribe `init`.
- `DESIGN.md` → **cómo** se ve (Fase 3, tarea 3.6). Se escribió a mano porque el skill no estaba disponible; ahora que existe `apps/mobile/src/shared/theme/tokens.ts`, queda pendiente regenerarlo con `extract`/`document` y revisarlo contra el código.

## Convenciones

- **Idioma:** español rioplatense (voseo) en documentación y en el copy de la app; nombres de código y commits convencionales en inglés/español según el caso (`docs:`, `feat:`, …).
- **Citar fuentes:** cada dato externo lleva URL o `archivo:línea`; las cifras de librerías y precios se verifican con Context7 y se anotan en `versiones.md` con fecha.
- **Credenciales:** el `.env` local (`GCBA_CLIENT_ID`, `GCBA_CLIENT_SECRET`) **nunca** se commitea; en documentos y fixtures se usan placeholders (`<ID>`, `<SECRET>`) y se redactan las URLs que los contengan.
- **Descargas grandes** (GTFS, clones) van fuera del repo (por ejemplo `~/.cache/transportate/`).
- **Un documento por tema**, concisos, con enlaces cruzados en vez de copias.
