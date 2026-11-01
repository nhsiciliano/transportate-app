# Documentación de Transportate

Transportate es una app móvil (iOS/Android, Expo) con colectivos, subte y tránsito de CABA en tiempo real, sin cuentas ni datos personales. Esta carpeta reúne todo lo que se decide, se investiga y se verifica a lo largo del proyecto. El trabajo avanza por fases con freno y validación al final de cada una (ver `00-plan.md`).

**Estado:** Fase 1 (investigación) en curso. Ver `bitacora.md`.

## Cómo leer esto

- ¿Qué vamos a construir y en qué orden? → `00-plan.md`
- ¿Qué datos hay y qué responde hoy la API? → `01-api-transporte.md`
- ¿Cómo se ve y qué tokens usamos? → `02-obelisco-tokens.md`, `02b-colores-subte.md`
- ¿Cómo está armado y cuánto aguanta? → `03-arquitectura.md`, `04-escalabilidad.md`
- ¿Qué pasa con los datos de las personas? → `05-privacidad.md`
- ¿Por qué se decidió así? → `adr/`

## Índice

Leyenda: ✅ escrito · 🚧 lo escribe otro lote de la Fase 1 · ⏳ fases posteriores

### Plan y estado

| Documento | Contenido | Estado |
|---|---|---|
| [`00-plan.md`](00-plan.md) | Plan maestro: contexto, decisiones de arquitectura, fases, riesgos | ✅ |
| [`bitacora.md`](bitacora.md) | Resumen por fase: qué se hizo, decisiones, riesgos, cierre | ✅ (Fase 1 en curso) |
| [`versiones.md`](versiones.md) | Versiones fijadas y verificadas con Context7, y lo pendiente de fijar | ✅ |

### Investigación (Fase 1)

| Documento | Contenido | Estado |
|---|---|---|
| [`01-api-transporte.md`](01-api-transporte.md) | Endpoints verificados con credenciales: status, tamaño, formato, frecuencia, inconsistencias | 🚧 |
| [`01a-api-console.md`](01a-api-console.md) | Lectura de la consola oficial de la API (`/console/`): endpoints candidatos, métodos, parámetros, términos | 🚧 |
| [`02-obelisco-tokens.md`](02-obelisco-tokens.md) | Tokens del sistema de diseño Obelisco v2 (color, tipografía, espaciado, radios, sombras, foco) con archivo y línea de origen; paleta oscura derivada | 🚧 |
| [`02b-colores-subte.md`](02b-colores-subte.md) | Colores oficiales de las líneas de subte (GTFS vs. fuentes públicas) y estaciones por línea | ✅ |
| [`briefs/`](briefs/) | Un brief por pantalla del MVP (Impeccable `shape`), con estados y sin código | 🚧 |
| [`fuentes/`](fuentes/) | Materiales de origen, por ejemplo `api-transporte-v1.raml` (spec oficial de la API) | ✅ |

### Diseño de la solución

| Documento | Contenido | Estado |
|---|---|---|
| [`03-arquitectura.md`](03-arquitectura.md) | Monorepo, flujo upstream → adaptador → contrato Zod v1 → app, patrón adaptador, cómo agregar un servicio | ✅ |
| [`04-escalabilidad.md`](04-escalabilidad.md) | Capa A / capa B, requests por día para 300 → 1.000.000 usuarios, límites y costos de Cloudflare, plan de migración | ✅ |
| [`05-privacidad.md`](05-privacidad.md) | Principios, qué se guarda y qué no sale del teléfono, rate limiting, logs, texto de "Acerca de" | ✅ |

### Decisiones (ADR)

| Documento | Decisión |
|---|---|
| [`adr/ADR-0001-monorepo.md`](adr/ADR-0001-monorepo.md) | Monorepo con pnpm |
| [`adr/ADR-0002-mapas-maplibre.md`](adr/ADR-0002-mapas-maplibre.md) | MapLibre en vez de react-native-maps |
| [`adr/ADR-0003-almacenamiento-mmkv.md`](adr/ADR-0003-almacenamiento-mmkv.md) | MMKV en vez de expo-sqlite |
| [`adr/ADR-0004-iconos-material-symbols.md`](adr/ADR-0004-iconos-material-symbols.md) | Material Symbols Rounded como SVG en vez de fuente variable |
| [`adr/ADR-0005-proxy-dos-capas.md`](adr/ADR-0005-proxy-dos-capas.md) | Proxy en dos capas con Durable Object `FeedHub` |

Formato de los ADR: **Contexto / Decisión / Alternativas consideradas / Consecuencias**. Los ADR no se reescriben: si una decisión cambia, se crea uno nuevo que reemplaza al anterior y se marca el estado.

### Fases siguientes (todavía no existen)

| Documento | Fase | Contenido |
|---|---|---|
| `06-proxy.md` | 2 | Rutas, adaptadores, caché y rate limit del Worker |
| `07-app.md` | 3 | Estructura y convenciones de la app |
| `08-design-system.md` | 3 | Componentes Obelisco en React Native |
| `09-testing.md` | 2–4 | Estrategia de tests (Vitest, Jest + RNTL) |
| `10-deploy.md` | 2 y 5 | Despliegue del Worker, EAS Build, CI |

## `PRODUCT.md` y `DESIGN.md` viven en la raíz

[`../PRODUCT.md`](../PRODUCT.md) (audiencia, modo de diseño, plataforma, restricciones) y `../DESIGN.md` (sistema visual, se genera en la Fase 3 a partir de los tokens) **no están en `docs/` a propósito**: el skill de diseño **Impeccable** los lee desde la raíz del proyecto, y si estuvieran acá no los encontraría. Para no perderlos de vista, este índice los enlaza; no se duplican.

- `PRODUCT.md` → **qué** es el producto y para quién (Fase 1, tarea 1.8). Lo escribe `init`.
- `DESIGN.md` → **cómo** se ve (Fase 3, tarea 3.6). Lo genera `extract`/`document` a partir del código y los tokens.

## Convenciones

- **Idioma:** español rioplatense (voseo) en documentación y en el copy de la app; nombres de código y commits convencionales en inglés/español según el caso (`docs:`, `feat:`, …).
- **Citar fuentes:** cada dato externo lleva URL o `archivo:línea`; las cifras de librerías y precios se verifican con Context7 y se anotan en `versiones.md` con fecha.
- **Credenciales:** el `.env` local (`GCBA_CLIENT_ID`, `GCBA_CLIENT_SECRET`) **nunca** se commitea; en documentos y fixtures se usan placeholders (`<ID>`, `<SECRET>`) y se redactan las URLs que los contengan.
- **Descargas grandes** (GTFS, clones) van fuera del repo (por ejemplo `~/.cache/transportate/`).
- **Un documento por tema**, concisos, con enlaces cruzados en vez de copias.
