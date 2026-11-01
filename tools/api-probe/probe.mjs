#!/usr/bin/env node
// Sondeo empírico de la API Transporte GCBA (Fase 1, tareas 1.3 y 1.4).
//
// Uso: cd tools/api-probe && npm install && node probe.mjs [flags]
//   --no-download     no descarga los GTFS estáticos (solo HEAD)
//   --no-fixtures     no escribe fixtures en apps/proxy/test/fixtures
//   --samples=N       muestras por feed de tiempo real (default 3)
//   --interval=S      segundos entre muestras (default 20)
//   --only=a,b        solo endpoints cuyo id contenga alguno de esos textos
//   --watch=S         además, observa los feeds de tiempo real durante S segundos (cadencia real)
//   --watch-every=S   intervalo de la observación larga (default 15)
//
// Lee GCBA_CLIENT_ID / GCBA_CLIENT_SECRET del .env de la raíz del repo.
// Las credenciales se redactan en toda salida (consola, last-run.json, fixtures).

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, createReadStream, createWriteStream, openSync, readSync, closeSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw } from 'node:zlib';
import { createHash } from 'node:crypto';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIXTURES_DIR = join(ROOT, 'apps', 'proxy', 'test', 'fixtures');
const CACHE_DIR = join(homedir(), '.cache', 'transportate', 'gtfs');
const BASE = 'https://apitransporte.buenosaires.gob.ar';
const FIXTURE_MAX_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------- args / env

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const SAMPLES = Number(args.samples ?? 3);
const INTERVAL_S = Number(args.interval ?? 20);
const ONLY = typeof args.only === 'string' ? args.only.split(',') : null;

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

const ENV = loadEnv(join(ROOT, '.env'));
const CLIENT_ID = ENV.GCBA_CLIENT_ID;
const CLIENT_SECRET = ENV.GCBA_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Faltan GCBA_CLIENT_ID / GCBA_CLIENT_SECRET en .env');

const SECRETS = [CLIENT_SECRET, CLIENT_ID].filter((s) => s && s.length >= 4);
function redact(value) {
  if (value == null) return value;
  let s = typeof value === 'string' ? value : JSON.stringify(value);
  for (const secret of SECRETS) s = s.split(secret).join('<redacted>');
  return s;
}
function containsSecret(buf) {
  return SECRETS.some((s) => buf.includes(Buffer.from(s)));
}

// ---------------------------------------------------------------- catálogo

// kind: gtfsrt (protobuf por defecto, json=1 opcional) | json | gbfs | zip
// rt: se muestrea SAMPLES veces para medir cadencia
// ramlActive: false = comentado en docs/fuentes/api-transporte-v1.raml
const GEO = { x: '-58.3816', y: '-34.6037', radio: '100', formato: 'geojson' };
const ENDPOINTS = [
  { id: 'subtes/feed-gtfs', kind: 'zip', ramlActive: true },
  { id: 'subtes/forecastGTFS', kind: 'gtfsrt', rt: true, ramlActive: true },
  { id: 'subtes/serviceAlerts', kind: 'gtfsrt', rt: true, ramlActive: true },
  { id: 'subtes/tripUpdates', kind: 'gtfsrt', rt: true, ramlActive: false },
  { id: 'colectivos/feed-gtfs', kind: 'zip', ramlActive: true },
  { id: 'colectivos/feed-gtfs-frequency', kind: 'zip', ramlActive: true },
  { id: 'colectivos/vehiclePositions', kind: 'gtfsrt', rt: true, ramlActive: true },
  { id: 'colectivos/vehiclePositionsSimple', kind: 'json', rt: true, ramlActive: true },
  { id: 'colectivos/serviceAlerts', kind: 'gtfsrt', rt: true, ramlActive: true },
  { id: 'colectivos/tripUpdates', kind: 'gtfsrt', rt: true, ramlActive: false },
  { id: 'trenes/vehiclePositions', kind: 'gtfsrt', rt: true, ramlActive: false },
  { id: 'trenes/tripUpdates', kind: 'gtfsrt', rt: true, ramlActive: false },
  { id: 'trenes/serviceAlerts', kind: 'gtfsrt', rt: true, ramlActive: false },
  {
    id: 'transito/v1/cortes', kind: 'json', ramlActive: false, timeoutMs: 60_000, retries: 1,
    variants: [{ name: 'default', params: {} }, { name: 'geo', params: GEO }],
  },
  {
    id: 'transito/v1/estacionamientos', kind: 'json', ramlActive: true,
    variants: [
      { name: 'default', params: {} },
      { name: 'geo', params: GEO },
      // El Obelisco cae sobre la 9 de Julio y no devuelve tramos; Palermo sí (para tener fixtures con datos).
      { name: 'palermo.geo', params: { ...GEO, x: '-58.4351', y: '-34.5884' } },
      { name: 'palermo.fullInfo', params: { x: '-58.4351', y: '-34.5884', radio: '100', fullInfo: 'true', limite: '3' } },
    ],
  },
  {
    id: 'transito/v1/semaforos', kind: 'json', ramlActive: true,
    variants: [
      { name: 'default', params: {} },
      { name: 'geo', params: GEO },
      // El RAML documenta lat/lon/radius para este endpoint (api-transporte-v1.raml:1310-1322)
      { name: 'latlon', params: { lat: '-34.6037', lon: '-58.3816', radius: '100' } },
    ],
  },
  { id: 'ecobici/gbfs/systemInformation', kind: 'gbfs', ramlActive: true },
  { id: 'ecobici/gbfs/stationStatus', kind: 'gbfs', rt: true, ramlActive: true },
  { id: 'ecobici/gbfs/stationInformation', kind: 'gbfs', ramlActive: true },
];

// ---------------------------------------------------------------- helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowS = () => Date.now() / 1000;
const iso = (s) => (s ? new Date(s * 1000).toISOString() : null);

function buildUrl(path, params = {}, { auth = true } = {}) {
  const u = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (auth) {
    u.searchParams.set('client_id', CLIENT_ID);
    u.searchParams.set('client_secret', CLIENT_SECRET);
  }
  return u;
}

const RELEVANT_HEADERS = /^(cache-control|etag|last-modified|expires|age|content-length|content-encoding|content-type|content-disposition|retry-after|x-ratelimit.*|ratelimit.*|x-rate-limit.*|x-cache.*|via|server|vary|access-control-allow-origin|x-request-id|x-correlation-id)$/i;

function pickHeaders(headers) {
  const relevant = {};
  const names = [];
  for (const [k, v] of headers) {
    names.push(k);
    if (RELEVANT_HEADERS.test(k)) relevant[k] = redact(v);
  }
  return { relevant, names: [...new Set(names)].sort() };
}

// Fiabilidad: cada intento (incluidos los fallidos) se contabiliza para el reporte.
const reliability = { intentos: 0, fallidos: 0, timeouts: 0, erroresRed: 0, ejemplos: [] };

// GET/HEAD con reintentos: el upstream cuelga o corta conexiones de forma intermitente,
// así que un fallo aislado no debe marcar el endpoint como caído.
async function request(path, params, opts = {}) {
  const retries = opts.retries ?? 2;
  const fallidos = [];
  for (let attempt = 0; ; attempt++) {
    const r = await requestOnce(path, params, opts);
    reliability.intentos++;
    if (r.meta.status != null) {
      if (fallidos.length) r.meta.intentosFallidos = fallidos;
      return r;
    }
    reliability.fallidos++;
    if (/TimeoutError/.test(r.meta.error)) reliability.timeouts++;
    else reliability.erroresRed++;
    if (reliability.ejemplos.length < 10) reliability.ejemplos.push({ endpoint: `/${path}`, error: r.meta.error, ms: r.meta.latencyMs, at: r.meta.startedAt });
    fallidos.push({ error: r.meta.error, ms: r.meta.latencyMs });
    if (attempt >= retries) {
      r.meta.intentosFallidos = fallidos;
      return r;
    }
    await sleep(1000);
  }
}

async function requestOnce(path, params, { method = 'GET', timeoutMs = 20_000, auth = true } = {}) {
  const url = buildUrl(path, params, { auth });
  const t0 = performance.now();
  const out = { method, url: redact(url.toString()), startedAt: new Date().toISOString() };
  try {
    const res = await fetch(url, { method, signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
    out.ttfbMs = Math.round(performance.now() - t0);
    out.status = res.status;
    out.statusText = res.statusText;
    out.contentType = res.headers.get('content-type');
    const { relevant, names } = pickHeaders(res.headers);
    out.headers = relevant;
    out.headerNames = names;
    if (res.status >= 300 && res.status < 400) out.location = redact(res.headers.get('location'));
    const body = method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await res.arrayBuffer());
    out.latencyMs = Math.round(performance.now() - t0);
    out.bytes = body.length;
    return { meta: out, body };
  } catch (err) {
    out.latencyMs = Math.round(performance.now() - t0);
    out.status = null;
    out.error = redact(`${err.name}: ${err.message}${err.cause ? ` (${err.cause.code ?? err.cause.message})` : ''}`);
    return { meta: out, body: null };
  }
}

function sniff(body, contentType = '') {
  if (!body || body.length === 0) return 'empty';
  const head = body.subarray(0, 64).toString('utf8').trimStart();
  if (head.startsWith('{') || head.startsWith('[')) return 'json';
  if (head.startsWith('<')) return /html/i.test(head) || /html/i.test(contentType) ? 'html' : 'xml';
  if (body[0] === 0x50 && body[1] === 0x4b) return 'zip';
  if (/protobuf|octet-stream/i.test(contentType)) return 'protobuf';
  // texto plano o protobuf sin content-type claro: intentamos protobuf después
  return /^[\x09\x0a\x0d\x20-\x7e]/.test(head) && !/[\x00-\x08]/.test(body.subarray(0, 64).toString('latin1')) ? 'text' : 'protobuf';
}

function tryJson(body) {
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    return undefined;
  }
}

const enumName = (E, v) => (v == null ? 'none' : typeof v === 'number' ? `${E[v] ?? '?'}(${v})` : String(v));

const camelToSnake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// Recorre un objeto y acumula qué rutas de campos aparecen con valor no nulo.
function collectPaths(obj, prefix, acc, { snake = false, depth = 0 } = {}) {
  if (obj == null || depth > 6) return;
  if (Array.isArray(obj)) {
    if (prefix) acc[`${prefix}[]`] = (acc[`${prefix}[]`] ?? 0) + (obj.length > 0 ? 1 : 0);
    for (const item of obj.slice(0, 50)) collectPaths(item, `${prefix}[]`, acc, { snake, depth: depth + 1 });
    return;
  }
  if (typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || (Array.isArray(v) && v.length === 0)) continue;
    const key = snake ? camelToSnake(k) : k;
    const p = prefix ? `${prefix}.${key}` : key;
    if (typeof v === 'object') collectPaths(v, p, acc, { snake, depth: depth + 1 });
    else acc[p] = (acc[p] ?? 0) + 1;
  }
}

function fieldPresence(items, opts) {
  const acc = {};
  for (const it of items) {
    const seen = {};
    collectPaths(it, '', seen, opts);
    for (const p of Object.keys(seen)) acc[p] = (acc[p] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(acc).sort(([a], [b]) => a.localeCompare(b)));
}

function stats(nums) {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const q = (p) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
  return { n: xs.length, min: Math.round(xs[0]), p50: Math.round(q(0.5)), p90: Math.round(q(0.9)), max: Math.round(xs[xs.length - 1]) };
}

// AMBA aproximado; CABA ⊂ AMBA. Fuera del AMBA = posición inválida para este producto.
const AMBA = { latMin: -35.3, latMax: -34.1, lonMin: -59.4, lonMax: -57.7 };
const CABA = { latMin: -34.71, latMax: -34.52, lonMin: -58.54, lonMax: -58.33 };
const inBox = (b, lat, lon) => lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax;

function positionQuality(vehicles) {
  // vehicles: [{ id, lat, lon, ts, routeId, tripId }]
  const now = nowS();
  const q = {
    total: vehicles.length,
    sinPosicion: 0,
    latLonCero: 0,
    fueraDeRango: 0, // |lat|>90 o |lon|>180 (p. ej. 91/181 como "sin dato")
    fueraAmba: 0,
    dentroCaba: 0,
    sinRouteId: 0,
    sinTripId: 0,
    sinVehicleId: 0,
    sinTimestamp: 0,
    idsDuplicados: 0,
    viejasMas5min: 0,
    viejasMas30min: 0,
    timestampFuturo: 0,
    edadSegundos: null,
    ejemplosInvalidos: [],
  };
  const ids = new Map();
  const ages = [];
  for (const v of vehicles) {
    if (v.lat == null || v.lon == null) q.sinPosicion++;
    else if (v.lat === 0 && v.lon === 0) q.latLonCero++;
    else if (Math.abs(v.lat) > 90 || Math.abs(v.lon) > 180) q.fueraDeRango++;
    else if (!inBox(AMBA, v.lat, v.lon)) q.fueraAmba++;
    else if (inBox(CABA, v.lat, v.lon)) q.dentroCaba++;
    const invalid = v.lat == null || (v.lat === 0 && v.lon === 0) || Math.abs(v.lat) > 90 || Math.abs(v.lon) > 180 || !inBox(AMBA, v.lat, v.lon);
    if (invalid && q.ejemplosInvalidos.length < 3) q.ejemplosInvalidos.push(v);
    if (!v.routeId) q.sinRouteId++;
    if (!v.tripId) q.sinTripId++;
    if (!v.id) q.sinVehicleId++;
    else ids.set(v.id, (ids.get(v.id) ?? 0) + 1);
    if (!v.ts) q.sinTimestamp++;
    else {
      const age = now - v.ts;
      ages.push(age);
      if (age > 300) q.viejasMas5min++;
      if (age > 1800) q.viejasMas30min++;
      if (age < -60) q.timestampFuturo++;
    }
  }
  q.idsDuplicados = [...ids.values()].filter((c) => c > 1).length;
  q.edadSegundos = stats(ages);
  return q;
}

// ---------------------------------------------------------------- análisis GTFS-RT

// IDs vistos en tiempo real y en los GTFS estáticos, para medir si cruzan (ver crossCheck()).
const RT_IDS = { vehicleRouteIds: null, stopTimeUpdateStopIds: null, simpleRouteIds: null };
const STATIC_IDS = {};

function analyzeFeedObject(feed, { snake }) {
  // feed: objeto plano (toObject de protobufjs en camelCase, o JSON del upstream en snake_case)
  const header = feed.header ?? {};
  const ts = Number(header.timestamp) || null;
  const entities = feed.entity ?? [];
  const out = {
    header: { gtfsRealtimeVersion: header.gtfsRealtimeVersion ?? header.gtfs_realtime_version, incrementality: header.incrementality, timestamp: ts, timestampIso: iso(ts), edadSegundos: ts ? Math.round(nowS() - ts) : null },
    entities: entities.length,
    tipos: { vehicle: 0, tripUpdate: 0, alert: 0, otros: 0 },
    camposPresentes: fieldPresence(entities, { snake }),
  };
  const get = (o, camel) => o?.[camel] ?? o?.[camelToSnake(camel)];
  const vehicles = [];
  const stuCounts = [];
  const stuTimesDelta = [];
  const tuAges = [];
  const tuIndex = {};
  const alertSummary = { causes: {}, effects: {}, idiomas: {}, conActivePeriod: 0 };
  const now = nowS();
  for (const e of entities) {
    const veh = get(e, 'vehicle');
    const tu = get(e, 'tripUpdate');
    const al = get(e, 'alert');
    if (veh) {
      out.tipos.vehicle++;
      const pos = get(veh, 'position') ?? {};
      const trip = get(veh, 'trip') ?? {};
      const vd = get(veh, 'vehicle') ?? {};
      vehicles.push({
        id: vd.id ?? null,
        lat: pos.latitude ?? null,
        lon: pos.longitude ?? null,
        ts: Number(veh.timestamp) || null,
        routeId: get(trip, 'routeId') ?? null,
        tripId: get(trip, 'tripId') ?? null,
      });
    }
    if (tu) {
      out.tipos.tripUpdate++;
      const tuTs = Number(tu.timestamp) || null;
      if (tuTs) tuAges.push(now - tuTs);
      const tuTrip = get(tu, 'trip') ?? {};
      tuIndex[get(tuTrip, 'tripId') ?? e.id] = `${tuTs}`;
      const stus = get(tu, 'stopTimeUpdate') ?? [];
      stuCounts.push(stus.length);
      (RT_IDS._stu ??= []).push(...stus.map((x) => get(x, 'stopId')).filter(Boolean));
      for (const s of stus) {
        const t = Number(get(s, 'arrival')?.time ?? get(s, 'departure')?.time);
        if (t) stuTimesDelta.push(t - now);
      }
    }
    if (al) {
      out.tipos.alert++;
      const c = enumName(GtfsRealtimeBindings.transit_realtime.Alert.Cause, al.cause);
      const ef = enumName(GtfsRealtimeBindings.transit_realtime.Alert.Effect, al.effect);
      alertSummary.causes[c] = (alertSummary.causes[c] ?? 0) + 1;
      alertSummary.effects[ef] = (alertSummary.effects[ef] ?? 0) + 1;
      if ((get(al, 'activePeriod') ?? []).length) alertSummary.conActivePeriod++;
      for (const tr of get(get(al, 'headerText'), 'translation') ?? []) {
        alertSummary.idiomas[tr.language ?? '∅'] = (alertSummary.idiomas[tr.language ?? '∅'] ?? 0) + 1;
      }
    }
    if (!veh && !tu && !al) out.tipos.otros++;
  }
  if (vehicles.length) {
    RT_IDS.vehicleRouteIds = vehicles.map((v) => v.routeId).filter(Boolean);
    out.calidadPosiciones = positionQuality(vehicles);
    out._vehicleIndex = Object.fromEntries(vehicles.filter((v) => v.id).map((v) => [v.id, `${v.ts}|${v.lat}|${v.lon}`]));
    out.maxVehicleTimestamp = Math.max(...vehicles.map((v) => v.ts || 0)) || null;
  }
  if (stuCounts.length) {
    RT_IDS.stopTimeUpdateStopIds = RT_IDS._stu;
    RT_IDS._stu = [];
    out.stopTimeUpdates = { porTrip: stats(stuCounts), total: stuCounts.reduce((a, b) => a + b, 0), segundosHastaArribo: stats(stuTimesDelta), enElPasado: stuTimesDelta.filter((d) => d < -60).length };
    out.tripUpdateEdadSegundos = stats(tuAges);
    out.tripUpdatesViejosMas30min = tuAges.filter((x) => x > 1800).length;
    out._vehicleIndex = out._vehicleIndex ?? tuIndex;
    out.maxTripUpdateTimestamp = Math.max(...tuAges.map((x) => Math.round(now - x))) || null;
  }
  if (out.tipos.alert) out.alertas = alertSummary;
  // Hash del contenido (sin header) para detectar cambios reales de alertas entre muestras.
  if (!out.tipos.vehicle && !out.tipos.tripUpdate) out._hashContenido = createHash('sha1').update(JSON.stringify(entities)).digest('hex').slice(0, 10);
  const sample = entities.find((e) => get(e, 'alert')) && out.tipos.alert && !out.tipos.vehicle ? entities.find((e) => get(e, 'alert')) : entities[0];
  out.entityMuestra = sample ? truncateSample(sample) : null;
  return out;
}

function truncateSample(e) {
  const clone = JSON.parse(JSON.stringify(e));
  const tu = clone.tripUpdate ?? clone.trip_update;
  const stu = tu && (tu.stopTimeUpdate ?? tu.stop_time_update);
  if (Array.isArray(stu) && stu.length > 3) {
    const n = stu.length;
    stu.splice(3);
    stu.push(`… (${n - 3} stop_time_update más)`);
  }
  return clone;
}

function decodeProtobuf(body) {
  const msg = FeedMessage.decode(new Uint8Array(body));
  return FeedMessage.toObject(msg, { longs: Number, enums: String, defaults: false });
}

function countReplacementChars(buf) {
  let n = 0;
  for (let i = buf.indexOf(0xef); i >= 0 && i < buf.length - 2; i = buf.indexOf(0xef, i + 1)) if (buf[i + 1] === 0xbf && buf[i + 2] === 0xbd) n++;
  return n;
}

// JSON de colectivos con json=1: {"_entity":[{"_vehicle":{"_position":{"_latitude":...},"extensionObject":null}}]}
function normalizeUnderscoreJson(v) {
  if (Array.isArray(v)) return v.map(normalizeUnderscoreJson);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === 'extensionObject') continue;
      out[k.replace(/^_/, '')] = normalizeUnderscoreJson(val);
    }
    return out;
  }
  return v;
}

function collectUnderscoreKeys(v, prefix, acc, depth = 0) {
  if (!v || typeof v !== 'object' || depth > 5) return;
  if (Array.isArray(v)) return v.slice(0, 3).forEach((x) => collectUnderscoreKeys(x, `${prefix}[]`, acc, depth + 1));
  for (const [k, val] of Object.entries(v)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (k.startsWith('_')) acc.push(p);
    collectUnderscoreKeys(val, p, acc, depth + 1);
  }
}

// /subtes/forecastGTFS: {"Header":{"timestamp"},"Entity":[{"ID","Linea":{"Trip_Id","Route_Id","Direction_ID","start_time","start_date","Estaciones":[{"stop_id","stop_name","arrival":{"time","delay"},"departure":{...}}]}}]}
function analyzeForecast(j) {
  const ts = Number(j.Header?.timestamp) || null;
  const now = nowS();
  const ents = j.Entity ?? [];
  const porLinea = {};
  const deltas = [];
  const delays = [];
  let estaciones = 0;
  for (const e of ents) {
    const l = e.Linea ?? {};
    porLinea[l.Route_Id ?? '∅'] = (porLinea[l.Route_Id ?? '∅'] ?? 0) + 1;
    for (const st of l.Estaciones ?? []) {
      estaciones++;
      const t = Number(st.arrival?.time);
      if (t) deltas.push(t - now);
      if (st.arrival?.delay != null) delays.push(Number(st.arrival.delay));
    }
  }
  return {
    header: { timestamp: ts, timestampIso: iso(ts), edadSegundos: ts ? Math.round(now - ts) : null },
    entities: ents.length,
    tripsPorLinea: porLinea,
    estaciones,
    startDates: [...new Set(ents.map((e) => e.Linea?.start_date))],
    segundosHastaArribo: stats(deltas),
    arribosEnElPasado: deltas.filter((d) => d < -60).length,
    delay: stats(delays),
    camposPresentes: fieldPresence(ents, {}),
    entityMuestra: ents[0] ? { ...ents[0], Linea: { ...ents[0].Linea, Estaciones: [...(ents[0].Linea?.Estaciones ?? []).slice(0, 2), `… (${(ents[0].Linea?.Estaciones ?? []).length} estaciones)`] } } : null,
  };
}

// ---------------------------------------------------------------- análisis de un body

function analyzeBody(ep, variant, meta, body) {
  const a = { formato: null };
  if (!body) return a;
  const kindSniff = sniff(body, meta.contentType ?? '');
  a.formato = kindSniff;
  if (meta.status !== 200) {
    a.cuerpoError = redact(body.subarray(0, 600).toString('utf8'));
    return a;
  }
  if (ep.kind === 'gtfsrt') {
    if (kindSniff === 'json') {
      const raw = tryJson(body);
      const underscored = raw && ('_entity' in raw || '_header' in raw);
      const j = underscored ? normalizeUnderscoreJson(raw) : raw;
      if (raw && (raw.Header || raw.Entity)) {
        a.formato = 'forecast-json'; // formato propio de /subtes/forecastGTFS (no es GTFS-RT)
        Object.assign(a, analyzeForecast(raw));
      } else if (j && (j.header || j.entity)) {
        a.formato = 'gtfsrt-json';
        a.dialectoJson = underscored ? 'claves con prefijo "_" + extensionObject (serialización Java de onebusaway), enums numéricos' : 'snake_case GTFS-RT, enums numéricos';
        Object.assign(a, analyzeFeedObject(j, { snake: false }));
      } else a.jsonMuestra = redact(body.subarray(0, 400).toString('utf8'));
    } else if (kindSniff === 'protobuf' || kindSniff === 'text') {
      a.reemplazosUtf8 = countReplacementChars(body);
      try {
        const feed = decodeProtobuf(body);
        a.formato = 'gtfsrt-protobuf';
        Object.assign(a, analyzeFeedObject(feed, { snake: true }));
      } catch (err) {
        a.formato = 'protobuf-invalido';
        a.errorDecodificacion = err.message;
        if (a.reemplazosUtf8) a.diagnostico = `el cuerpo contiene ${a.reemplazosUtf8} secuencias EF BF BD (U+FFFD): el servidor re-codificó el binario como texto UTF-8 y destruyó los bytes >= 0x80; irrecuperable, usar json=1`;
        a.hexInicio = body.subarray(0, 32).toString('hex');
      }
    } else a.cuerpoMuestra = redact(body.subarray(0, 400).toString('utf8'));
    return a;
  }
  if (ep.kind === 'json' || ep.kind === 'gbfs') {
    const j = tryJson(body);
    if (j === undefined) {
      a.cuerpoMuestra = redact(body.subarray(0, 400).toString('utf8'));
      return a;
    }
    if (j && j.type === 'FeatureCollection') {
      a.formato = 'geojson';
      const feats = j.features ?? [];
      a.features = feats.length;
      a.geometrias = feats.reduce((acc, f) => ((acc[f.geometry?.type ?? '∅'] = (acc[f.geometry?.type ?? '∅'] ?? 0) + 1), acc), {});
      a.camposPresentes = fieldPresence(feats.map((f) => f.properties ?? {}), {});
      a.muestra = feats[0] ?? null;
      return a;
    }
    if (Array.isArray(j)) {
      a.raiz = 'array';
      a.items = j.length;
      a.camposPresentes = fieldPresence(j, {});
      a.muestra = j[0] ?? null;
      if (ep.id === 'colectivos/vehiclePositionsSimple') {
        const vehicles = j.map((v) => ({ id: v.id ?? null, lat: v.latitude ?? null, lon: v.longitude ?? null, ts: Number(v.timestamp) || null, routeId: v.route_id ?? null, tripId: v.trip_id ?? v.tip_id ?? null }));
        RT_IDS.simpleRouteIds = vehicles.map((v) => v.routeId).filter(Boolean);
        a.calidadPosiciones = positionQuality(vehicles);
        a._vehicleIndex = Object.fromEntries(vehicles.filter((v) => v.id).map((v) => [v.id, `${v.ts}|${v.lat}|${v.lon}`]));
        a.maxVehicleTimestamp = Math.max(...vehicles.map((v) => v.ts || 0)) || null;
        a.lineasDistintas = new Set(j.map((v) => v.route_short_name)).size;
        a.agenciasDistintas = new Set(j.map((v) => v.agency_id)).size;
      }
      return a;
    }
    a.raiz = 'object';
    a.claves = Object.keys(j ?? {});
    const underscoreKeys = [];
    collectUnderscoreKeys(j, '', underscoreKeys);
    if (underscoreKeys.length) a.clavesConGuionBajo = [...new Set(underscoreKeys)].slice(0, 20);
    if (ep.kind === 'gbfs') {
      a.gbfs = { lastUpdated: j.last_updated ?? null, lastUpdatedIso: iso(j.last_updated), edadSegundos: j.last_updated ? Math.round(nowS() - j.last_updated) : null, ttl: j.ttl ?? null, version: j.version ?? null };
      const stations = j.data?.stations;
      if (Array.isArray(stations)) {
        a.items = stations.length;
        a.camposPresentes = fieldPresence(stations, {});
        a.muestra = stations[0];
        a._vehicleIndex = Object.fromEntries(stations.map((st) => [st.station_id, `${st.last_reported ?? ''}|${st.num_bikes_available ?? ''}|${st.num_docks_available ?? ''}`]));
        const reported = stations.map((s) => Number(s.last_reported)).filter(Boolean);
        if (reported.length) a.gbfs.lastReportedEdad = stats(reported.map((r) => nowS() - r));
      } else a.muestra = j.data ?? null;
      return a;
    }
    // objeto genérico (p. ej. estacionamientos {total, instancias})
    const arr = Object.values(j ?? {}).find(Array.isArray);
    if (arr) {
      a.items = arr.length;
      a.camposPresentes = fieldPresence(arr, {});
      a.muestra = arr[0] ?? null;
    } else a.muestra = j;
    return a;
  }
  return a;
}

// ---------------------------------------------------------------- fixtures

const fixtureLog = [];

function fixtureName(ep, variant, meta, analysis) {
  const [servicio, ...rest] = ep.id.split('/');
  const endpoint = rest.filter((p) => p !== 'v1' && p !== 'gbfs').join('-');
  const suffix = variant.name === 'default' ? '' : `.${variant.name}`;
  let ext;
  if (meta.status !== 200 || !meta.bytes) ext = 'error.txt';
  else if (analysis.formato === 'gtfsrt-protobuf' || analysis.formato === 'protobuf-invalido') ext = 'pb';
  else if (analysis.formato === 'geojson') ext = 'geojson';
  else if (['gtfsrt-json', 'forecast-json', 'json'].includes(analysis.formato)) ext = 'json';
  else ext = 'error.txt'; // 200 con cuerpo inesperado (HTML, texto, protobuf inválido)
  return join(servicio, `${endpoint}${suffix}.${ext}`);
}

function writeFixture(ep, variant, meta, body, analysis) {
  if (args['no-fixtures']) return null;
  const rel = fixtureName(ep, variant, meta, analysis);
  const abs = join(FIXTURES_DIR, rel);
  const entry = { archivo: rel, endpoint: `/${ep.id}`, params: variant.params, status: meta.status, contentType: meta.contentType ?? null, capturadoEn: meta.startedAt };
  if (analysis?.diagnostico) entry.nota = 'protobuf corrupto en origen (bytes >= 0x80 reemplazados por U+FFFD); no decodifica';
  else if (meta.status == null) entry.nota = `sin respuesta: ${meta.error}`;
  let data = body;
  if (rel.endsWith('.error.txt')) {
    const lines = [
      `# Fixture de error capturado por tools/api-probe/probe.mjs`,
      `# endpoint: GET /${ep.id}  params: ${JSON.stringify(variant.params)}`,
      `# capturado: ${meta.startedAt}`,
      `# status: ${meta.status ?? 'sin respuesta'} ${meta.statusText ?? ''}`.trimEnd(),
      `# content-type: ${meta.contentType ?? '-'}`,
      meta.error ? `# error de red: ${meta.error}` : null,
      `# bytes: ${meta.bytes ?? 0}`,
      `# ---- cuerpo crudo ----`,
    ].filter(Boolean);
    data = Buffer.concat([Buffer.from(lines.join('\n') + '\n'), body ?? Buffer.alloc(0)]);
  }
  if (!data) return null;
  if (containsSecret(data)) {
    const asText = data.toString('utf8');
    if (rel.endsWith('.pb')) {
      entry.omitido = 'el cuerpo contenía credenciales';
      fixtureLog.push(entry);
      return entry;
    }
    data = Buffer.from(redact(asText));
    entry.redactado = true;
  }
  if (data.length > FIXTURE_MAX_BYTES) {
    entry.omitido = `excede ${FIXTURE_MAX_BYTES} bytes (${data.length})`;
    entry.bytes = data.length;
    fixtureLog.push(entry);
    return entry;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, data);
  entry.bytes = data.length;
  fixtureLog.push(entry);
  return entry;
}

// ---------------------------------------------------------------- GTFS estático (zip)

function readZipDirectory(file) {
  const fd = openSync(file, 'r');
  try {
    const size = statSync(file).size;
    const tailLen = Math.min(size, 65_557 + 20);
    const tail = Buffer.alloc(tailLen);
    readSync(fd, tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('zip sin EOCD');
    let entries = tail.readUInt16LE(eocd + 10);
    let cdSize = tail.readUInt32LE(eocd + 12);
    let cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdOffset === 0xffffffff || entries === 0xffff) {
      const loc = eocd - 20;
      if (loc >= 0 && tail.readUInt32LE(loc) === 0x07064b50) {
        const z64Off = Number(tail.readBigUInt64LE(loc + 8));
        const z64 = Buffer.alloc(56);
        readSync(fd, z64, 0, 56, z64Off);
        entries = Number(z64.readBigUInt64LE(32));
        cdSize = Number(z64.readBigUInt64LE(40));
        cdOffset = Number(z64.readBigUInt64LE(48));
      }
    }
    const cd = Buffer.alloc(cdSize);
    readSync(fd, cd, 0, cdSize, cdOffset);
    const list = [];
    let p = 0;
    for (let i = 0; i < entries && p < cd.length; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) break;
      const method = cd.readUInt16LE(p + 10);
      let compSize = cd.readUInt32LE(p + 20);
      let uncompSize = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      let localOffset = cd.readUInt32LE(p + 42);
      const name = cd.subarray(p + 46, p + 46 + nameLen).toString('utf8');
      // extra ZIP64
      let e = p + 46 + nameLen;
      const eEnd = e + extraLen;
      while (e + 4 <= eEnd) {
        const tag = cd.readUInt16LE(e);
        const len = cd.readUInt16LE(e + 2);
        if (tag === 0x0001) {
          let q = e + 4;
          if (uncompSize === 0xffffffff) { uncompSize = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (compSize === 0xffffffff) { compSize = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (localOffset === 0xffffffff) { localOffset = Number(cd.readBigUInt64LE(q)); q += 8; }
        }
        e += 4 + len;
      }
      list.push({ name, method, compSize, uncompSize, localOffset });
      p = eEnd + commentLen;
    }
    // inicio real de los datos (header local)
    for (const it of list) {
      const lh = Buffer.alloc(30);
      readSync(fd, lh, 0, 30, it.localOffset);
      it.dataStart = it.localOffset + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
    }
    return list;
  } finally {
    closeSync(fd);
  }
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Lee un .txt del zip en streaming: cuenta filas y guarda cabecera + primeras filas + valores de columnas pedidas.
async function scanZipEntry(file, entry, { keepRows = 3, collect = [], count = [], minmax = [], sets = [] } = {}) {
  const src = createReadStream(file, { start: entry.dataStart, end: entry.dataStart + entry.compSize - 1 });
  const stream = entry.method === 8 ? src.pipe(createInflateRaw()) : src;
  let header = null;
  let rows = 0;
  const firstRows = [];
  const collected = Object.fromEntries(collect.map((c) => [c, []]));
  const counts = Object.fromEntries(count.map((c) => [c, {}]));
  const ranges = Object.fromEntries(minmax.map((c) => [c, { min: null, max: null }]));
  const idSets = Object.fromEntries(sets.map((c) => [c, new Set()]));
  const needParse = collect.length || count.length || minmax.length || sets.length;
  let rest = '';
  const handle = (line) => {
    if (!line.trim()) return;
    if (!header) {
      header = parseCsvLine(line.replace(/^﻿/, '')).map((h) => h.trim());
      return;
    }
    rows++;
    if (firstRows.length < keepRows || needParse) {
      const vals = parseCsvLine(line);
      const obj = Object.fromEntries(header.map((h, i) => [h, vals[i]]));
      if (firstRows.length < keepRows) firstRows.push(obj);
      for (const c of collect) if (collected[c].length < 500) collected[c].push(obj[c]);
      for (const c of count) counts[c][obj[c]] = (counts[c][obj[c]] ?? 0) + 1;
      for (const c of sets) idSets[c].add(obj[c]);
      for (const c of minmax) {
        const val = obj[c];
        if (val == null || val === '') continue;
        if (ranges[c].min == null || val < ranges[c].min) ranges[c].min = val;
        if (ranges[c].max == null || val > ranges[c].max) ranges[c].max = val;
      }
    }
  };
  for await (const chunk of stream) {
    const text = rest + chunk.toString('utf8');
    const lines = text.split(/\r?\n/);
    rest = lines.pop();
    for (const l of lines) handle(l);
  }
  handle(rest);
  return { header, rows, firstRows, collected, counts, ranges, idSets };
}

async function downloadZipOnce(ep, zipPath, metaPath, headLm) {
  const url = buildUrl(ep.id, {});
  const t0 = performance.now();
  const meta = { method: 'GET', url: redact(url.toString()), startedAt: new Date().toISOString(), streamedTo: zipPath.replace(homedir(), '~') };
  const ctrl = new AbortController();
  // 30 s para recibir headers; 15 min en total para la descarga.
  const headerTimer = setTimeout(() => ctrl.abort(new Error('TimeoutError: sin headers en 30 s')), 30_000);
  const totalTimer = setTimeout(() => ctrl.abort(new Error('TimeoutError: descarga > 15 min')), 15 * 60_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(headerTimer);
    meta.ttfbMs = Math.round(performance.now() - t0);
    meta.status = res.status;
    meta.contentType = res.headers.get('content-type');
    Object.assign(meta, (({ relevant, names }) => ({ headers: relevant, headerNames: names }))(pickHeaders(res.headers)));
    if (res.status !== 200 || !res.body) {
      const body = Buffer.from(await res.arrayBuffer());
      meta.bytes = body.length;
      meta.latencyMs = Math.round(performance.now() - t0);
      writeFixture(ep, { name: 'default', params: {} }, meta, body, { formato: 'error' });
      return { meta, errorBody: redact(body.subarray(0, 600).toString('utf8')) };
    }
    const tmp = `${zipPath}.part`;
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
    renameSync(tmp, zipPath);
    meta.latencyMs = Math.round(performance.now() - t0);
    meta.bytes = statSync(zipPath).size;
    meta.mbps = +((meta.bytes * 8) / 1e6 / (meta.latencyMs / 1000)).toFixed(1);
    writeFileSync(metaPath, JSON.stringify({ lastModified: meta.headers['last-modified'] ?? headLm ?? null, bytes: meta.bytes, at: meta.startedAt }, null, 2));
    return { meta };
  } catch (err) {
    meta.latencyMs = Math.round(performance.now() - t0);
    const cause = err.cause ? ` (${err.cause.code ?? err.cause.message})` : '';
    meta.error = redact(`${err.name}: ${err.message}${cause}`);
    return { meta };
  } finally {
    clearTimeout(headerTimer);
    clearTimeout(totalTimer);
  }
}

async function probeStatic(ep) {
  const result = { id: ep.id, kind: 'zip', ramlActive: ep.ramlActive, head: null, get: null, zip: null };
  const head = await request(ep.id, {}, { method: 'HEAD', timeoutMs: 30_000 });
  result.head = head.meta;
  if (args['no-download']) return result;
  mkdirSync(CACHE_DIR, { recursive: true });
  const name = ep.id.replace(/\//g, '_');
  const zipPath = join(CACHE_DIR, `${name}.zip`);
  const metaPath = join(CACHE_DIR, `${name}.meta.json`);
  const headLm = head.meta.headers?.['last-modified'];
  const headLen = Number(head.meta.headers?.['content-length']) || null;
  let reused = false;
  if (existsSync(zipPath) && existsSync(metaPath)) {
    const prev = JSON.parse(readFileSync(metaPath, 'utf8'));
    if (head.meta.status === 200 && headLm && prev.lastModified === headLm && (!headLen || statSync(zipPath).size === headLen)) reused = true;
  }
  if (!reused) {
    // Hasta 3 intentos: el upstream corta conexiones o cuelga de forma intermitente.
    const fallidos = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await downloadZipOnce(ep, zipPath, metaPath, headLm);
      reliability.intentos++;
      if (r.meta.error) {
        reliability.fallidos++;
        if (/Timeout|Abort/.test(r.meta.error)) reliability.timeouts++;
        else reliability.erroresRed++;
        fallidos.push({ error: r.meta.error, ms: r.meta.latencyMs });
        result.get = r.meta;
        if (attempt < 2) await sleep(2000);
        continue;
      }
      result.get = r.meta;
      if (r.errorBody != null) {
        result.error = r.errorBody;
        if (fallidos.length) result.get.intentosFallidos = fallidos;
        return result;
      }
      break;
    }
    if (fallidos.length) result.get.intentosFallidos = fallidos;
    if (result.get.error) return result;
  } else {
    result.get = { reusadoDeCache: zipPath.replace(homedir(), '~'), bytes: statSync(zipPath).size };
  }
  try {
    const entries = readZipDirectory(zipPath);
    result.zip = { archivos: entries.map((e) => ({ name: e.name, comprimido: e.compSize, descomprimido: e.uncompSize })) };
    const want = {
      'agency.txt': { keepRows: 3 },
      'routes.txt': { keepRows: 3, collect: ['route_id', 'route_short_name', 'route_long_name', 'route_color', 'route_type'], count: ['route_type'], sets: ['route_id'] },
      'stops.txt': { keepRows: 3, collect: ['stop_id', 'stop_name'], sets: ['stop_id'] },
      'trips.txt': { keepRows: 5 },
      'feed_info.txt': { keepRows: 3 },
      'calendar.txt': { keepRows: 2, minmax: ['start_date', 'end_date'] },
      'calendar_dates.txt': { keepRows: 1, minmax: ['date'] },
    };
    result.zip.tablas = {};
    for (const [fname, opts] of Object.entries(want)) {
      const entry = entries.find((e) => e.name.split('/').pop() === fname);
      if (!entry) continue;
      const scan = await scanZipEntry(zipPath, entry, opts);
      const t = { columnas: scan.header, filas: scan.rows, primerasFilas: scan.firstRows };
      if (fname === 'routes.txt') {
        t.routeIdsEjemplo = scan.collected.route_id.slice(0, 15);
        if (scan.rows <= 60) t.rutas = scan.collected.route_id.map((id, i) => ({ route_id: id, route_short_name: scan.collected.route_short_name[i], route_long_name: scan.collected.route_long_name[i], route_color: scan.collected.route_color[i], route_type: scan.collected.route_type[i] }));
        t.routeTypes = scan.counts.route_type;
      }
      if (fname === 'stops.txt') t.stopIdsEjemplo = scan.collected.stop_id.slice(0, 15);
      if (fname === 'agency.txt') t.agencias = scan.rows;
      if (Object.keys(scan.ranges).length) t.rangos = scan.ranges;
      for (const [col, set] of Object.entries(scan.idSets)) ((STATIC_IDS[ep.id] ??= {})[col] = set);
      const mojibake = JSON.stringify(scan.firstRows).match(/Ã[\x80-\xBF¡-ÿ]/g);
      if (mojibake) t.mojibakeEnMuestra = true;
      result.zip.tablas[fname] = t;
    }
  } catch (err) {
    result.zip = { error: err.message };
  }
  return result;
}

// ---------------------------------------------------------------- endpoints dinámicos

function variantsFor(ep) {
  if (ep.variants) return ep.variants;
  const v = [{ name: 'default', params: {} }];
  if (ep.kind === 'gtfsrt') v.push({ name: 'json=1', params: { json: '1' } });
  return v;
}

function slim(analysis) {
  const { _vehicleIndex, _hashContenido, ...rest } = analysis;
  return rest;
}

async function probeDynamic(ep) {
  const result = { id: ep.id, kind: ep.kind, ramlActive: ep.ramlActive, variantes: [], cadencia: null };
  for (const variant of variantsFor(ep)) {
    const { meta, body } = await request(ep.id, variant.params, { timeoutMs: ep.timeoutMs, retries: ep.retries });
    const analysis = analyzeBody(ep, variant, meta, body);
    const fixture = writeFixture(ep, variant, meta, body, analysis);
    result.variantes.push({ variante: variant.name, params: variant.params, ...meta, analisis: slim(analysis), fixture: fixture?.archivo ?? null, _analysis: analysis });
  }
  // Cadencia: más muestras de la variante por defecto, separadas INTERVAL_S.
  if (ep.rt && SAMPLES > 1) {
    // Se muestrea la variante por defecto, salvo que no tenga timestamp legible (p. ej. protobuf corrupto): ahí, json=1.
    const hasTs = (v) => v.status === 200 && sampleSummary(v._analysis, v).timestamp != null;
    const first = result.variantes.find(hasTs) ?? result.variantes[0];
    const cadParams = first.params;
    const samples = [sampleSummary(first._analysis, first)];
    let prev = first._analysis;
    let last = first;
    for (let i = 1; i < SAMPLES; i++) {
      const wait = INTERVAL_S * 1000 - (Date.now() - Date.parse(last.startedAt));
      if (wait > 0) await sleep(wait);
      const { meta, body } = await request(ep.id, cadParams, { timeoutMs: ep.timeoutMs, retries: ep.retries });
      const analysis = analyzeBody(ep, { name: first.variante, params: cadParams }, meta, body);
      const s = sampleSummary(analysis, meta);
      if (prev?._vehicleIndex && analysis._vehicleIndex) {
        const ids = Object.keys(analysis._vehicleIndex);
        const comunes = ids.filter((id) => prev._vehicleIndex[id] !== undefined);
        s.vehiculosComunes = comunes.length;
        s.vehiculosQueCambiaron = comunes.filter((id) => prev._vehicleIndex[id] !== analysis._vehicleIndex[id]).length;
      }
      samples.push(s);
      prev = analysis;
      last = { startedAt: meta.startedAt };
    }
    const tsList = samples.map((s) => s.timestamp).filter(Boolean);
    const distinct = [...new Set(tsList)];
    const deltas = distinct.slice(1).map((t, i) => t - distinct[i]);
    result.cadencia = {
      variante: first.variante,
      intervaloSegundos: INTERVAL_S,
      muestras: samples,
      timestampsDistintos: distinct.length,
      deltasTimestamp: deltas,
      cambiaEntreMuestras: distinct.length > 1,
      etagsDistintos: new Set(samples.map((s) => s.etag).filter(Boolean)).size,
      maxVehicleTimestampDistintos: new Set(samples.map((s) => s.maxVehicleTimestamp).filter(Boolean)).size || null,
      maxTripUpdateTimestampDistintos: new Set(samples.map((s) => s.maxTripUpdateTimestamp).filter(Boolean)).size || null,
    };
  }
  for (const v of result.variantes) delete v._analysis;
  return result;
}

function sampleSummary(analysis, meta) {
  return {
    at: meta.startedAt,
    status: meta.status,
    bytes: meta.bytes,
    latencyMs: meta.latencyMs,
    timestamp: analysis?.header?.timestamp ?? analysis?.gbfs?.lastUpdated ?? analysis?.maxVehicleTimestamp ?? null,
    fuenteTimestamp: analysis?.header ? 'header.timestamp' : analysis?.gbfs ? 'last_updated' : analysis?.maxVehicleTimestamp ? 'max(vehicle.timestamp)' : null,
    maxVehicleTimestamp: analysis?.maxVehicleTimestamp ?? null,
    maxTripUpdateTimestamp: analysis?.maxTripUpdateTimestamp ?? null,
    entities: analysis?.entities ?? analysis?.items ?? null,
    etag: meta.headers?.etag ?? null,
    lastModified: meta.headers?.['last-modified'] ?? null,
  };
}

// ---------------------------------------------------------------- cruce tiempo real ↔ estático

function crossCheck() {
  const st = STATIC_IDS['colectivos/feed-gtfs'];
  if (!st) return null;
  const ratio = (list, set) => {
    if (!list?.length) return null;
    const hit = list.filter((x) => set.has(x)).length;
    const distinct = [...new Set(list)];
    const dHit = distinct.filter((x) => set.has(x)).length;
    return { ocurrencias: `${hit}/${list.length}`, pct: +((100 * hit) / list.length).toFixed(1), distintos: `${dHit}/${distinct.length}`, ejemplosFaltantes: distinct.filter((x) => !set.has(x)).slice(0, 5) };
  };
  return {
    estatico: 'colectivos/feed-gtfs',
    nota: 'trip_id no se mide: el estático usa IDs secuenciales "<n>-1" que coinciden por casualidad con los del tiempo real',
    vehiclePositionsRouteId: ratio(RT_IDS.vehicleRouteIds, st.route_id),
    vehiclePositionsSimpleRouteId: ratio(RT_IDS.simpleRouteIds, st.route_id),
    tripUpdatesStopId: ratio(RT_IDS.stopTimeUpdateStopIds, st.stop_id),
  };
}

// ---------------------------------------------------------------- observación larga (--watch)

const WATCH_FEEDS = [
  { id: 'colectivos/vehiclePositions', params: {}, dato: 'max(vehicle.timestamp)' },
  { id: 'colectivos/vehiclePositionsSimple', params: {}, dato: 'max(timestamp)' },
  { id: 'colectivos/tripUpdates', params: {}, dato: 'max(trip_update.timestamp)' },
  { id: 'colectivos/serviceAlerts', params: {}, dato: 'header.timestamp' },
  { id: 'subtes/serviceAlerts', params: { json: '1' }, dato: 'header.timestamp + hash de entities' },
  { id: 'subtes/forecastGTFS', params: {}, dato: 'Header.timestamp' },
  { id: 'ecobici/gbfs/stationStatus', params: {}, dato: 'last_updated' },
];

function entityTs(sig) {
  const t = Number(String(sig).split('|')[0]);
  return Number.isFinite(t) && t > 0 ? t : null;
}

async function watchFeed(wf, seconds, every) {
  const ep = ENDPOINTS.find((e) => e.id === wf.id);
  const end = Date.now() + seconds * 1000;
  const samples = [];
  const intervalsPorEntidad = [];
  let prevIndex = null;
  while (Date.now() < end) {
    const t0 = Date.now();
    const { meta, body } = await request(wf.id, wf.params, { timeoutMs: 20_000, retries: 0 });
    const an = meta.status === 200 ? analyzeBody(ep, { name: 'watch', params: wf.params }, meta, body) : {};
    const dataTs = an.maxVehicleTimestamp ?? an.maxTripUpdateTimestamp ?? an.gbfs?.lastUpdated ?? an.header?.timestamp ?? null;
    const sample = {
      at: meta.startedAt,
      status: meta.status ?? meta.error,
      latencyMs: meta.latencyMs,
      bytes: meta.bytes ?? null,
      headerTs: an.header?.timestamp ?? null,
      datoTs: dataTs,
      entidades: an.entities ?? an.items ?? null,
    };
    if (an._hashContenido) sample.hashContenido = an._hashContenido;
    const idx = an._vehicleIndex;
    if (idx && prevIndex) {
      let comunes = 0;
      let cambiaron = 0;
      for (const [id, sig] of Object.entries(idx)) {
        if (!(id in prevIndex)) continue;
        comunes++;
        if (prevIndex[id] !== sig) {
          cambiaron++;
          const a = entityTs(prevIndex[id]);
          const b = entityTs(sig);
          if (a && b && b > a) intervalsPorEntidad.push(b - a);
        }
      }
      sample.entidadesComunes = comunes;
      sample.entidadesQueCambiaron = cambiaron;
    }
    if (idx) prevIndex = idx;
    samples.push(sample);
    const wait = every * 1000 - (Date.now() - t0);
    if (wait > 0 && Date.now() + wait < end) await sleep(wait);
    else if (Date.now() + Math.max(wait, 0) >= end) break;
  }
  const datos = samples.map((x) => x.datoTs).filter(Boolean);
  const distintos = [...new Set(datos)].sort((a, b) => a - b);
  const deltas = distintos.slice(1).map((t, i) => t - distintos[i]);
  const ok = samples.filter((x) => x.status === 200);
  const edadAlLeer = ok.filter((x) => x.datoTs).map((x) => Date.parse(x.at) / 1000 - x.datoTs);
  return {
    endpoint: `/${wf.id}`,
    params: wf.params,
    dato: wf.dato,
    muestras: samples.length,
    ok: ok.length,
    fallidas: samples.length - ok.length,
    datoTsDistintos: distintos.length,
    deltasEntreActualizaciones: stats(deltas),
    deltasCrudos: deltas.slice(0, 40),
    edadDelDatoAlLeer: stats(edadAlLeer),
    intervaloReportePorEntidad: stats(intervalsPorEntidad),
    hashesDistintos: samples.some((x) => x.hashContenido) ? new Set(samples.map((x) => x.hashContenido).filter(Boolean)).size : undefined,
    latencia: stats(ok.map((x) => x.latencyMs)),
    detalle: samples,
  };
}

async function probeWatch(seconds, every) {
  console.log(`\nObservación larga: ${seconds} s, cada ${every} s, ${WATCH_FEEDS.length} feeds…`);
  const res = await Promise.all(WATCH_FEEDS.map(async (wf, i) => {
    await sleep(i * 700);
    return watchFeed(wf, seconds, every);
  }));
  return { duracionSegundos: seconds, intervaloSegundos: every, feeds: res };
}

// ---------------------------------------------------------------- auth y rate limit

async function probeAuth() {
  const path = 'subtes/serviceAlerts';
  const out = [];
  const cases = [
    { caso: 'sin credenciales', url: () => request(path, { json: '1' }, { auth: false }) },
    {
      caso: 'secret inválido',
      url: async () => {
        const u = new URL(`${BASE}/${path}`);
        u.searchParams.set('json', '1');
        u.searchParams.set('client_id', CLIENT_ID);
        u.searchParams.set('client_secret', 'invalido-transportate-probe');
        const t0 = performance.now();
        const res = await fetch(u, { signal: AbortSignal.timeout(30_000) });
        const body = Buffer.from(await res.arrayBuffer());
        const { relevant, names } = pickHeaders(res.headers);
        return { meta: { method: 'GET', url: redact(u.toString()), startedAt: new Date().toISOString(), status: res.status, statusText: res.statusText, contentType: res.headers.get('content-type'), headers: relevant, headerNames: names, bytes: body.length, latencyMs: Math.round(performance.now() - t0) }, body };
      },
    },
  ];
  for (const c of cases) {
    const { meta, body } = await c.url();
    const fixtureVariant = { name: c.caso === 'sin credenciales' ? 'noauth' : 'badsecret', params: { json: '1' } };
    if (meta.status !== 200) writeFixture({ id: path }, fixtureVariant, meta, body, { formato: 'error' });
    out.push({ caso: c.caso, status: meta.status, contentType: meta.contentType, bytes: meta.bytes, latencyMs: meta.latencyMs, headers: meta.headers, cuerpo: body ? redact(body.subarray(0, 400).toString('utf8')) : meta.error });
  }
  return out;
}

async function probeBurst(n = 15) {
  // Ráfaga corta y secuencial sobre un endpoint liviano para ver si aparece 429 o headers de cuota.
  const statuses = {};
  const latencies = [];
  const rateHeaders = new Set();
  for (let i = 0; i < n; i++) {
    const { meta } = await request('subtes/serviceAlerts', { json: '1' }, { timeoutMs: 20_000, retries: 0 });
    statuses[meta.status ?? 'error'] = (statuses[meta.status ?? 'error'] ?? 0) + 1;
    latencies.push(meta.latencyMs);
    for (const h of meta.headerNames ?? []) if (/rate|limit|quota|retry/i.test(h)) rateHeaders.add(h);
  }
  return { endpoint: '/subtes/serviceAlerts?json=1', requests: n, modo: 'secuencial, sin pausa', statuses, latencia: stats(latencies), headersDeCuota: [...rateHeaders] };
}

// ---------------------------------------------------------------- consola

function fmtBytes(b) {
  if (b == null) return '-';
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

function printSummary(run) {
  const rows = [];
  for (const r of run.endpoints) {
    if (r.kind === 'zip') {
      const g = r.get ?? {};
      rows.push([r.id, 'HEAD', r.head?.status ?? r.head?.error, fmtBytes(Number(r.head?.headers?.['content-length']) || null), `${r.head?.latencyMs ?? '-'} ms`, r.head?.headers?.['last-modified'] ?? '-']);
      rows.push([r.id, 'GET', g.status ?? (g.reusadoDeCache ? 'cache' : g.error ?? '-'), fmtBytes(g.bytes), g.latencyMs ? `${g.latencyMs} ms` : '-', r.zip?.tablas ? Object.entries(r.zip.tablas).filter(([k]) => /routes|stops|trips|agency/.test(k)).map(([k, t]) => `${k.replace('.txt', '')}=${t.filas}`).join(' ') : r.zip?.error ?? '']);
      continue;
    }
    for (const v of r.variantes) {
      const an = v.analisis ?? {};
      const age = an.header?.edadSegundos ?? an.gbfs?.edadSegundos ?? (an.maxVehicleTimestamp ? Math.round(Date.parse(v.startedAt) / 1000 - an.maxVehicleTimestamp) : null);
      const extra = [an.formato, an.entities != null ? `${an.entities} ent` : an.items != null ? `${an.items} items` : an.features != null ? `${an.features} feat` : null, age != null ? `edad ${age} s` : null, v.error ?? null].filter(Boolean).join(', ');
      rows.push([r.id, v.variante, v.status ?? 'ERR', fmtBytes(v.bytes), `${v.latencyMs} ms`, extra]);
    }
    if (r.cadencia) rows.push([r.id, `cadencia x${r.cadencia.muestras.length}`, r.cadencia.variante, '', '', `ts distintos=${r.cadencia.timestampsDistintos} deltas=[${r.cadencia.deltasTimestamp.join(',')}]${r.cadencia.maxVehicleTimestampDistintos ? ` max(vehicle.ts) distintos=${r.cadencia.maxVehicleTimestampDistintos}` : ''}${r.cadencia.maxTripUpdateTimestampDistintos ? ` max(trip_update.ts) distintos=${r.cadencia.maxTripUpdateTimestampDistintos}` : ''}`]);
  }
  const widths = [36, 18, 6, 10, 10];
  console.log('\n' + ['endpoint', 'variante', 'status', 'bytes', 'latencia', 'detalle'].map((h, i) => (widths[i] ? h.padEnd(widths[i]) : h)).join(' '));
  for (const row of rows) console.log(row.map((c, i) => (widths[i] ? String(c ?? '').padEnd(widths[i]) : String(c ?? ''))).join(' '));
  console.log('\nauth:', run.auth.map((a) => `${a.caso} → ${a.status}`).join(' | '));
  console.log('ráfaga:', JSON.stringify(run.burst.statuses), 'headers de cuota:', run.burst.headersDeCuota.join(',') || 'ninguno');
  if (run.cruceTiempoRealEstatico) {
    const c = run.cruceTiempoRealEstatico;
    console.log(`cruce RT↔estático colectivos: route_id vehículos ${c.vehiclePositionsRouteId?.pct ?? '-'}%, stop_id arribos ${c.tripUpdatesStopId?.pct ?? '-'}%`);
  }
  if (run.observacionLarga) {
    console.log(`\nobservación larga (${run.observacionLarga.duracionSegundos} s cada ${run.observacionLarga.intervaloSegundos} s):`);
    for (const f of run.observacionLarga.feeds) {
      const d = f.deltasEntreActualizaciones;
      const e = f.edadDelDatoAlLeer;
      const r = f.intervaloReportePorEntidad;
      console.log(`  ${f.endpoint.padEnd(36)} ok ${f.ok}/${f.muestras}  dato distintos=${f.datoTsDistintos}  Δ p50=${d?.p50 ?? '-'} s  edad p50=${e?.p50 ?? '-'} s max=${e?.max ?? '-'} s  reporte/entidad p50=${r?.p50 ?? '-'} s${f.hashesDistintos ? `  contenidos distintos=${f.hashesDistintos}` : ''}`);
    }
  }
  console.log(`fiabilidad: ${run.fiabilidad.fallidos}/${run.fiabilidad.intentos} intentos fallidos (${run.fiabilidad.timeouts} timeouts, ${run.fiabilidad.erroresRed} errores de red)`);
  console.log(`fixtures: ${run.fixtures.filter((f) => !f.omitido).length} escritos, ${run.fixtures.filter((f) => f.omitido).length} omitidos`);
}

// ---------------------------------------------------------------- README de fixtures

function writeFixturesReadme(run) {
  if (args['no-fixtures']) return;
  if (ONLY) {
    console.log('(--only: no se regenera apps/proxy/test/fixtures/README.md)');
    return;
  }
  const written = run.fixtures.filter((f) => !f.omitido).sort((a, b) => a.archivo.localeCompare(b.archivo));
  const skipped = run.fixtures.filter((f) => f.omitido);
  const q = (p) => (Object.keys(p ?? {}).length ? '`' + new URLSearchParams(p).toString() + '`' : '—');
  const lines = [
    '# Fixtures reales de la API Transporte GCBA',
    '',
    `Capturados por \`tools/api-probe/probe.mjs\` entre ${run.inicio} y ${run.fin} (UTC) contra \`${run.base}\`. Son los cuerpos **crudos** de la primera muestra de cada endpoint/variante, sin credenciales. Se regeneran corriendo el probe (ver [\`tools/api-probe/README.md\`](../../../../tools/api-probe/README.md)); análisis en [\`docs/01-api-transporte.md\`](../../../../docs/01-api-transporte.md).`,
    '',
    'Convención: `<servicio>/<endpoint>[.<variante>].<ext>`. Variantes: `json=1` (mismo feed en JSON), `geo` (`x=-58.3816&y=-34.6037&radio=100&formato=geojson`), `latlon` (`lat/lon/radius` del RAML), `noauth` / `badsecret` (casos de auth). `.error.txt` = respuesta no-200, cuerpo vacío o formato inesperado, con cabecera `#` de metadatos seguida del cuerpo crudo.',
    '',
    '| Archivo | Endpoint | Params | Status | Content-Type | Bytes | Capturado (UTC) | Nota |',
    '|---|---|---|---|---|---:|---|---|',
    ...written.map((f) => `| \`${f.archivo}\` | \`${f.endpoint}\` | ${q(f.params)} | ${f.status ?? 'sin respuesta'} | ${f.contentType ? '`' + f.contentType + '`' : '—'} | ${f.bytes} | ${f.capturadoEn} | ${f.nota ?? ''} |`),
  ];
  if (skipped.length) {
    lines.push('', '## No guardados', '', ...skipped.map((f) => `- \`${f.archivo}\` (\`${f.endpoint}\`): ${f.omitido}.`));
  }
  lines.push('', `## Particularidades que los tests del proxy tienen que cubrir

- \`subtes/serviceAlerts.pb\`: protobuf **corrupto en origen**, no decodifica. Sirve para testear el camino de "upstream inválido"; el adaptador real usa \`serviceAlerts.json=1.json\`.
- \`subtes/forecastGTFS*.json\`: formato propio (\`Header\`/\`Entity\`/\`Linea\`/\`Estaciones\`), no GTFS-RT. En esta captura está **congelado** (\`Header.timestamp\` 2026-10-24): sirve para testear la detección de dato viejo.
- \`colectivos/*.json=1.json\`: claves con prefijo \`_\` y \`extensionObject\` (serialización Java), enums numéricos.
- \`colectivos/*.pb\`: \`header.timestamp\` = hora del request; la frescura sale de \`vehicle.timestamp\` o \`trip_update.timestamp\`. Incluyen vehículos sin viaje, fuera del AMBA y con timestamps de horas atrás.
- \`transito/cortes*.error.txt\`: \`500 text/plain\` con el path como cuerpo; \`transito/estacionamientos.error.txt\`: \`500\` por falta de \`x\` (debería ser 400).
- \`trenes/*.error.txt\` y \`subtes/tripUpdates*.error.txt\`: \`404\` "No listener…" en dos formatos distintos (\`text/plain\` y JSON).`);
  lines.push('', 'Los zips GTFS estáticos no se guardan acá (pesan decenas/cientos de MB); el probe los baja a `~/.cache/transportate/gtfs/`.', '');
  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(join(FIXTURES_DIR, 'README.md'), redact(lines.join('\n')));
}

// ---------------------------------------------------------------- main

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`api-probe ${startedAt} — base ${BASE} — ${SAMPLES} muestras cada ${INTERVAL_S} s`);
  // Corrida completa: se limpian los fixtures previos para no dejar archivos de variantes viejas
  // (p. ej. un .error.txt de una corrida anterior junto al .pb nuevo).
  if (!ONLY && !args['no-fixtures']) rmSync(FIXTURES_DIR, { recursive: true, force: true });
  const selected = ENDPOINTS.filter((e) => !ONLY || ONLY.some((o) => e.id.includes(o)));
  const dynamic = selected.filter((e) => e.kind !== 'zip');
  const statics = selected.filter((e) => e.kind === 'zip');

  // Los dinámicos corren en paralelo con arranque escalonado (1 s) para no generar ráfagas.
  const dynPromise = Promise.all(
    dynamic.map(async (ep, i) => {
      await sleep(i * 1000);
      const r = await probeDynamic(ep);
      const v0 = r.variantes[0];
      console.log(`  ✓ ${ep.id} → ${v0.status ?? v0.error} (${fmtBytes(v0.bytes)}, ${v0.latencyMs} ms)`);
      return r;
    }),
  );
  // Los estáticos van en serie (son pesados) y en paralelo con los dinámicos.
  const staticPromise = (async () => {
    const out = [];
    for (const ep of statics) {
      const r = await probeStatic(ep);
      console.log(`  ✓ ${ep.id} → HEAD ${r.head?.status ?? r.head?.error}, GET ${r.get?.status ?? (r.get?.reusadoDeCache ? 'cache' : r.get?.error ?? '-')} (${fmtBytes(r.get?.bytes)})`);
      out.push(r);
    }
    return out;
  })();
  const [dyn, sta] = await Promise.all([dynPromise, staticPromise]);
  const cruce = crossCheck();
  const auth = await probeAuth();
  const burst = await probeBurst();
  const watch = args.watch ? await probeWatch(Number(args.watch), Number(args['watch-every'] ?? 15)) : null;

  const order = new Map(ENDPOINTS.map((e, i) => [e.id, i]));
  const run = {
    herramienta: 'tools/api-probe/probe.mjs',
    base: BASE,
    inicio: startedAt,
    fin: new Date().toISOString(),
    node: process.version,
    muestrasRT: SAMPLES,
    intervaloSegundos: INTERVAL_S,
    endpoints: [...dyn, ...sta].sort((a, b) => order.get(a.id) - order.get(b.id)),
    auth,
    burst,
    cruceTiempoRealEstatico: cruce,
    observacionLarga: watch,
    fiabilidad: { ...reliability, tasaFallo: reliability.intentos ? +(reliability.fallidos / reliability.intentos).toFixed(3) : 0 },
    fixtures: fixtureLog,
  };
  const json = redact(JSON.stringify(run, null, 2));
  writeFileSync(join(HERE, 'last-run.json'), json + '\n');
  writeFixturesReadme(run);
  printSummary(run);
  console.log(`\nResultado completo en tools/api-probe/last-run.json`);
}

main().catch((err) => {
  console.error(redact(err.stack ?? String(err)));
  process.exit(1);
});
