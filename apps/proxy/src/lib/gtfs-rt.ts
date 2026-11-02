// Decodificación de feeds GTFS-RT (protobuf) con gtfs-realtime-bindings (protobufjs).
// Solo se decodifican feeds chicos, filtrados por `route_id` upstream: el feed completo de
// colectivos (~580 KB) excede el presupuesto de CPU del plan Free (docs/04-escalabilidad.md §9).
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

export const { transit_realtime } = GtfsRealtimeBindings;
export type FeedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;
export type FeedEntityInit = GtfsRealtimeBindings.transit_realtime.IFeedEntity;

/** Entero protobuf de 64 bits: protobufjs devuelve `number` o un `Long` (paquete long). */
type Int64 = number | { toNumber(): number } | null | undefined;

export function toNumber(v: Int64): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = v.toNumber();
  return Number.isFinite(n) ? n : null;
}

/** Decodifica un `FeedMessage`. Lanza si el cuerpo no es un protobuf GTFS-RT válido. */
export function decodeFeed(buf: ArrayBuffer | Uint8Array): FeedMessage {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return transit_realtime.FeedMessage.decode(bytes);
}

/** `header.timestamp` en milisegundos (en colectivos es la hora del request, no del dato). */
export function headerTimestampMs(feed: FeedMessage): number | null {
  const s = toNumber(feed.header.timestamp);
  return s === null || s <= 0 ? null : s * 1000;
}

/** Epoch en segundos → milisegundos (`null` si falta o es 0). */
export function secondsToMs(v: Int64): number | null {
  const s = toNumber(v);
  return s === null || s <= 0 ? null : s * 1000;
}

/** Epoch ms → ISO 8601 UTC. */
export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Nombre del valor de un enum de protobufjs; `undefined` si no existe. protobufjs arma los enums
 * como `{ NAME: n }` con el mapa inverso en el prototipo, así que `Object.keys` da solo nombres.
 */
function enumName(
  values: Readonly<Record<string, string | number>>,
  n: number | null | undefined,
): string | undefined {
  if (n === null || n === undefined) return undefined;
  return Object.keys(values).find((k) => values[k] === n);
}

/** `Alert.Effect` numérico → texto (`NO_SERVICE`, `REDUCED_SERVICE`…). */
export function effectName(n: number | null | undefined): string | undefined {
  return enumName(transit_realtime.Alert.Effect, n);
}

/** `Alert.Cause` numérico → texto (`CONSTRUCTION`, `OTHER_CAUSE`…). */
export function causeName(n: number | null | undefined): string | undefined {
  return enumName(transit_realtime.Alert.Cause, n);
}

/** `VehiclePosition.VehicleStopStatus` → texto (`INCOMING_AT`, `STOPPED_AT`, `IN_TRANSIT_TO`). */
export function stopStatusName(n: number | null | undefined): string | undefined {
  return enumName(transit_realtime.VehiclePosition.VehicleStopStatus, n);
}
