// Helpers de GeoJSON para las capas propias (subte en 4.3, colectivos en 4.6).
import type { LngLat, LngLatBounds } from '@maplibre/maplibre-react-native';

type Position = readonly number[];

function* positions(geometry: GeoJSON.Geometry): Generator<Position> {
  switch (geometry.type) {
    case 'Point':
      yield geometry.coordinates;
      return;
    case 'MultiPoint':
    case 'LineString':
      yield* geometry.coordinates;
      return;
    case 'MultiLineString':
    case 'Polygon':
      for (const ring of geometry.coordinates) yield* ring;
      return;
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) for (const ring of polygon) yield* ring;
      return;
    case 'GeometryCollection':
      for (const child of geometry.geometries) yield* positions(child);
  }
}

/**
 * Extensión `[oeste, sur, este, norte]` de una colección, o `null` si no tiene coordenadas.
 * Sirve como `initialBounds` del `MapView`.
 */
export function boundsOf(collection: GeoJSON.FeatureCollection): LngLatBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const feature of collection.features) {
    for (const [lon, lat] of positions(feature.geometry)) {
      if (lon === undefined || lat === undefined) continue;
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

/** Arma una `FeatureCollection` de puntos a partir de cualquier lista con coordenadas. */
export function pointCollection<T, P extends GeoJSON.GeoJsonProperties>(
  items: readonly T[],
  toPoint: (item: T) => { coordinates: LngLat; properties: P; id?: string | number },
): GeoJSON.FeatureCollection<GeoJSON.Point, P> {
  return {
    type: 'FeatureCollection',
    features: items.map((item) => {
      const { coordinates, properties, id } = toPoint(item);
      return {
        type: 'Feature',
        ...(id === undefined ? {} : { id }),
        geometry: { type: 'Point', coordinates },
        properties,
      };
    }),
  };
}

/**
 * Lee una propiedad de texto de la primera feature tocada (`onPress` de un `GeoJSONSource`).
 * Las `properties` de GeoJSON no tienen tipo: se valida en vez de castear.
 */
export function pressedProperty(features: readonly GeoJSON.Feature[], key: string): string | null {
  for (const feature of features) {
    const value: unknown = feature.properties?.[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return null;
}
