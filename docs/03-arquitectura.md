# 03 — Arquitectura

Cómo está organizado Transportate y por qué. Las decisiones puntuales viven en `adr/`; los números de capacidad y costo, en `04-escalabilidad.md`; lo que se guarda y lo que no, en `05-privacidad.md`.

## 1. Principios

1. **El contrato propio es la única dependencia entre app y backend.** La app nunca conoce el formato del upstream (GTFS-RT, JSON del GCBA); solo el JSON v1 definido en `packages/contracts`.
2. **El upstream queda detrás de un adaptador.** Si la API cambia de versión o se suspende, cambia un adaptador, no la app.
3. **La carga sobre el upstream no depende de la cantidad de usuarios.** Se logra con caché, *coalescing* y, a escala, un único fetcher por feed (ADR-0005).
4. **Lo estático se resuelve en el teléfono.** Búsqueda, paradas cercanas y colores de líneas salen de un índice descargado una vez; no generan carga por consulta.
5. **Privacidad por diseño:** sin cuentas, sin analytics, ubicación solo en memoria.

## 2. Monorepo (pnpm)

Decisión en `adr/ADR-0001-monorepo.md`.

```
Transportate/
├── apps/
│   ├── mobile/        Expo SDK 58 + Expo Router + TypeScript estricto (Fases 3–4)
│   └── proxy/         Cloudflare Worker + Hono (Fase 2; capa B en Fase 5)
├── packages/
│   └── contracts/     esquemas Zod v1 + tipos inferidos (los usan app y proxy)
├── tools/
│   └── gtfs/          preprocesado offline de GTFS → JSON compacto versionado → R2
├── docs/              esta documentación (índice en docs/README.md)
├── PRODUCT.md, DESIGN.md   contexto de diseño para Impeccable (en la raíz a propósito)
└── pnpm-workspace.yaml, .env.example, README.md
```

| Pieza | Qué es | Depende de | Quién la consume |
|---|---|---|---|
| `packages/contracts` | Esquemas Zod del JSON v1, tipos TS inferidos, versión de contrato | `zod` | `apps/proxy` (valida lo que emite), `apps/mobile` (parsea lo que recibe) |
| `apps/proxy` | Worker Hono: rutas `/v1/*`, adaptadores, fuentes con caché, rate limit | `contracts`, `hono`, bindings de Cloudflare | La app |
| `apps/mobile` | App iOS/Android | `contracts`, TanStack Query, MMKV, MapLibre | Personas |
| `tools/gtfs` | Script Node: descarga GTFS (colectivos ≈ 209 MB), filtra a CABA, genera JSON compacto con hash, sube a R2 | `contracts` (tipos del manifiesto estático) | Se ejecuta a mano / por CI; lo sirve el proxy |

Reglas de dependencia: `contracts` no depende de nada del repo; `apps/*` y `tools/*` dependen de `contracts` y **nunca entre sí**.

## 3. Flujo de datos

```
        UPSTREAM (GCBA)                       NUESTRO BACKEND (Cloudflare)                       APP
 ┌──────────────────────────┐        ┌──────────────────────────────────────────┐     ┌────────────────────┐
 │ apitransporte…gob.ar     │        │  Worker Hono  (apps/proxy)               │     │  apps/mobile       │
 │  /colectivos/            │        │                                          │     │                    │
 │    vehiclePositions(.pb) │        │  /v1/colectivos/lineas/:id   ──┐         │     │  TanStack Query    │
 │    vehiclePositionsSimple│        │  /v1/subtes/estado             │         │     │   (polling 20 s,   │
 │  /subtes/forecastGTFS    │ ◄───── │  /v1/subtes/arribos            ▼         │ ◄── │    foreground)     │
 │  /subtes/serviceAlerts   │  fetch │  /v1/transito/cortes     ┌───────────┐   │ JSON│  validación Zod    │
 │  /transito/…             │  con   │  /v1/static/*            │ FeedSource│   │ v1  │  persister MMKV    │
 │  /subtes/feed-gtfs (est.)│ client │  /v1/health              └─────┬─────┘   │     │  favoritos (MMKV)  │
 └──────────────────────────┘ id/    │                                │         │     └─────────┬──────────┘
                              secret │   Adaptador por servicio       │         │               │ (solo local)
                              (solo  │   ┌──────────────────────┐     │         │     ┌─────────▼──────────┐
                              aquí)  │   │ colectivos │ subtes  │ ... │         │     │ índice estático    │
                                     │   │ transito   │ (…)     │     │         │     │ paradas/estaciones │
                                     │   └──────────┬───────────┘     │         │     └─────────▲──────────┘
                                     │              ▼                 ▼         │               │ descarga única
                                     │     upstream → modelo interno → contrato Zod v1          │ (ETag, versión)
                                     │                                          │               │
                                     │  Capa A (MVP):  Cache API por colo +     │      ┌────────┴─────────┐
                                     │                 coalescing + SWR         │      │ R2: JSON estático│
                                     │  Capa B (Fase 5): DO FeedHub (alarm) ──► │ ◄─── │ versionado (hash)│
                                     │                 slices por línea         │      └──────────────────┘
                                     └──────────────────────────────────────────┘
                                                                     ▲
                                                tools/gtfs (offline) ┘ genera y sube
```

Camino de una request de tiempo real (por ejemplo, posiciones de la línea 60):

1. La app (`useQuery` con `refetchInterval`) pide `GET /v1/colectivos/lineas/60`.
2. El Worker aplica rate limit y busca en caché (Cache API del colo; en capa B, sale del slice del DO).
3. Si no hay dato fresco, `FeedSource` trae el feed del upstream (con `client_id`/`client_secret` desde *secrets*), una sola vez aunque lleguen muchas requests a la vez (*coalescing*).
4. El **adaptador** decodifica (Protobuf o JSON), filtra, normaliza y emite el modelo del **contrato Zod v1** con `generatedAt` (cuándo lo armó el proxy) y `sourceTimestamp` (la hora del dato original).
5. La app valida con el mismo esquema Zod y muestra el dato con "hace X s". Si el proxy responde `stale`, error o no hay red, la UI muestra el último dato bueno marcado como no actualizado.

## 4. Patrón adaptador por servicio

Cada servicio del upstream se encapsula en tres piezas con responsabilidad única:

| Pieza | Responsabilidad | Ejemplo (colectivos) | No hace |
|---|---|---|---|
| **Fuente** (`FeedSource`) | Obtener bytes/JSON del upstream **con caché, TTL, coalescing y credenciales**. Devuelve el cuerpo crudo + metadatos (hora de obtención, si es `stale`). | `ColectivosPositionsSource` (TTL 15–30 s) | Interpretar el contenido |
| **Adaptador** (`*Adapter`) | Traducir upstream → contrato: decodificar, filtrar por línea/bbox, normalizar nombres e IDs, derivar estados. Funciones puras, testeables con fixtures reales. | `ColectivosAdapter.positionsByLine(raw, lineId)` | Hacer I/O ni cachear |
| **Ruta** (`routes/v1/*`) | Exponer el contrato: validar parámetros, llamar fuente + adaptador, fijar `Cache-Control`/ETag, errores tipados. | `GET /v1/colectivos/lineas/:id` | Conocer el formato del upstream |

Estructura prevista dentro de `apps/proxy/src/`:

```
index.ts                 app Hono, middlewares (rate limit, cache headers)
routes/v1/               colectivos.ts · subtes.ts · transito.ts · static.ts · health.ts
adapters/<servicio>/     *.ts (puro) + tipos del upstream
sources/                 FeedSource, ColectivosSource, SubtesSource… (+ FeedHubSource en capa B)
cache/                   utilidades de Cache API, claves, coalescing
ratelimit/               envoltorio del binding nativo
```

### Cómo se agrega un servicio nuevo (por ejemplo trenes o Ecobici)

1. **Investigar y documentar.** Probar el endpoint con las credenciales, registrar status, formato, tamaño y frecuencia de actualización en `docs/01-api-transporte.md`; guardar un fixture real en `apps/proxy/test/fixtures/`. *(En el RAML actual hay un recurso `/ecobici/gbfs`; no hay un recurso de trenes: antes de prometer trenes hay que confirmar que exista una fuente.)*
2. **Definir el contrato.** Agregar los esquemas Zod en `packages/contracts` (campos cortos, `generatedAt`, `sourceTimestamp`) y subir la versión menor del contrato si es aditivo; un cambio incompatible crea `/v2`.
3. **Escribir el adaptador** como funciones puras con tests Vitest contra el fixture.
4. **Crear la fuente** con su TTL (según la frecuencia del feed) y registrarla en el contenedor de fuentes.
5. **Exponer la ruta** `/v1/<servicio>/…` con ETag y `Cache-Control` coherentes con el TTL.
6. **Sumar a la app** una feature en `features/<servicio>/` que consuma el cliente tipado de `shared/api` (nunca el upstream).
7. **Actualizar documentación:** `01-api-transporte.md`, `06-proxy.md` (cuando exista), `04-escalabilidad.md` si cambia la cantidad de feeds, y la bitácora.
8. **Capa B:** si el feed es grande o muy consultado, agregar su `FeedHub` (un DO por feed); no hace falta tocar rutas ni app.

## 5. Contrato Zod v1

- **Campos cortos** para achicar payloads (el teléfono paga por byte y por batería).
- Todo recurso de tiempo real incluye **`generatedAt`** y **`sourceTimestamp`**; la app calcula frescura y *staleness* con ellos.
- Los errores son **tipados** (`code`, `retryable`) para distinguir "sin servicio" de "pedido inválido".
- Versionado por prefijo de ruta (`/v1`) + versión semántica del paquete `contracts`. Los cambios aditivos no rompen clientes viejos; los incompatibles crean `/v2` y conviven.
- Tanto el proxy (al emitir, en tests) como la app (al recibir) validan con el mismo esquema: si el upstream cambia y un adaptador deja de cumplir el contrato, falla el test, no la pantalla.

## 6. Datos estáticos

`tools/gtfs` convierte los GTFS estáticos (colectivos ≈ 209 MB; subtes ≈ 48 KB) en JSON compacto filtrado a CABA, versionado por hash, y lo sube a **R2**. El Worker lo sirve en `/v1/static/*` con `Cache-Control` largo y ETag. La app lo descarga una vez, lo persiste y resuelve búsqueda y paradas cercanas **sin red** (ver ADR-0003). En la app, Colectivos usa `paradas.json` y `lineas-colectivos.json`, guardados en MMKV por archivo con una sola versión y fuera de la caché de TanStack Query (`07-app.md` §14 y §19). `indice-colectivos.json` lo usa solo el proxy. Los colores de línea de subte salen de este preprocesado (`02b-colores-subte.md`).

## 7. App (resumen)

- **Navegación:** Expo Router; tabs Inicio, Colectivos, Subtes, Tránsito, Favoritos; Ajustes y Acerca de como stack.
- **Datos:** TanStack Query v5, polling con jitter solo en primer plano (`focusManager` + `AppState`), `onlineManager` con NetInfo, persister en MMKV.
- **Almacenamiento:** MMKV detrás de `FavoritosRepository` (ADR-0003).
- **Mapa:** MapLibre (ADR-0002). **Íconos:** SVG de Material Symbols (ADR-0004).
- **Tema:** tokens de Obelisco v2 con modo claro/oscuro (`02-obelisco-tokens.md`).

## 8. Despliegue (visión)

- **Proxy:** Cloudflare Workers (plan Free al inicio; ver `04-escalabilidad.md` para el momento de pasar a Paid). Secretos con `wrangler secret`; el `.env` local nunca se versiona.
- **Estático:** bucket R2 detrás del Worker.
- **App:** EAS Build (dev client, preview, production). No hay Expo Go (MapLibre y MMKV son módulos nativos).
- **CI:** GitHub Actions con lint, typecheck y tests de ambas apps.

## 9. Riesgos de arquitectura

| Riesgo | Mitigación |
|---|---|
| Upstream suspendido o inestable | Adaptadores aislados; último dato bueno con `stale`; estado "servicio no disponible" en la UI |
| Un feed deja de existir (arribos de colectivos) | La función se omite; no se promete en la UI |
| Caché frío por colo (Cache API no replica entre centros de datos) | TTL con SWR; en capa B el DO sirve de fuente común |
| Cambio de formato del upstream | Falla un test del adaptador con fixtures, no la app |
