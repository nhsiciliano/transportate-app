# sofse-probe

Volcado de la **API comunitaria de trenes** (SOFSE / Trenes Argentinos, Fase 6) y captura de las fixtures del adaptador de trenes del proxy.

La fuente es `https://ariedro.dev/api-trenes`: un proxy Express que mantiene una persona, agrega la autenticación de la app oficial de Trenes Argentinos y reenvía a la API interna de SOFSE. No es oficial: no tiene auth, términos ni SLA, y cada pedido tarda 1–2,5 s. Por eso el probe va **de a un pedido**, con **300 ms de pausa** entre pedidos y `User-Agent: transportate-tools/0.1`. No usa credenciales ni lee el `.env`.

## Requisitos

- Node ≥ 22 (usa `fetch` nativo). Sin dependencias: no hace falta `npm install`.

## Uso

```sh
node tools/sofse-probe/probe.mjs              # volcados crudos en ~/.cache/transportate/sofse/
node tools/sofse-probe/probe.mjs --fixtures   # además, las fixtures del proxy
```

| Flag | Efecto |
|---|---|
| `--fixtures` | Escribe además el subconjunto de fixtures en `apps/proxy/test/fixtures/sofse/`. |
| `--base <url>` | Base de la API (default `https://ariedro.dev/api-trenes`), por si la fuente se muda. |
| `--sin-estaciones` | No baja las estaciones de cada ramal (con `--fixtures` igual baja las del ramal 1). |

Tarda ~1 min (37 pedidos). Imprime status, latencia y bytes de cada pedido.

## Qué produce

**Volcados crudos** en `~/.cache/transportate/sofse/` (fuera del repo). Son la entrada del paso `trenes` de `tools/gtfs` (estático de estaciones y ramales):

| Archivo | Endpoint |
|---|---|
| `gerencias.json` | `/infraestructura/gerencias?idEmpresa=1` |
| `ramales-<idGerencia>.json` | `/infraestructura/ramales?idGerencia=<id>` para Roca 11, Sarmiento 1, Mitre 5, San Martín 31, Belgrano Sur 21 y Tren de la Costa 41 |
| `estaciones-<idRamal>.json` | `/infraestructura/estaciones?idRamal=<id>` por cada ramal con `publico: true` |
| `arribos-332.json`, `arribos-50.json`, `arribos-inexistente.json` | `/arribos/estacion/<id>?cantidad=8` (Retiro LGM, Caballito, `999999`) |
| `capturado.json` | Fecha de captura, URL base, cantidad de ramales públicos y de estaciones únicas |

Captura del 2026-11-05: 27 ramales públicos y 262 estaciones únicas.

**Fixtures** (con `--fixtures`) en `apps/proxy/test/fixtures/sofse/`: `gerencias.json`, `ramales.<idGerencia>.json` ×6, `estaciones.ramal=1.json`, `arribos.332.json`, `arribos.50.json` y `arribos.inexistente.json`. Son los cuerpos crudos; ver [`apps/proxy/test/fixtures/README.md`](../../apps/proxy/test/fixtures/README.md).

## Particularidades de la fuente

- Un path desconocido responde **500 con el texto «Not Found»** (no 404).
- `gerencias` con otro `idEmpresa` y `estaciones` sin parámetros devuelven `[]`.
- Una estación inexistente en `arribos` devuelve 200 con `results: []`, igual que una estación sin trenes.
- `visibilidad` es un objeto en `estaciones` y un string con JSON adentro en las cabeceras de `ramales`.
- Supuestos verificados sobre los datos (fechas, efectos GTFS, sentido): [`apps/proxy/src/adapters/trenes/README.md`](../../apps/proxy/src/adapters/trenes/README.md).
