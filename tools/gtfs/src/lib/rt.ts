// Lectura de los fixtures de tiempo real (vehiclePositions.pb, tripUpdates.pb, vehiclePositionsSimple.json).
// Mismo criterio que tools/gtfs-cruce/cruce.mjs (cargarTiempoReal), tipado.
import { readFileSync } from 'node:fs';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { z } from 'zod';
import { isValidCoord } from './geo.js';

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

export interface VehicleObs {
  vehicleId: string | null;
  routeId: string | null;
  tripId: string | null;
  stopId: string | null;
  lat: number;
  lon: number;
}

export interface TripObs {
  tripId: string | null;
  routeId: string | null;
  vehicleId: string | null;
  /** stop_id en orden de stop_sequence (el primero es la próxima parada del viaje). */
  stopIds: string[];
}

export function readVehiclePositions(file: string): VehicleObs[] {
  const feed = FeedMessage.decode(readFileSync(file));
  const out: VehicleObs[] = [];
  for (const e of feed.entity) {
    const v = e.vehicle;
    const p = v?.position;
    if (!v || !p || !isValidCoord(p.latitude, p.longitude)) continue;
    out.push({
      vehicleId: v.vehicle?.id ?? null,
      routeId: v.trip?.routeId ?? null,
      tripId: v.trip?.tripId ?? null,
      stopId: v.stopId ?? null,
      lat: p.latitude,
      lon: p.longitude,
    });
  }
  return out;
}

export function readTripUpdates(file: string): TripObs[] {
  const feed = FeedMessage.decode(readFileSync(file));
  const out: TripObs[] = [];
  for (const e of feed.entity) {
    const u = e.tripUpdate;
    if (!u) continue;
    const stus = [...(u.stopTimeUpdate ?? [])].sort(
      (a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0),
    );
    out.push({
      tripId: u.trip.tripId ?? null,
      routeId: u.trip.routeId ?? null,
      vehicleId: u.vehicle?.id ?? null,
      stopIds: stus.map((s) => s.stopId ?? '').filter((s) => s !== ''),
    });
  }
  return out;
}

/** Fila de /colectivos/vehiclePositionsSimple (solo los campos que usamos). */
export const SimpleVehicleSchema = z.object({
  route_id: z.union([z.string(), z.number()]).transform(String),
  route_short_name: z.string().nullish(),
  agency_name: z.string().nullish(),
  agency_id: z.union([z.string(), z.number()]).nullish(),
  trip_headsign: z.string().nullish(),
  latitude: z.number(),
  longitude: z.number(),
});
export type SimpleVehicle = z.infer<typeof SimpleVehicleSchema>;

export function readVehiclePositionsSimple(file: string): SimpleVehicle[] {
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return z.array(SimpleVehicleSchema).parse(raw);
}
