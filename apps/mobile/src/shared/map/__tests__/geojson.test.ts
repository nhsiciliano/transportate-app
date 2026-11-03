import { boundsOf, pointCollection, pressedProperty } from '../geojson';

describe('boundsOf', () => {
  it('calcula [oeste, sur, este, norte] sobre líneas y puntos', () => {
    expect(
      boundsOf({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: null,
            geometry: {
              type: 'LineString',
              coordinates: [
                [-58.4, -34.6],
                [-58.5, -34.65],
              ],
            },
          },
          {
            type: 'Feature',
            properties: null,
            geometry: { type: 'Point', coordinates: [-58.37, -34.55] },
          },
        ],
      }),
    ).toEqual([-58.5, -34.65, -58.37, -34.55]);
  });

  it('sin coordenadas devuelve null', () => {
    expect(boundsOf({ type: 'FeatureCollection', features: [] })).toBeNull();
  });
});

describe('pointCollection', () => {
  it('convierte una lista en puntos GeoJSON con id y properties', () => {
    const fc = pointCollection([{ id: 'p1', lon: -58.4, lat: -34.6 }], (p) => ({
      id: p.id,
      coordinates: [p.lon, p.lat],
      properties: { id: p.id },
    }));
    expect(fc.features[0]).toEqual({
      type: 'Feature',
      id: 'p1',
      geometry: { type: 'Point', coordinates: [-58.4, -34.6] },
      properties: { id: 'p1' },
    });
  });
});

describe('pressedProperty', () => {
  const feature = (properties: GeoJSON.GeoJsonProperties): GeoJSON.Feature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties,
  });

  it('devuelve el primer valor de texto no vacío', () => {
    expect(
      pressedProperty([feature(null), feature({ id: '' }), feature({ id: '1078' })], 'id'),
    ).toBe('1078');
  });

  it('ignora valores que no son texto', () => {
    expect(pressedProperty([feature({ id: 7 })], 'id')).toBeNull();
  });
});
