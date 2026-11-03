// Esquemas de los `.geojson` del paquete estático: contra los archivos reales que generó
// tools/gtfs (si están) y contra casos mínimos que tienen que fallar.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  GEOJSON_ESTATICOS_V1,
  GeoJsonFeatureCollectionV1,
  SubteRedGeoJsonV1,
} from '../src/index.js';

const OUT = fileURLToPath(new URL('../../../tools/gtfs/out/', import.meta.url));

const linea = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-58.37, -34.6],
      [-58.38, -34.61],
    ],
  },
  properties: { linea: 'A', routeId: 'LineaA', color: '#A5C8FF' },
} as const;

describe('SubteRedGeoJsonV1', () => {
  it('acepta un trazo por línea con color GTFS', () => {
    expect(
      SubteRedGeoJsonV1.safeParse({ type: 'FeatureCollection', features: [linea] }).success,
    ).toBe(true);
  });

  it.each([
    ['línea desconocida', { ...linea, properties: { ...linea.properties, linea: 'Z' } }],
    ['color sin #', { ...linea, properties: { ...linea.properties, color: 'A5C8FF' } }],
    [
      'un solo punto',
      { ...linea, geometry: { type: 'LineString', coordinates: [[-58.3, -34.6]] } },
    ],
    [
      'geometría que no es línea',
      { ...linea, geometry: { type: 'Point', coordinates: [-58.3, -34.6] } },
    ],
  ])('rechaza %s', (_caso, feature) => {
    expect(
      SubteRedGeoJsonV1.safeParse({ type: 'FeatureCollection', features: [feature] }).success,
    ).toBe(false);
  });

  it.runIf(existsSync(`${OUT}subte-red.geojson`))('valida el subte-red.geojson generado', () => {
    const red = SubteRedGeoJsonV1.parse(
      JSON.parse(readFileSync(`${OUT}subte-red.geojson`, 'utf8')),
    );
    expect(red.features.map((f) => f.properties.linea).sort()).toEqual(
      ['A', 'B', 'C', 'D', 'E', 'H', 'PM-C', 'PM-S'].sort(),
    );
  });
});

describe('GeoJsonFeatureCollectionV1', () => {
  it('acepta cualquier geometría con properties libres o null', () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-58.4, -34.6] },
          properties: null,
        },
        {
          type: 'Feature',
          id: 7,
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [-58.4, -34.6],
                [-58.41, -34.61],
              ],
            ],
          },
          properties: { numero: 1 },
        },
      ],
    };
    expect(GeoJsonFeatureCollectionV1.safeParse(fc).success).toBe(true);
  });

  it('rechaza lo que no es una FeatureCollection', () => {
    expect(GeoJsonFeatureCollectionV1.safeParse({ type: 'Feature' }).success).toBe(false);
    expect(
      GeoJsonFeatureCollectionV1.safeParse({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Circle' }, properties: {} }],
      }).success,
    ).toBe(false);
  });

  it.runIf(existsSync(`${OUT}recorridos-colectivos.geojson`))(
    'valida el recorridos-colectivos.geojson generado',
    () => {
      const raw: unknown = JSON.parse(readFileSync(`${OUT}recorridos-colectivos.geojson`, 'utf8'));
      expect(GEOJSON_ESTATICOS_V1['recorridos-colectivos.geojson'].safeParse(raw).success).toBe(
        true,
      );
    },
  );
});
