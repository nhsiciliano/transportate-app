// lineas-colectivos.json: diccionario semilla route_id → línea/ramal/empresa desde vehiclePositionsSimple.
// En runtime el proxy lo regenera desde el feed en cada lectura (los route_id cambian sin aviso);
// este archivo es solo la semilla para búsqueda offline y para los tests.
import { cleanText, MOJIBAKE_TEST, normalizeLinea } from '../lib/text.js';
import type { SimpleVehicle } from '../lib/rt.js';
import type { LineaColectivo } from '../schemas.js';

export interface LineasStats {
  vehiculos: number;
  routeIds: number;
  numerosDistintos: number;
  empresas: number;
  empresasReparadas: number;
  sinNumero: number;
  enCaba: number;
}

/** Empresa legible: mojibake reparado (cp1252), espacios y NBSP normalizados. Conserva sufijos ("S.A.T."). */
export function normalizeEmpresa(raw: string | null | undefined): string | null {
  const s = cleanText(raw);
  return s === '' ? null : s;
}

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN || (n === bestN && best !== null && v < best)) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

export function buildLineas(
  vehicles: SimpleVehicle[],
  inCaba: (lat: number, lon: number) => boolean,
): { lineas: LineaColectivo[]; stats: LineasStats } {
  const byRoute = new Map<string, SimpleVehicle[]>();
  for (const v of vehicles) {
    const list = byRoute.get(v.route_id);
    if (list) list.push(v);
    else byRoute.set(v.route_id, [v]);
  }
  let empresasReparadas = 0;
  const lineas: LineaColectivo[] = [];
  for (const [routeId, vs] of byRoute) {
    const shortName = mostCommon(
      vs.map((v) => cleanText(v.route_short_name).toUpperCase() || null),
    );
    const n = normalizeLinea(shortName ?? routeId);
    if (!n) continue;
    const rawEmpresa = mostCommon(vs.map((v) => v.agency_name ?? null));
    const empresa = normalizeEmpresa(rawEmpresa);
    if (rawEmpresa && MOJIBAKE_TEST.test(rawEmpresa)) empresasReparadas++;
    const agency = vs.find((v) => v.agency_id != null)?.agency_id;
    lineas.push({
      routeId,
      linea: n.linea,
      numero: n.numero,
      ramal: n.ramal,
      empresa,
      agencyId: agency == null ? null : String(agency),
      cabeceras: [
        ...new Set(vs.map((v) => cleanText(v.trip_headsign)).filter((h) => h !== '')),
      ].sort(),
      enCaba: vs.some((v) => inCaba(v.latitude, v.longitude)),
    });
  }
  lineas.sort(
    (a, b) =>
      (a.numero ?? Infinity) - (b.numero ?? Infinity) ||
      a.linea.localeCompare(b.linea) ||
      a.routeId.localeCompare(b.routeId, 'en', { numeric: true }),
  );
  return {
    lineas,
    stats: {
      vehiculos: vehicles.length,
      routeIds: lineas.length,
      numerosDistintos: new Set(lineas.map((l) => l.numero).filter((x) => x !== null)).size,
      empresas: new Set(lineas.map((l) => l.empresa)).size,
      empresasReparadas,
      sinNumero: lineas.filter((l) => l.numero === null).length,
      enCaba: lineas.filter((l) => l.enCaba).length,
    },
  };
}
