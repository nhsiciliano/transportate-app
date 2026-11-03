// GeoJSON y estaciones chicos para los tests del mapa, validados con los contratos al cargarse.
import { ManifestV1, SubteEstacionesArchivoV1, SubteRedGeoJsonV1 } from '@transportate/contracts';

export const subteRed = SubteRedGeoJsonV1.parse({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-58.3708, -34.6085],
          [-58.4007, -34.6092],
          [-58.4635, -34.6295],
        ],
      },
      properties: { linea: 'A', routeId: 'LineaA', color: '#A5C8FF' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-58.3747, -34.6036],
          [-58.4565, -34.5776],
        ],
      },
      properties: { linea: 'B', routeId: 'LineaB', color: '#FF0000' },
    },
  ],
});

export const subteEstaciones = SubteEstacionesArchivoV1.parse({
  version: 1,
  fuente: 'prueba',
  estaciones: [
    {
      id: '1078',
      nombre: 'Plaza de Mayo',
      nombreGtfs: 'Plaza de Mayo',
      lat: -34.6085,
      lon: -58.3708,
      lineas: ['A'],
      andenes: ['1078N', '1078S'],
      accesible: true,
    },
    {
      id: '1090',
      nombre: 'Leandro N. Alem',
      nombreGtfs: 'Leandro N. Alem',
      lat: -34.6036,
      lon: -58.3747,
      lineas: ['B'],
      andenes: ['1090N', '1090S'],
      accesible: null,
    },
  ],
});

/** Manifiesto que publica los dos archivos del mapa (versión `abc123`). */
export const manifestMapa = ManifestV1.parse({
  version: 'abc123',
  generatedAt: '2026-11-01T00:00:00.000Z',
  archivos: {
    'subte-estaciones.json': {
      url: 'abc123/subte-estaciones.json',
      bytes: 100,
      sha256: 'a'.repeat(64),
    },
    'subte-red.geojson': { url: 'abc123/subte-red.geojson', bytes: 100, sha256: 'b'.repeat(64) },
  },
});
