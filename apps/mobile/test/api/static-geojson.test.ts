// `staticGeoJson`: baja un `.geojson` del paquete estático y lo valida con su esquema.
import { ContractError, createApiClient, type ApiError } from '@/shared/api';

import { subteRed } from '../map/fixtures';
import * as fx from './fixtures';

function setup(body: unknown) {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>(() =>
    Promise.resolve(fx.jsonResponse(body)),
  );
  const client = createApiClient({
    baseUrl: 'https://proxy.test',
    fetch: fetchMock as unknown as typeof fetch,
    now: () => fx.NOW,
  });
  return { client, fetchMock };
}

describe('staticGeoJson', () => {
  it('baja subte-red.geojson de /v1/static/<version>/ y lo devuelve tipado', async () => {
    const { client, fetchMock } = setup(subteRed);
    const result = await client.staticGeoJson('abc123', 'subte-red.geojson');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://proxy.test/v1/static/abc123/subte-red.geojson',
    );
    expect(result.data.features.map((f) => f.properties.linea)).toEqual(['A', 'B']);
    expect(result.data.features[0]?.properties.color).toBe('#A5C8FF');
  });

  it('un GeoJSON fuera de contrato es ContractError (no llega a la pantalla)', async () => {
    const { client } = setup({ type: 'FeatureCollection', features: [{ type: 'Feature' }] });
    const error = await client
      .staticGeoJson('abc123', 'subte-red.geojson')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContractError);
    expect((error as ApiError).route).toBe('/v1/static/:version/:archivo');
  });

  it('los recorridos de colectivos se validan como FeatureCollection mínima', async () => {
    const { client } = setup({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
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
    });
    const result = await client.staticGeoJson('abc123', 'recorridos-colectivos.geojson');
    expect(result.data.features).toHaveLength(1);
  });
});
