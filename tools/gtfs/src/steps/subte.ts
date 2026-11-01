// subte-lineas.json, subte-estaciones.json y subte-red.geojson desde el GTFS de subtes.
import type { Readable } from 'node:stream';
import { readCsvRows, type CsvRow } from '../lib/csv.js';
import { haversine, round6, simplify, type LatLon } from '../lib/geo.js';
import type { SubteEstacion, SubteLinea } from '../schemas.js';
import { COLORES_SUBTE, PARAMS } from '../config.js';
import { z } from 'zod';
import type { SubteRedSchema } from '../schemas.js';

/**
 * Tildes que el GTFS de subte omite (docs/02b-colores-subte.md, Anexo A). Lista curada a mano,
 * palabra completa. No se usan los nombres de forecastGTFS: traen errores ("Carlos Pelegrini",
 * "Scalabrini Ortíz") y recortes ("Moreno" por "Jose Maria Moreno").
 */
const TILDES: Record<string, string> = {
  Angel: 'Ángel',
  Bolivar: 'Bolívar',
  Civico: 'Cívico',
  Constitucion: 'Constitución',
  Cordoba: 'Córdoba',
  Diaz: 'Díaz',
  Echeverria: 'Echeverría',
  Fatima: 'Fátima',
  Fernandez: 'Fernández',
  Hernandez: 'Hernández',
  Inclan: 'Inclán',
  Jose: 'José',
  Larrazabal: 'Larrazábal',
  Maria: 'María',
  Martin: 'Martín',
  Nicolas: 'Nicolás',
  Ortuzar: 'Ortúzar',
  Peru: 'Perú',
  Puan: 'Puán',
  Pueyrredon: 'Pueyrredón',
  Rio: 'Río',
  Rios: 'Ríos',
  Saenz: 'Sáenz',
  Tucuman: 'Tucumán',
};

export function addTildes(name: string): string {
  return name.replace(/\p{L}+/gu, (w) => TILDES[w] ?? w);
}

/**
 * Une dos secuencias de estaciones (sentido 0 y sentido 1 invertido) conservando el orden.
 * Una estación que falta en `base` va entre su anterior y su siguiente conocidos en `other`; si en
 * ese hueco ya hay otras (Alberti y Pasco en la A: cada sentido saltea una), con coordenadas se
 * elige la posición que menos alarga el recorrido.
 */
export function mergeSequences(
  base: string[],
  other: string[],
  coord?: (id: string) => LatLon | undefined,
): string[] {
  const out = [...base];
  const dist = (a: string | undefined, b: string | undefined): number => {
    const pa = a === undefined ? undefined : coord?.(a);
    const pb = b === undefined ? undefined : coord?.(b);
    return pa && pb ? haversine(pa.lat, pa.lon, pb.lat, pb.lon) : 0;
  };
  for (let i = 0; i < other.length; i++) {
    const s = other[i];
    if (s === undefined || out.includes(s)) continue;
    let lo = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = out.indexOf(other[j] ?? '');
      if (k >= 0) {
        lo = k + 1;
        break;
      }
    }
    let hi = lo;
    for (let j = i + 1; j < other.length; j++) {
      const k = out.indexOf(other[j] ?? '');
      if (k >= lo) {
        hi = k;
        break;
      }
    }
    let pos = lo;
    if (coord && hi > lo) {
      let best = Infinity;
      for (let p = lo; p <= hi; p++) {
        const detour = dist(out[p - 1], s) + dist(s, out[p]) - dist(out[p - 1], out[p]);
        if (detour < best) {
          best = detour;
          pos = p;
        }
      }
    }
    out.splice(pos, 0, s);
  }
  return out;
}

export interface SubteInput {
  routes: CsvRow[];
  stops: CsvRow[];
  trips: CsvRow[];
  stopTimes: CsvRow[];
  shapes: CsvRow[];
  feedInfo: CsvRow[];
}

export async function readSubteInput(open: (f: string) => Readable): Promise<SubteInput> {
  const read = (f: string): Promise<CsvRow[]> => readCsvRows(open(f));
  const [routes, stops, trips, stopTimes, shapes, feedInfo] = await Promise.all([
    read('routes.txt'),
    read('stops.txt'),
    read('trips.txt'),
    read('stop_times.txt'),
    read('shapes.txt'),
    read('feed_info.txt'),
  ]);
  return { routes, stops, trips, stopTimes, shapes, feedInfo };
}

export interface SubteStats {
  lineas: number;
  estaciones: number;
  andenes: number;
  coloresDistintosDelGtfs: string[];
  feedEndDate: string | null;
  puntosShapes: number;
  puntosRed: number;
}

type RedGeoJson = z.infer<typeof SubteRedSchema>;

const hexColor = (s: string | undefined): string => `#${(s ?? '').toUpperCase()}`;

export function buildSubte(input: SubteInput): {
  lineas: SubteLinea[];
  estaciones: SubteEstacion[];
  red: RedGeoJson;
  stats: SubteStats;
} {
  const stations = new Map<string, CsvRow>();
  const platformParent = new Map<string, string>();
  for (const s of input.stops) {
    const id = s.stop_id ?? '';
    if (s.location_type === '1') stations.set(id, s);
    else if (s.location_type === '0' || s.location_type === '') {
      if (s.parent_station) platformParent.set(id, s.parent_station);
    }
  }
  const toStation = (stopId: string): string => platformParent.get(stopId) ?? stopId;

  const stopTimesByTrip = new Map<string, CsvRow[]>();
  for (const st of input.stopTimes) {
    const t = st.trip_id ?? '';
    const list = stopTimesByTrip.get(t);
    if (list) list.push(st);
    else stopTimesByTrip.set(t, [st]);
  }

  const shapes = new Map<string, { seq: number; p: LatLon }[]>();
  for (const sh of input.shapes) {
    const id = sh.shape_id ?? '';
    const pt = {
      seq: Number(sh.shape_pt_sequence),
      p: { lat: Number(sh.shape_pt_lat), lon: Number(sh.shape_pt_lon) },
    };
    const list = shapes.get(id);
    if (list) list.push(pt);
    else shapes.set(id, [pt]);
  }

  const coloresDistintos: string[] = [];
  const lineas: SubteLinea[] = [];
  const stationLines = new Map<string, Set<string>>();
  const features: RedGeoJson['features'] = [];
  let puntosRed = 0;

  for (const r of input.routes) {
    const routeId = r.route_id ?? '';
    const colores = COLORES_SUBTE[routeId];
    if (!colores)
      throw new Error(
        `subte: ${routeId} no está en la tabla de colores de docs/02b-colores-subte.md`,
      );
    const gtfsColor = hexColor(r.route_color);
    const gtfsText = hexColor(r.route_text_color);
    if (gtfsColor !== colores.color || gtfsText !== colores.texto) {
      coloresDistintos.push(
        `${routeId}: GTFS ${gtfsColor}/${gtfsText} vs doc ${colores.color}/${colores.texto}`,
      );
    }
    const id = r.route_short_name ?? routeId;
    const routeTrips = input.trips.filter((t) => t.route_id === routeId);

    // Viaje más largo (más stop_times) por sentido.
    const sentidos: SubteLinea['sentidos'] = [];
    for (const dir of [...new Set(routeTrips.map((t) => Number(t.direction_id ?? 0)))].sort()) {
      let best: { trip: CsvRow; sts: CsvRow[] } | null = null;
      for (const t of routeTrips.filter((x) => Number(x.direction_id ?? 0) === dir)) {
        const sts = stopTimesByTrip.get(t.trip_id ?? '') ?? [];
        if (!best || sts.length > best.sts.length) best = { trip: t, sts };
      }
      if (!best) continue;
      const seq = [...best.sts]
        .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence))
        .map((st) => toStation(st.stop_id ?? ''));
      const dedup = seq.filter((s, i) => s !== seq[i - 1]);
      sentidos.push({
        directionId: dir,
        cabecera: best.trip.trip_headsign ?? '',
        estaciones: dedup,
      });
    }
    const first = sentidos[0];
    if (!first) throw new Error(`subte: ${routeId} sin viajes`);
    const second = sentidos[1];
    const coord = (sid: string): LatLon | undefined => {
      const st = stations.get(sid);
      return st ? { lat: Number(st.stop_lat), lon: Number(st.stop_lon) } : undefined;
    };
    const estaciones = second
      ? mergeSequences(first.estaciones, [...second.estaciones].reverse(), coord)
      : first.estaciones;
    for (const s of estaciones) {
      const set = stationLines.get(s) ?? new Set<string>();
      set.add(id);
      stationLines.set(s, set);
    }
    lineas.push({
      id,
      routeId,
      nombre: addTildes(r.route_long_name ?? ''),
      tipo: r.route_type === '0' ? 'premetro' : 'subte',
      color: colores.color,
      colorTexto: colores.texto,
      estaciones,
      sentidos,
    });

    // Red: el shape más largo de la línea, simplificado.
    const shapeIds = [...new Set(routeTrips.map((t) => t.shape_id ?? '').filter(Boolean))];
    let longest: LatLon[] = [];
    for (const sid of shapeIds) {
      const pts = (shapes.get(sid) ?? []).sort((a, b) => a.seq - b.seq).map((x) => x.p);
      if (pts.length > longest.length) longest = pts;
    }
    if (longest.length >= 2) {
      const simple = simplify(longest, PARAMS.simplifySubteM);
      puntosRed += simple.length;
      features.push({
        type: 'Feature',
        properties: { linea: id, routeId, color: colores.color },
        geometry: {
          type: 'LineString',
          coordinates: simple.map((p) => [round6(p.lon), round6(p.lat)]),
        },
      });
    }
  }

  const estaciones: SubteEstacion[] = [...stations.values()]
    .filter((s) => stationLines.has(s.stop_id ?? ''))
    .map((s) => {
      const id = s.stop_id ?? '';
      const wb = s.wheelchair_boarding ?? '';
      return {
        id,
        nombre: addTildes(s.stop_name ?? id),
        nombreGtfs: s.stop_name ?? id,
        lat: round6(Number(s.stop_lat)),
        lon: round6(Number(s.stop_lon)),
        lineas: [...(stationLines.get(id) ?? [])].sort(),
        andenes: [...platformParent.entries()]
          .filter(([, parent]) => parent === id)
          .map(([p]) => p)
          .sort(),
        accesible: wb === '1' ? true : wb === '2' ? false : null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const feedEndDate = input.feedInfo[0]?.feed_end_date ?? null;
  return {
    lineas,
    estaciones,
    red: { type: 'FeatureCollection', features },
    stats: {
      lineas: lineas.length,
      estaciones: estaciones.length,
      andenes: platformParent.size,
      coloresDistintosDelGtfs: coloresDistintos,
      feedEndDate,
      puntosShapes: input.shapes.length,
      puntosRed,
    },
  };
}
