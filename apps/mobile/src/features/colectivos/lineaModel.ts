// Detalle de línea (tarea 4.6): funciones puras para el mapa y la sheet. Se testean sin React.
// Suposiciones F4-colectivos-mapa-n: README.md, "Línea y mapa".
import type { GeoJsonFeatureCollectionV1, VehiculoV1 } from '@transportate/contracts';

import type { LatLon } from '@/features/ubicacion';
import { distanceMeters } from '@/features/ubicacion';
import { formatAge } from '@/shared/ui';

/** S31: un vehículo con más de 5 min sin reportar se atenúa. */
export const VEHICULO_VIEJO_S = 5 * 60;
/** Feed con más de 10 min: todos atenuados + Alert "Las posiciones pueden no ser actuales". */
export const FEED_VIEJO_S = 10 * 60;
/** F4-colectivos-mapa-3: con más de 80 vehículos se agrupan, solo hasta zoom 13. */
export const CLUSTER_MIN_VEHICULOS = 80;
export const CLUSTER_MAX_ZOOM = 13;

export const SIN_VEHICULOS = 'No hay colectivos de esta línea con GPS activo ahora.';
export const POSICIONES_NO_DISPONIBLES =
  'Las posiciones de colectivos no están disponibles por ahora';
export const POSICIONES_VIEJAS = 'Las posiciones pueden no ser actuales';
export const REFRESH_FALLIDO = 'No pudimos actualizar. Mostramos lo último que sabemos.';

/** Segundos desde el reporte del vehículo, contados con el reloj actual. */
export function edadVehiculo(v: Pick<VehiculoV1, 'ts' | 'edadSegundos'>, now: number): number {
  const ts = Date.parse(v.ts);
  return Number.isFinite(ts) ? Math.max(0, Math.round((now - ts) / 1000)) : v.edadSegundos;
}

/** "18 colectivos en servicio" / "1 colectivo en servicio". */
export function enServicio(n: number): string {
  return `${String(n)} ${n === 1 ? 'colectivo' : 'colectivos'} en servicio`;
}

/** "a 600 m de vos" / "a 1,2 km de vos" (y su versión hablada). */
export function formatDistancia(metros: number): { short: string; spoken: string } {
  if (metros < 1000) {
    const m = Math.max(10, Math.round(metros / 10) * 10);
    return { short: `a ${String(m)} m de vos`, spoken: `a ${String(m)} metros de vos` };
  }
  const km = (Math.round(metros / 100) / 10).toLocaleString('es-AR');
  return { short: `a ${km} km de vos`, spoken: `a ${km} kilómetros de vos` };
}

export interface VehiculoVista {
  id: string;
  lat: number;
  lon: number;
  /** "Interno 1404" (F4-colectivos-mapa-2: el `id` del vehículo del feed). */
  nombre: string;
  edad: number;
  viejo: boolean;
  /** "Interno 1404 · actualizado hace 25 s · a 600 m de vos". */
  texto: string;
  /** Lo mismo para el lector de pantalla, con unidades enteras. */
  hablado: string;
  rumbo: number | null;
}

export function vistaVehiculo(
  v: VehiculoV1,
  { now, posicion }: { now: number; posicion: LatLon | null },
): VehiculoVista {
  const edad = edadVehiculo(v, now);
  const age = formatAge(edad);
  const nombre = `Interno ${v.id}`;
  const distancia =
    posicion === null
      ? null
      : formatDistancia(distanceMeters(posicion, { lat: v.lat, lon: v.lon }));
  return {
    id: v.id,
    lat: v.lat,
    lon: v.lon,
    nombre,
    edad,
    viejo: edad > VEHICULO_VIEJO_S,
    texto: [nombre, `actualizado hace ${age.short}`, distancia?.short]
      .filter((x) => x !== undefined)
      .join(' · '),
    hablado: [nombre, `actualizado hace ${age.spoken}`, distancia?.spoken]
      .filter((x) => x !== undefined)
      .join(', '),
    rumbo: v.rumbo ?? null,
  };
}

export interface VehiculoProps {
  [key: string]: string | number | boolean | null;
  id: string;
  /** Lo que se lee sobre el marcador ("60"). */
  etiqueta: string;
  /** Atenuado: dato viejo del vehículo, feed viejo, sin conexión o actualización fallida. */
  atenuado: boolean;
  seleccionado: boolean;
  /** `null` si el feed no trae rumbo (hoy nunca lo trae): sin flecha. */
  rumbo: number | null;
}

/** Puntos para el `GeoJSONSource` de vehículos. */
export function vehiculosCollection(
  vehiculos: readonly VehiculoVista[],
  {
    etiqueta,
    todosAtenuados,
    seleccionadoId,
  }: { etiqueta: string; todosAtenuados: boolean; seleccionadoId: string | null },
): GeoJSON.FeatureCollection<GeoJSON.Point, VehiculoProps> {
  return {
    type: 'FeatureCollection',
    features: vehiculos.map((v) => ({
      type: 'Feature',
      id: v.id,
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      properties: {
        id: v.id,
        etiqueta,
        atenuado: todosAtenuados || v.viejo,
        seleccionado: v.id === seleccionadoId,
        rumbo: v.rumbo,
      },
    })),
  };
}

/** Recorrido de un número de línea (`recorridos-colectivos.geojson` trae uno por número). */
export function recorridoDe(
  recorridos: GeoJsonFeatureCollectionV1 | undefined,
  numero: string,
): GeoJSON.FeatureCollection | null {
  if (recorridos === undefined) return null;
  const features = recorridos.features.filter((f) => String(f.properties?.['numero']) === numero);
  if (features.length === 0) return null;
  return { type: 'FeatureCollection', features };
}

/** Orden de la lista accesible: los más recientes primero, después por interno. */
export function ordenarVehiculos(vehiculos: readonly VehiculoVista[]): VehiculoVista[] {
  return [...vehiculos].sort((a, b) => a.edad - b.edad || a.id.localeCompare(b.id, 'es'));
}
