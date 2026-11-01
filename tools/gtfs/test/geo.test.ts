import { describe, expect, it } from 'vitest';
import { AreaMask, clipToArea, Grid, haversine, round6, simplify } from '../src/lib/geo.js';

describe('haversine', () => {
  it('Obelisco → Plaza de Mayo ≈ 1,3 km', () => {
    const d = haversine(-34.6037, -58.3816, -34.6083, -58.3712);
    expect(d).toBeGreaterThan(1_000);
    expect(d).toBeLessThan(1_100);
  });
  it('1e-5 grados de latitud ≈ 1,1 m', () => {
    expect(haversine(-34.6, -58.4, -34.60001, -58.4)).toBeCloseTo(1.11, 1);
  });
});

describe('Grid', () => {
  const grid = new Grid<string>();
  // ~0,000359° de latitud ≈ 40 m
  grid.add(-34.6, -58.4, 'a');
  grid.add(-34.6 + 0.00027, -58.4, 'b30m');
  grid.add(-34.6 + 0.00045, -58.4, 'c50m');
  grid.add(-34.61, -58.4, 'lejos');

  it('within devuelve solo los puntos a <= radio, ordenados por distancia', () => {
    const near = grid.within(-34.6, -58.4, 40).map((n) => n.v);
    expect(near).toEqual(['a', 'b30m']);
  });
  it('busca en celdas vecinas para radios mayores a una celda', () => {
    expect(grid.within(-34.6, -58.4, 1_200).map((n) => n.v)).toContain('lejos');
  });
  it('nearest', () => {
    expect(grid.nearest(-34.6 + 0.0004, -58.4, 40)?.v).toBe('c50m');
    expect(grid.nearest(-34.7, -58.4, 40)).toBeNull();
  });
});

describe('simplify (Douglas-Peucker)', () => {
  it('quita puntos colineales y conserva los extremos', () => {
    const line = Array.from({ length: 11 }, (_, i) => ({ lat: -34.6, lon: -58.4 + i * 0.0001 }));
    const s = simplify(line, 1);
    expect(s).toEqual([line[0], line[10]]);
  });
  it('conserva un vértice que se desvía más que la tolerancia', () => {
    const line = [
      { lat: -34.6, lon: -58.4 },
      { lat: -34.6 + 0.001, lon: -58.399 }, // ~110 m fuera de la recta
      { lat: -34.6, lon: -58.398 },
    ];
    expect(simplify(line, 10)).toHaveLength(3);
    expect(simplify(line, 500)).toHaveLength(2);
  });
});

describe('clipToArea y AreaMask', () => {
  it('corta la polilínea en tramos dentro del área', () => {
    const pts = [0, 1, 2, 3, 4, 5].map((i) => ({ lat: i, lon: 0 }));
    const parts = clipToArea(pts, (p) => p.lat !== 2);
    expect(parts).toEqual([pts.slice(0, 2), pts.slice(3)]);
  });
  it('la máscara incluye las celdas con puntos y su vecindad', () => {
    const mask = new AreaMask([{ lat: -34.6, lon: -58.4 }], 0.005, 1);
    expect(mask.has(-34.6, -58.4)).toBe(true);
    expect(mask.has(-34.604, -58.4)).toBe(true);
    expect(mask.has(-34.62, -58.4)).toBe(false);
  });
});

it('round6', () => {
  expect(round6(-34.62567625999999)).toBe(-34.625676);
});
