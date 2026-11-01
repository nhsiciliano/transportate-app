// Aprendizaje de la ubicación de cada stop_id desde capturas acumuladas de vehiclePositions.
//
// Formato (tools/captura-posiciones, otro worker): <dir>/posiciones-YYYY-MM-DD.csv.gz con cabecera
//   snapshot_ts,vehicle_id,trip_id,route_id,stop_id,current_stop_sequence,current_status,lat,lon,speed,vehicle_ts
// Se lee por nombre de columna (tolera columnas extra u otro orden) y en streaming: las filas vienen
// agrupadas por snapshot, así que alcanza con recordar la última lectura de cada vehículo.
//
// Método (medido, ver README): el stop_id de un vehículo es su PRÓXIMA parada. La "posición de mínima
// velocidad" del doc 01b queda a una mediana de 224 m de la parada real (el vehículo frena en
// semáforos antes de llegar). En cambio, cuando un vehículo pasa de informar `s` (secuencia k) a la
// secuencia k+1, la parada `s` quedó en el tramo recorrido entre esas dos lecturas. Cada pasada vota
// por las paradas BA de la misma línea cercanas a ese tramo; las lecturas STOPPED_AT votan por las
// paradas a <= radio del punto. Gana la parada con más votos.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eachCsvRow, openCsv } from './csv.js';
import { haversine, isValidCoord, type Grid, type LatLon } from './geo.js';

export interface ParadaRef {
  id: string;
  numeros: Set<number>;
}

export interface LearnedStop extends LatLon {
  stopId: string;
  /** Parada BA ganadora, o null si ninguna pasada tuvo una parada cercana con la línea. */
  paradaId: string | null;
  /** Votos de la parada ganadora. */
  votos: number;
  /** Pasadas (transiciones + STOPPED_AT) observadas para este stop_id. */
  pasadas: number;
  /** votos / pasadas con candidata: qué tan de acuerdo están las pasadas (0–1). */
  acuerdo: number;
  routeIds: string[];
}

export interface CapturasStats {
  archivos: string[];
  filas: number;
  filasUsables: number;
  /** Snapshots distintos (snapshot_ts) y rango cubierto, en ISO UTC. */
  snapshots: number;
  desde: string | null;
  hasta: string | null;
  vehiculos: number;
  transiciones: number;
  /** Transiciones que pasaron 2–4 paradas (votan solo por la primera, con medio voto). */
  transicionesMultiples: number;
  transicionesDescartadas: number;
  /** Motivos de descarte: salto de más de una parada, hueco de tiempo, tramo largo. */
  descartesPorMotivo: { saltoDeSecuencia: number; huecoDeTiempo: number; tramoLargo: number };
  lecturasStoppedAt: number;
  stopIds: number;
  stopIdsAprendidos: number;
  stopIdsConParada: number;
}

export interface LearnOptions {
  grid: Grid<ParadaRef>;
  routeNumero: Map<string, number>;
  radiusM: number;
  minVotos: number;
  /** Tramos más largos que esto (o más separados en el tiempo) no se usan: pasaron varias paradas. */
  maxTramoM?: number;
  maxGapS?: number;
}

interface LastObs {
  ts: number;
  tripId: string;
  stopId: string;
  seq: number | null;
  lat: number;
  lon: number;
}

interface Acc {
  votes: Map<string, number>;
  pasadas: number;
  conCandidata: number;
  mids: LatLon[];
  routes: Set<string>;
}

/** Mayor salto de stop_sequence entre dos lecturas que se sigue usando (solo la primera parada). */
const MAX_SALTO = 4;

const isStopped = (status: string): boolean =>
  status === '1' || status.toUpperCase() === 'STOPPED_AT';

export function listCapturas(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^posiciones-.*\.csv(\.gz)?$/.test(f))
    .sort()
    .map((f) => join(dir, f));
}

/**
 * Paradas candidatas a <= radio de un tramo a–b (muestreado cada ~15 m), filtradas por línea,
 * en el orden en que aparecen yendo de a hacia b.
 */
export function paradasNearSegment(
  grid: Grid<ParadaRef>,
  a: LatLon,
  b: LatLon,
  radiusM: number,
  numero: number | undefined,
): Set<string> {
  const len = haversine(a.lat, a.lon, b.lat, b.lon);
  const steps = Math.max(1, Math.ceil(len / 15));
  const out = new Set<string>(); // Set conserva el orden de inserción
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
    for (const n of grid.within(p.lat, p.lon, radiusM)) {
      if (numero === undefined || n.v.numeros.has(numero)) out.add(n.v.id);
    }
  }
  return out;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

export async function learnFromCapturas(
  files: string[],
  opts: LearnOptions,
  paradaCoords: Map<string, LatLon>,
): Promise<{ learned: Map<string, LearnedStop>; stats: CapturasStats }> {
  const maxTramoM = opts.maxTramoM ?? 1_500;
  const maxGapS = opts.maxGapS ?? 180;
  const stats: CapturasStats = {
    archivos: files,
    filas: 0,
    filasUsables: 0,
    snapshots: 0,
    desde: null,
    hasta: null,
    vehiculos: 0,
    transiciones: 0,
    transicionesMultiples: 0,
    transicionesDescartadas: 0,
    descartesPorMotivo: { saltoDeSecuencia: 0, huecoDeTiempo: 0, tramoLargo: 0 },
    lecturasStoppedAt: 0,
    stopIds: 0,
    stopIdsAprendidos: 0,
    stopIdsConParada: 0,
  };
  const last = new Map<string, LastObs>();
  const snapshots = new Set<string>();
  let tsMin = Infinity;
  let tsMax = -Infinity;
  const acc = new Map<string, Acc>();
  const getAcc = (stopId: string): Acc => {
    let a = acc.get(stopId);
    if (!a) {
      a = { votes: new Map(), pasadas: 0, conCandidata: 0, mids: [], routes: new Set() };
      acc.set(stopId, a);
    }
    return a;
  };
  const vote = (a: Acc, candidates: Set<string>, weight: number): void => {
    a.pasadas++;
    if (!candidates.size) return;
    a.conCandidata++;
    for (const id of candidates) a.votes.set(id, (a.votes.get(id) ?? 0) + weight / candidates.size);
  };

  for (const file of files) {
    await eachCsvRow(openCsv(file), (r) => {
      stats.filas++;
      const snap = r.snapshot_ts ?? '';
      if (snap && !snapshots.has(snap)) {
        snapshots.add(snap);
        const t = Number(snap);
        if (Number.isFinite(t)) {
          tsMin = Math.min(tsMin, t);
          tsMax = Math.max(tsMax, t);
        }
      }
      const vehicleId = r.vehicle_id ?? '';
      const stopId = r.stop_id ?? '';
      const tripId = r.trip_id ?? '';
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      const ts = Number(r.vehicle_ts || r.snapshot_ts);
      if (!vehicleId || !stopId || !tripId || !isValidCoord(lat, lon) || !Number.isFinite(ts))
        return;
      stats.filasUsables++;
      const seqRaw = r.current_stop_sequence ?? '';
      const seq = seqRaw === '' ? null : Number(seqRaw);
      const routeId = r.route_id ?? '';
      const numero = opts.routeNumero.get(routeId);

      if (isStopped(r.current_status ?? '')) {
        stats.lecturasStoppedAt++;
        const a = getAcc(stopId);
        if (routeId) a.routes.add(routeId);
        const cands = new Set(
          opts.grid
            .within(lat, lon, opts.radiusM)
            .filter((n) => numero === undefined || n.v.numeros.has(numero))
            .map((n) => n.v.id),
        );
        vote(a, cands, 1);
        if (a.mids.length < 32) a.mids.push({ lat, lon });
      }

      const prev = last.get(vehicleId);
      last.set(vehicleId, { ts, tripId, stopId, seq, lat, lon });
      if (!prev || prev.tripId !== tripId || prev.stopId === stopId || prev.ts === ts) return;
      // Transición: el vehículo dejó atrás prev.stopId entre las dos lecturas.
      const gap = ts - prev.ts;
      const len = haversine(prev.lat, prev.lon, lat, lon);
      // Paradas recorridas en el tramo: 1 si la secuencia avanzó en uno (o no se informa).
      const salto = prev.seq === null || seq === null ? 1 : seq - prev.seq;
      if (gap <= 0 || gap > maxGapS || len > maxTramoM || salto < 1 || salto > MAX_SALTO) {
        stats.transicionesDescartadas++;
        if (salto < 1 || salto > MAX_SALTO) stats.descartesPorMotivo.saltoDeSecuencia++;
        else if (gap <= 0 || gap > maxGapS) stats.descartesPorMotivo.huecoDeTiempo++;
        else stats.descartesPorMotivo.tramoLargo++;
        return;
      }
      stats.transiciones++;
      if (salto > 1) stats.transicionesMultiples++;
      const a = getAcc(prev.stopId);
      if (routeId) a.routes.add(routeId);
      const cands = paradasNearSegment(opts.grid, prev, { lat, lon }, opts.radiusM, numero);
      if (salto === 1) vote(a, cands, 1);
      else {
        // Pasó varias paradas: prev.stopId es la primera del tramo → solo la primera candidata, medio voto.
        const first = cands.values().next();
        vote(a, first.done ? new Set() : new Set([first.value]), 0.5);
      }
      if (a.mids.length < 32) a.mids.push({ lat: (prev.lat + lat) / 2, lon: (prev.lon + lon) / 2 });
    });
  }
  stats.vehiculos = last.size;
  stats.snapshots = snapshots.size;
  // snapshot_ts puede venir en segundos o milisegundos.
  const toIso = (t: number): string | null =>
    Number.isFinite(t) ? new Date(t > 1e12 ? t : t * 1000).toISOString() : null;
  stats.desde = toIso(tsMin);
  stats.hasta = toIso(tsMax);
  stats.stopIds = acc.size;

  const learned = new Map<string, LearnedStop>();
  for (const [stopId, a] of acc) {
    if (a.pasadas < opts.minVotos) continue;
    let best: string | null = null;
    let bestVotes = 0;
    for (const [id, v] of [...a.votes.entries()].sort(([x], [y]) => x.localeCompare(y))) {
      if (v > bestVotes) {
        best = id;
        bestVotes = v;
      }
    }
    const coords = best ? paradaCoords.get(best) : undefined;
    const point =
      coords ??
      (a.mids.length
        ? { lat: median(a.mids.map((m) => m.lat)), lon: median(a.mids.map((m) => m.lon)) }
        : null);
    if (!point) continue;
    // Sin parada: solo se acepta si hay suficientes pasadas (el punto medio es impreciso).
    if (!best && a.pasadas < opts.minVotos * 2) continue;
    learned.set(stopId, {
      stopId,
      lat: point.lat,
      lon: point.lon,
      paradaId: best && bestVotes >= opts.minVotos * 0.5 ? best : null,
      votos: Math.round(bestVotes * 10) / 10,
      pasadas: a.pasadas,
      acuerdo: a.conCandidata ? Math.round((bestVotes / a.conCandidata) * 100) / 100 : 0,
      routeIds: [...a.routes].sort(),
    });
  }
  stats.stopIdsAprendidos = learned.size;
  stats.stopIdsConParada = [...learned.values()].filter((l) => l.paradaId).length;
  return { learned, stats };
}
