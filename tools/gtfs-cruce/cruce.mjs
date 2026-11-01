#!/usr/bin/env node
// Cruce de fuentes estáticas candidatas (GTFS y datasets de paradas) con los IDs
// reales del tiempo real de colectivos (fixtures de Fase 1).
//
// Uso:  node tools/gtfs-cruce/cruce.mjs            (desde la raíz del repo o desde esta carpeta)
//       GTFS_CACHE=/otra/ruta node cruce.mjs       (default: ~/.cache/transportate/gtfs)
//
// No descarga nada: las fuentes se bajan a mano a GTFS_CACHE (ver README.md).
// Lee los .zip con `unzip -p` (streaming) y nunca abre stop_times.txt (1,4 GB).
// Escribe el resultado en tools/gtfs-cruce/last-run.json.

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const FIX = join(REPO, 'apps/proxy/test/fixtures/colectivos');
const CACHE = process.env.GTFS_CACHE ?? join(homedir(), '.cache/transportate/gtfs');
const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

// Bounding box aproximado de CABA (para medir cuánto del estático cae en la Ciudad).
const CABA = { minLat: -34.705, maxLat: -34.527, minLon: -58.531, maxLon: -58.335 };
const RADIO_M = 40; // radio para considerar "la misma parada" en el cruce espacial

const CANDIDATOS = [
  { id: 'api-feed-gtfs', tipo: 'gtfs', archivo: 'colectivos_feed-gtfs.zip',
    nombre: 'API GCBA /colectivos/feed-gtfs' },
  { id: 'api-feed-gtfs-frequency', tipo: 'gtfs', archivo: 'colectivos_feed-gtfs-frequency.zip',
    nombre: 'API GCBA /colectivos/feed-gtfs-frequency' },
  { id: 'ba-cdn-colectivos-gtfs', tipo: 'gtfs', archivo: 'ba-cdn/colectivos-gtfs.zip',
    nombre: 'BA Data colectivos-gtfs (CDN) = Mobility Database mdb-1220' },
  { id: 'ba-colectivos-paradas', tipo: 'paradas-csv', archivo: 'ba-paradas/paradas-de-colectivo.csv',
    nombre: 'BA Data colectivos-paradas (CSV)' },
  { id: 'nacion-recorridos-kml', tipo: 'kml', archivo: 'nacion/lineas_jn_rmba_cnrt.kml',
    nombre: 'Nación: Recorridos de servicios de colectivos AMBA (KML, CNRT)' },
  { id: 'osm-bus-stop', tipo: 'osm', archivo: 'osm/bus_stops.json',
    nombre: 'OpenStreetMap highway=bus_stop (Overpass, bbox CABA)' },
];

// ---------------------------------------------------------------- utilidades

function parseCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Recorre filas de un CSV (dentro de un zip o suelto) llamando a onRow(obj). */
async function eachRow(source, onRow, { zipEntry } = {}) {
  const child = zipEntry ? spawn('unzip', ['-p', source, zipEntry]) : null;
  const input = child ? child.stdout : (await import('node:fs')).createReadStream(source);
  const rl = createInterface({ input, crlfDelay: Infinity });
  let header = null;
  for await (let line of rl) {
    if (!line) continue;
    if (!header) { header = parseCsvLine(line.replace(/^﻿/, '')).map((h) => h.trim()); continue; }
    const cols = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (cols[i] ?? '').trim();
    onRow(row);
  }
  if (child) await new Promise((r) => child.on('close', r));
  return header;
}

function zipEntries(zip) {
  return new Promise((res, rej) => {
    const c = spawn('unzip', ['-Z1', zip]);
    let out = '';
    c.stdout.on('data', (d) => (out += d));
    c.on('close', (code) => (code === 0 ? res(out.split('\n').filter(Boolean)) : rej(new Error(`unzip -Z1 ${zip}: ${code}`))));
  });
}

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const normLinea = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, '');
const numLinea = (s) => (normLinea(s).match(/^\d+/) ?? [null])[0];
const MOJIBAKE = /Ã[\u0080-¿¡-ÿ]|Â[ -¿]|�/;
// Nombre de empresa normalizado: sin tildes, sin puntuación ni sufijos societarios.
const normAgencia = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/Â´|´|'/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(S ?A ?C?|S ?R ?L|S ?A ?T|S ?A ?C ?I|SA|SRL|SAC|SACI|SAT|UTE)\b/g, ' ').replace(/\s+/g, ' ').trim();
const enCaba = (lat, lon) => lat >= CABA.minLat && lat <= CABA.maxLat && lon >= CABA.minLon && lon <= CABA.maxLon;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Grilla simple para búsqueda de vecinos (celdas de ~110 m). */
class Grilla {
  constructor(cell = 0.001) { this.cell = cell; this.map = new Map(); }
  key(lat, lon) { return `${Math.floor(lat / this.cell)}:${Math.floor(lon / this.cell)}`; }
  add(lat, lon, v) { const k = this.key(lat, lon); (this.map.get(k) ?? this.map.set(k, []).get(k)).push({ lat, lon, v }); }
  nearest(lat, lon, maxM) {
    const cy = Math.floor(lat / this.cell), cx = Math.floor(lon / this.cell);
    let best = null;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const p of this.map.get(`${cy + dy}:${cx + dx}`) ?? []) {
        const d = haversine(lat, lon, p.lat, p.lon);
        if (d <= maxM && (!best || d < best.d)) best = { d, v: p.v };
      }
    }
    return best;
  }
}

function quantiles(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const q = (p) => Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]);
  return { n: s.length, p50: q(0.5), p90: q(0.9), max: Math.round(s[s.length - 1]) };
}

// ---------------------------------------------------------------- tiempo real

function decodePb(file) {
  return FeedMessage.toObject(FeedMessage.decode(readFileSync(file)), { longs: Number });
}

function cargarTiempoReal() {
  const vp = decodePb(join(FIX, 'vehiclePositions.pb'));
  const tu = decodePb(join(FIX, 'tripUpdates.pb'));
  const simple = JSON.parse(readFileSync(join(FIX, 'vehiclePositionsSimple.json'), 'utf8'));

  const rt = {
    routeIds: new Set(), tripIds: new Set(), stopIds: new Set(), agencyIds: new Set(),
    shortNames: new Set(), shortNameByRoute: new Map(), agencyNames: new Set(), shortNamesEnCABA: new Set(),
    stopPredicciones: [], // stop_id por cada stop_time_update (ponderado)
    vehiculos: [],        // { routeId, stopId, lat, lon } desde vehiclePositions
    stopIdsTU: new Set(), stopIdsVP: new Set(),
  };
  for (const e of vp.entity) {
    const v = e.vehicle; if (!v) continue;
    const r = v.trip?.routeId, t = v.trip?.tripId, s = v.stopId;
    if (r) rt.routeIds.add(r); if (t) rt.tripIds.add(t);
    if (s) { rt.stopIds.add(s); rt.stopIdsVP.add(s); }
    const p = v.position;
    if (p && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180) {
      rt.vehiculos.push({ routeId: r, stopId: s, lat: p.latitude, lon: p.longitude, seq: v.currentStopSequence });
    }
  }
  for (const e of tu.entity) {
    const u = e.tripUpdate; if (!u) continue;
    if (u.trip?.routeId) rt.routeIds.add(u.trip.routeId);
    if (u.trip?.tripId) rt.tripIds.add(u.trip.tripId);
    for (const st of u.stopTimeUpdate ?? []) {
      if (!st.stopId) continue;
      rt.stopIds.add(st.stopId); rt.stopIdsTU.add(st.stopId); rt.stopPredicciones.push(st.stopId);
    }
  }
  for (const v of simple) {
    const r = String(v.route_id);
    rt.routeIds.add(r);
    if (v.tip_id) rt.tripIds.add(String(v.tip_id));
    if (v.agency_id != null) rt.agencyIds.add(String(v.agency_id));
    if (v.agency_name) rt.agencyNames.add(normAgencia(v.agency_name));
    if (v.route_short_name) {
      rt.shortNames.add(normLinea(v.route_short_name));
      rt.shortNameByRoute.set(r, normLinea(v.route_short_name));
      if (enCaba(v.latitude, v.longitude)) rt.shortNamesEnCABA.add(normLinea(v.route_short_name));
    }
  }
  const formato = (s) => (/^S\d+$/.test(s) ? 'S + dígitos' : /^\d+$/.test(s) ? 'numérico' : 'otro');
  const formatos = {};
  for (const s of rt.stopIds) formatos[formato(s)] = (formatos[formato(s)] ?? 0) + 1;
  rt.formato = formato;
  return {
    rt,
    resumen: {
      vehiclePositions: vp.entity.length, tripUpdates: tu.entity.length, simple: simple.length,
      routeIds: rt.routeIds.size, tripIds: rt.tripIds.size, stopIds: rt.stopIds.size,
      stopIdsSoloTU: rt.stopIdsTU.size, stopIdsSoloVP: rt.stopIdsVP.size,
      predicciones: rt.stopPredicciones.length, shortNames: rt.shortNames.size, agencyIds: rt.agencyIds.size,
      agencyNames: rt.agencyNames.size, shortNamesConVehiculosEnCABA: rt.shortNamesEnCABA.size,
      stopIdPorFormato: formatos,
      muestras: {
        routeId: [...rt.routeIds].slice(0, 4), tripId: [...rt.tripIds].slice(0, 3),
        stopId: [...rt.stopIdsTU].slice(0, 4), shortName: [...rt.shortNames].slice(0, 5),
      },
      // Plan B: cuántos stop_id de arribos aparecen también como stop_id de un vehículo con posición
      stopIdsTUconVehiculo: pct([...rt.stopIdsTU].filter((s) => rt.stopIdsVP.has(s)).length, rt.stopIdsTU.size),
    },
  };
}

// ---------------------------------------------------------------- candidatos GTFS

async function analizarGtfs(zip, rt) {
  const entries = await zipEntries(zip);
  const has = (f) => entries.includes(f);
  const out = { archivos: entries, feedInfo: null, rangoServicio: null, conteos: {}, bbox: null, mojibake: {}, muestras: {} };

  if (has('feed_info.txt')) { const rows = []; await eachRow(zip, (r) => rows.push(r), { zipEntry: 'feed_info.txt' }); out.feedInfo = rows[0] ?? null; }

  let minD = null, maxD = null;
  const upd = (d) => { if (!/^\d{8}$/.test(d)) return; if (!minD || d < minD) minD = d; if (!maxD || d > maxD) maxD = d; };
  if (has('calendar.txt')) await eachRow(zip, (r) => { upd(r.start_date); upd(r.end_date); }, { zipEntry: 'calendar.txt' });
  if (has('calendar_dates.txt')) await eachRow(zip, (r) => upd(r.date), { zipEntry: 'calendar_dates.txt' });
  out.rangoServicio = { desde: minD, hasta: maxD };

  const agencies = new Set(); const agencyNames = new Set(); let mojA = 0;
  await eachRow(zip, (r) => {
    agencies.add(r.agency_id); agencyNames.add(normAgencia(r.agency_name));
    if (MOJIBAKE.test(r.agency_name ?? '')) mojA++;
  }, { zipEntry: 'agency.txt' });

  const routes = new Map(); let mojR = 0;
  await eachRow(zip, (r) => {
    routes.set(r.route_id, { short: normLinea(r.route_short_name), agency: r.agency_id });
    if (MOJIBAKE.test(r.route_long_name ?? '') || MOJIBAKE.test(r.route_desc ?? '')) mojR++;
  }, { zipEntry: 'routes.txt' });

  const stops = new Map(); const grilla = new Grilla(); let mojS = 0, enCaba = 0;
  let bbox = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
  await eachRow(zip, (r) => {
    const lat = Number(r.stop_lat), lon = Number(r.stop_lon);
    stops.set(r.stop_id, { lat, lon, name: r.stop_name });
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0) {
      bbox = { minLat: Math.min(bbox.minLat, lat), maxLat: Math.max(bbox.maxLat, lat), minLon: Math.min(bbox.minLon, lon), maxLon: Math.max(bbox.maxLon, lon) };
      if (lat >= CABA.minLat && lat <= CABA.maxLat && lon >= CABA.minLon && lon <= CABA.maxLon) enCaba++;
      grilla.add(lat, lon, r.stop_id);
    }
    if (MOJIBAKE.test(r.stop_name ?? '')) mojS++;
  }, { zipEntry: 'stops.txt' });

  const trips = new Set();
  await eachRow(zip, (r) => trips.add(r.trip_id), { zipEntry: 'trips.txt' });

  const shortNames = new Set([...routes.values()].map((r) => r.short).filter(Boolean));
  out.conteos = { agency: agencies.size, routes: routes.size, stops: stops.size, trips: trips.size, routeShortNames: shortNames.size, stopsEnCABA: enCaba };
  out.bbox = bbox;
  out.mojibake = { agency: mojA, routes: mojR, stops: mojS };
  out.muestras = { agencyId: [...agencies].slice(0, 3), routeId: [...routes.keys()].slice(0, 4), stopId: [...stops.keys()].slice(0, 4), tripId: [...trips].slice(0, 3) };

  // --- cruce por id
  const inRoutes = [...rt.routeIds].filter((r) => routes.has(r));
  const inTrips = [...rt.tripIds].filter((t) => trips.has(t));
  const inStops = [...rt.stopIds].filter((s) => stops.has(s));
  const predOk = rt.stopPredicciones.filter((s) => stops.has(s)).length;

  // --- coherencia de ids que "cruzan": ¿el route_id significa la misma línea?
  let mismoNombre = 0, conNombre = 0;
  for (const r of inRoutes) {
    const rtName = rt.shortNameByRoute.get(r); if (!rtName) continue;
    conNombre++; if (routes.get(r).short === rtName) mismoNombre++;
  }
  // --- ¿los stop_id que cruzan están cerca del vehículo que dice ir hacia ellos?
  const dist = [];
  for (const v of rt.vehiculos) {
    const s = v.stopId && stops.get(v.stopId);
    if (s && Number.isFinite(s.lat)) dist.push(haversine(v.lat, v.lon, s.lat, s.lon));
  }
  // --- stop_id por formato (el RT mezcla códigos numéricos con códigos "S…")
  const porFormato = {};
  for (const s of rt.stopIds) {
    const f = rt.formato(s); porFormato[f] ??= { ok: 0, total: 0 };
    porFormato[f].total++; if (stops.has(s)) porFormato[f].ok++;
  }
  for (const f of Object.values(porFormato)) f.pct = pct(f.ok, f.total);
  const agOk = [...rt.agencyNames].filter((a) => agencyNames.has(a)).length;
  // --- cruce por nombre de línea
  const nombresOk = [...rt.shortNames].filter((n) => shortNames.has(n)).length;
  const numsGtfs = new Set([...shortNames].map(numLinea).filter(Boolean));
  const cabaPorNumero = [...rt.shortNamesEnCABA].filter((n) => numsGtfs.has(numLinea(n))).length;
  const rutasSinId = [...rt.shortNameByRoute.entries()].filter(([r]) => !routes.has(r));
  const rescatadasPorNombre = rutasSinId.filter(([, n]) => shortNames.has(n)).length;

  out.cruce = {
    routeId: { ok: inRoutes.length, total: rt.routeIds.size, pct: pct(inRoutes.length, rt.routeIds.size) },
    tripId: { ok: inTrips.length, total: rt.tripIds.size, pct: pct(inTrips.length, rt.tripIds.size),
      nota: 'Los trip_id del RT y de los GTFS son secuenciales "<n>-1": un match no implica el mismo viaje.' },
    stopId: { ok: inStops.length, total: rt.stopIds.size, pct: pct(inStops.length, rt.stopIds.size) },
    prediccionesConStop: { ok: predOk, total: rt.stopPredicciones.length, pct: pct(predOk, rt.stopPredicciones.length) },
    stopIdPorFormato: porFormato,
    routeIdMismoShortName: { ok: mismoNombre, total: conNombre, pct: pct(mismoNombre, conNombre),
      nota: 'De los route_id que cruzan y tienen nombre en vehiclePositionsSimple: cuántos son la misma línea. 0 % = ids reasignados, el cruce por id es casual.' },
    distanciaVehiculoAStopId_m: quantiles(dist),
    vehiculosConStopIdAMenosDe1km: { ok: dist.filter((d) => d < 1000).length, total: dist.length, pct: pct(dist.filter((d) => d < 1000).length, dist.length) },
    agencyName: { ok: agOk, total: rt.agencyNames.size, pct: pct(agOk, rt.agencyNames.size) },
    shortName: { ok: nombresOk, total: rt.shortNames.size, pct: pct(nombresOk, rt.shortNames.size) },
    shortNameEnCABAPorNumero: { ok: cabaPorNumero, total: rt.shortNamesEnCABA.size, pct: pct(cabaPorNumero, rt.shortNamesEnCABA.size) },
    routeIdsSinMatchRescatadosPorNombre: { ok: rescatadasPorNombre, total: rutasSinId.length, pct: pct(rescatadasPorNombre, rutasSinId.length) },
  };
  return { out, stops, grilla };
}

// ---------------------------------------------------------------- paradas sin GTFS

async function analizarParadasCsv(file, rt) {
  const grilla = new Grilla(); let n = 0, enCaba = 0; const lineas = new Set(); let mojS = 0;
  let bbox = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
  const header = await eachRow(file, (r) => {
    const lat = Number(r.coord_Y), lon = Number(r.coord_X);
    n++;
    const ls = [];
    for (let i = 1; i <= 6; i++) { const l = r[`L${i}`]; if (l) { ls.push(normLinea(l)); lineas.add(normLinea(l)); } }
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      bbox = { minLat: Math.min(bbox.minLat, lat), maxLat: Math.max(bbox.maxLat, lat), minLon: Math.min(bbox.minLon, lon), maxLon: Math.max(bbox.maxLon, lon) };
      if (lat >= CABA.minLat && lat <= CABA.maxLat && lon >= CABA.minLon && lon <= CABA.maxLon) enCaba++;
      grilla.add(lat, lon, { calle: r.CALLE, altura: r['ALT PLANO'], lineas: ls });
    }
    if (MOJIBAKE.test(r.CALLE ?? '')) mojS++;
  });
  const lineasNum = new Set([...lineas].map(numLinea).filter(Boolean));
  const exact = [...rt.shortNames].filter((s) => lineas.has(s)).length;
  const porNumero = [...rt.shortNames].filter((s) => lineasNum.has(numLinea(s))).length;
  const cabaPorNumero = [...rt.shortNamesEnCABA].filter((s) => lineasNum.has(numLinea(s))).length;
  return {
    out: {
      columnas: header, conteos: { paradas: n, lineasDistintas: lineas.size, paradasEnCABA: enCaba }, bbox,
      mojibake: { calles: mojS }, muestras: { lineas: [...lineas].slice(0, 8) },
      cruce: {
        stopId: { ok: 0, total: rt.stopIds.size, pct: 0, nota: 'El dataset no tiene stop_id: solo calle, altura, coordenadas y hasta 6 líneas con sentido.' },
        shortNameExacto: { ok: exact, total: rt.shortNames.size, pct: pct(exact, rt.shortNames.size) },
        shortNamePorNumero: { ok: porNumero, total: rt.shortNames.size, pct: pct(porNumero, rt.shortNames.size),
          nota: 'Compara solo la parte numérica ("228B" → "228"); el RT trae ramal con letra.' },
        shortNameEnCABAPorNumero: { ok: cabaPorNumero, total: rt.shortNamesEnCABA.size, pct: pct(cabaPorNumero, rt.shortNamesEnCABA.size),
          nota: 'Solo líneas con al menos un vehículo dentro del bbox de CABA en el fixture.' },
      },
    },
    grilla,
  };
}

/** KML de recorridos de líneas de jurisdicción nacional: solo trazados, sin paradas ni ids. */
function analizarKml(file, rt) {
  const txt = readFileSync(file, 'utf8');
  const placemarks = txt.split('<Placemark').slice(1);
  const lineas = new Set(), empresas = new Set(); let conGeom = 0;
  for (const p of placemarks) {
    const val = (n) => (p.match(new RegExp(`<SimpleData name="${n}">([^<]*)`)) ?? [])[1];
    const l = val('Linea'); if (l) lineas.add(String(Number(l)));
    const e = val('Razon_soci'); if (e) empresas.add(normAgencia(e));
    if (/<coordinates>/.test(p)) conGeom++;
  }
  const caba = [...rt.shortNamesEnCABA].filter((s) => lineas.has(numLinea(s) ?? '')).length;
  const emp = [...rt.agencyNames].filter((a) => empresas.has(a)).length;
  return {
    conteos: { recorridos: placemarks.length, conGeometria: conGeom, lineasDistintas: lineas.size, empresas: empresas.size },
    cruce: {
      stopId: { ok: 0, pct: 0, nota: 'Sin paradas: solo trazados por línea, ramal y sentido.' },
      shortNameEnCABAPorNumero: { ok: caba, total: rt.shortNamesEnCABA.size, pct: pct(caba, rt.shortNamesEnCABA.size),
        nota: 'Solo cubre líneas de jurisdicción nacional (las que cruzan CABA ↔ provincia).' },
      agencyName: { ok: emp, total: rt.agencyNames.size, pct: pct(emp, rt.agencyNames.size) },
    },
  };
}

function analizarOsm(file) {
  const els = JSON.parse(readFileSync(file, 'utf8')).elements ?? [];
  const grilla = new Grilla(); let conNombre = 0, conRef = 0, conRouteRef = 0;
  for (const e of els) {
    const t = e.tags ?? {};
    if (t.name) conNombre++; if (t.ref) conRef++; if (t.route_ref) conRouteRef++;
    grilla.add(e.lat, e.lon, { name: t.name ?? null });
  }
  return {
    out: {
      conteos: { paradas: els.length, conNombre, conRef, conRouteRef },
      cruce: { stopId: { ok: 0, pct: 0, nota: 'OSM no tiene los stop_id del RT; ref/route_ref casi no se usan en CABA.' } },
    },
    grilla,
  };
}

/** Cobertura espacial: de los stop_id RT ubicables (vía un GTFS con coordenadas), cuántos tienen
 *  una parada del dataset a <= RADIO_M metros. Mide si el dataset describe las mismas paradas físicas. */
function coberturaEspacial(stopIdsRT, stopsGtfs, grilla) {
  let ubicables = 0, cubiertas = 0; const d = [];
  for (const s of stopIdsRT) {
    const g = stopsGtfs.get(s); if (!g || !Number.isFinite(g.lat)) continue;
    if (!(g.lat >= CABA.minLat && g.lat <= CABA.maxLat && g.lon >= CABA.minLon && g.lon <= CABA.maxLon)) continue;
    ubicables++;
    const n = grilla.nearest(g.lat, g.lon, RADIO_M);
    if (n) { cubiertas++; d.push(n.d); }
  }
  return { radio_m: RADIO_M, stopIdsRTubicadosEnCABA: ubicables, conParadaCerca: cubiertas, pct: pct(cubiertas, ubicables), distancia_m: quantiles(d) };
}

// ---------------------------------------------------------------- main

async function main() {
  const t0 = Date.now();
  const { rt, resumen } = cargarTiempoReal();
  const resultados = [];
  let referencia = null; // GTFS con más stop_id cruzados: sirve para ubicar stop_id RT en el mapa

  for (const c of CANDIDATOS) {
    const path = join(CACHE, c.archivo);
    if (!existsSync(path)) { resultados.push({ ...c, estado: 'no descargado', ruta: path }); console.warn(`⚠ falta ${path}`); continue; }
    const st = statSync(path);
    const base = { ...c, estado: 'ok', bytes: st.size, mtime: st.mtime.toISOString() };
    process.stderr.write(`· ${c.id}… `);
    if (c.tipo === 'gtfs') {
      const { out, stops, grilla } = await analizarGtfs(path, rt);
      resultados.push({ ...base, ...out });
      if (!referencia || out.cruce.stopId.ok > referencia.ok) referencia = { id: c.id, ok: out.cruce.stopId.ok, stops, grilla };
    } else if (c.tipo === 'paradas-csv') {
      const { out, grilla } = await analizarParadasCsv(path, rt);
      resultados.push({ ...base, ...out, _grilla: grilla });
    } else if (c.tipo === 'kml') {
      resultados.push({ ...base, ...analizarKml(path, rt) });
    } else if (c.tipo === 'osm') {
      const { out, grilla } = analizarOsm(path);
      resultados.push({ ...base, ...out, _grilla: grilla });
    }
    process.stderr.write('ok\n');
  }

  // Cobertura espacial de los datasets sin ids, usando el GTFS de referencia para ubicar los stop_id RT.
  if (referencia) {
    for (const r of resultados) {
      if (r._grilla) {
        r.cruce.coberturaEspacial = { ...coberturaEspacial(rt.stopIds, referencia.stops, r._grilla), ubicadosCon: referencia.id };
        delete r._grilla;
      }
    }
  }
  for (const r of resultados) delete r._grilla;

  const informe = {
    generado: new Date().toISOString(),
    duracion_s: Math.round((Date.now() - t0) / 100) / 10,
    cache: CACHE.replace(homedir(), '~'),
    tiempoReal: { fixtures: 'apps/proxy/test/fixtures/colectivos/{vehiclePositions.pb,tripUpdates.pb,vehiclePositionsSimple.json}', ...resumen },
    candidatos: resultados.map((r) => ({ ...r, ruta: undefined })),
  };
  const outFile = join(HERE, 'last-run.json');
  writeFileSync(outFile, JSON.stringify(informe, null, 2) + '\n');

  // Resumen en consola
  console.log(`\nTiempo real: ${resumen.routeIds} route_id · ${resumen.tripIds} trip_id · ${resumen.stopIds} stop_id · ${resumen.shortNames} route_short_name`);
  console.log('| Candidato | route_id | …misma línea | trip_id* | stop_id | predicciones | vehículo→stop < 1 km | empresa | línea CABA (nro.) | cobertura espacial 40 m |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of informe.candidatos) {
    const x = r.cruce ?? {};
    const f = (o) => (o && o.pct != null ? `${o.pct} %` : '—');
    console.log(`| ${r.id} | ${f(x.routeId)} | ${f(x.routeIdMismoShortName)} | ${f(x.tripId)} | ${f(x.stopId)} | ${f(x.prediccionesConStop)} | ${f(x.vehiculosConStopIdAMenosDe1km)} | ${f(x.agencyName)} | ${f(x.shortNameEnCABAPorNumero)} | ${f(x.coberturaEspacial)} |`);
  }
  console.log(`\nEscrito ${outFile.replace(REPO + '/', '')} en ${informe.duracion_s} s`);
}

main().catch((e) => { console.error(e); process.exit(1); });
