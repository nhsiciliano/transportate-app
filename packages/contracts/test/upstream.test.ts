import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UpstreamSubteAlertsJson, UpstreamSubteForecastJson } from '../src/upstream/index.js';

const fixture = fileURLToPath(
  new URL('../../../apps/proxy/test/fixtures/subtes/serviceAlerts.json=1.json', import.meta.url),
);

describe('UpstreamSubteAlertsJson', () => {
  it('acepta la fixture real de /subtes/serviceAlerts?json=1', () => {
    const raw: unknown = JSON.parse(readFileSync(fixture, 'utf8'));
    const result = UpstreamSubteAlertsJson.safeParse(raw);
    expect(result.success).toBe(true);
    const ids = result.data?.entity?.map((e) => e.id) ?? [];
    expect(ids).toContain('Alert_LineaB');
  });

  it('rechaza algo que no es un feed', () => {
    expect(UpstreamSubteAlertsJson.safeParse({ entity: 'nada' }).success).toBe(false);
  });
});

const forecastFixture = fileURLToPath(
  new URL('../../../apps/proxy/test/fixtures/subtes/forecastGTFS.json', import.meta.url),
);

describe('UpstreamSubteForecastJson', () => {
  it('acepta la fixture real de /subtes/forecastGTFS', () => {
    const raw: unknown = JSON.parse(readFileSync(forecastFixture, 'utf8'));
    const result = UpstreamSubteForecastJson.safeParse(raw);
    expect(result.success).toBe(true);
    const lineas = new Set(result.data?.Entity?.map((e) => e.Linea.Route_Id));
    expect(lineas).toContain('LineaA');
    expect(result.data?.Entity?.[0]?.Linea.Estaciones?.[0]?.stop_id).toMatch(/^\d{4}[NS]$/);
  });

  it('rechaza un feed GTFS-RT (no es este formato)', () => {
    expect(UpstreamSubteForecastJson.safeParse({ header: {}, entity: [] }).success).toBe(false);
  });
});
