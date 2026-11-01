#!/usr/bin/env node
// Captura continua de colectivos de la API Transporte GCBA (Fase 2, tarea 2.0).
//
// Cada ~60 s baja /colectivos/vehiclePositions (protobuf) y agrega una fila por vehículo a
//   <dir>/posiciones-YYYY-MM-DD.csv.gz
// Cada ~10 min baja /colectivos/tripUpdates (≈ 3,6 MB) y agrega una muestra a
//   <dir>/viajes-YYYY-MM-DD.csv.gz
// El día (YYYY-MM-DD) es el de Buenos Aires (UTC-3, sin horario de verano).
//
// Uso:  node captura.mjs [--once] [--dir=RUTA]
//   --once   toma un snapshot de cada feed y termina (para probar)
//   --dir    carpeta de salida (default ~/.cache/transportate/capturas)
// Variables opcionales: TRIP_SAMPLE (1 de cada N viajes de tripUpdates, default 3).
//
// Lee GCBA_CLIENT_ID / GCBA_CLIENT_SECRET del .env de la raíz del repo.
// Privacidad: no se guardan patente (`licensePlate`) ni `label`; nunca se loguean URLs ni credenciales.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { gzipSync } from 'node:zlib';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const { FeedMessage, VehiclePosition } = GtfsRealtimeBindings.transit_realtime;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const BASE = 'https://apitransporte.buenosaires.gob.ar';
const USER_AGENT = 'transportate-tools/0.1';
const TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 2_000;
const VEHICLES_EVERY_MS = 60_000;
const TRIPS_EVERY_MS = 10 * 60_000;
const JITTER_MS = 5_000;
const BA_OFFSET_MS = -3 * 3_600_000; // America/Argentina/Buenos_Aires, sin DST

const VEHICLES_HEADER =
  'snapshot_ts,vehicle_id,trip_id,route_id,stop_id,current_stop_sequence,current_status,lat,lon,speed,vehicle_ts';
const TRIPS_HEADER = 'snapshot_ts,trip_id,route_id,stop_id,stop_sequence,arrival_time,delay';

// ---------------------------------------------------------------- args / env

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const ONCE = args.once === true;
const OUT_DIR = typeof args.dir === 'string' ? resolve(args.dir) : join(homedir(), '.cache', 'transportate', 'capturas');
const TRIP_SAMPLE = Math.max(1, Number(process.env.TRIP_SAMPLE ?? 3));
const LOG_FILE = join(OUT_DIR, 'captura.log');
const PID_FILE = join(OUT_DIR, 'captura.pid');

function loadEnv(file) {
  if (!existsSync(file)) throw new Error(`No existe ${file}. Copiá .env.example a .env y completá las credenciales.`);
  const env = {};
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[key] = val;
  }
  return env;
}

const env = loadEnv(join(ROOT, '.env'));
const CLIENT_ID = env.GCBA_CLIENT_ID;
const CLIENT_SECRET = env.GCBA_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Faltan GCBA_CLIENT_ID / GCBA_CLIENT_SECRET en el .env de la raíz.');

mkdirSync(OUT_DIR, { recursive: true });

// ------------------------------------------------------------------- helpers

/** Redacta credenciales y query strings de cualquier texto antes de loguearlo. */
function redact(text) {
  return String(text)
    .split(CLIENT_SECRET).join('<SECRET>')
    .split(CLIENT_ID).join('<ID>')
    .replace(/client_(id|secret)=[^&\s"']*/gi, 'client_$1=<redactado>')
    .replace(/https?:\/\/\S+/gi, '<url>');
}

function log(message) {
  appendFileSync(LOG_FILE, `${new Date().toISOString()} ${message}\n`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => Math.round((Math.random() * 2 - 1) * JITTER_MS);

/** Día de Buenos Aires (YYYY-MM-DD) para un epoch en ms. */
function baDay(ms) {
  return new Date(ms + BA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Convierte Long / number / string de protobufjs a número; '' si no hay valor. */
function num(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  if (typeof v.toNumber === 'function') return v.toNumber();
  return '';
}

function csv(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Hash FNV-1a de 32 bits: muestreo estable de viajes (el mismo trip_id cae siempre en la misma muestra). */
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Agrega un bloque gzip (miembro concatenado; `zcat` y `gzip -dc` los leen de corrido). */
function appendGz(file, header, lines) {
  const body = (existsSync(file) ? '' : `${header}\n`) + lines.join('\n') + (lines.length ? '\n' : '');
  if (!body) return 0;
  const block = gzipSync(body);
  appendFileSync(file, block);
  return block.length;
}

// --------------------------------------------------------------------- fetch

/** Baja un endpoint con timeout de 20 s y 1 reintento. Devuelve { ok, bytes, ms, buffer?, error? }. */
async function download(path) {
  const url = `${BASE}${path}?client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}`;
  let last = { ok: false, bytes: 0, ms: 0, error: 'sin_intento' };
  for (let intento = 1; intento <= 2; intento++) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/x-protobuf, */*' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        await res.arrayBuffer().catch(() => undefined);
        last = { ok: false, bytes: 0, ms: Date.now() - t0, error: `http_${res.status}` };
      } else {
        const buffer = new Uint8Array(await res.arrayBuffer());
        return { ok: true, bytes: buffer.length, ms: Date.now() - t0, buffer, intento };
      }
    } catch (err) {
      const causa = err?.cause?.code ?? err?.name ?? 'error';
      last = { ok: false, bytes: 0, ms: Date.now() - t0, error: redact(causa) };
    }
    if (intento === 1) await sleep(RETRY_DELAY_MS);
  }
  return last;
}

// ----------------------------------------------------------------- snapshots

async function snapshotVehicles() {
  const tsMs = Date.now();
  const snapshotTs = Math.floor(tsMs / 1000);
  const res = await download('/colectivos/vehiclePositions');
  if (!res.ok) return log(`vehiclePositions fail error=${res.error} ms=${res.ms}`);
  let feed;
  try {
    feed = FeedMessage.decode(res.buffer);
  } catch {
    return log(`vehiclePositions fail error=decode bytes=${res.bytes} ms=${res.ms}`);
  }
  const lines = [];
  for (const entity of feed.entity) {
    const v = entity.vehicle;
    if (!v) continue;
    const status = Object.hasOwn(v, 'currentStatus') ? VehiclePosition.VehicleStopStatus[v.currentStatus] : '';
    lines.push(
      [
        snapshotTs,
        v.vehicle?.id,
        v.trip?.tripId,
        v.trip?.routeId,
        v.stopId,
        Object.hasOwn(v, 'currentStopSequence') ? v.currentStopSequence : '',
        status,
        v.position?.latitude,
        v.position?.longitude,
        v.position?.speed,
        num(v.timestamp),
      ].map(csv).join(','),
    );
  }
  const file = join(OUT_DIR, `posiciones-${baDay(tsMs)}.csv.gz`);
  appendGz(file, VEHICLES_HEADER, lines);
  log(`vehiclePositions ok vehiculos=${lines.length} bytes=${res.bytes} ms=${res.ms} intento=${res.intento}`);
}

async function snapshotTrips() {
  const tsMs = Date.now();
  const snapshotTs = Math.floor(tsMs / 1000);
  const res = await download('/colectivos/tripUpdates');
  if (!res.ok) return log(`tripUpdates fail error=${res.error} ms=${res.ms}`);
  let feed;
  try {
    feed = FeedMessage.decode(res.buffer);
  } catch {
    return log(`tripUpdates fail error=decode bytes=${res.bytes} ms=${res.ms}`);
  }
  const seen = new Set();
  const lines = [];
  let viajes = 0;
  let muestreados = 0;
  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    const tripId = tu?.trip?.tripId;
    if (!tu || !tripId) continue;
    viajes++;
    if (fnv1a(tripId) % TRIP_SAMPLE !== 0) continue;
    muestreados++;
    for (const stu of tu.stopTimeUpdate ?? []) {
      const key = `${tripId}|${stu.stopSequence}|${stu.stopId}`;
      if (seen.has(key)) continue; // fila única por (viaje, secuencia, parada) en el snapshot
      seen.add(key);
      const when = stu.arrival ?? stu.departure;
      lines.push(
        [
          snapshotTs,
          tripId,
          tu.trip?.routeId,
          stu.stopId,
          Object.hasOwn(stu, 'stopSequence') ? stu.stopSequence : '',
          num(when?.time),
          when && Object.hasOwn(when, 'delay') ? when.delay : '',
        ].map(csv).join(','),
      );
    }
  }
  const file = join(OUT_DIR, `viajes-${baDay(tsMs)}.csv.gz`);
  appendGz(file, TRIPS_HEADER, lines);
  log(
    `tripUpdates ok viajes=${viajes} muestreados=${muestreados} filas=${lines.length} bytes=${res.bytes} ms=${res.ms} intento=${res.intento}`,
  );
}

/** Ejecuta un snapshot sin dejar que una excepción inesperada mate el proceso. */
async function safe(name, fn) {
  try {
    await fn();
  } catch (err) {
    log(`${name} fail error=inesperado detalle=${redact(err?.name ?? 'Error')}`);
  }
}

// ---------------------------------------------------------------------- main

let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log(`stop senal=${signal}`);
  try {
    unlinkSync(PID_FILE);
  } catch {
    /* ya no existe */
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

log(`start pid=${process.pid} trip_sample=1/${TRIP_SAMPLE} once=${ONCE}`);

if (ONCE) {
  await safe('vehiclePositions', snapshotVehicles);
  await safe('tripUpdates', snapshotTrips);
  process.exit(0);
}

let nextVehicles = Date.now();
let nextTrips = Date.now() + 5_000; // desfasado para no pisar el primer snapshot de posiciones
while (!stopping) {
  const now = Date.now();
  if (now >= nextVehicles) {
    await safe('vehiclePositions', snapshotVehicles);
    nextVehicles = Date.now() + VEHICLES_EVERY_MS + jitter();
  }
  if (Date.now() >= nextTrips) {
    await safe('tripUpdates', snapshotTrips);
    nextTrips = Date.now() + TRIPS_EVERY_MS + jitter();
  }
  const wait = Math.min(nextVehicles, nextTrips) - Date.now();
  if (wait > 0) await sleep(Math.min(wait, 1_000));
}
