import { CABA_BBOX, distanceMeters, isInsideCaba } from '../geo';

describe('isInsideCaba', () => {
  it.each([
    ['Obelisco', -34.6037, -58.3816],
    ['Plaza de Mayo', -34.6083, -58.3712],
    ['Liniers', -34.6393, -58.5189],
    ['Costanera Sur', -34.6195, -58.3498],
  ])('%s está adentro', (_nombre, lat, lon) => {
    expect(isInsideCaba(lat, lon)).toBe(true);
  });

  it.each([
    ['La Plata', -34.9205, -57.9536],
    ['Rosario', -32.9442, -60.6505],
    ['Montevideo', -34.9011, -56.1645],
    ['Tigre', -34.4261, -58.5797],
    ['Ezeiza', -34.8, -58.5],
  ])('%s está afuera', (_nombre, lat, lon) => {
    expect(isInsideCaba(lat, lon)).toBe(false);
  });

  it('los bordes del rectángulo cuentan como adentro', () => {
    expect(isInsideCaba(CABA_BBOX.minLat, CABA_BBOX.minLon)).toBe(true);
    expect(isInsideCaba(CABA_BBOX.maxLat, CABA_BBOX.maxLon)).toBe(true);
    expect(isInsideCaba(CABA_BBOX.maxLat + 0.001, CABA_BBOX.maxLon)).toBe(false);
  });

  it('rechaza valores que no son números', () => {
    expect(isInsideCaba(Number.NaN, -58.4)).toBe(false);
    expect(isInsideCaba(-34.6, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('distanceMeters', () => {
  const obelisco = { lat: -34.6037, lon: -58.3816 };
  const plazaDeMayo = { lat: -34.6083, lon: -58.3712 };

  it('es cero entre el mismo punto', () => {
    expect(distanceMeters(obelisco, obelisco)).toBe(0);
  });

  it('es simétrica', () => {
    expect(distanceMeters(obelisco, plazaDeMayo)).toBeCloseTo(
      distanceMeters(plazaDeMayo, obelisco),
      6,
    );
  });

  it('Obelisco – Plaza de Mayo: unos 1,1 km', () => {
    const d = distanceMeters(obelisco, plazaDeMayo);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1250);
  });

  it('un grado de latitud son unos 111,2 km', () => {
    const d = distanceMeters({ lat: -34, lon: -58 }, { lat: -35, lon: -58 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('Buenos Aires – Montevideo: unos 205 km', () => {
    const d = distanceMeters(obelisco, { lat: -34.9011, lon: -56.1645 });
    expect(d / 1000).toBeGreaterThan(200);
    expect(d / 1000).toBeLessThan(210);
  });
});
