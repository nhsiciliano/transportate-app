// Preprocesado de datos estáticos → tools/gtfs/out/ (JSON compacto, validado con Zod, versionado).
//
// Uso:  npm run build                      todo
//       npm run build -- --solo paradas    solo algunos pasos (coma): paradas, lineas, equivalencias,
//                                          subte, recorridos, trenes. El manifest se regenera siempre con lo
//                                          que haya en out/.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import {
  CAPTURAS_DIR,
  FUENTES,
  INPUTS,
  OUT_DIR,
  OUTPUT_FILES,
  PARAMS,
  type OutputFile,
} from './config.js';
import {
  listCapturas,
  learnFromCapturas,
  type CapturasStats,
  type LearnedStop,
} from './lib/capturas.js';
import { eachCsvRow, openCsv } from './lib/csv.js';
import { AreaMask, isValidCoord, type LatLon } from './lib/geo.js';
import { sha256 } from './lib/hash.js';
import { readTripUpdates, readVehiclePositions, readVehiclePositionsSimple } from './lib/rt.js';
import { listZip, openZipEntry } from './lib/zip.js';
import {
  SCHEMAS,
  validate,
  type LineaColectivo,
  type Manifest,
  type Parada,
  type Validator,
} from './schemas.js';
import { buildEquivalencias, buildParadaGrid, toPublished } from './steps/equivalencias.js';
import { buildIndice } from './steps/indice.js';
import { buildLineas } from './steps/lineas.js';
import { buildParadas } from './steps/paradas.js';
import { buildRecorridos } from './steps/recorridos.js';
import { buildSubte, readSubteInput } from './steps/subte.js';
import { buildTrenes, fuenteSofse } from './steps/trenes.js';

const STEPS = ['paradas', 'lineas', 'equivalencias', 'subte', 'recorridos', 'trenes'] as const;
type Step = (typeof STEPS)[number];

const { values } = parseArgs({ options: { solo: { type: 'string' } }, allowPositionals: false });
const solo: Set<Step> = values.solo
  ? new Set(
      values.solo.split(',').map((s) => {
        const step = STEPS.find((x) => x === s.trim());
        if (!step)
          throw new Error(`--solo: paso desconocido "${s}". Opciones: ${STEPS.join(', ')}`);
        return step;
      }),
    )
  : new Set(STEPS);

const report: Record<string, unknown> = { inicio: new Date().toISOString(), pasos: [...solo] };
const tiempos: Record<string, number> = {};
const omitidos: Record<string, string> = {};

function requireInput(path: string): string {
  if (!existsSync(path))
    throw new Error(`Falta la entrada ${path} (ver tools/gtfs/README.md, "Entradas")`);
  return path;
}

async function timed<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const t0 = performance.now();
  const r = await fn();
  tiempos[name] = Math.round(performance.now() - t0);
  console.log(`  ✓ ${name} (${(tiempos[name] / 1000).toFixed(1)} s)`);
  return r;
}

/** Valida contra el esquema y escribe JSON compacto. Falla el build si no valida. */
function schemaFor(file: string): Validator {
  const schema = SCHEMAS[file];
  if (!schema) throw new Error(`${file}: sin esquema`);
  return schema;
}

function writeOutput(file: OutputFile, data: unknown): number {
  const errors = validate(schemaFor(file), data);
  if (errors.length) {
    throw new Error(`${file} no valida contra su contrato:\n${errors.join('\n')}`);
  }
  const json = JSON.stringify(data);
  writeFileSync(join(OUT_DIR, file), json);
  return Buffer.byteLength(json);
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(
    `tools/gtfs → ${relative(process.cwd(), OUT_DIR) || '.'} (pasos: ${[...solo].join(', ')})`,
  );
  const need = (s: Step): boolean => solo.has(s);
  const needParadas =
    need('paradas') || need('lineas') || need('equivalencias') || need('recorridos');
  const needLineas = need('lineas') || need('equivalencias');

  // ---------------------------------------------------------------- paradas BA
  let paradas: Parada[] = [];
  if (needParadas) {
    const r = await timed('paradas', () => buildParadas(openCsv(requireInput(INPUTS.baParadas))));
    paradas = r.paradas;
    report.paradas = r.stats;
    if (need('paradas')) {
      report.paradasBytes = writeOutput('paradas.json', {
        version: 1,
        fuente: FUENTES.baParadas.url,
        paradas,
      });
    }
  }
  // Máscara de CABA a partir de las paradas oficiales (ver AreaMask).
  const mask = paradas.length ? new AreaMask(paradas) : null;
  const inCaba = (lat: number, lon: number): boolean => (mask ? mask.has(lat, lon) : false);

  // ---------------------------------------------------------------- líneas (tiempo real)
  const routeNumero = new Map<string, number>();
  let lineasEstaticas: LineaColectivo[] = [];
  if (needLineas) {
    const r = await timed('lineas', () => {
      const vehicles = readVehiclePositionsSimple(requireInput(INPUTS.vehiclePositionsSimple));
      return buildLineas(vehicles, inCaba);
    });
    report.lineas = r.stats;
    lineasEstaticas = r.lineas;
    for (const l of r.lineas) if (l.numero !== null) routeNumero.set(l.lineaId, l.numero);
    if (need('lineas')) {
      report.lineasBytes = writeOutput('lineas-colectivos.json', {
        version: 1,
        fuente: '/colectivos/vehiclePositionsSimple (fixture)',
        nota: 'Semilla offline. En runtime el proxy regenera este diccionario desde el feed en cada lectura: los route_id se reasignan sin aviso; unir siempre por empresa + número, nunca por route_id.',
        capturadoEn: FUENTES.tiempoReal.fecha,
        lineas: r.lineas,
      });
    }
  }

  // ---------------------------------------------------------------- equivalencias stop_id → parada
  if (need('equivalencias')) {
    const zip = requireInput(INPUTS.colectivosGtfs);
    const entries = listZip(zip);
    const stops2021 = await timed('equivalencias: stops.txt 2021', async () => {
      const m = new Map<string, LatLon>();
      await eachCsvRow(openZipEntry(zip, 'stops.txt', entries), (s) => {
        const lat = Number(s.stop_lat);
        const lon = Number(s.stop_lon);
        if (s.stop_id && isValidCoord(lat, lon)) m.set(s.stop_id, { lat, lon });
      });
      return m;
    });
    const capturas = listCapturas(CAPTURAS_DIR);
    let learned = new Map<string, LearnedStop>();
    let capStats: CapturasStats | { archivos: string[]; nota: string } = {
      archivos: [],
      nota: `sin capturas en ${CAPTURAS_DIR.replace(homedir(), '~')}: solo semilla GTFS 2021`,
    };
    if (capturas.length) {
      const r = await timed('equivalencias: capturas', () =>
        learnFromCapturas(
          capturas,
          {
            grid: buildParadaGrid(paradas),
            routeNumero,
            radiusM: PARAMS.matchRadiusM,
            minVotos: PARAMS.minVotos,
          },
          new Map(paradas.map((p) => [p.id, { lat: p.lat, lon: p.lon }])),
        ),
      );
      learned = r.learned;
      capStats = { ...r.stats, archivos: r.stats.archivos.map((f) => relative(CAPTURAS_DIR, f)) };
    }
    report.capturas = capStats;
    const r = await timed('equivalencias', () =>
      buildEquivalencias({
        stops2021,
        vehicles: readVehiclePositions(requireInput(INPUTS.vehiclePositions)),
        trips: readTripUpdates(requireInput(INPUTS.tripUpdates)),
        routeNumero,
        paradas,
        inCaba,
        learned,
        matchRadiusM: PARAMS.matchRadiusM,
        maxReporterDistanceM: PARAMS.maxReporterDistanceM,
        minVotos: PARAMS.minVotos,
      }),
    );
    const publicadas = toPublished(r.equivalencias);
    // Las filas sin parada BA no se publican (la app no puede usarlas); solo se cuentan.
    report.equivalencias = {
      ...r.stats,
      publicadas: publicadas.length,
      noPublicadasSinParada: r.equivalencias.length - publicadas.length,
    };
    report.equivalenciasBytes = writeOutput('equivalencias-paradas.json', {
      version: 1,
      metodo:
        'docs/01b-gtfs-alternativos.md §4 + tools/gtfs/README.md: coordenada GTFS 2021 del stop_id (validada a ≤ 1 km de los vehículos que lo informan) → parada BA más cercana a ≤ 40 m que comparta número de línea; las capturas votan por parada en cada pasada del vehículo (transición de stop_id) y confirman o corrigen la semilla. origen ajustada-ba = semilla 2021 ajustada a parada BA; aprendida = parada elegida por las capturas. Solo se publican las filas con parada BA.',
      equivalencias: publicadas,
    });
    // Índice compacto para el proxy (sale de paradas + líneas + equivalencias de esta corrida).
    const ix = buildIndice(paradas, lineasEstaticas, publicadas);
    report.indice = ix.stats;
    report.indiceBytes = writeOutput('indice-colectivos.json', ix.indice);
  }

  // ---------------------------------------------------------------- subte
  if (need('subte')) {
    const zip = requireInput(INPUTS.subtesGtfs);
    const entries = listZip(zip);
    const r = await timed('subte', async () =>
      buildSubte(await readSubteInput((f) => openZipEntry(zip, f, entries))),
    );
    report.subte = r.stats;
    report.subteBytes = {
      lineas: writeOutput('subte-lineas.json', {
        version: 1,
        fuente: FUENTES.subtesGtfs.url,
        feedEndDate: r.stats.feedEndDate,
        lineas: r.lineas,
      }),
      estaciones: writeOutput('subte-estaciones.json', {
        version: 1,
        fuente: FUENTES.subtesGtfs.url,
        estaciones: r.estaciones,
      }),
      red: writeOutput('subte-red.geojson', r.red),
    };
  }

  // ---------------------------------------------------------------- trenes (volcados de tools/sofse-probe)
  if (need('trenes')) {
    const dir = requireInput(INPUTS.sofseDir);
    const r = await timed('trenes', () => buildTrenes(dir));
    report.trenes = {
      lineas: r.stats.lineas,
      ramales: r.stats.ramales,
      estaciones: r.stats.estaciones,
      filasDeEstacion: r.stats.filasDeEstacion,
      descartadas: r.stats.descartadas,
      sinAppMobile: r.stats.sinAppMobile,
      cabecerasNoCoinciden: r.stats.cabecerasNoCoinciden,
      estacionesDeRamalNoPublicadas: r.stats.estacionesDeRamalNoPublicadas,
    };
    for (const d of r.stats.descartadas)
      console.warn(
        `  ! trenes: estación ${d.id} (${d.nombre}) con coordenada inválida: descartada`,
      );
    for (const c of r.stats.cabecerasNoCoinciden)
      console.warn(
        `  ! trenes: ramal ${c.ramalId} (${c.nombre}) no empieza/termina en sus cabeceras (el upstream devuelve la lista incompleta)`,
      );
    report.trenesBytes = {
      lineas: writeOutput('trenes-lineas.json', r.lineas),
      estaciones: writeOutput('trenes-estaciones.json', r.estaciones),
    };
  }

  // ---------------------------------------------------------------- recorridos (opcional)
  if (need('recorridos')) {
    const zip = requireInput(INPUTS.colectivosGtfs);
    const entries = listZip(zip);
    const r = await timed('recorridos', () =>
      buildRecorridos(
        {
          routes: openZipEntry(zip, 'routes.txt', entries),
          trips: openZipEntry(zip, 'trips.txt', entries),
          shapes: openZipEntry(zip, 'shapes.txt', entries),
        },
        inCaba,
        PARAMS.simplifyColectivosM,
      ),
    );
    const bytes = Buffer.byteLength(JSON.stringify(r.geojson));
    report.recorridos = { ...r.stats, bytes };
    const path = join(OUT_DIR, 'recorridos-colectivos.geojson');
    if (bytes <= PARAMS.recorridosMaxBytes) writeOutput('recorridos-colectivos.geojson', r.geojson);
    else {
      rmSync(path, { force: true });
      omitidos['recorridos-colectivos.geojson'] =
        `${bytes} B > ${PARAMS.recorridosMaxBytes} B tras simplificar`;
    }
  }

  // ---------------------------------------------------------------- manifest
  const manifest = await timed('manifest', () => buildManifest());
  report.manifest = {
    version: manifest.version,
    archivos: manifest.archivos,
    omitidos: manifest.omitidos,
  };
  report.tiempos = tiempos;
  report.fin = new Date().toISOString();
  // Reporte en out/ (ignorado por git): cada build lo regenera. Las cifras de referencia van al README.
  writeFileSync(join(OUT_DIR, 'last-build.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nversion ${manifest.version}`);
  for (const [f, a] of Object.entries(manifest.archivos))
    console.log(`  ${f.padEnd(32)} ${String(a.bytes).padStart(9)} B`);
  for (const [f, why] of Object.entries(manifest.omitidos ?? {}))
    console.log(`  ${f.padEnd(32)} omitido: ${why}`);
  console.log('Estadísticas en tools/gtfs/out/last-build.json');
}

function buildManifest(): Manifest {
  const files: { f: string; bytes: number; sha: string }[] = [];
  const contents: Buffer[] = [];
  for (const f of OUTPUT_FILES) {
    const path = join(OUT_DIR, f);
    if (!existsSync(path)) {
      omitidos[f] ??= 'no generado en esta corrida';
      continue;
    }
    const buf = readFileSync(path);
    // Revalida lo que haya en out/ (también lo generado en corridas anteriores con --solo).
    const errors = validate(schemaFor(f), JSON.parse(buf.toString('utf8')));
    if (errors.length) throw new Error(`out/${f} no valida:\n${errors.join('\n')}`);
    files.push({ f, bytes: buf.length, sha: sha256(buf) });
    contents.push(Buffer.from(`${f}\n`), buf);
  }
  const version = sha256(Buffer.concat(contents)).slice(0, 12);
  const archivos: Manifest['archivos'] = {};
  // url relativa a /v1/static/ (la ruta del proxy) y a la raíz del bucket R2.
  for (const { f, bytes, sha } of files)
    archivos[f] = { url: `${version}/${f}`, bytes, sha256: sha };
  const subteEnd = existsSync(join(OUT_DIR, 'subte-lineas.json'))
    ? z
        .object({ feedEndDate: z.string().nullable() })
        .parse(JSON.parse(readFileSync(join(OUT_DIR, 'subte-lineas.json'), 'utf8'))).feedEndDate
    : null;
  // La fecha de la fuente de trenes es la de la captura de los volcados.
  const trenesCapturado = existsSync(join(OUT_DIR, 'trenes-lineas.json'))
    ? z
        .object({ capturadoEn: z.string() })
        .parse(JSON.parse(readFileSync(join(OUT_DIR, 'trenes-lineas.json'), 'utf8'))).capturadoEn
    : null;
  const manifest: Manifest = {
    version,
    generatedAt: new Date().toISOString(),
    archivos,
    omitidos,
    fuentes: {
      ...FUENTES,
      subtesGtfs: {
        ...FUENTES.subtesGtfs,
        nota: `fecha = descarga; feed_end_date ${subteEnd ?? 'desconocido'}`,
      },
      ...(trenesCapturado === null ? {} : { sofse: fuenteSofse(trenesCapturado) }),
      colectivosGtfs: {
        ...FUENTES.colectivosGtfs,
        nota: 'fecha = archivos internos del zip; servicio 2020-12-21 → 2021-06-21',
      },
    },
  };
  const errors = validate(schemaFor('manifest.json'), manifest);
  if (errors.length) throw new Error(`manifest no valida:\n${errors.join('\n')}`);
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
