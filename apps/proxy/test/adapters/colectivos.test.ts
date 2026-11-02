import {
  ArribosParadaResponseV1,
  LineasColectivoResponseV1,
  PosicionesLineaResponseV1,
  type EquivalenciaParadaV1,
  type LineaColectivoEstaticaV1,
  type ManifestV1,
  type ParadaV1,
} from '@transportate/contracts';
import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import tripUpdatesFixture from '../fixtures/colectivos/tripUpdates.pb?inline';
import vehiclePositionsFixture from '../fixtures/colectivos/vehiclePositions.pb?inline';
import { createColectivosAdapter } from '../../src/adapters/colectivos';
import {
  interleave,
  r2Store,
  resetStaticIndex,
  type StaticStore,
} from '../../src/adapters/colectivos/static-index';
import { ApiError } from '../../src/adapters/types';
import {
  decodeFeed,
  transit_realtime,
  type FeedEntityInit,
  type FeedMessage,
} from '../../src/lib/gtfs-rt';
import type { DeadlineFeedSource } from '../../src/sources/edge-cached';
import type { FeedRequest, FeedResult, FeedSource } from '../../src/sources/types';
import { fixtureBytes } from '../lib/fixture-bytes';

// Fixtures reales del 2026-11-01. Línea 152 (EMPRESA TANDILENSE): route_id 834 y 835.
const VP = decodeFeed(fixtureBytes(vehiclePositionsFixture));
const TU = decodeFeed(fixtureBytes(tripUpdatesFixture));
const NOW_VP = Number(VP.header.timestamp) * 1000;
const NOW_TU = Number(TU.header.timestamp) * 1000;
const STOP = '6861103995'; // stop_id con arribos de la 834 a 28, 46 y 88 s del header

/** Respuesta "filtrada por route_id" simulada: el feed real reducido a esa ruta. */
function filtered(feed: FeedMessage, routeId: string, extra: FeedEntityInit[] = []): ArrayBuffer {
  const entity = feed.entity.filter(
    (e) => (e.vehicle?.trip?.routeId ?? e.tripUpdate?.trip.routeId) === routeId,
  );
  const msg = transit_realtime.FeedMessage.create({
    header: feed.header,
    entity: [...entity, ...extra],
  });
  const bytes = transit_realtime.FeedMessage.encode(msg).finish();
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

function fakeSource(bodies: Record<string, ArrayBuffer>): FeedSource & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    fetch(req: FeedRequest): Promise<FeedResult> {
      keys.push(req.key);
      expect(req.url.searchParams.has('client_secret')).toBe(false);
      const body = bodies[req.key];
      if (!body) return Promise.reject(new ApiError('upstream_unavailable', 'x', 503));
      return Promise.resolve({
        body,
        fetchedAt: 0,
        fromCache: false,
        stale: false,
        upstreamStatus: 200,
      });
    },
  };
}

// ---------------------------------------------------------------- paquete estático de muestra en R2

const VERSION = 'test0colect1';
const lineas: LineaColectivoEstaticaV1[] = [
  {
    lineaId: '834',
    linea: '152',
    empresa: 'EMPRESA TANDILENSE S.A.C.I.F.I.Y DE S.',
    numero: 152,
    agencyId: '54',
    enCaba: true,
    cabeceras: ['a Olivos'],
  },
  {
    lineaId: '835',
    linea: '152',
    empresa: 'EMPRESA TANDILENSE S.A.C.I.F.I.Y DE S.',
    numero: 152,
    agencyId: '54',
    enCaba: true,
  },
  {
    lineaId: '1882',
    linea: '422-1',
    ramal: '1',
    empresa: 'TRANSPORTES LA PERLITA S.A.',
    numero: 422,
    agencyId: '9',
    enCaba: false,
  },
];
const parada = (id: string, numeros: number[]): ParadaV1 => ({
  id,
  calle: 'Av. Santa Fe',
  altura: 1000,
  nombre: 'Av. Santa Fe 1000',
  lat: -34.59,
  lon: -58.39,
  comuna: 1,
  barrio: 'Retiro',
  lineas: numeros.map((n) => ({ linea: String(n), numero: n, sentido: 'ida' as const })),
});
const paradas = [
  parada('pconarribos1', [152]),
  parada('psinequival', [152]),
  parada('psinlineas0', [999]),
];
const equivalencias: EquivalenciaParadaV1[] = [
  {
    stopId: STOP,
    paradaId: 'pconarribos1',
    origen: 'ajustada-ba',
    confianza: 0.9,
    observaciones: 3,
  },
  {
    stopId: 'S00081620',
    paradaId: 'pconarribos1',
    origen: 'aprendida',
    confianza: 0.7,
    observaciones: 5,
  },
  {
    stopId: '6861101775',
    paradaId: 'psinlineas0',
    origen: 'ajustada-ba',
    confianza: 0.8,
    observaciones: 1,
  },
];

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

beforeAll(async () => {
  const files: Record<string, unknown> = {
    'lineas-colectivos.json': {
      version: 1,
      fuente: 'test',
      nota: 'test',
      capturadoEn: '2026-11-01',
      lineas,
    },
    'paradas.json': { version: 1, fuente: 'test', paradas },
    'equivalencias-paradas.json': { version: 1, metodo: 'test', equivalencias },
  };
  const archivos: ManifestV1['archivos'] = {};
  for (const [name, data] of Object.entries(files)) {
    const text = JSON.stringify(data);
    await env.STATIC.put(`${VERSION}/${name}`, text);
    archivos[name] = { url: `${VERSION}/${name}`, bytes: text.length, sha256: await sha256(text) };
  }
  const manifest: ManifestV1 = {
    version: VERSION,
    generatedAt: '2026-11-01T23:00:00.000Z',
    archivos,
  };
  await env.STATIC.put('latest/manifest.json', JSON.stringify(manifest));
  resetStaticIndex();
});

function adapter(
  bodies: Record<string, ArrayBuffer>,
  now: number,
  store: StaticStore = r2Store(env.STATIC),
) {
  const source = fakeSource(bodies);
  return {
    source,
    colectivos: createColectivosAdapter({
      source,
      store,
      ttlSeconds: 20,
      staticTtlSeconds: 86_400,
      now: () => now,
    }),
  };
}

// ---------------------------------------------------------------- tests

describe('ColectivosAdapter.lineas', () => {
  it('diccionario desde lineas-colectivos.json en R2, como LineaColectivoV1', async () => {
    const { colectivos } = adapter({}, Date.parse('2026-11-02T00:00:00Z'));
    const res = await colectivos.lineas();
    expect(LineasColectivoResponseV1.parse(res)).toEqual(res);
    expect(res.data.lineas).toEqual([
      {
        lineaId: '834',
        linea: '152',
        empresa: 'EMPRESA TANDILENSE S.A.C.I.F.I.Y DE S.',
        cabeceras: ['a Olivos'],
      },
      { lineaId: '835', linea: '152', empresa: 'EMPRESA TANDILENSE S.A.C.I.F.I.Y DE S.' },
      { lineaId: '1882', linea: '422-1', ramal: '1', empresa: 'TRANSPORTES LA PERLITA S.A.' },
    ]);
    expect(res.meta).toMatchObject({
      ttlSeconds: 86_400,
      sourceTimestamp: '2026-11-01T23:00:00.000Z',
      ageSeconds: 3600,
    });
  });

  it('sin manifiesto en el bucket → 503 "Datos estáticos no cargados"', async () => {
    resetStaticIndex();
    const empty: StaticStore = {
      manifest: () => Promise.resolve(null),
      file: () => Promise.resolve(null),
    };
    const { colectivos } = adapter({}, NOW_VP, empty);
    await expect(colectivos.lineas()).rejects.toMatchObject({
      code: 'upstream_unavailable',
      message: 'Datos estáticos no cargados',
      status: 503,
    });
    resetStaticIndex();
  });
});

describe('ColectivosAdapter.posiciones', () => {
  const lejos = transit_realtime.FeedEntity.create({
    id: 'fuera',
    vehicle: {
      trip: { routeId: '834' },
      vehicle: { id: 'gps-roto' },
      position: { latitude: -28.47, longitude: -65.77 },
      timestamp: NOW_VP / 1000,
    },
  });
  const viejo = transit_realtime.FeedEntity.create({
    id: 'viejo',
    vehicle: {
      trip: { routeId: '834' },
      vehicle: { id: 'sin-reportar' },
      position: { latitude: -34.6, longitude: -58.4 },
      timestamp: NOW_VP / 1000 - 31 * 60,
    },
  });

  it('decodifica el feed filtrado: vehículos de la 834 con edad, sin rumbo, sin fuera de AMBA ni viejos', async () => {
    const { colectivos, source } = adapter(
      { 'colectivos:vehiclePositions:route=834': filtered(VP, '834', [lejos, viejo]) },
      NOW_VP,
    );
    const res = await colectivos.posiciones('834');
    expect(PosicionesLineaResponseV1.parse(res)).toEqual(res);
    expect(source.keys).toEqual(['colectivos:vehiclePositions:route=834']);
    const ids = res.data.vehiculos.map((v) => v.id);
    expect(ids).not.toContain('gps-roto');
    expect(ids).not.toContain('sin-reportar');
    expect(res.data.vehiculos.length).toBeGreaterThan(10);
    for (const v of res.data.vehiculos) {
      expect(v).toMatchObject({ lineaId: '834', linea: '152', rumbo: null });
      expect(v.edadSegundos).toBeLessThanOrEqual(30 * 60);
    }
    // paradaId vía equivalencias (stop_id 6861101775 → psinlineas0)
    expect(res.data.vehiculos.find((v) => v.id === '8469')?.paradaId).toBe('psinlineas0');
    expect(res.meta.sourceTimestamp).not.toBeNull();
    expect(res.meta.stale).toBe(false);
  });

  it('línea inexistente → 404 not_found (sin pedir upstream)', async () => {
    const { colectivos, source } = adapter({}, NOW_VP);
    await expect(colectivos.posiciones('99999')).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
    });
    expect(source.keys).toEqual([]);
  });
});

describe('ColectivosAdapter.arribos', () => {
  it('pide tripUpdates por cada línea de la parada y filtra por sus stop_id', async () => {
    const { colectivos, source } = adapter(
      { 'colectivos:tripUpdates:route=834': filtered(TU, '834') }, // la 835 falla
      NOW_TU,
    );
    const res = await colectivos.arribos('pconarribos1');
    expect(ArribosParadaResponseV1.parse(res)).toEqual(res);
    expect(source.keys.sort()).toEqual([
      'colectivos:tripUpdates:route=834',
      'colectivos:tripUpdates:route=835',
    ]);
    const a = res.data.arribos;
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(10);
    expect(
      a.every((x) => x.lineaId === '834' && x.linea === '152' && x.paradaId === 'pconarribos1'),
    ).toBe(true);
    expect(a.every((x) => x.enSegundos >= -60)).toBe(true);
    expect(a.map((x) => x.enSegundos)).toEqual(
      [...a.map((x) => x.enSegundos)].sort((x, y) => x - y),
    );
    expect(a[0]?.enSegundos).toBe(28);
    // Un viaje aparece una sola vez aunque pase por dos stop_id de la misma parada
    expect(new Set(a.map((x) => x.viajeId)).size).toBe(a.length);
    expect(res.meta.stale).toBe(true); // la 835 no respondió
  });

  it('parada sin equivalencia stop_id → lista vacía sin pedir upstream', async () => {
    const { colectivos, source } = adapter({}, NOW_TU);
    const res = await colectivos.arribos('psinequival');
    expect(res.data).toEqual({ paradaId: 'psinequival', arribos: [] });
    expect(res.meta.stale).toBe(false);
    expect(source.keys).toEqual([]);
  });

  it('parada inexistente → 404', async () => {
    const { colectivos } = adapter({}, NOW_TU);
    await expect(colectivos.arribos('pnoexiste00')).rejects.toMatchObject({ status: 404 });
  });

  it('fan-out con una línea que nunca responde → responde en < 6 s con las otras y stale (presupuesto 5 s)', async () => {
    const base = fakeSource({ 'colectivos:tripUpdates:route=834': filtered(TU, '834') });
    const calls: { key: string; retry: boolean | undefined; hasSignal: boolean }[] = [];
    const source: DeadlineFeedSource = {
      fetch(req, opts) {
        calls.push({ key: req.key, retry: opts?.retry, hasSignal: Boolean(opts?.signal) });
        // La 835 se cuelga para siempre (y no respeta el signal): el adaptador no debe esperarla.
        if (req.key.endsWith('route=835')) return new Promise<FeedResult>(() => undefined);
        return base.fetch(req);
      },
    };
    const colectivos = createColectivosAdapter({
      source,
      store: r2Store(env.STATIC),
      ttlSeconds: 20,
      staticTtlSeconds: 86_400,
      now: () => NOW_TU,
    });
    const t0 = performance.now();
    const res = await colectivos.arribos('pconarribos1');
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(6_000);
    expect(ms).toBeGreaterThanOrEqual(4_900);
    expect(res.meta.stale).toBe(true);
    expect(res.data.arribos.length).toBeGreaterThan(0);
    expect(new Set(res.data.arribos.map((a) => a.lineaId))).toEqual(new Set(['834']));
    // Dentro del fan-out no se reintenta y todas las llamadas llevan el plazo compartido
    expect(calls.every((c) => c.retry === false && c.hasSignal)).toBe(true);
  }, 10_000);

  it('todas las líneas fallan → 503', async () => {
    const { colectivos } = adapter({}, NOW_TU);
    await expect(colectivos.arribos('pconarribos1')).rejects.toMatchObject({ status: 503 });
  });
});

it('interleave reparte el tope entre números de línea', () => {
  expect(interleave([['a1', 'a2', 'a3'], ['b1']])).toEqual(['a1', 'b1', 'a2', 'a3']);
});
