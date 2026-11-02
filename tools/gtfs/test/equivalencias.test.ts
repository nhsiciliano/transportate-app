import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { learnFromCapturas, type LearnedStop } from '../src/lib/capturas.js';
import type { TripObs, VehicleObs } from '../src/lib/rt.js';
import { EquivalenciaParadaV1 } from '@transportate/contracts';
import type { Parada } from '../src/schemas.js';
import {
  buildEquivalencias,
  buildParadaGrid,
  snapToParada,
  toPublished,
} from '../src/steps/equivalencias.js';

// ~0,000009° de latitud ≈ 1 m
const M = 0.000009;
const BASE = { lat: -34.6, lon: -58.4 };
const at = (northM: number, eastM = 0) => ({
  lat: BASE.lat + northM * M,
  lon: BASE.lon + eastM * M * 1.2,
});

function parada(id: string, northM: number, lineas: number[], eastM = 0): Parada {
  const p = at(northM, eastM);
  return {
    id,
    calle: 'Calle',
    altura: 100,
    nombre: 'Calle 100',
    lat: p.lat,
    lon: p.lon,
    comuna: 1,
    barrio: 'San Telmo',
    lineas: lineas.map((n) => ({ linea: String(n), numero: n, sentido: 'ida' as const })),
  };
}

const pid = (n: number) => `p${String(n).padStart(10, '0')}`;

describe('snapToParada (≤ 40 m y misma línea)', () => {
  const grid = buildParadaGrid([
    parada(pid(1), 10, [60]),
    parada(pid(2), 30, [22]),
    parada(pid(3), 55, [22]),
  ]);

  it('elige la más cercana que comparte línea, aunque haya otra más cerca', () => {
    expect(snapToParada(grid, BASE, new Set([22]), 40).match).toMatchObject({
      paradaId: pid(2),
      lineaComun: 22,
    });
  });
  it('no acepta paradas a más de 40 m', () => {
    const r = snapToParada(grid, BASE, new Set([99]), 40);
    expect(r.match).toBeNull();
    expect(r.cercanaSinLinea).toBe(10);
  });
  it('sin línea conocida toma la más cercana', () => {
    expect(snapToParada(grid, BASE, new Set(), 40).match?.paradaId).toBe(pid(1));
  });
});

describe('buildEquivalencias (semilla GTFS 2021)', () => {
  const paradas = [parada(pid(1), 0, [22]), parada(pid(2), 2_000, [22])];
  const routeNumero = new Map([['R22', 22]]);
  const veh = (stopId: string, northM: number, id = `v${stopId}`): VehicleObs => ({
    vehicleId: id,
    routeId: 'R22',
    tripId: `t${id}`,
    stopId,
    ...at(northM),
  });
  const run = (
    stops2021: Map<string, { lat: number; lon: number }>,
    vehicles: VehicleObs[],
    trips: TripObs[] = [],
    learned = new Map<string, LearnedStop>(),
  ) =>
    buildEquivalencias({
      stops2021,
      vehicles,
      trips,
      routeNumero,
      paradas,
      inCaba: () => true,
      learned,
      matchRadiusM: 40,
      maxReporterDistanceM: 1_000,
      minVotos: 3,
    });

  it('stop_id 2021 a 25 m de una parada BA con la misma línea → ajustada-ba', () => {
    const { equivalencias, stats } = run(new Map([['111', at(25)]]), [veh('111', 300)]);
    expect(equivalencias).toHaveLength(1);
    const e = equivalencias[0];
    expect(EquivalenciaParadaV1.parse(toPublished(equivalencias)[0])).toMatchObject({
      stopId: '111',
    });
    expect(e?.observaciones).toBe(1);
    expect(e).toMatchObject({
      stopId: '111',
      paradaId: pid(1),
      origen: 'ajustada-ba',
      distanciaM: 25,
    });
    expect(e?.confianza).toBeGreaterThan(0.8);
    expect(stats.validadosConVehiculo).toBe(1);
  });

  it('a 60 m de la parada → solo coordenada (gtfs2021, sin paradaId)', () => {
    const e = run(new Map([['112', at(60)]]), [veh('112', 100)]).equivalencias[0];
    expect(e).toMatchObject({ origen: 'gtfs2021', paradaId: null, distanciaM: null });
    expect(e?.confianza).toBeLessThan(0.5);
    // No se publica: la app no puede usar un stop_id sin parada.
    expect(toPublished(e ? [e] : [])).toEqual([]);
  });

  it('descarta el stop_id si queda a más de 1 km de los vehículos que lo informan', () => {
    const { equivalencias, stats } = run(new Map([['113', at(0)]]), [veh('113', 1_500)]);
    expect(equivalencias).toHaveLength(0);
    expect(stats.descartadosLejosDeVehiculos).toBe(1);
  });

  it('valida con el vehículo del tripUpdate para la primera parada pendiente del viaje', () => {
    const trips: TripObs[] = [
      { tripId: 't1', routeId: 'R22', vehicleId: 'bus1', stopIds: ['114', '115'] },
    ];
    const vehicles: VehicleObs[] = [
      { vehicleId: 'bus1', routeId: 'R22', tripId: 't1', stopId: null, ...at(5_000) },
    ];
    const { equivalencias, stats } = run(
      new Map([
        ['114', at(0)],
        ['115', at(2_000)],
      ]),
      vehicles,
      trips,
    );
    // 114 queda a 5 km del vehículo → descartado; 115 no tiene evidencia de posición → se conserva
    expect(equivalencias.map((e) => e.stopId)).toEqual(['115']);
    expect(stats.descartadosLejosDeVehiculos).toBe(1);
    expect(stats.coberturaTripUpdates).toMatchObject({ predicciones: 2, prediccionesConParada: 1 });
  });

  it('ignora stop_id no numéricos sin capturas ("S…" no existen en 2021)', () => {
    expect(run(new Map(), [veh('S00085138', 0)]).equivalencias).toHaveLength(0);
  });

  it('las capturas pueden corregir una semilla contradicha con suficientes votos', () => {
    const learned = new Map<string, LearnedStop>([
      [
        '116',
        {
          stopId: '116',
          paradaId: pid(2),
          votos: 6,
          pasadas: 8,
          acuerdo: 0.8,
          routeIds: ['R22'],
          ...at(2_000),
        },
      ],
    ]);
    const e = run(new Map([['116', at(10)]]), [veh('116', 200)], [], learned).equivalencias[0];
    expect(e).toMatchObject({
      paradaId: pid(2),
      origen: 'aprendida',
      distanciaM: null,
      observaciones: 8,
    });
    expect(e?.notas).toMatch(/reemplaza a la coordenada GTFS 2021/);
  });
});

describe('learnFromCapturas (transiciones de stop_id)', () => {
  it('vota por la parada BA del tramo recorrido entre dos lecturas', async () => {
    const paradas = [
      parada(pid(1), 100, [22]),
      parada(pid(2), 400, [22]),
      parada(pid(9), 110, [60]),
    ];
    const header =
      'snapshot_ts,vehicle_id,trip_id,route_id,stop_id,current_stop_sequence,current_status,lat,lon,speed,vehicle_ts';
    const rows: string[] = [];
    // 4 vehículos: cada uno informa "A" a 0 m (seq 5) y 60 s después "B" a 250 m (seq 6): pasó "A" (parada a 100 m).
    for (let v = 0; v < 4; v++) {
      const t0 = 1_000 + v * 500;
      const p0 = at(0, v);
      const p1 = at(250, v);
      rows.push(`${t0},bus${v},trip${v},R22,A,5,,${p0.lat},${p0.lon},8,${t0}`);
      rows.push(`${t0 + 60},bus${v},trip${v},R22,B,6,,${p1.lat},${p1.lon},8,${t0 + 60}`);
    }
    const dir = mkdtempSync(join(tmpdir(), 'capturas-'));
    const file = join(dir, 'posiciones-2026-11-01.csv.gz');
    writeFileSync(file, gzipSync(`${header}\n${rows.join('\n')}\n`));

    const { learned, stats } = await learnFromCapturas(
      [file],
      {
        grid: buildParadaGrid(paradas),
        routeNumero: new Map([['R22', 22]]),
        radiusM: 40,
        minVotos: 3,
      },
      new Map(paradas.map((p) => [p.id, { lat: p.lat, lon: p.lon }])),
    );
    expect(stats.transiciones).toBe(4);
    const a = learned.get('A');
    // La parada de la línea 60 (a 10 m de la 22) no recibe votos: no comparte línea.
    expect(a).toMatchObject({ stopId: 'A', paradaId: pid(1), votos: 4, pasadas: 4, acuerdo: 1 });
    expect(learned.has('B')).toBe(false);
  });
});
