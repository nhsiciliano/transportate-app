// Geografía mínima para la ubicación: ¿está la persona en la Ciudad? y ¿a cuántos metros queda
// una parada? Funciones puras, sin red ni estado.

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Rectángulo de la Ciudad Autónoma de Buenos Aires: lat −34,71 a −34,52 y lon −58,54 a −58,33.
 * Sale de `docs/01b-gtfs-alternativos.md` (consulta Overpass con bbox `(-34.71,-58.54,-34.52,-58.33)`),
 * el mismo recorte con el que se relevaron las paradas. Es un rectángulo y no el polígono de la
 * Ciudad: deja pasar un pedazo del Gran Buenos Aires (F4-ubicacion-2).
 */
export const CABA_BBOX = {
  minLat: -34.71,
  maxLat: -34.52,
  minLon: -58.54,
  maxLon: -58.33,
} as const;

export function isInsideCaba(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= CABA_BBOX.minLat &&
    lat <= CABA_BBOX.maxLat &&
    lon >= CABA_BBOX.minLon &&
    lon <= CABA_BBOX.maxLon
  );
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia en metros entre dos puntos sobre la esfera terrestre (fórmula de haversine). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
