import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UpstreamSubteAlertsJson } from '../src/upstream/index.js';

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
