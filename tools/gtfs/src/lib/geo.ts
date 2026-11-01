// Geometría: distancias, grilla de vecinos, máscara de CABA y simplificación de líneas.

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_R = 6_371_000;
const RAD = Math.PI / 180;

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

/** Redondeo a 6 decimales (~0,1 m), el formato de coordenadas de todas las salidas. */
export const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;

export const isValidCoord = (lat: number, lon: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** Bounding box aproximado de CABA (mismo que tools/gtfs-cruce). */
export const CABA_BBOX = { minLat: -34.705, maxLat: -34.527, minLon: -58.531, maxLon: -58.335 };

export const inCabaBbox = (lat: number, lon: number): boolean =>
  lat >= CABA_BBOX.minLat &&
  lat <= CABA_BBOX.maxLat &&
  lon >= CABA_BBOX.minLon &&
  lon <= CABA_BBOX.maxLon;

export interface Neighbor<T> {
  d: number;
  v: T;
  lat: number;
  lon: number;
}

/** Grilla de celdas de ~110 m para búsqueda de vecinos a pocas decenas/centenas de metros. */
export class Grid<T> {
  private readonly cells = new Map<string, { lat: number; lon: number; v: T }[]>();
  constructor(private readonly cell = 0.001) {}

  private key(cy: number, cx: number): string {
    return `${cy}:${cx}`;
  }

  add(lat: number, lon: number, v: T): void {
    const k = this.key(Math.floor(lat / this.cell), Math.floor(lon / this.cell));
    const list = this.cells.get(k);
    if (list) list.push({ lat, lon, v });
    else this.cells.set(k, [{ lat, lon, v }]);
  }

  /** Todos los puntos a <= maxM metros, del más cercano al más lejano. */
  within(lat: number, lon: number, maxM: number): Neighbor<T>[] {
    const span = Math.max(1, Math.ceil(maxM / (this.cell * 111_000)));
    const cy = Math.floor(lat / this.cell);
    const cx = Math.floor(lon / this.cell);
    const out: Neighbor<T>[] = [];
    for (let dy = -span; dy <= span; dy++) {
      for (let dx = -span; dx <= span; dx++) {
        for (const p of this.cells.get(this.key(cy + dy, cx + dx)) ?? []) {
          const d = haversine(lat, lon, p.lat, p.lon);
          if (d <= maxM) out.push({ d, v: p.v, lat: p.lat, lon: p.lon });
        }
      }
    }
    return out.sort((a, b) => a.d - b.d);
  }

  nearest(lat: number, lon: number, maxM: number): Neighbor<T> | null {
    return this.within(lat, lon, maxM)[0] ?? null;
  }
}

/**
 * Máscara de CABA: celdas de ~550 m que contienen alguna parada oficial BA (el dataset cubre solo
 * la Ciudad), dilatadas una celda (~550 m de margen). Aproxima el límite de CABA mejor que el bbox,
 * que incluye esquinas de provincia, sin depender de un polígono externo.
 */
export class AreaMask {
  private readonly cells = new Set<string>();
  constructor(
    points: Iterable<LatLon>,
    private readonly cell = 0.005,
    dilate = 1,
  ) {
    for (const p of points) {
      const cy = Math.floor(p.lat / cell);
      const cx = Math.floor(p.lon / cell);
      for (let dy = -dilate; dy <= dilate; dy++)
        for (let dx = -dilate; dx <= dilate; dx++) this.cells.add(`${cy + dy}:${cx + dx}`);
    }
  }
  has(lat: number, lon: number): boolean {
    return this.cells.has(`${Math.floor(lat / this.cell)}:${Math.floor(lon / this.cell)}`);
  }
  get size(): number {
    return this.cells.size;
  }
}

/** Distancia (m) de p al segmento a–b, en proyección equirectangular local (válida a escala urbana). */
function pointSegmentDistance(p: LatLon, a: LatLon, b: LatLon): number {
  const kx = Math.cos(p.lat * RAD) * RAD * EARTH_R;
  const ky = RAD * EARTH_R;
  const ax = (a.lon - p.lon) * kx;
  const ay = (a.lat - p.lat) * ky;
  const bx = (b.lon - p.lon) * kx;
  const by = (b.lat - p.lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt(cx * cx + cy * cy);
}

/** Douglas-Peucker iterativo con tolerancia en metros. Conserva extremos. */
export function simplify(points: LatLon[], toleranceM: number): LatLon[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop() ?? [0, 0];
    const a = points[i];
    const b = points[j];
    if (!a || !b) continue;
    let maxD = -1;
    let idx = -1;
    for (let k = i + 1; k < j; k++) {
      const p = points[k];
      if (!p) continue;
      const d = pointSegmentDistance(p, a, b);
      if (d > maxD) {
        maxD = d;
        idx = k;
      }
    }
    if (idx > 0 && maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([i, idx], [idx, j]);
    }
  }
  return points.filter((_, k) => keep[k] === 1);
}

/** Corta una polilínea en tramos contiguos cuyos puntos están dentro del área. */
export function clipToArea(points: LatLon[], inside: (p: LatLon) => boolean): LatLon[][] {
  const parts: LatLon[][] = [];
  let cur: LatLon[] = [];
  for (const p of points) {
    if (inside(p)) cur.push(p);
    else if (cur.length) {
      if (cur.length >= 2) parts.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) parts.push(cur);
  return parts;
}

export function quantiles(
  nums: number[],
): { n: number; p50: number; p90: number; max: number } | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const q = (p: number): number =>
    Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0);
  return { n: s.length, p50: q(0.5), p90: q(0.9), max: Math.round(s[s.length - 1] ?? 0) };
}
