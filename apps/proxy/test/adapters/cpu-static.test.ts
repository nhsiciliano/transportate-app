// Medición del CPU del primer request de un isolate para colectivos, con el paquete estático real
// (tools/gtfs/out). En workerd local los timers avanzan durante el cómputo (en producción no: docs
// de Workers, "performance.now()"), así que `performance.now()` mide el CPU del isolate.
// Si no hay build en tools/gtfs/out, se saltea. Cifras: src/adapters/README.md.
import {
  EquivalenciasArchivoV1,
  LineasColectivoArchivoV1,
  ParadasArchivoV1,
  type ManifestV1,
} from '@transportate/contracts';
import { describe, expect, it } from 'vitest';
import {
  getStaticSnapshot,
  resetStaticIndex,
  type StaticStore,
} from '../../src/adapters/colectivos/static-index';

const raw = import.meta.glob<string>('../../../../tools/gtfs/out/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const byName = new Map(
  Object.entries(raw).map(([path, text]) => [path.split('/').pop() ?? path, text]),
);
const text = (name: string): string => byName.get(name) ?? '';
const manifestText = byName.get('manifest.json');
const hasIndice = byName.has('indice-colectivos.json');

function store(): StaticStore {
  return {
    manifest: () => Promise.resolve(manifestText ? (JSON.parse(manifestText) as ManifestV1) : null),
    file: (key) => Promise.resolve(byName.get(key.split('/').pop() ?? key) ?? null),
  };
}

const median = (xs: number[]): number =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const round = (x: number): number => Math.round(x * 10) / 10;

function timeIt(fn: () => unknown, runs = 7): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  return round(median(times));
}

async function timeAsync(fn: () => Promise<unknown>, runs = 7): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  return round(median(times));
}

describe.skipIf(!manifestText || !hasIndice)(
  'CPU del índice estático en workerd (tools/gtfs/out)',
  () => {
    it('antes (Zod sobre paradas + equivalencias + líneas) vs después (índice compacto sin Zod)', async () => {
      const antes = {
        paradas: timeIt(() => ParadasArchivoV1.parse(JSON.parse(text('paradas.json')))),
        equivalencias: timeIt(() =>
          EquivalenciasArchivoV1.parse(JSON.parse(text('equivalencias-paradas.json'))),
        ),
        lineas: timeIt(() =>
          LineasColectivoArchivoV1.parse(JSON.parse(text('lineas-colectivos.json'))),
        ),
      };
      const cold = async (step: 'lineas' | 'paradas') => {
        resetStaticIndex();
        const snap = await getStaticSnapshot(store(), 86_400, Date.now());
        await snap[step]();
      };
      const despues = {
        lineas: await timeAsync(() => cold('lineas')),
        indice: await timeAsync(() => cold('paradas')),
      };
      const bytes = Object.fromEntries(
        [
          'paradas.json',
          'equivalencias-paradas.json',
          'lineas-colectivos.json',
          'indice-colectivos.json',
        ].map((f) => [f, text(f).length]),
      );
      console.log('CPU', JSON.stringify({ bytes, antesMs: antes, despuesMs: despues }));
      // El primer request de arribos (líneas + índice) tiene que entrar en el presupuesto del plan Free.
      expect(despues.lineas + despues.indice).toBeLessThan(10);
    });
  },
);
