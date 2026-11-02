import { describe, expect, it } from 'vitest';
import vehiclePositions from '../fixtures/colectivos/vehiclePositions.pb?inline';
import { decodeFeed } from '../../src/lib/gtfs-rt';

function bytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

describe('gtfs-rt dentro de workerd', () => {
  it('decodifica vehiclePositions.pb', () => {
    const feed = decodeFeed(bytes(vehiclePositions));
    expect(feed.entity.length).toBeGreaterThan(1000);
  });
});
