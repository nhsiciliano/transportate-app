import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  UpstreamSofseAlerta,
  UpstreamSofseArribos,
  UpstreamSofseEstaciones,
  UpstreamSofseGerencias,
  UpstreamSofseRamales,
  UpstreamSubteAlertsJson,
  UpstreamSubteForecastJson,
} from '../src/upstream/index.js';

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

const sofse = (archivo: string): unknown =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../apps/proxy/test/fixtures/sofse/${archivo}`, import.meta.url)),
      'utf8',
    ),
  );

describe('esquemas de la API comunitaria de trenes (SOFSE)', () => {
  it('UpstreamSofseGerencias acepta la fixture real con alertas de línea', () => {
    const result = UpstreamSofseGerencias.safeParse(sofse('gerencias.json'));
    expect(result.success).toBe(true);
    const ids = result.data?.map((g) => g.id) ?? [];
    expect(ids).toEqual(expect.arrayContaining([11, 1, 5, 31, 21, 41]));
    expect(result.data?.[0]?.alerta?.[0]?.vigencia_desde).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it.each([11, 1, 5, 31, 21, 41])('UpstreamSofseRamales acepta ramales.%i.json', (id) => {
    const result = UpstreamSofseRamales.safeParse(sofse(`ramales.${id}.json`));
    expect(result.success).toBe(true);
    expect(result.data?.every((r) => r.cabecera_inicial && r.cabecera_final)).toBe(true);
  });

  it('UpstreamSofseEstaciones acepta las estaciones del ramal Once-Moreno', () => {
    const result = UpstreamSofseEstaciones.safeParse(sofse('estaciones.ramal=1.json'));
    expect(result.success).toBe(true);
    expect(result.data?.map((e) => e.nombre)).toContain('Caballito');
  });

  it.each(['arribos.332.json', 'arribos.50.json', 'arribos.inexistente.json'])(
    'UpstreamSofseArribos acepta %s',
    (archivo) => {
      expect(UpstreamSofseArribos.safeParse(sofse(archivo)).success).toBe(true);
    },
  );

  it('UpstreamSofseAlerta acepta efecto_gtfs como nombre o como número', () => {
    const base = { id: 1, contenido: 'x', habilitado: 1 };
    expect(UpstreamSofseAlerta.safeParse({ ...base, efecto_gtfs: 'NO_SERVICE' }).success).toBe(
      true,
    );
    expect(UpstreamSofseAlerta.safeParse({ ...base, efecto_gtfs: 1 }).success).toBe(true);
    expect(UpstreamSofseAlerta.safeParse({ ...base, efecto_gtfs: {} }).success).toBe(false);
  });

  it('rechaza formas que no son de la fuente', () => {
    expect(UpstreamSofseGerencias.safeParse({ results: [] }).success).toBe(false);
    expect(UpstreamSofseRamales.safeParse([{ id: 1 }]).success).toBe(false);
    expect(UpstreamSofseEstaciones.safeParse([{ nombre: 'Once' }]).success).toBe(false);
    expect(UpstreamSofseArribos.safeParse({ timestamp: 1, results: [{}] }).success).toBe(false);
  });
});
