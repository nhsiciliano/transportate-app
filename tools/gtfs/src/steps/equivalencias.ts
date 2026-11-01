// equivalencias-paradas.json: stop_id del tiempo real → parada BA (paradas.json).
// Método: docs/01b-gtfs-alternativos.md §4 "Plan B", con el aprendizaje por transiciones de
// lib/capturas.ts (el de "mínima velocidad" del doc se midió y no sirve; ver README).
import { Grid, haversine, round6, type LatLon } from '../lib/geo.js';
import type { LearnedStop, ParadaRef } from '../lib/capturas.js';
import type { TripObs, VehicleObs } from '../lib/rt.js';
import type { Equivalencia, Parada } from '../schemas.js';

export interface EquivalenciasInput {
  stops2021: Map<string, LatLon>;
  vehicles: VehicleObs[];
  trips: TripObs[];
  /** route_id del tiempo real → número de línea (desde lineas-colectivos). */
  routeNumero: Map<string, number>;
  paradas: Parada[];
  inCaba: (lat: number, lon: number) => boolean;
  learned: Map<string, LearnedStop>;
  matchRadiusM: number;
  maxReporterDistanceM: number;
  /** Votos mínimos para que lo aprendido reemplace a la semilla 2021. */
  minVotos: number;
}

export interface EquivalenciasStats {
  stopIdsTiempoReal: number;
  numericos: number;
  numericosEnGtfs2021: number;
  descartadosLejosDeVehiculos: number;
  descartadosFueraDeCaba: number;
  validadosConVehiculo: number;
  porOrigen: Record<Equivalencia['origen'], number>;
  conParada: number;
  semillaConfirmadaPorCapturas: number;
  semillaCorregidaPorCapturas: number;
  /** Validación del aprendizaje: stop_id con semilla ajustada a BA y parada aprendida; % en que coinciden. */
  aprendidasComparablesConSemilla: number;
  pctAcuerdoAprendidaVsSemilla: number;
  aprendidasSinSemilla: number;
  coberturaTripUpdates: {
    stopIds: number;
    stopIdsConCoordenada: number;
    stopIdsConParada: number;
    predicciones: number;
    prediccionesConCoordenada: number;
    prediccionesConParada: number;
    pctStopIdsConParada: number;
    pctPrediccionesConParada: number;
    pctPrediccionesConCoordenada: number;
    /** Predicciones cuyo stop_id se ubicó fuera de CABA (descartadas a propósito). */
    prediccionesFueraDeCaba: number;
    /** Predicciones cuyo stop_id no se pudo ubicar (ni GTFS 2021 validado ni capturas). */
    prediccionesSinUbicar: number;
    /** De las predicciones ubicadas en CABA, % con parada BA asignada: la cobertura útil para la app. */
    pctPrediccionesEnCabaConParada: number;
  };
}

interface Reporters {
  numeros: Set<number>;
  positions: LatLon[];
}

const pct = (a: number, b: number): number => (b ? Math.round((1000 * a) / b) / 10 : 0);
const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Reúne, por stop_id, los números de línea y las posiciones de los vehículos que lo informan. */
export function collectReporters(
  vehicles: VehicleObs[],
  trips: TripObs[],
  routeNumero: Map<string, number>,
): Map<string, Reporters> {
  const out = new Map<string, Reporters>();
  const get = (s: string): Reporters => {
    let r = out.get(s);
    if (!r) {
      r = { numeros: new Set(), positions: [] };
      out.set(s, r);
    }
    return r;
  };
  const byVehicle = new Map<string, VehicleObs>();
  for (const v of vehicles) {
    if (v.vehicleId) byVehicle.set(v.vehicleId, v);
    if (!v.stopId) continue;
    const r = get(v.stopId);
    const n = v.routeId ? routeNumero.get(v.routeId) : undefined;
    if (n !== undefined) r.numeros.add(n);
    r.positions.push({ lat: v.lat, lon: v.lon });
  }
  for (const t of trips) {
    const n = t.routeId ? routeNumero.get(t.routeId) : undefined;
    t.stopIds.forEach((s, i) => {
      const r = get(s);
      if (n !== undefined) r.numeros.add(n);
      // La primera parada pendiente del viaje está cerca del vehículo que lo recorre.
      if (i === 0 && t.vehicleId) {
        const v = byVehicle.get(t.vehicleId);
        if (v) r.positions.push({ lat: v.lat, lon: v.lon });
      }
    });
  }
  return out;
}

export function buildParadaGrid(paradas: Parada[]): Grid<ParadaRef> {
  const grid = new Grid<ParadaRef>();
  for (const p of paradas) {
    const numeros = new Set(p.lineas.map((l) => l.numero).filter((n): n is number => n !== null));
    grid.add(p.lat, p.lon, { id: p.id, numeros });
  }
  return grid;
}

export interface SnapResult {
  paradaId: string;
  d: number;
  lineaComun: number | null;
}

/**
 * Parada BA más cercana a <= radio que comparta número de línea con quien informa el stop_id.
 * Si no se conoce la línea del informante, se acepta la más cercana (y se marca).
 */
export function snapToParada(
  grid: Grid<ParadaRef>,
  point: LatLon,
  numeros: Set<number>,
  radiusM: number,
): { match: SnapResult | null; cercanaSinLinea: number | null } {
  const near = grid.within(point.lat, point.lon, radiusM);
  const first = near[0];
  if (!first) return { match: null, cercanaSinLinea: null };
  if (numeros.size === 0) {
    return { match: { paradaId: first.v.id, d: first.d, lineaComun: null }, cercanaSinLinea: null };
  }
  for (const n of near) {
    const comun = [...numeros].find((x) => n.v.numeros.has(x));
    if (comun !== undefined) {
      return { match: { paradaId: n.v.id, d: n.d, lineaComun: comun }, cercanaSinLinea: null };
    }
  }
  return { match: null, cercanaSinLinea: Math.round(first.d) };
}

/**
 * Confianza 0–1 (heurística, documentada en el README):
 * - semilla 2021 ajustada a parada BA: 0,70–0,95 según distancia (0 m → 0,95; 40 m → 0,70);
 *   −0,20 si no se conoce la línea del informante; +0,05 validada con vehículo, −0,10 si no;
 * - aprendida con parada: 0,50 + 0,30·min(1, votos/10) + 0,15·acuerdo;
 * - solo coordenada (sin parada BA): 0,35 (semilla) o 0,25 (aprendida);
 * - +0,10 si semilla y capturas coinciden en la misma parada.
 */
export function confianza(o: {
  tipo: 'semilla' | 'aprendida';
  snappedDistanceM: number | null;
  lineaConocida: boolean;
  validadoConVehiculo: boolean;
  learned: LearnedStop | null;
  coincide: boolean;
}): number {
  let c: number;
  if (o.tipo === 'aprendida' && o.learned) {
    c =
      o.snappedDistanceM === null && !o.learned.paradaId
        ? 0.25
        : 0.5 + 0.3 * Math.min(1, o.learned.votos / 10) + 0.15 * o.learned.acuerdo;
  } else if (o.snappedDistanceM !== null) {
    c = 0.7 + 0.25 * (1 - Math.min(1, o.snappedDistanceM / 40));
    if (!o.lineaConocida) c -= 0.2;
    c += o.validadoConVehiculo ? 0.05 : -0.1;
  } else c = o.validadoConVehiculo ? 0.35 : 0.25;
  if (o.coincide) c += 0.1;
  return round2(Math.max(0.05, Math.min(1, c)));
}

function emptyStats(n: number): EquivalenciasStats {
  return {
    stopIdsTiempoReal: n,
    numericos: 0,
    numericosEnGtfs2021: 0,
    descartadosLejosDeVehiculos: 0,
    descartadosFueraDeCaba: 0,
    validadosConVehiculo: 0,
    porOrigen: { gtfs2021: 0, aprendida: 0, 'ajustada-ba': 0 },
    conParada: 0,
    semillaConfirmadaPorCapturas: 0,
    semillaCorregidaPorCapturas: 0,
    aprendidasComparablesConSemilla: 0,
    pctAcuerdoAprendidaVsSemilla: 0,
    aprendidasSinSemilla: 0,
    coberturaTripUpdates: {
      stopIds: 0,
      stopIdsConCoordenada: 0,
      stopIdsConParada: 0,
      predicciones: 0,
      prediccionesConCoordenada: 0,
      prediccionesConParada: 0,
      pctStopIdsConParada: 0,
      pctPrediccionesConParada: 0,
      pctPrediccionesConCoordenada: 0,
      prediccionesFueraDeCaba: 0,
      prediccionesSinUbicar: 0,
      pctPrediccionesEnCabaConParada: 0,
    },
  };
}

export function buildEquivalencias(input: EquivalenciasInput): {
  equivalencias: Equivalencia[];
  stats: EquivalenciasStats;
} {
  const grid = buildParadaGrid(input.paradas);
  const paradaById = new Map(input.paradas.map((p) => [p.id, p]));
  const reporters = collectReporters(input.vehicles, input.trips, input.routeNumero);
  const stats = emptyStats(reporters.size);
  const out = new Map<string, Equivalencia>();
  const fueraDeCaba = new Set<string>();
  const allStopIds = new Set<string>([...reporters.keys(), ...input.learned.keys()]);

  for (const stopId of [...allStopIds].sort()) {
    const rep = reporters.get(stopId) ?? { numeros: new Set<number>(), positions: [] };
    const learned = input.learned.get(stopId) ?? null;
    if (learned) {
      for (const r of learned.routeIds) {
        const n = input.routeNumero.get(r);
        if (n !== undefined) rep.numeros.add(n);
      }
    }
    const numerico = /^\d+$/.test(stopId);
    if (numerico) stats.numericos++;
    const seed = numerico ? (input.stops2021.get(stopId) ?? null) : null;
    if (seed) stats.numericosEnGtfs2021++;

    // 1) Semilla GTFS 2021, validada contra los vehículos que informan el stop_id.
    let seedOk = seed !== null;
    let minRepDist: number | null = null;
    if (seed && rep.positions.length) {
      minRepDist = Math.min(
        ...rep.positions.map((p) => haversine(p.lat, p.lon, seed.lat, seed.lon)),
      );
      if (minRepDist > input.maxReporterDistanceM) {
        seedOk = false;
        stats.descartadosLejosDeVehiculos++;
      } else stats.validadosConVehiculo++;
    }
    const seedSnap =
      seedOk && seed ? snapToParada(grid, seed, rep.numeros, input.matchRadiusM) : null;
    const learnedStrong =
      learned?.paradaId != null && learned.votos >= input.minVotos && learned.acuerdo >= 0.5;

    // 2) Decidir: semilla, semilla confirmada, o aprendida (si no hay semilla o la contradice con fuerza).
    let tipo: 'semilla' | 'aprendida';
    let coincide = false;
    const notas: string[] = [];
    if (seed && seedSnap) {
      tipo = 'semilla';
      if (learned?.paradaId && seedSnap.match) stats.aprendidasComparablesConSemilla++;
      if (learned?.paradaId && seedSnap.match?.paradaId === learned.paradaId) {
        coincide = true;
        stats.semillaConfirmadaPorCapturas++;
      } else if (learnedStrong) {
        tipo = 'aprendida';
        stats.semillaCorregidaPorCapturas++;
      }
    } else if (learned) {
      tipo = 'aprendida';
      stats.aprendidasSinSemilla++;
    } else continue;

    let point: LatLon;
    let match: SnapResult | null;
    let cercanaSinLinea: number | null = null;
    if (tipo === 'semilla' && seed && seedSnap) {
      point = seed;
      match = seedSnap.match;
      cercanaSinLinea = seedSnap.cercanaSinLinea;
      notas.push('coordenada GTFS 2021');
      notas.push(
        minRepDist !== null
          ? `vehículo informante a ${Math.round(minRepDist)} m`
          : 'sin vehículo informante con posición',
      );
      if (coincide && learned)
        notas.push(
          `confirmada por capturas (${learned.votos} votos de ${learned.pasadas} pasadas)`,
        );
      else if (learned?.paradaId)
        notas.push(
          `las capturas sugieren otra parada (${learned.votos} votos, acuerdo ${learned.acuerdo})`,
        );
    } else if (learned) {
      const p = learned.paradaId ? paradaById.get(learned.paradaId) : undefined;
      point = p ? { lat: p.lat, lon: p.lon } : learned;
      match = p ? { paradaId: p.id, d: 0, lineaComun: null } : null;
      notas.push(
        p
          ? `aprendida de capturas: ${learned.votos} votos de ${learned.pasadas} pasadas (acuerdo ${learned.acuerdo})`
          : `aprendida de capturas sin parada BA cercana (${learned.pasadas} pasadas; punto medio de los tramos)`,
      );
      if (seed && tipo === 'aprendida' && seedOk) notas.push('reemplaza a la coordenada GTFS 2021');
      else if (seed && !seedOk) notas.push('GTFS 2021 descartada (lejos de los vehículos)');
    } else continue;

    if (!input.inCaba(point.lat, point.lon)) {
      stats.descartadosFueraDeCaba++;
      fueraDeCaba.add(stopId);
      continue;
    }
    if (tipo === 'semilla') {
      if (match) {
        notas.push(
          match.lineaComun !== null
            ? `parada BA a ${Math.round(match.d)} m con línea ${match.lineaComun}`
            : `parada BA a ${Math.round(match.d)} m (línea del informante desconocida)`,
        );
      } else if (cercanaSinLinea !== null)
        notas.push(`parada BA a ${cercanaSinLinea} m sin línea en común`);
      else notas.push(`sin parada BA a ≤ ${input.matchRadiusM} m`);
    }

    const origen: Equivalencia['origen'] = match
      ? 'ajustada-ba'
      : tipo === 'semilla'
        ? 'gtfs2021'
        : 'aprendida';
    const eq: Equivalencia = {
      stopId,
      paradaId: match?.paradaId ?? null,
      origen,
      confianza: confianza({
        tipo,
        snappedDistanceM: match ? match.d : null,
        lineaConocida: rep.numeros.size > 0,
        validadoConVehiculo: tipo === 'semilla' && minRepDist !== null,
        learned,
        coincide,
      }),
      lat: round6(point.lat),
      lon: round6(point.lon),
      // Solo tiene sentido si la coordenada es independiente de la parada (semilla 2021).
      distanciaM: match && tipo === 'semilla' ? Math.round(match.d) : null,
      observaciones: notas.join('; '),
    };
    out.set(stopId, eq);
    stats.porOrigen[origen]++;
    if (eq.paradaId) stats.conParada++;
  }

  stats.pctAcuerdoAprendidaVsSemilla = pct(
    stats.semillaConfirmadaPorCapturas,
    stats.aprendidasComparablesConSemilla,
  );

  // Cobertura sobre las predicciones de tripUpdates (lo que la app podría mostrar como arribos).
  const tuStops = new Set<string>();
  const cov = stats.coberturaTripUpdates;
  for (const t of input.trips) {
    for (const s of t.stopIds) {
      tuStops.add(s);
      cov.predicciones++;
      const eq = out.get(s);
      if (eq) cov.prediccionesConCoordenada++;
      if (eq?.paradaId) cov.prediccionesConParada++;
      if (!eq && fueraDeCaba.has(s)) cov.prediccionesFueraDeCaba++;
    }
  }
  cov.stopIds = tuStops.size;
  cov.stopIdsConCoordenada = [...tuStops].filter((s) => out.has(s)).length;
  cov.stopIdsConParada = [...tuStops].filter((s) => out.get(s)?.paradaId).length;
  cov.pctStopIdsConParada = pct(cov.stopIdsConParada, cov.stopIds);
  cov.pctPrediccionesConParada = pct(cov.prediccionesConParada, cov.predicciones);
  cov.pctPrediccionesConCoordenada = pct(cov.prediccionesConCoordenada, cov.predicciones);
  cov.prediccionesSinUbicar =
    cov.predicciones - cov.prediccionesConCoordenada - cov.prediccionesFueraDeCaba;
  cov.pctPrediccionesEnCabaConParada = pct(
    cov.prediccionesConParada,
    cov.prediccionesConCoordenada,
  );

  return { equivalencias: [...out.values()], stats };
}
