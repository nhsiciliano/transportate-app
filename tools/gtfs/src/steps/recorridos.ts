// recorridos-colectivos.geojson (opcional): shapes del GTFS 2021, recortados a CABA, simplificados y
// unidos por número de línea. Son "recorridos aproximados": el GTFS es de 2021 y los route_id fueron
// reasignados, así que solo se confía en el número de línea (docs/01b-gtfs-alternativos.md §4).
import type { Readable } from 'node:stream';
import { eachCsvRow } from '../lib/csv.js';
import { clipToArea, round6, simplify, type LatLon } from '../lib/geo.js';
import { normalizeLinea } from '../lib/text.js';
import type { RecorridosSchema } from '../schemas.js';
import type { z } from 'zod';

type Recorridos = z.infer<typeof RecorridosSchema>;

export interface RecorridosStats {
  shapes: number;
  puntosOriginales: number;
  shapesEnCaba: number;
  lineas: number;
  tramos: number;
  puntosFinales: number;
}

export interface RecorridosInput {
  routes: Readable;
  trips: Readable;
  shapes: Readable;
}

/** Dos tramos casi idénticos (ida y vuelta, ramales) se dibujan una vez: clave por grilla de ~50 m. */
function tramoKey(points: LatLon[]): string {
  const q = (p: LatLon): string => `${Math.round(p.lat / 0.0005)}:${Math.round(p.lon / 0.0005)}`;
  const cells = [...new Set(points.map(q))].sort();
  return cells.join('|');
}

export async function buildRecorridos(
  input: RecorridosInput,
  inside: (lat: number, lon: number) => boolean,
  toleranceM: number,
): Promise<{ geojson: Recorridos; stats: RecorridosStats }> {
  const routeNumero = new Map<string, { numero: number; linea: string }>();
  await eachCsvRow(input.routes, (r) => {
    const n = normalizeLinea(r.route_short_name);
    if (n?.numero != null && r.route_id)
      routeNumero.set(r.route_id, { numero: n.numero, linea: n.linea });
  });
  const shapeRoute = new Map<string, string>();
  await eachCsvRow(input.trips, (t) => {
    if (t.shape_id && t.route_id && !shapeRoute.has(t.shape_id))
      shapeRoute.set(t.shape_id, t.route_id);
  });

  // shapes.txt (≈ 30 MB, 784 mil puntos): se acumula como arrays numéricos por shape.
  const pts = new Map<string, number[]>(); // [seq, lat, lon, seq, lat, lon, ...]
  let puntosOriginales = 0;
  await eachCsvRow(input.shapes, (s) => {
    const id = s.shape_id ?? '';
    const lat = Number(s.shape_pt_lat);
    const lon = Number(s.shape_pt_lon);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    puntosOriginales++;
    const arr = pts.get(id);
    const triple = [Number(s.shape_pt_sequence), lat, lon];
    if (arr) arr.push(...triple);
    else pts.set(id, triple);
  });

  const byNumero = new Map<number, { lineas: Set<string>; tramos: Map<string, LatLon[]> }>();
  let shapesEnCaba = 0;
  for (const [shapeId, flat] of pts) {
    const route = shapeRoute.get(shapeId);
    const info = route ? routeNumero.get(route) : undefined;
    if (!info) continue;
    const ordered: { seq: number; p: LatLon }[] = [];
    for (let i = 0; i + 2 < flat.length; i += 3) {
      ordered.push({ seq: flat[i] ?? 0, p: { lat: flat[i + 1] ?? 0, lon: flat[i + 2] ?? 0 } });
    }
    ordered.sort((a, b) => a.seq - b.seq);
    const parts = clipToArea(
      ordered.map((o) => o.p),
      (p) => inside(p.lat, p.lon),
    );
    if (!parts.length) continue;
    shapesEnCaba++;
    let entry = byNumero.get(info.numero);
    if (!entry) {
      entry = { lineas: new Set(), tramos: new Map() };
      byNumero.set(info.numero, entry);
    }
    entry.lineas.add(info.linea);
    for (const part of parts) {
      const simple = simplify(part, toleranceM);
      if (simple.length < 2) continue;
      const key = tramoKey(simple);
      if (!entry.tramos.has(key)) entry.tramos.set(key, simple);
    }
  }

  let tramos = 0;
  let puntosFinales = 0;
  const features: Recorridos['features'] = [...byNumero.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, e]) => e.tramos.size > 0)
    .map(([numero, e]) => {
      const lines = [...e.tramos.values()].map((l) =>
        l.map((p): [number, number] => [round6(p.lon), round6(p.lat)]),
      );
      tramos += lines.length;
      puntosFinales += lines.reduce((a, l) => a + l.length, 0);
      return {
        type: 'Feature' as const,
        properties: { numero, lineas2021: [...e.lineas].sort(), aproximado: true as const },
        geometry: { type: 'MultiLineString' as const, coordinates: lines },
      };
    });

  return {
    geojson: { type: 'FeatureCollection', features },
    stats: {
      shapes: pts.size,
      puntosOriginales,
      shapesEnCaba,
      lineas: features.length,
      tramos,
      puntosFinales,
    },
  };
}
