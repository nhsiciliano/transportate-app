// SubtesAdapter (tarea 2.5): estado por línea y alertas desde `/subtes/serviceAlerts?json=1`, y
// arribos desde `/subtes/forecastGTFS`. Reglas de estado: README.md de esta carpeta.
//
// - El protobuf por defecto de serviceAlerts llega corrupto (bytes ≥ 0x80 reemplazados por
//   U+FFFD, docs/01-api-transporte.md): se usa siempre `json=1`.
// - forecastGTFS es un JSON propio (no GTFS-RT) y hoy está congelado desde 2026-10-24: se marca
//   `stale` cuando su `Header.timestamp` tiene más de 3 minutos.
import type {
  AlertaV1,
  AlertasV1,
  ArriboSubteV1,
  ArribosEstacionV1,
  EnvelopeV1,
  EstadoLineasV1,
  LineaSubteId,
} from '@transportate/contracts';
import {
  UpstreamSubteAlertsJson,
  UpstreamSubteForecastJson,
} from '@transportate/contracts/upstream';
import { causeName, effectName } from '../../lib/gtfs-rt';
import { buildMeta, upstreamUrl } from '../../sources/upstream';
import type { FeedResult, FeedSource } from '../../sources/types';
import { ApiError, type SubtesAdapter } from '../types';
import { LINEAS_SUBTE, lineasDeRoute } from './lineas';
import { alertaActiva, estadoDe, ORDEN_SEVERIDAD, severidad, type Severidad } from './reglas';

/** Edad a partir de la cual el forecast se considera congelado (dato viejo). */
export const FORECAST_STALE_SECONDS = 180;
/** Arribos más viejos que esto (pasados) se descartan. */
const ARRIBO_PASADO_SECONDS = -30;

export interface SubtesDeps {
  source: FeedSource;
  ttlSeconds: number;
  now: () => number;
}

type UpstreamAlert = NonNullable<NonNullable<UpstreamSubteAlertsJson['entity']>[number]['alert']>;

interface AlertaInterna {
  v1: AlertaV1;
  severidad: Severidad;
}

function decodeJson(result: FeedResult): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(result.body));
  } catch {
    throw new ApiError('upstream_unavailable', 'Respuesta inválida del GCBA', 503);
  }
}

/** Texto en español de un `TranslatedString` (o la primera traducción). */
function texto(t: UpstreamAlert['header_text']): string {
  const tr = t?.translation ?? [];
  const es = tr.find((x) => (x.language ?? '').toLowerCase().startsWith('es')) ?? tr[0];
  return (es?.text ?? '').trim();
}

/** `stop_id` de andén (`1087N`) → estación (`1087`). */
const estacionDe = (stopId: string): string => stopId.replace(/^(\d{4})[NSEO]$/, '$1');

function traducirAlerta(id: string, alert: UpstreamAlert): AlertaInterna {
  const titulo = texto(alert.header_text);
  const descripcion = texto(alert.description_text);
  const lineas = new Set<LineaSubteId>();
  const estaciones = new Set<string>();
  for (const ie of alert.informed_entity ?? []) {
    for (const l of lineasDeRoute(ie.route_id)) lineas.add(l);
    if (ie.stop_id) estaciones.add(estacionDe(ie.stop_id));
  }
  const periodos = alert.active_period ?? [];
  const starts = periodos.map((p) => p.start ?? 0).filter((s) => s > 0);
  const ends = periodos.map((p) => p.end ?? 0).filter((e) => e > 0);
  const v1: AlertaV1 = {
    id,
    lineas: LINEAS_SUBTE.map((l) => l.id).filter((l) => lineas.has(l)),
    titulo: titulo || descripcion,
    descripcion: descripcion || titulo,
  };
  const causa = causeName(alert.cause);
  const efecto = effectName(alert.effect);
  if (causa) v1.causa = causa;
  if (efecto) v1.efecto = efecto;
  if (starts.length) v1.desde = new Date(Math.min(...starts) * 1000).toISOString();
  if (ends.length && ends.length === periodos.length) {
    v1.hasta = new Date(Math.max(...ends) * 1000).toISOString();
  }
  if (estaciones.size) v1.estacionIds = [...estaciones].sort();
  return { v1, severidad: severidad(alert.effect, `${titulo} ${descripcion}`) };
}

export function createSubtesAdapter(deps: SubtesDeps): SubtesAdapter {
  const { source, ttlSeconds, now } = deps;

  async function loadAlertas(): Promise<{
    result: FeedResult;
    alertas: AlertaInterna[];
    tsMs: number | null;
  }> {
    const result = await source.fetch({
      key: 'subtes:serviceAlerts:json',
      url: upstreamUrl('/subtes/serviceAlerts', { json: '1' }),
      ttlSeconds,
      accept: 'json',
    });
    const parsed = UpstreamSubteAlertsJson.safeParse(decodeJson(result));
    if (!parsed.success)
      throw new ApiError('upstream_unavailable', 'Respuesta inválida del GCBA', 503);
    const t = now();
    const alertas: AlertaInterna[] = [];
    for (const e of parsed.data.entity ?? []) {
      if (!e.alert || e.is_deleted === true || !alertaActiva(e.alert.active_period, t)) continue;
      alertas.push(traducirAlerta(e.id, e.alert));
    }
    const ts = parsed.data.header.timestamp;
    return { result, alertas, tsMs: ts ? ts * 1000 : null };
  }

  return {
    async estadoLineas(): Promise<EnvelopeV1<EstadoLineasV1>> {
      let loaded: Awaited<ReturnType<typeof loadAlertas>>;
      try {
        loaded = await loadAlertas();
      } catch (err) {
        if (!(err instanceof ApiError) || err.code !== 'upstream_unavailable') throw err;
        // Upstream caído y sin último dato bueno: el estado se informa como desconocido.
        return {
          meta: buildMeta({ now: now(), ttlSeconds, sourceTimestampMs: null, stale: true }),
          data: {
            lineas: LINEAS_SUBTE.map((l) => ({
              linea: l.id,
              estado: 'sin_datos',
              color: l.color,
              colorTexto: l.colorTexto,
              nombre: l.nombre,
              alertaIds: [],
            })),
          },
        };
      }
      const lineas = LINEAS_SUBTE.map((l) => {
        const propias = loaded.alertas
          .filter((a) => a.v1.lineas.includes(l.id))
          .sort((a, b) => ORDEN_SEVERIDAD[b.severidad] - ORDEN_SEVERIDAD[a.severidad]);
        const peor = propias[0];
        const linea: EstadoLineasV1['lineas'][number] = {
          linea: l.id,
          estado: estadoDe(peor?.severidad ?? null),
          color: l.color,
          colorTexto: l.colorTexto,
          nombre: l.nombre,
          alertaIds: propias.map((a) => a.v1.id),
        };
        if (peor) linea.resumen = peor.v1.titulo;
        return linea;
      });
      return {
        meta: buildMeta({
          now: now(),
          ttlSeconds,
          sourceTimestampMs: loaded.tsMs,
          results: [loaded.result],
        }),
        data: { lineas },
      };
    },

    async alertas(): Promise<EnvelopeV1<AlertasV1>> {
      const loaded = await loadAlertas();
      return {
        meta: buildMeta({
          now: now(),
          ttlSeconds,
          sourceTimestampMs: loaded.tsMs,
          results: [loaded.result],
        }),
        data: { alertas: loaded.alertas.map((a) => a.v1) },
      };
    },

    async arribos(estacionId: string): Promise<EnvelopeV1<ArribosEstacionV1>> {
      const result = await source.fetch({
        key: 'subtes:forecastGTFS',
        url: upstreamUrl('/subtes/forecastGTFS'),
        ttlSeconds,
        accept: 'json',
      });
      const parsed = UpstreamSubteForecastJson.safeParse(decodeJson(result));
      if (!parsed.success)
        throw new ApiError('upstream_unavailable', 'Respuesta inválida del GCBA', 503);
      const t = now();
      const tsSec = parsed.data.Header.timestamp ?? null;
      const tsMs = tsSec ? tsSec * 1000 : null;
      const congelado = tsMs === null || t - tsMs > FORECAST_STALE_SECONDS * 1000;

      const arribos: ArriboSubteV1[] = [];
      for (const e of parsed.data.Entity ?? []) {
        const [linea] = lineasDeRoute(e.Linea.Route_Id);
        const estaciones = e.Linea.Estaciones ?? [];
        if (!linea || !estaciones.length) continue;
        const cuando = (s: (typeof estaciones)[number]): number | null =>
          s.arrival?.time ?? s.departure?.time ?? null;
        // Destino = la última estación del viaje en el tiempo (el orden de la lista no es confiable).
        const ultima = [...estaciones].sort((a, b) => (cuando(b) ?? 0) - (cuando(a) ?? 0))[0];
        for (const s of estaciones) {
          if (estacionDe(s.stop_id) !== estacionId) continue;
          const time = cuando(s);
          if (!time) continue;
          const enSegundos = Math.round(time - t / 1000);
          if (enSegundos < ARRIBO_PASADO_SECONDS) continue;
          arribos.push({
            linea,
            estacionId,
            estacion: s.stop_name ?? estacionId,
            destino: ultima?.stop_name ?? '',
            enSegundos,
            horaEstimada: new Date(time * 1000).toISOString(),
          });
        }
      }
      arribos.sort((a, b) => a.enSegundos - b.enSegundos);
      return {
        meta: buildMeta({
          now: t,
          ttlSeconds,
          sourceTimestampMs: tsMs,
          results: [result],
          stale: congelado,
        }),
        data: { estacionId, arribos },
      };
    },
  };
}
