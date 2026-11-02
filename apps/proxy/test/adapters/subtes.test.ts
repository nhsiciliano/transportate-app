import {
  AlertasResponseV1,
  ArribosEstacionResponseV1,
  EstadoLineasResponseV1,
} from '@transportate/contracts';
import { describe, expect, it } from 'vitest';
import alertsFixture from '../fixtures/subtes/serviceAlerts.json=1.json';
import forecastFixture from '../fixtures/subtes/forecastGTFS.json';
import { createSubtesAdapter } from '../../src/adapters/subtes';
import { lineasDeRoute } from '../../src/adapters/subtes/lineas';
import { alertaActiva, severidad } from '../../src/adapters/subtes/reglas';
import { ApiError } from '../../src/adapters/types';
import type { FeedRequest, FeedResult, FeedSource } from '../../src/sources/types';

function encode(v: unknown): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(v));
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

/** Fuente falsa: responde la fixture según la clave y registra las requests. */
function fakeSource(
  bodies: Record<string, unknown>,
  opts: { stale?: boolean; fail?: boolean } = {},
): FeedSource & { calls: FeedRequest[] } {
  const calls: FeedRequest[] = [];
  return {
    calls,
    fetch(req: FeedRequest): Promise<FeedResult> {
      calls.push(req);
      if (opts.fail) {
        return Promise.reject(
          new ApiError('upstream_unavailable', 'Servicio del GCBA no disponible', 503, 20),
        );
      }
      const body = bodies[req.key];
      if (body === undefined) return Promise.reject(new Error(`sin fixture para ${req.key}`));
      return Promise.resolve({
        body: encode(body),
        fetchedAt: 0,
        fromCache: false,
        stale: opts.stale ?? false,
        upstreamStatus: 200,
      });
    },
  };
}

const ALERTS_TS = alertsFixture.header.timestamp * 1000;
const FORECAST_TS = forecastFixture.Header.timestamp * 1000;
const bodies = {
  'subtes:serviceAlerts:json': alertsFixture,
  'subtes:forecastGTFS': forecastFixture,
};

function adapter(nowMs: number, opts: { stale?: boolean; fail?: boolean } = {}) {
  const source = fakeSource(bodies, opts);
  return { source, subtes: createSubtesAdapter({ source, ttlSeconds: 20, now: () => nowMs }) };
}

describe('SubtesAdapter.estadoLineas (fixture real 2026-11-01)', () => {
  it('B, C y E demoradas por obras; el resto normal', async () => {
    const { subtes, source } = adapter(ALERTS_TS + 25_000);
    const res = await subtes.estadoLineas();
    expect(EstadoLineasResponseV1.parse(res)).toEqual(res);
    const estados = Object.fromEntries(res.data.lineas.map((l) => [l.linea, l.estado]));
    expect(estados).toEqual({
      A: 'normal',
      B: 'demorada', // "Estación Medrano cerrada…" (OTHER_EFFECT + texto "cerrad")
      C: 'demorada', // "…Lavalle cerrada por obras…"
      D: 'normal',
      E: 'demorada', // effect REDUCED_SERVICE
      H: 'normal',
      'PM-C': 'normal',
      'PM-S': 'normal',
    });
    const b = res.data.lineas.find((l) => l.linea === 'B');
    expect(b).toMatchObject({
      alertaIds: ['Alert_LineaB'],
      color: '#FF0000',
      colorTexto: '#000000',
      resumen: 'Estación Medrano cerrada por obras de renovación integral.',
    });
    expect(res.data.lineas.find((l) => l.linea === 'A')).not.toHaveProperty('resumen');
    expect(res.meta).toMatchObject({ stale: false, ttlSeconds: 20, ageSeconds: 25 });
    expect(res.meta.sourceTimestamp).toBe(new Date(ALERTS_TS).toISOString());
    // Nunca la variante protobuf (corrupta)
    expect(source.calls[0]?.url.searchParams.get('json')).toBe('1');
  });

  it('upstream caído sin dato → todas sin_datos y meta.stale', async () => {
    const { subtes } = adapter(ALERTS_TS, { fail: true });
    const res = await subtes.estadoLineas();
    expect(EstadoLineasResponseV1.parse(res)).toEqual(res);
    expect(new Set(res.data.lineas.map((l) => l.estado))).toEqual(new Set(['sin_datos']));
    expect(res.meta).toMatchObject({ stale: true, sourceTimestamp: null, ageSeconds: null });
  });

  it('dato viejo de la fuente → meta.stale', async () => {
    const { subtes } = adapter(ALERTS_TS, { stale: true });
    expect((await subtes.estadoLineas()).meta.stale).toBe(true);
  });
});

describe('SubtesAdapter.alertas', () => {
  it('traduce cada entity a AlertaV1', async () => {
    const { subtes } = adapter(ALERTS_TS);
    const res = await subtes.alertas();
    expect(AlertasResponseV1.parse(res)).toEqual(res);
    expect(res.data.alertas.map((a) => a.id)).toEqual([
      'Alert_LineaB',
      'Alert_LineaC',
      'Alert_LineaE',
    ]);
    expect(res.data.alertas[2]).toEqual({
      id: 'Alert_LineaE',
      lineas: ['E'],
      titulo: 'Entre Ríos y Urquiza cerradas por obras de renovación integral.',
      descripcion: 'Entre Ríos y Urquiza cerradas por obras de renovación integral.',
      causa: 'CONSTRUCTION',
      efecto: 'REDUCED_SERVICE',
    });
    expect(res.data.alertas[0]).toMatchObject({ causa: 'OTHER_CAUSE', efecto: 'OTHER_EFFECT' });
  });

  it('upstream caído → 503 (no hay alertas que mostrar)', async () => {
    const { subtes } = adapter(ALERTS_TS, { fail: true });
    await expect(subtes.alertas()).rejects.toMatchObject({ status: 503 });
  });
});

describe('SubtesAdapter.arribos (forecastGTFS)', () => {
  it('forecast congelado (fixture del 2026-10-24 leída el 2026-11-01) → sin arribos futuros y stale', async () => {
    const { subtes } = adapter(ALERTS_TS);
    const res = await subtes.arribos('1059');
    expect(ArribosEstacionResponseV1.parse(res)).toEqual(res);
    expect(res.data).toEqual({ estacionId: '1059', arribos: [] });
    expect(res.meta.stale).toBe(true);
    expect(res.meta.ageSeconds).toBeGreaterThan(7 * 24 * 3600);
  });

  it('leída cuando el feed estaba vivo → arribos futuros ordenados, con destino', async () => {
    const { subtes } = adapter(FORECAST_TS + 10_000);
    const res = await subtes.arribos('1059');
    expect(ArribosEstacionResponseV1.parse(res)).toEqual(res);
    expect(res.meta.stale).toBe(false);
    expect(res.data.arribos.length).toBeGreaterThan(0);
    for (const a of res.data.arribos) {
      expect(a).toMatchObject({ linea: 'A', estacionId: '1059', estacion: 'San Pedrito' });
      expect(a.enSegundos).toBeGreaterThanOrEqual(-30);
    }
    const s = res.data.arribos.map((a) => a.enSegundos);
    expect(s).toEqual([...s].sort((x, y) => x - y));
  });

  it('estación que no está en el feed → lista vacía (no 404)', async () => {
    const { subtes } = adapter(FORECAST_TS);
    expect((await subtes.arribos('9999')).data.arribos).toEqual([]);
  });
});

describe('reglas', () => {
  it.each([
    [1, 'Servicio normal', 'interrumpida'], // NO_SERVICE
    [7, 'Línea sin servicio por un incidente', 'interrumpida'],
    [7, 'Servicio interrumpido entre X e Y', 'interrumpida'],
    [7, 'El tren no se detiene en Callao', 'demorada'],
    [3, 'Demoras', 'demorada'], // SIGNIFICANT_DELAYS
    [9, 'Andén provisorio', 'demorada'], // STOP_MOVED
    [7, 'Nuevo horario de verano', 'informativa'],
  ])('effect %i + "%s" → %s', (effect, texto, esperado) => {
    expect(severidad(effect, texto)).toBe(esperado);
  });

  it('alerta activa según active_period', () => {
    expect(alertaActiva([], 1_000_000)).toBe(true);
    expect(alertaActiva([{ start: 0, end: 500 }], 1_000_000)).toBe(false);
    expect(alertaActiva([{ start: 900, end: 0 }], 1_000_000)).toBe(true);
  });

  it('route_id upstream → líneas', () => {
    expect(lineasDeRoute('LineaA')).toEqual(['A']);
    expect(lineasDeRoute('PM-Civico')).toEqual(['PM-C']);
    expect(lineasDeRoute('Premetro')).toEqual(['PM-C', 'PM-S']);
    expect(lineasDeRoute('LineaX')).toEqual([]);
  });
});
