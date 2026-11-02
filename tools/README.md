# Herramientas (`tools/`)

Scripts de investigación y preprocesado de Transportate. **No forman parte del workspace pnpm** (`pnpm-workspace.yaml` solo incluye `apps/*` y `packages/*`): cada carpeta es un paquete **npm standalone** con su propio `package.json` (salvo `contraste`, que es un script de Python sin dependencias). Por eso `pnpm install`, `pnpm test` y `pnpm lint` de la raíz **no** los tocan; se corren desde su carpeta.

## Reglas comunes

1. **npm standalone, fuera del workspace pnpm.** `npm install` dentro de la carpeta (en las de investigación, con `--no-package-lock` para no ensuciar el repo; `tools/gtfs` sí versiona su `package-lock.json`). Node ≥ 22 (`tools/gtfs` pide ≥ 24).
2. **Credenciales en el `.env` de la raíz** (`GCBA_CLIENT_ID`, `GCBA_CLIENT_SECRET`; plantilla en [`../.env.example`](../.env.example)). El `.env` está en `.gitignore`. Las credenciales viajan en la query de la API, así que **ninguna herramienta imprime, loguea ni guarda una URL de la API sin redactarla**.
3. **Datos grandes fuera del repo**, en `~/.cache/transportate/` (GTFS en `gtfs/`, capturas en `capturas/`). No se commitean archivos de más de 5 MB.
4. **`User-Agent: transportate-tools/0.1`** en todo request, y **sin datos personales** (ni emails ni nombres) en headers, logs, fixtures ni salidas.
5. **Español rioplatense** en comentarios y mensajes; identificadores de código en inglés.

## Tabla

| Herramienta | Propósito | Entradas | Salidas | Comando (desde su carpeta) |
|---|---|---|---|---|
| [`api-probe`](api-probe/README.md) | Sondeo empírico de todos los endpoints de la API (status, bytes, latencia, cadencia, fallos) y captura de fixtures. Resultados: [`docs/01-api-transporte.md`](../docs/01-api-transporte.md) | API con credenciales; `~/.cache/transportate/gtfs/` para los zips | `last-run.json` (sin credenciales); fixtures en `apps/proxy/test/fixtures/`; GTFS en `~/.cache/transportate/gtfs/` | `npm install --no-package-lock && node probe.mjs` (flags: `--no-download`, `--no-fixtures`, `--samples=N`, `--interval=S`, `--only=a,b`, `--watch=S`) |
| [`gtfs-cruce`](gtfs-cruce/README.md) | Cruza GTFS y datasets de paradas candidatos con los IDs del tiempo real de colectivos. Resultados: [`docs/01b-gtfs-alternativos.md`](../docs/01b-gtfs-alternativos.md) | Fuentes en `~/.cache/transportate/gtfs/` (o `GTFS_CACHE`); fixtures de tiempo real | Tabla en consola y `last-run.json`. No usa credenciales ni descarga nada | `npm install && npm run cruce` (necesita `unzip` en el PATH) |
| [`captura-posiciones`](captura-posiciones/README.md) | Captura continua de `vehiclePositions` (cada ~60 s) y muestras de `tripUpdates` (cada ~10 min) para medir la cobertura de `stop_id` | API con credenciales | `posiciones-YYYY-MM-DD.csv.gz`, `viajes-YYYY-MM-DD.csv.gz`, `captura.log` y `captura.pid` en `~/.cache/transportate/capturas/` | `npm install --no-package-lock`, luego `./start.sh`, `./status.sh`, `./stop.sh` (prueba puntual: `node captura.mjs --once`) |
| [`gtfs`](gtfs/README.md) | Preprocesa paradas oficiales BA, líneas, subte, equivalencias `stop_id → parada` y recorridos a JSON compacto, validado con Zod y versionado por hash, para servir desde R2 en `/v1/static/*` | Paradas BA y GTFS en `~/.cache/transportate/gtfs/`; fixtures de tiempo real; capturas en `~/.cache/transportate/capturas/` (opcional) | `gtfs/out/` (no se commitea) con `manifest.json`; estadísticas en `out/last-build.json` | `npm install && npm run build`; `npm run check` (typecheck + lint + prettier + tests); `./upload-r2.sh` sube a R2 (`DRY_RUN=1` para ensayar) |
| [`contraste`](contraste/contraste.py) | Verifica contraste WCAG 2.x de las paletas de Obelisco (clara vigente, oscura derivada e histórica de referencia). Resultados: [`docs/02-obelisco-tokens.md`](../docs/02-obelisco-tokens.md) | Pares de colores definidos en el propio script (los contrastes de las líneas de subte están en `docs/02b-colores-subte.md`) | Tablas Markdown por consola | `python3 contraste.py` (`--check` sale con código 1 si falla un par exigible de la paleta oscura) |

`gtfs` es el único con tests propios y TypeScript estricto (Vitest, ESLint, Prettier): se valida con `npm run check` dentro de su carpeta. El resto son scripts de uso puntual sin suite de tests.

## Estado de la captura de posiciones

Medido el **2026-11-02 a las 00:09 UTC** (2026-11-01 21:09 hora de Buenos Aires) con `captura-posiciones/status.sh`. La captura se lanzó el 2026-11-01 a las 23:31 UTC y el objetivo es que corra **24–48 h**, así que esta cifra es solo un instante:

| | |
|---|---|
| Proceso | PID 41628, vivo, hace 38 min |
| `vehiclePositions` | 33 snapshots ok, 2 fallidos (≈ 5.300 vehículos y ≈ 530 KB cada uno) |
| `tripUpdates` | 3 snapshots ok, 1 fallido (≈ 1.200 viajes y ≈ 28.000 filas muestreadas cada uno) |
| En disco | 6,0 MB (`posiciones-2026-11-01.csv.gz` 4,6 MB y `viajes-2026-11-01.csv.gz` 849 KB) |

Para la cifra actual: `./captura-posiciones/status.sh` (cuenta por día UTC del log; los archivos usan el día de Buenos Aires). Si la máquina se duerme o se cierra la tapa, la captura queda con huecos que se ven en `captura.log`. Formato de los CSV: [`captura-posiciones/README.md`](captura-posiciones/README.md). Las capturas alimentan el aprendizaje de la tabla de equivalencias de `gtfs` (ver [ADR-0006](../docs/adr/ADR-0006-paradas-colectivos.md)); `gtfs/README.md` documenta con cuánta captura se generó cada build.
