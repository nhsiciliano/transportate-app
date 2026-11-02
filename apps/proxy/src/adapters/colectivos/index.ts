// ColectivosAdapter (tarea 2.6). Reglas en README.md de esta carpeta.
//
// NUNCA pide el feed completo (580 KB / 3,6 MB): decodificarlo excede el CPU del plan Free
// (docs/04-escalabilidad.md §9). Siempre usa el filtro upstream `route_id` (~1 KB / ~5 KB).
import type {
  ArriboColectivoV1,
  ArribosParadaV1,
  EnvelopeV1,
  LineaColectivoEstaticaV1,
  LineaColectivoV1,
  LineasColectivoV1,
  PosicionesLineaV1,
  VehiculoV1,
} from '@transportate/contracts';
import { decodeFeed, secondsToMs, toNumber, type FeedMessage } from '../../lib/gtfs-rt';
import { raceAbort } from '../../cache/deadline';
import type { DeadlineFeedSource } from '../../sources/edge-cached';
import type { FeedResult } from '../../sources/types';
import { buildMeta, upstreamUrl } from '../../sources/upstream';
import { ApiError, type ColectivosAdapter } from '../types';
import { getStaticSnapshot, type StaticStore } from './static-index';

/** Vehículos con reporte más viejo que esto se descartan. */
export const MAX_EDAD_VEHICULO_S = 30 * 60;
/** Bbox del AMBA: el feed trae vehículos de otras jurisdicciones (−28,47/−65,77) o con GPS roto. */
export const AMBA = { minLat: -35.2, maxLat: -34.2, minLon: -59.2, maxLon: -58.0 };
/** Arribos más viejos que esto se descartan. */
const ARRIBO_PASADO_S = -60;
export const MAX_LINEAS_POR_PARADA = 8;
export const MAX_ARRIBOS_POR_LINEA = 10;

/** Presupuesto total de `arribos()` (fan-out a varias líneas): nunca esperar más que esto. */
export const FANOUT_BUDGET_MS = 5_000;

export interface ColectivosDeps {
  source: DeadlineFeedSource;
  /** Presupuesto del fan-out de `arribos()` en ms (default `FANOUT_BUDGET_MS`). */
  fanOutBudgetMs?: number;
  store: StaticStore;
  ttlSeconds: number;
  staticTtlSeconds: number;
  now: () => number;
}

const enAmba = (lat: number, lon: number): boolean =>
  lat >= AMBA.minLat && lat <= AMBA.maxLat && lon >= AMBA.minLon && lon <= AMBA.maxLon;

/** Entrada estática → `LineaColectivoV1` (sin los campos extra del archivo). */
function toLineaV1(l: LineaColectivoEstaticaV1): LineaColectivoV1 {
  const out: LineaColectivoV1 = { lineaId: l.lineaId, linea: l.linea, empresa: l.empresa };
  if (l.ramal !== undefined) out.ramal = l.ramal;
  if (l.cabeceras !== undefined) out.cabeceras = l.cabeceras;
  return out;
}

function decode(result: FeedResult): FeedMessage {
  try {
    return decodeFeed(result.body);
  } catch {
    throw new ApiError('upstream_unavailable', 'Respuesta inválida del GCBA', 503);
  }
}

export function createColectivosAdapter(deps: ColectivosDeps): ColectivosAdapter {
  const { source, store, ttlSeconds, staticTtlSeconds, now } = deps;
  const snapshot = () => getStaticSnapshot(store, staticTtlSeconds, now());

  const fanOutBudgetMs = deps.fanOutBudgetMs ?? FANOUT_BUDGET_MS;
  const feed = (
    kind: 'vehiclePositions' | 'tripUpdates',
    lineaId: string,
    signal?: AbortSignal,
  ): Promise<FeedResult> => {
    const req = {
      key: `colectivos:${kind}:route=${lineaId}`,
      url: upstreamUrl(`/colectivos/${kind}`, { route_id: lineaId }),
      ttlSeconds,
      accept: 'protobuf' as const,
    };
    // Con plazo (fan-out): sin reintento y compitiendo contra el plazo también acá, por si la
    // fuente no lo respeta. Sin plazo (una sola línea): timeout de la fuente + 1 reintento.
    if (!signal) return source.fetch(req);
    return raceAbort(source.fetch(req, { signal, retry: false }), signal);
  };

  return {
    async lineas(): Promise<EnvelopeV1<LineasColectivoV1>> {
      const snap = await snapshot();
      const idx = await snap.lineas();
      return {
        meta: buildMeta({
          now: now(),
          ttlSeconds: staticTtlSeconds,
          sourceTimestampMs: Date.parse(snap.generatedAt),
        }),
        data: { lineas: [...idx.porId.values()].map(toLineaV1) },
      };
    },

    async posiciones(lineaId: string): Promise<EnvelopeV1<PosicionesLineaV1>> {
      const snap = await snapshot();
      const [idx, paradasIdx] = await Promise.all([snap.lineas(), snap.paradas()]);
      const stopToParada = paradasIdx.paradaDeStop;
      const linea = idx.porId.get(lineaId);
      if (!linea) throw new ApiError('not_found', 'Línea inexistente', 404);

      const result = await feed('vehiclePositions', lineaId);
      const msg = decode(result);
      const t = now();
      let maxTs: number | null = null;
      const vehiculos: VehiculoV1[] = [];
      for (const e of msg.entity) {
        const v = e.vehicle;
        const p = v?.position;
        if (!v || !p) continue;
        const routeId = v.trip?.routeId;
        if (routeId && routeId !== lineaId) continue; // por si el filtro upstream deja pasar otras
        const tsMs = secondsToMs(v.timestamp);
        if (tsMs === null) continue;
        const edad = Math.max(0, Math.round((t - tsMs) / 1000));
        if (edad > MAX_EDAD_VEHICULO_S || !enAmba(p.latitude, p.longitude)) continue;
        maxTs = maxTs === null ? tsMs : Math.max(maxTs, tsMs);
        const veh: VehiculoV1 = {
          id: v.vehicle?.id ?? e.id,
          lineaId,
          linea: linea.linea,
          empresa: linea.empresa,
          lat: p.latitude,
          lon: p.longitude,
          rumbo: null, // el feed no trae bearing (docs/01-api-transporte.md)
          ts: new Date(tsMs).toISOString(),
          edadSegundos: edad,
        };
        if (linea.ramal !== undefined) veh.ramal = linea.ramal;
        const speed = Object.hasOwn(p, 'speed') ? p.speed : null;
        if (typeof speed === 'number' && Number.isFinite(speed) && speed >= 0)
          veh.velocidad = speed;
        const paradaId = v.stopId ? stopToParada.get(v.stopId) : undefined;
        if (paradaId) veh.paradaId = paradaId;
        vehiculos.push(veh);
      }
      return {
        meta: buildMeta({ now: t, ttlSeconds, sourceTimestampMs: maxTs, results: [result] }),
        data: { lineaId, vehiculos },
      };
    },

    async arribos(paradaId: string): Promise<EnvelopeV1<ArribosParadaV1>> {
      const snap = await snapshot();
      const [paradas, idx] = await Promise.all([snap.paradas(), snap.lineas()]);
      const parada = paradas.get(paradaId);
      if (!parada) throw new ApiError('not_found', 'Parada inexistente', 404);
      const t = now();
      // Sin equivalencia stop_id → parada no hay forma de ubicar arribos: lista vacía (la app los oculta).
      if (!parada.stopIds.length || !parada.lineaIds.length) {
        return {
          meta: buildMeta({ now: t, ttlSeconds, sourceTimestampMs: null }),
          data: { paradaId, arribos: [] },
        };
      }

      const stopIds = new Set(parada.stopIds);
      const lineaIds = parada.lineaIds.slice(0, MAX_LINEAS_POR_PARADA);
      // Un solo plazo para todo el fan-out: la respuesta sale en ≤ fanOutBudgetMs aunque alguna
      // línea no conteste (las que no llegan se omiten y la respuesta va con meta.stale).
      const signal = AbortSignal.timeout(fanOutBudgetMs);
      const settled = await Promise.allSettled(
        lineaIds.map((id) => feed('tripUpdates', id, signal)),
      );
      if (settled.every((s) => s.status === 'rejected')) {
        throw new ApiError(
          'upstream_unavailable',
          'Servicio del GCBA no disponible',
          503,
          ttlSeconds,
        );
      }

      let algunaFallo = false;
      let maxTs: number | null = null;
      const results: FeedResult[] = [];
      const arribos: ArriboColectivoV1[] = [];
      settled.forEach((s, i) => {
        const lineaId = lineaIds[i];
        const linea = lineaId ? idx.porId.get(lineaId) : undefined;
        if (s.status === 'rejected' || !lineaId || !linea) {
          algunaFallo = true;
          return;
        }
        results.push(s.value);
        let msg: FeedMessage;
        try {
          msg = decodeFeed(s.value.body);
        } catch {
          algunaFallo = true;
          return;
        }
        const deLinea: ArriboColectivoV1[] = [];
        for (const e of msg.entity) {
          const u = e.tripUpdate;
          if (!u) continue;
          if (u.trip.routeId && u.trip.routeId !== lineaId) continue;
          const tuTs = secondsToMs(u.timestamp);
          if (tuTs !== null) maxTs = maxTs === null ? tuTs : Math.max(maxTs, tuTs);
          for (const stu of u.stopTimeUpdate ?? []) {
            if (!stu.stopId || !stopIds.has(stu.stopId)) continue;
            const ev = stu.arrival?.time != null ? stu.arrival : stu.departure;
            const time = toNumber(ev?.time);
            if (time === null || time <= 0) continue;
            const enSegundos = Math.round(time - t / 1000);
            if (enSegundos < ARRIBO_PASADO_S) continue;
            const arribo: ArriboColectivoV1 = {
              paradaId,
              lineaId,
              linea: linea.linea,
              enSegundos,
              horaEstimada: new Date(time * 1000).toISOString(),
              viajeId: u.trip.tripId ?? e.id,
            };
            // protobufjs devuelve el default (0) para campos ausentes: solo se informan si vinieron.
            const delay = ev && Object.hasOwn(ev, 'delay') ? ev.delay : null;
            if (typeof delay === 'number' && Number.isFinite(delay))
              arribo.retrasoSegundos = Math.round(delay);
            const unc = ev && Object.hasOwn(ev, 'uncertainty') ? ev.uncertainty : null;
            if (typeof unc === 'number' && Number.isFinite(unc) && unc >= 0) {
              arribo.incertidumbre = Math.round(unc);
            }
            deLinea.push(arribo);
          }
        }
        deLinea.sort((a, b) => a.enSegundos - b.enSegundos);
        // Varios stop_id pueden apuntar a la misma parada (p. ej. dos códigos AVL consecutivos):
        // un viaje cuenta una sola vez, con su primer arribo.
        const vistos = new Set<string>();
        const unicos: ArriboColectivoV1[] = [];
        for (const a of deLinea) {
          if (vistos.has(a.viajeId)) continue;
          vistos.add(a.viajeId);
          unicos.push(a);
        }
        arribos.push(...unicos.slice(0, MAX_ARRIBOS_POR_LINEA));
      });
      arribos.sort((a, b) => a.enSegundos - b.enSegundos);
      return {
        meta: buildMeta({
          now: t,
          ttlSeconds,
          sourceTimestampMs: maxTs,
          results,
          stale: algunaFallo,
        }),
        data: { paradaId, arribos },
      };
    },
  };
}
