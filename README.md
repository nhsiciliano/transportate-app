# Transportate

App móvil (iOS y Android, Expo) con **colectivos, subte y tránsito de CABA en tiempo real**, sin cuentas, sin analytics y con la ubicación solo en el teléfono. Un proxy en Cloudflare Workers esconde las credenciales del GCBA, cachea y le entrega a la app un contrato JSON propio.

**Estado: Fase 3 (base de la app) cerrada técnicamente el 2026-11-02, pendiente de validación; Fase 4 (features) sin iniciar.** El proxy (Fase 2) tiene las rutas `/v1/*` con caché, rate limit, estáticos desde R2 y los adaptadores de subte y colectivos, con los contratos v1 en `packages/contracts`. `apps/mobile` tiene la base de la app: Expo SDK 58 con Expo Router, cuatro tabs nativas (Inicio, Colectivos, Subtes, Favoritos) con Ajustes y Acerca de como stack, tema Obelisco claro y oscuro, fuentes Nunito y Open Sans, íconos Material Symbols, 15 componentes compartidos, cliente API tipado con TanStack Query y favoritos y preferencias guardados en el teléfono con MMKV. Las pantallas son placeholders y todavía no consumen el proxy; falta probar en un dev build real (simulador o dispositivo). Los assets de marca están en `design/brand/` y enchufados en la config de Expo. Hay 432 tests (contracts 67, proxy 87, app 278). Plan y fases: [`docs/00-plan.md`](docs/00-plan.md); qué se hizo en cada fase: [`docs/bitacora.md`](docs/bitacora.md).

## Estructura del repo

| Carpeta | Qué hay |
|---|---|
| [`apps/mobile/`](apps/mobile/README.md) | App iOS/Android con Expo SDK 58 y Expo Router (base de la Fase 3 lista; features en la Fase 4). |
| [`apps/proxy/`](apps/proxy/README.md) | Worker de Cloudflare con Hono 4: rutas `/v1/*`, adaptadores, caché, rate limit, estáticos desde R2. |
| `packages/contracts/` | Esquemas Zod 4 del JSON v1 y tipos compartidos entre proxy y app. |
| [`tools/`](tools/README.md) | Herramientas de investigación y preprocesado (paquetes npm sueltos, fuera del workspace pnpm). |
| [`docs/`](docs/README.md) | Toda la documentación: plan, API, arquitectura, escalabilidad, privacidad, ADR, bitácora. |
| `PRODUCT.md` | Contexto de producto y diseño (lo lee el skill Impeccable desde la raíz). |

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

## Paquete estático (paradas, líneas, subte)

La búsqueda y las paradas cercanas se resuelven en el teléfono contra JSON preprocesado que sirve el proxy desde R2. Lo genera `tools/gtfs`, que es un paquete npm standalone:

```sh
cd tools/gtfs
npm install
npm run build        # genera out/ (JSON versionado + manifest.json); necesita las entradas en ~/.cache/transportate/
./upload-r2.sh       # sube out/ al bucket R2 (requiere wrangler login; DRY_RUN=1 para ensayar)
```

Las entradas necesarias, las salidas y las decisiones están en [`tools/gtfs/README.md`](tools/gtfs/README.md).

## Despliegue

Proxy en Cloudflare Workers con entornos `preview` y `production`, buckets R2 y secrets: [`docs/10-deploy.md`](docs/10-deploy.md). Cuánto aguanta cada plan de Cloudflare y cuánto cuesta escalar: [`docs/04-escalabilidad.md`](docs/04-escalabilidad.md).

## Privacidad

Sin cuentas, sin analytics, sin tracking; los favoritos y la ubicación no salen del teléfono; el Worker no persiste IPs ni loguea datos identificables. Detalle en [`docs/05-privacidad.md`](docs/05-privacidad.md).

## Datos y atribución

Los datos de transporte provienen de los datos abiertos del **Gobierno de la Ciudad de Buenos Aires** ([API Transporte](https://apitransporte.buenosaires.gob.ar/) y [BA Data](https://data.buenosaires.gob.ar/)), publicados bajo licencia [**CC BY 2.5 AR**](https://creativecommons.org/licenses/by/2.5/ar/): se reconoce autoría, fuente y licencia. Transportate es un proyecto independiente: no está desarrollado ni respaldado por el GCBA. El mapa base usa datos de OpenStreetMap (atribución en la app, ver [`docs/05-privacidad.md`](docs/05-privacidad.md)).

## Licencia

**A definir por el usuario.** Hasta que se decida, el código no tiene licencia de uso asignada.
