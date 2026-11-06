# Transportate

App móvil (iOS y Android, Expo) con **colectivos, subte y trenes del área metropolitana de Buenos Aires en tiempo real**, sin cuentas, sin analytics y con la ubicación solo en el teléfono. Un proxy en Cloudflare Workers esconde las credenciales del GCBA, cachea, aísla las fuentes y le entrega a la app un contrato JSON propio.

**Estado (2026-11-06): Fase 6 (Trenes) integrada en `main`, pendiente de la prueba del usuario en el iPhone; Fase 5 (rediseño «Señalética de terminal») mergeada y validada en el teléfono, a falta de la revisión final de diseño.** La app tiene cuatro tabs nativas, Inicio, Colectivos, Subtes y Trenes, y Favoritos se abre con la estrella del header de Inicio. Inicio muestra el estado del subte y los favoritos con dato vivo; Subtes tiene raíz, línea, estación y mapa de la red; Colectivos, búsqueda local, paradas cercanas, parada y línea con mapa en tiempo real; Trenes, tablero de las 6 líneas de Trenes Argentinos (Roca, Sarmiento, Mitre, San Martín, Belgrano Sur y Tren de la Costa), ramales, estaciones con arribos por destino y favoritos de ramal y estación; Favoritos, con alias, Deshacer, búsqueda y reorden por arrastre; y Ajustes, Acerca de y Licencias. Tema Obelisco claro y oscuro, Fira Sans, MapLibre, MMKV. Tránsito sigue oculto (no hay fuente de cortes). Hay 1.154 tests (contratos 116, proxy 130, `tools/gtfs` 104, app 804). El paquete estático (versión `6abe94f97629`) ya está en R2; el Worker todavía no está desplegado. La guía de prueba en el teléfono está en [`docs/11-prueba-manual.md`](docs/11-prueba-manual.md). Plan y fases: [`docs/00-plan.md`](docs/00-plan.md); qué se hizo en cada fase: [`docs/bitacora.md`](docs/bitacora.md).

## Estructura del repo

| Carpeta | Qué hay |
|---|---|
| [`apps/mobile/`](apps/mobile/README.md) | App iOS/Android con Expo SDK 58 y Expo Router: features por carpeta en `src/features/` (inicio, colectivos, subtes, trenes, favoritos, ajustes) y UI compartida en `src/shared/`. |
| [`apps/proxy/`](apps/proxy/README.md) | Worker de Cloudflare con Hono 4: rutas `/v1/*` (subtes, colectivos, trenes, estáticos), adaptadores por fuente, caché, rate limit, R2. |
| `packages/contracts/` | Esquemas Zod 4 del JSON v1 (incluidos trenes y el paquete estático) y tipos compartidos entre proxy y app. |
| [`tools/`](tools/README.md) | Herramientas de investigación y preprocesado (paquetes npm sueltos, fuera del workspace pnpm): `gtfs` (paquete estático), `sofse-probe` (volcados de la fuente de trenes), `contraste`, etc. |
| [`docs/`](docs/README.md) | Toda la documentación: plan, API, arquitectura, escalabilidad, privacidad, ADR, bitácora. |
| `PRODUCT.md`, `DESIGN.md` | Contexto de producto y sistema de diseño (los lee el skill Impeccable desde la raíz; los contratos de dirección por pantalla están en `apps/mobile/.impeccable/surfaces/`). |

El workspace pnpm incluye solo `apps/*` y `packages/*` (`pnpm-workspace.yaml`).

## Requisitos

- **Node 24** (`engines` del `package.json` raíz).
- **pnpm 12**: la versión exacta está en el campo `packageManager` del `package.json` raíz. Con Corepack: `corepack enable` y pnpm toma esa versión solo.
- Una **cuenta de Cloudflare** (el plan Free alcanza para empezar) para desplegar. Para desarrollar local no hace falta.
- **Credenciales de la API Transporte del GCBA** (`client_id` y `client_secret`), ver el paso 2.

## Setup

```sh
# 1. Dependencias del workspace (apps/* y packages/*)
pnpm install

# 2. Credenciales de la API Transporte
#    Se solicitan en https://apitransporte.buenosaires.gob.ar/ (la consola de la API está en /console/);
#    el sitio define el paso a paso vigente. Te dan un client_id y un client_secret.
cp .env.example .env                           # lo leen las herramientas de tools/*
cp .dev.vars.example apps/proxy/.dev.vars      # lo lee el Worker con `wrangler dev`
#    Completá GCBA_CLIENT_ID y GCBA_CLIENT_SECRET en los dos archivos.
```

`.env` y `apps/proxy/.dev.vars` están en `.gitignore`: **nunca se commitean** y nunca se pegan en docs, tests ni logs. En producción las credenciales van como secrets de Workers (`wrangler secret put`), ver [`docs/10-deploy.md`](docs/10-deploy.md).

## Cómo correr

Desde la raíz del repo:

```sh
pnpm test                                # Vitest de todos los paquetes (el proxy corre dentro de workerd)
pnpm lint                                # ESLint
pnpm typecheck                           # tsc --noEmit
pnpm format:check                        # Prettier (pnpm format escribe los cambios)
pnpm --filter transportate-proxy dev     # wrangler dev → http://localhost:8787/v1
```

Más comandos del proxy (regenerar tipos, rutas, caché, rate limit): [`apps/proxy/README.md`](apps/proxy/README.md). Estrategia de tests: [`docs/09-testing.md`](docs/09-testing.md).

## Cómo correr la app

La app (`apps/mobile`) usa un dev client de Expo, no Expo Go. Con Xcode o Android Studio instalados:

```sh
pnpm install                                  # desde la raíz
pnpm --filter transportate-proxy dev          # proxy local en :8787 (opcional por ahora)
cd apps/mobile && pnpm ios                    # o: pnpm android
```

La guía completa está en [`apps/mobile/README.md`](apps/mobile/README.md): builds con EAS, la variable `EXPO_PUBLIC_API_URL`, los tests y la estructura de rutas.

## Paquete estático (paradas, líneas, subte, trenes)

La búsqueda y las paradas cercanas se resuelven en el teléfono contra JSON preprocesado que sirve el proxy desde R2. Lo genera `tools/gtfs`, que es un paquete npm standalone:

```sh
cd tools/gtfs
npm install
npm run build        # genera out/ (JSON versionado + manifest.json); necesita las entradas en ~/.cache/transportate/
./upload-r2.sh       # sube out/ al bucket R2 (requiere wrangler login; DRY_RUN=1 para ensayar)
```

Los archivos de trenes (`trenes-lineas.json`, `trenes-estaciones.json`) salen de los volcados que hace `tools/sofse-probe` de la fuente de trenes; los colores de las líneas están en [`docs/02c-colores-trenes.md`](docs/02c-colores-trenes.md). Las entradas necesarias, las salidas y las decisiones están en [`tools/gtfs/README.md`](tools/gtfs/README.md).

## Despliegue

Proxy en Cloudflare Workers con entornos `preview` y `production`, buckets R2 y secrets: [`docs/10-deploy.md`](docs/10-deploy.md). Cuánto aguanta cada plan de Cloudflare y cuánto cuesta escalar: [`docs/04-escalabilidad.md`](docs/04-escalabilidad.md).

## Privacidad

Sin cuentas, sin analytics, sin tracking; los favoritos y la ubicación no salen del teléfono; el Worker no persiste IPs ni loguea datos identificables. Detalle en [`docs/05-privacidad.md`](docs/05-privacidad.md).

## Datos y atribución

Los datos de colectivos y subte provienen de los datos abiertos del **Gobierno de la Ciudad de Buenos Aires** ([API Transporte](https://apitransporte.buenosaires.gob.ar/) y [BA Data](https://data.buenosaires.gob.ar/)), publicados bajo licencia [**CC BY 2.5 AR**](https://creativecommons.org/licenses/by/2.5/ar/): se reconoce autoría, fuente y licencia. Los datos de trenes son de **Trenes Argentinos (SOFSE)** y llegan a través de una [API comunitaria no oficial](https://github.com/ariedro/api-trenes), sin términos ni garantía de servicio (evaluación y riesgos en [`docs/01d-api-trenes-sofse.md`](docs/01d-api-trenes-sofse.md)). Transportate es un proyecto independiente: no está desarrollado ni respaldado por el GCBA ni por Trenes Argentinos. El mapa base usa datos de OpenStreetMap (atribución en la app, ver [`docs/05-privacidad.md`](docs/05-privacidad.md)).

## Licencia

**A definir por el usuario.** Hasta que se decida, el código no tiene licencia de uso asignada.
