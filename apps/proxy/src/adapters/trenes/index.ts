// TrenesAdapter (Fase 6, ola 1): estado por línea y ramal, alertas y arribos por estación desde la
// API comunitaria de SOFSE (sofse.ts). Reglas, claves, TTL y degradación: README.md.
//
// La fuente es el servidor personal de una persona (1–2,5 s por pedido, sin SLA): TTL generosos,
// un solo refresco por clave (capa A) y un plazo único de 5 s para el fan-out de `loadRed()`.
import type {
  AlertasTrenV1,
  AlertaTrenV1,
  ArribosEstacionTrenV1,
  ArriboTrenV1,
  EnvelopeV1,
  EstadoLineasTrenV1,
  EstadoLineaTrenV1,
  EstadoRamalTrenV1,
  LineaTrenId,
  SentidoTrenV1,
} from '@transportate/contracts';
import {
  UpstreamSofseArribos,
  UpstreamSofseGerencias,
  UpstreamSofseRamales,
  type UpstreamSofseAlerta,
} from '@transportate/contracts/upstream';
import { DeadlineExceeded, raceAbort } from '../../cache/deadline';
import type { DeadlineFeedSource } from '../../sources/edge-cached';
import type { FeedRequest, FeedResult } from '../../sources/types';
import { buildMeta } from '../../sources/upstream';
import { ApiError, type TrenesAdapter } from '../types';
import { LINEAS_TREN, lineaDeGerencia, type LineaTren } from './lineas';
import {
  alertaVigente,
  estadoDe,
  nombreEfecto,
  normalizarTexto,
  ORDEN_SEVERIDAD,
  severidadAlerta,
  severidadEstadoSofse,
  tituloDe,
  type Severidad,
} from './reglas';
import { decodeJson, MENSAJE_INVALIDA, parseFechaSofse, parseIsoArribo, urls } from './sofse';

/** Presupuesto del fan-out de `loadRed()` (gerencias + 6 ramales). */
export const RED_BUDGET_MS = 5_000;
/**
 * Pedidos en vuelo a la vez en `loadRed()`. Workers deja 6 conexiones salientes simultáneas por
 * request; el séptimo fetch esperaría su turno igual, pero sin control propio del orden.
 */
export const RED_CONCURRENCIA = 6;
/** Arribos que se piden a la fuente por estación. */
export const CANTIDAD_ARRIBOS = 8;
/** Arribos más viejos que esto (pasados) se descartan. */
const ARRIBO_PASADO_SECONDS = -30;

export const MENSAJE_APAGADO = 'Trenes no disponible por ahora';
export const MENSAJE_CAIDO = 'Servicio de trenes no disponible';

export interface TrenesDeps {
  source: DeadlineFeedSource;
  /** Base de la fuente (`TRENES_UPSTREAM_BASE`). */
  baseUrl: string;
  /** Kill-switch (`TRENES_ENABLED === 'true'`). */
  enabled: boolean;
  /** TTL de arribos (`TRENES_TTL_SECONDS`). */
  ttlSeconds: number;
  /** TTL de gerencias y ramales (`TRENES_ESTADO_TTL_SECONDS`). */
  ttlEstadoSeconds: number;
  /** Plazo del fan-out en ms (default `RED_BUDGET_MS`). */
  redBudgetMs?: number;
  now: () => number;
}

type Gerencia = UpstreamSofseGerencias[number];
type Ramal = UpstreamSofseRamales[number];

interface Cargado<T> {
  result: FeedResult;
  data: T;
}

interface AlertaInterna {
  v1: AlertaTrenV1;
  severidad: Severidad;
  orden: number;
}

/** Lo que leyó `loadRed()`: `ramales` en `null` para las líneas cuya fuente falló. */
interface Red {
  gerencias: Cargado<UpstreamSofseGerencias>;
  ramales: Map<LineaTrenId, Cargado<UpstreamSofseRamales> | null>;
}

/** Fallos esperables de la fuente (sin dato y sin copia, o plazo vencido). El resto se propaga. */
const esCaida = (err: unknown): boolean =>
  err instanceof DeadlineExceeded ||
  (err instanceof ApiError && err.code === 'upstream_unavailable');

/**
 * `Promise.allSettled` con a lo sumo `limite` tareas en vuelo: cada una arranca cuando termina
 * otra, en el orden de la lista.
 */
export async function settledConLimite<T>(
  tareas: readonly (() => Promise<T>)[],
  limite: number,
): Promise<PromiseSettledResult<T>[]> {
  const out: PromiseSettledResult<T>[] = new Array<PromiseSettledResult<T>>(tareas.length);
  let siguiente = 0;
  const trabajador = async (): Promise<void> => {
    while (siguiente < tareas.length) {
      const i = siguiente++;
      const tarea = tareas[i];
      if (!tarea) continue;
      try {
        out[i] = { status: 'fulfilled', value: await tarea() };
      } catch (reason) {
        out[i] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, tareas.length) }, trabajador));
  return out;
}

const apagado = (): ApiError => new ApiError('upstream_unavailable', MENSAJE_APAGADO, 503);

const iso = (ms: number | null): string | undefined =>
  ms === null ? undefined : new Date(ms).toISOString();

const idDe = (v: string | number | null | undefined): string | undefined =>
  v === null || v === undefined || String(v).trim() === '' ? undefined : String(v);

function sentidoDe(v: string | number | null | undefined): SentidoTrenV1 | undefined {
  const s = idDe(v);
  return s === '1' || s === '2' ? s : undefined;
}

/** Más severa primero; a igual severidad, menor `criticidad_orden` (más crítica para SOFSE); luego id. */
function porSeveridad(a: AlertaInterna, b: AlertaInterna): number {
  return (
    ORDEN_SEVERIDAD[b.severidad] - ORDEN_SEVERIDAD[a.severidad] ||
    a.orden - b.orden ||
    a.v1.id.localeCompare(b.v1.id)
  );
}

function peorSeveridad(xs: readonly Severidad[]): Severidad | null {
  let peor: Severidad | null = null;
  for (const s of xs) if (peor === null || ORDEN_SEVERIDAD[s] > ORDEN_SEVERIDAD[peor]) peor = s;
  return peor;
}

/** Alerta de SOFSE → v1 (`undefined` si su línea no es una de las seis). */
/**
 * Alerta de SOFSE → v1. Sin `linea_id` (o sin `ramal_id`) toma la línea (o el ramal) de la lista
 * donde vino; con un `linea_id` que no es de las seis líneas, `undefined`.
 */
function traducirAlerta(
  a: UpstreamSofseAlerta,
  donde: { linea: LineaTrenId; ramalId?: string | undefined },
): AlertaInterna | undefined {
  const lineaId = idDe(a.linea_id);
  const linea = lineaId === undefined ? donde.linea : lineaDeGerencia(lineaId);
  if (!linea) return undefined;
  const descripcion = normalizarTexto(a.contenido);
  const v1: AlertaTrenV1 = { id: String(a.id), linea, titulo: tituloDe(descripcion), descripcion };
  const ramalId = idDe(a.ramal_id) ?? donde.ramalId;
  const estacionId = idDe(a.estacion_id);
  const sentido = sentidoDe(a.sentido);
  const causa = idDe(a.causa_gtfs);
  const efecto = nombreEfecto(a.efecto_gtfs);
  const desde = iso(parseFechaSofse(a.vigencia_desde));
  const hasta = iso(parseFechaSofse(a.vigencia_hasta));
  if (ramalId) v1.ramalId = ramalId;
  if (estacionId) v1.estacionId = estacionId;
  if (sentido) v1.sentido = sentido;
  if (causa) v1.causa = causa;
  if (efecto) v1.efecto = efecto;
  if (desde) v1.desde = desde;
  if (hasta) v1.hasta = hasta;
  return {
    v1,
    severidad: severidadAlerta(a),
    orden: a.criticidad_orden ?? Number.MAX_SAFE_INTEGER,
  };
}

export function createTrenesAdapter(deps: TrenesDeps): TrenesAdapter {
  const { source, enabled, ttlSeconds, ttlEstadoSeconds, now } = deps;
  const u = urls(deps.baseUrl);
  const redBudgetMs = deps.redBudgetMs ?? RED_BUDGET_MS;

  const conPlazo = (req: FeedRequest, signal: AbortSignal): Promise<FeedResult> =>
    raceAbort(source.fetch(req, { signal, retry: false }), signal);

  /** `parse` falla → `null` (se trata como caída de esa parte). */
  function leer<T>(
    result: FeedResult,
    schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } },
  ): Cargado<T> | null {
    let raw: unknown;
    try {
      raw = decodeJson(result);
    } catch {
      return null;
    }
    const parsed = schema.safeParse(raw);
    return parsed.success ? { result, data: parsed.data } : null;
  }

  /**
   * Gerencias + los ramales de las 6 líneas, con un único plazo y a lo sumo `RED_CONCURRENCIA`
   * pedidos en vuelo (gerencias y 5 ramales; el sexto ramal arranca cuando termina el primero). Si `gerencias` no
   * llega (ni hay último dato bueno) devuelve `null`; un `ramales` caído deja esa línea en `null`.
   */
  async function loadRed(): Promise<Red | null> {
    const signal = AbortSignal.timeout(redBudgetMs);
    const pedidos: FeedRequest[] = [
      { key: 'trenes:gerencias', url: u.gerencias(), ttlSeconds: ttlEstadoSeconds, accept: 'json' },
      ...LINEAS_TREN.map((l) => ({
        key: `trenes:ramales:${l.idGerencia}`,
        url: u.ramales(l.idGerencia),
        ttlSeconds: ttlEstadoSeconds,
        accept: 'json' as const,
      })),
    ];
    const settled = await settledConLimite(
      pedidos.map((r) => () => conPlazo(r, signal)),
      RED_CONCURRENCIA,
    );
    for (const s of settled) if (s.status === 'rejected' && !esCaida(s.reason)) throw s.reason;
    const [g, ...rs] = settled;
    const gerencias = g?.status === 'fulfilled' ? leer(g.value, UpstreamSofseGerencias) : null;
    if (!gerencias) return null;
    const ramales = new Map<LineaTrenId, Cargado<UpstreamSofseRamales> | null>();
    LINEAS_TREN.forEach((l, i) => {
      const s = rs[i];
      ramales.set(l.id, s?.status === 'fulfilled' ? leer(s.value, UpstreamSofseRamales) : null);
    });
    return { gerencias, ramales };
  }

  /** Alertas vigentes de una línea: las de su gerencia y las de todos sus ramales, sin repetir. */
  function alertasDeLinea(
    l: LineaTren,
    gerencia: Gerencia | undefined,
    ramales: readonly Ramal[],
    t: number,
  ): { deLinea: AlertaInterna[]; porRamal: Map<string, AlertaInterna[]> } {
    const vistas = new Set<string>();
    const deLinea: AlertaInterna[] = [];
    const porRamal = new Map<string, AlertaInterna[]>();
    const agregar = (a: UpstreamSofseAlerta, ramalId?: string): void => {
      const id = String(a.id);
      if (vistas.has(id) || !alertaVigente(a, t)) return;
      const interna = traducirAlerta(a, { linea: l.id, ramalId });
      if (!interna || interna.v1.linea !== l.id) return;
      vistas.add(id);
      deLinea.push(interna);
      const r = interna.v1.ramalId;
      if (r !== undefined) porRamal.set(r, [...(porRamal.get(r) ?? []), interna]);
    };
    for (const a of gerencia?.alerta ?? []) agregar(a);
    for (const r of ramales) for (const a of r.alerta ?? []) agregar(a, String(r.id));
    deLinea.sort(porSeveridad);
    for (const xs of porRamal.values()) xs.sort(porSeveridad);
    return { deLinea, porRamal };
  }

  function sinDatos(): EnvelopeV1<EstadoLineasTrenV1> {
    return {
      meta: buildMeta({
        now: now(),
        ttlSeconds: ttlEstadoSeconds,
        sourceTimestampMs: null,
        stale: true,
      }),
      data: {
        lineas: LINEAS_TREN.map((l) => ({
          linea: l.id,
          nombre: l.nombre,
          color: l.color,
          colorTexto: l.colorTexto,
          estado: 'sin_datos',
          alertaIds: [],
          ramales: [],
        })),
      },
    };
  }

  /** Resultados que efectivamente se usaron (para `meta.stale`) y si faltó alguna parte. */
  function resultados(red: Red): { results: FeedResult[]; incompleta: boolean } {
    const results = [red.gerencias.result];
    let incompleta = false;
    for (const r of red.ramales.values()) {
      if (r) results.push(r.result);
      else incompleta = true;
    }
    return { results, incompleta };
  }

  return {
    async estadoLineas(): Promise<EnvelopeV1<EstadoLineasTrenV1>> {
      if (!enabled) return sinDatos();
      const red = await loadRed();
      if (!red) return sinDatos();
      const t = now();
      let faltaLinea = false;
      const lineas = LINEAS_TREN.map((l): EstadoLineaTrenV1 => {
        const gerencia = red.gerencias.data.find((x) => lineaDeGerencia(x.id) === l.id);
        const base = { linea: l.id, nombre: l.nombre, color: l.color, colorTexto: l.colorTexto };
        if (!gerencia) {
          faltaLinea = true;
          return { ...base, estado: 'sin_datos', alertaIds: [], ramales: [] };
        }
        const ramalesFuente = red.ramales.get(l.id)?.data ?? null;
        const { deLinea, porRamal } = alertasDeLinea(l, gerencia, ramalesFuente ?? [], t);
        const sevMensaje = severidadEstadoSofse(gerencia.estado?.mensaje);
        const peorAlerta = deLinea[0];
        const sevLinea = peorSeveridad([sevMensaje, ...(peorAlerta ? [peorAlerta.severidad] : [])]);
        const linea: EstadoLineaTrenV1 = {
          ...base,
          estado: estadoDe(sevLinea),
          alertaIds: deLinea.map((a) => a.v1.id),
          ramales: [],
        };
        const mensaje = normalizarTexto(gerencia.estado?.mensaje);
        if (
          mensaje &&
          sevMensaje !== 'informativa' &&
          (!peorAlerta || ORDEN_SEVERIDAD[sevMensaje] > ORDEN_SEVERIDAD[peorAlerta.severidad])
        ) {
          linea.resumen = mensaje;
        } else if (peorAlerta) {
          linea.resumen = peorAlerta.v1.titulo;
        }
        // Alertas de la línea que no son de un ramal: pesan sobre todos sus ramales.
        const generales = deLinea.filter((a) => a.v1.ramalId === undefined);
        linea.ramales = (ramalesFuente ?? [])
          .filter((r) => r.publico === true)
          .sort(
            (a, b) =>
              (a.orden_ramal ?? Number.MAX_SAFE_INTEGER) -
                (b.orden_ramal ?? Number.MAX_SAFE_INTEGER) ||
              String(a.id).localeCompare(String(b.id), 'es', { numeric: true }),
          )
          .map((r): EstadoRamalTrenV1 => {
            const propias = porRamal.get(String(r.id)) ?? [];
            const todas = [...propias, ...generales];
            return {
              ramalId: String(r.id),
              nombre: normalizarTexto(r.nombre),
              estado: estadoDe(peorSeveridad(todas.map((a) => a.severidad))),
              alertaIds: todas.map((a) => a.v1.id),
            };
          });
        return linea;
      });
      const { results, incompleta } = resultados(red);
      return {
        meta: buildMeta({
          now: t,
          ttlSeconds: ttlEstadoSeconds,
          // La fuente no informa la hora del dato: se usa cuándo se leyó.
          sourceTimestampMs: red.gerencias.result.fetchedAt,
          results,
          stale: incompleta || faltaLinea,
        }),
        data: { lineas },
      };
    },

    async alertas(): Promise<EnvelopeV1<AlertasTrenV1>> {
      if (!enabled) throw apagado();
      const red = await loadRed();
      if (!red) throw new ApiError('upstream_unavailable', MENSAJE_CAIDO, 503, ttlEstadoSeconds);
      const t = now();
      const alertas: AlertaTrenV1[] = [];
      for (const l of LINEAS_TREN) {
        const gerencia = red.gerencias.data.find((x) => lineaDeGerencia(x.id) === l.id);
        const ramales = red.ramales.get(l.id)?.data ?? [];
        alertas.push(...alertasDeLinea(l, gerencia, ramales, t).deLinea.map((a) => a.v1));
      }
      const { results, incompleta } = resultados(red);
      return {
        meta: buildMeta({
          now: t,
          ttlSeconds: ttlEstadoSeconds,
          sourceTimestampMs: red.gerencias.result.fetchedAt,
          results,
          stale: incompleta,
        }),
        data: { alertas },
      };
    },

    async arribos(estacionId: string): Promise<EnvelopeV1<ArribosEstacionTrenV1>> {
      if (!enabled) throw apagado();
      const result = await source.fetch({
        key: `trenes:arribos:${estacionId}`,
        url: u.arribos(estacionId, CANTIDAD_ARRIBOS),
        ttlSeconds,
        accept: 'json',
      });
      const parsed = UpstreamSofseArribos.safeParse(decodeJson(result));
      if (!parsed.success) throw new ApiError('upstream_unavailable', MENSAJE_INVALIDA, 503);
      const t = now();
      const arribos: ArriboTrenV1[] = [];
      for (const { arribo, servicio } of parsed.data.results) {
        const linea = lineaDeGerencia(servicio.gerencia.id);
        const sentido = sentidoDe(servicio.sentido);
        if (!linea || !sentido) continue;
        const programada =
          parseIsoArribo(arribo.llegada?.programada) ?? parseIsoArribo(arribo.salida?.programada);
        if (programada === null) continue;
        const estimada =
          parseIsoArribo(arribo.llegada?.estimada) ?? parseIsoArribo(arribo.salida?.estimada);
        const enSegundos = Math.round(((estimada ?? programada) - t) / 1000);
        if (enSegundos < ARRIBO_PASADO_SECONDS) continue;
        const { ramal } = servicio;
        const destino = sentido === '1' ? ramal.cabeceraFinal.nombre : ramal.cabeceraInicial.nombre;
        const a: ArriboTrenV1 = {
          estacionId,
          linea,
          ramalId: String(ramal.id),
          ramal: normalizarTexto(ramal.nombre),
          destino: normalizarTexto(destino),
          sentido,
          enSegundos,
          horaProgramada: new Date(programada).toISOString(),
          cancelado: servicio.cancelacion !== null && servicio.cancelacion !== undefined,
        };
        if (estimada !== null) a.horaEstimada = new Date(estimada).toISOString();
        const anden = idDe(arribo.anden?.nombre);
        if (anden) a.anden = anden;
        const servicioId = idDe(servicio.id);
        if (servicioId) a.servicioId = servicioId;
        arribos.push(a);
      }
      arribos.sort((a, b) => a.enSegundos - b.enSegundos);
      return {
        meta: buildMeta({
          now: t,
          ttlSeconds,
          sourceTimestampMs: parsed.data.timestamp * 1000,
          results: [result],
        }),
        data: { estacionId, arribos },
      };
    },
  };
}
