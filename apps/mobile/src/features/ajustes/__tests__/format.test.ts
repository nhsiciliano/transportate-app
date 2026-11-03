import { describeIndice, formatFechaAR, formatMegabytes, totalBytes } from '../format';

const manifest = {
  version: 'abc',
  generatedAt: '2026-10-12T15:00:00.000Z',
  archivos: {
    'a.json': { url: 'abc/a.json', bytes: 3_000_000, sha256: 'a'.repeat(64) },
    'b.json': { url: 'abc/b.json', bytes: 2_000_000, sha256: 'b'.repeat(64) },
  },
};

describe('formato del índice', () => {
  it('fecha en formato argentino y con la hora de Buenos Aires', () => {
    expect(formatFechaAR('2026-10-12T15:00:00.000Z')).toBe('12/10/2026');
    // 01:30 UTC todavía es el día anterior en Argentina (UTC−3).
    expect(formatFechaAR('2026-10-12T01:30:00.000Z')).toBe('11/10/2026');
    expect(formatFechaAR('no es una fecha')).toBe('—');
  });

  it('megabytes con coma decimal', () => {
    expect(formatMegabytes(5_000_000)).toBe('4,8 MB');
    expect(formatMegabytes(1024 * 1024)).toBe('1,0 MB');
    expect(formatMegabytes(0)).toBe('0,0 MB');
  });

  it('suma los bytes de todos los archivos', () => {
    expect(totalBytes(manifest)).toBe(5_000_000);
    expect(describeIndice(manifest)).toBe('Versión del 12/10/2026 · 4,8 MB');
  });
});
