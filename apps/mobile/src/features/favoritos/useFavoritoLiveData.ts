// Dato vivo de un favorito (Inicio y Favoritos). Reutiliza las queries de cada feature (misma
// query key, mismo polling en primer plano): no agrega endpoints ni otro polling.
//
// - `linea_subte`      → estado de la línea (`useEstadoSubtes`).
// - `estacion_subte`   → próximo arribo por sentido (`useArribosEstacion`).
// - `linea_colectivo`  → vehículos en servicio (`usePosicionesLinea`).
// - `parada_colectivo` → estático: las líneas que paran, desde `paradas.json` (archivo grande,
//                        `useStaticArchivoGrande`). Mientras no está cargado, el `subtitulo`
//                        guardado. Si la parada ya no figura en el listado: huérfano (`orphan`).
// - `ramal_tren`       → estado del ramal (`useEstadoTrenes`, TTL 60 s).
// - `estacion_tren`    → próximo tren por destino (`useArribosEstacionTren`).
import type { EstadoServicioV1 } from '@transportate/contracts';
import { useEffect, useState } from 'react';

import {
  useArribosEstacion,
  useArribosEstacionTren,
  useEstadoSubtes,
  useEstadoTrenes,
  useLineasColectivo,
  usePosicionesLinea,
} from '@/shared/api';
import { useRefreshInterval } from '@/shared/query';
import { useStaticArchivoGrande } from '@/shared/static';
import { formatAge, freshnessLevel, STATUS } from '@/shared/ui';

import { describirLineas, numerosDeParada } from '../colectivos/model';
import { useRedSubte } from '../subtes/hooks';
import {
  agruparArribos,
  arribosVigentes,
  estadoDeLinea,
  formatArribo,
  isLineaKey,
} from '../subtes/model';
import { useRedTrenes } from '../trenes/hooks';
import {
  agruparArribosTren,
  arribosTrenVigentes,
  estadoDeRamal,
  formatArriboTren,
} from '../trenes/model';
import type { FavoritoV1 } from './model';
import { orphanMessage, resolveFavorito } from './subte';
import { resolveFavoritoTren } from './tren';

export type LiveDataStatus =
  | 'loading'
  | 'ok'
  | 'stale'
  | 'error'
  | 'static'
  | 'none'
  /** El destino ya no está en el listado (parada que desapareció del índice). */
  | 'orphan';

/** Copy genérico del huérfano; las filas usan `orphanMessage` ("Esta parada ya no figura…"). */
export const HUERFANO = 'Ya no figura en los datos oficiales';

export interface FavoritoLiveDataResult {
  status: LiveDataStatus;
  /** Lo que se ve ("→ Leandro N. Alem 2 min · → Juan Manuel de Rosas 5 min"). */
  text: string;
  /** Lo que lee el lector ("Hacia Leandro N. Alem en 2 minutos"). */
  spoken: string;
  /** `muted` = atenuado (error o dato viejo). */
  tone: 'default' | 'muted';
  sourceTimestamp: string | null;
  /** `linea_subte` y `ramal_tren`: para el `StatusChip`. */
  estado?: EstadoServicioV1;
  /** "hace 6 min" si el dato está viejo; vacío si no. */
  ageText?: string;
  /**
   * Valor principal corto para la banda de señal de Inicio («4 min», «Llegando», «2 en servicio»,
   * «Con demoras», «Sin información»). Vacío mientras carga. `text`/`spoken` siguen siendo los de
   * Favoritos.
   */
  primary: string;
  /** `primary` es un arribo (un tiempo): Inicio lo muestra a escala monumental con «Próximo». */
  primaryIsArribo: boolean;
  /** Estaciones (subte o tren) con arribos: cabecera del tren más próximo («Leandro N. Alem»). */
  sentido?: string;
}

export const SIN_INFORMACION = 'Sin información';
export const SIN_ARRIBOS = 'Sin arribos informados';

/** Reloj que avanza cada `ms` mientras el componente está montado. */
export function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, ms);
    return () => {
      clearInterval(id);
    };
  }, [ms]);
  return now;
}

/** `resolveFavorito` y `orphanMessage` solo miran `tipo` y `refId`. */
function asFavorito(f: Pick<FavoritoV1, 'tipo' | 'refId' | 'subtitulo'>): FavoritoV1 {
  return {
    id: `${f.tipo}:${f.refId}`,
    tipo: f.tipo,
    refId: f.refId,
    nombre: f.refId,
    orden: 0,
    creadoEn: '',
  };
}

/** Versión corta de `SIN_ARRIBOS` para la banda de señal. */
export const SIN_ARRIBOS_CORTO = 'Sin arribos';
/** Valor de la banda de un favorito huérfano. */
export const HUERFANO_CORTO = 'Ya no figura';

const loading: FavoritoLiveDataResult = {
  status: 'loading',
  text: '',
  spoken: 'Cargando',
  tone: 'default',
  sourceTimestamp: null,
  primary: '',
  primaryIsArribo: false,
};
const error: FavoritoLiveDataResult = {
  status: 'error',
  text: SIN_INFORMACION,
  spoken: SIN_INFORMACION,
  tone: 'muted',
  sourceTimestamp: null,
  primary: SIN_INFORMACION,
  primaryIsArribo: false,
};

/**
 * `{ status, text, spoken, tone, sourceTimestamp }` del favorito. Con `enabled: false` (fila fuera
 * de pantalla) no se pide nada; las queries que ya estén en caché se siguen leyendo.
 */
export function useFavoritoLiveData(
  favorito: Pick<FavoritoV1, 'tipo' | 'refId' | 'subtitulo'>,
  { enabled = true }: { enabled?: boolean } = {},
): FavoritoLiveDataResult {
  const { tipo, refId } = favorito;
  const { seconds } = useRefreshInterval();
  const now = useNow(15_000);
  const red = useRedSubte();
  // Huérfano (único criterio, F4-favoritos-7): subte contra el estático de subte (el mismo
  // `resolveFavorito` que da el color de la insignia); línea de colectivo contra las líneas
  // vigentes del proxy; parada contra el índice de paradas. Sin el dato cargado no se afirma nada.
  const subteOrphan =
    (tipo === 'linea_subte' || tipo === 'estacion_subte') &&
    resolveFavorito(asFavorito(favorito), red.red).orphan;
  const redTrenes = useRedTrenes();
  const trenOrphan =
    (tipo === 'ramal_tren' || tipo === 'estacion_tren') &&
    resolveFavoritoTren(favorito, redTrenes.red).orphan;
  const lineasVivas = useLineasColectivo({ enabled: enabled && tipo === 'linea_colectivo' });
  const lineaOrphan =
    tipo === 'linea_colectivo' &&
    lineasVivas.data !== undefined &&
    !lineasVivas.data.lineas.some((l) => l.lineaId === refId);
  const estado = useEstadoSubtes({ enabled: enabled && tipo === 'linea_subte' && !subteOrphan });
  const arribos = useArribosEstacion(tipo === 'estacion_subte' ? refId : null, {
    enabled: enabled && !subteOrphan,
  });
  const posiciones = usePosicionesLinea(tipo === 'linea_colectivo' ? refId : null, {
    enabled: enabled && !lineaOrphan,
  });
  const estadoTren = useEstadoTrenes({
    enabled: enabled && tipo === 'ramal_tren' && !trenOrphan,
  });
  const arribosTren = useArribosEstacionTren(tipo === 'estacion_tren' ? refId : null, {
    enabled: enabled && !trenOrphan,
  });
  // Solo carga el índice de paradas (1,7 MB) para favoritos de parada.
  const paradas = useStaticArchivoGrande('paradas.json', {
    enabled: enabled && tipo === 'parada_colectivo',
  });

  /** Edad del dato y si está viejo para el intervalo elegido (S6). */
  // El reloj nunca va detrás de la última respuesta (si no, un dato recién llegado "rejuvenece").
  const age = (ts: string | null, dataUpdatedAt: number) => {
    const t = ts === null ? NaN : Date.parse(ts);
    if (Number.isNaN(t)) return { stale: false, veryStale: false, suffix: '' };
    const ageSeconds = Math.max(0, (Math.max(now, dataUpdatedAt) - t) / 1000);
    const level = freshnessLevel(ageSeconds, seconds);
    const stale = level === 'stale' || level === 'veryStale';
    return {
      stale,
      veryStale: level === 'veryStale',
      suffix: stale ? `hace ${formatAge(ageSeconds).short}` : '',
    };
  };
  const join = (...parts: string[]) => parts.filter((p) => p !== '').join(' · ');
  const orphan = (): FavoritoLiveDataResult => {
    const message = orphanMessage(asFavorito(favorito));
    return {
      status: 'orphan',
      text: message,
      spoken: message,
      tone: 'muted',
      sourceTimestamp: null,
      primary: HUERFANO_CORTO,
      primaryIsArribo: false,
    };
  };
  if (subteOrphan || lineaOrphan || trenOrphan) return orphan();

  switch (tipo) {
    case 'linea_subte': {
      const linea = isLineaKey(refId) ? red.red?.lineaPorKey.get(refId) : undefined;
      if (estado.data === undefined || (linea === undefined && red.isPending)) {
        return estado.isLoadingError || red.isLoadingError ? error : loading;
      }
      if (linea === undefined) return error;
      const { estado: e } = estadoDeLinea(linea, estado.data.lineas);
      const a = age(estado.sourceTimestamp, estado.dataUpdatedAt);
      const label = STATUS[e].label;
      return {
        status: a.stale ? 'stale' : 'ok',
        text: join(label, a.suffix),
        spoken: join(`Estado: ${label.toLowerCase()}`, a.suffix),
        tone: a.stale ? 'muted' : 'default',
        sourceTimestamp: estado.sourceTimestamp,
        estado: e,
        ageText: a.suffix,
        primary: label,
        primaryIsArribo: false,
      };
    }
    case 'estacion_subte': {
      const estacion = red.red?.estacionPorId.get(refId);
      const linea = estacion === undefined ? undefined : red.red?.lineaPorKey.get(estacion.linea);
      if (arribos.data === undefined || (linea === undefined && red.isPending)) {
        return arribos.isLoadingError || red.isLoadingError ? error : loading;
      }
      const a = age(arribos.sourceTimestamp, arribos.dataUpdatedAt);
      const bloques =
        linea === undefined || red.red === undefined
          ? []
          : agruparArribos(
              refId,
              linea,
              arribosVigentes(arribos.data.arribos, Math.max(now, arribos.dataUpdatedAt)),
              red.red.estacionPorId,
            ).filter((b) => b.arribos.length > 0);
      // Con dato de más de 10 min, un "2 min" engaña (S30): se muestra solo la antigüedad.
      if (bloques.length === 0 || a.veryStale) {
        return {
          status: a.stale ? 'stale' : 'ok',
          text: join(SIN_ARRIBOS, a.suffix),
          spoken: join(SIN_ARRIBOS, a.suffix),
          tone: 'muted',
          sourceTimestamp: arribos.sourceTimestamp,
          ageText: a.suffix,
          primary: SIN_ARRIBOS_CORTO,
          primaryIsArribo: false,
        };
      }
      // El sentido con el tren más próximo primero.
      const primeros = bloques
        .flatMap((b) => {
          const first = b.arribos[0];
          return first === undefined
            ? []
            : [{ cabecera: b.cabecera, en: first.enSegundos, t: formatArribo(first.enSegundos) }];
        })
        .sort((x, y) => x.en - y.en);
      return {
        status: a.stale ? 'stale' : 'ok',
        text: join(primeros.map((p) => `→ ${p.cabecera} ${p.t.short}`).join(' · '), a.suffix),
        spoken: join(primeros.map((p) => `Hacia ${p.cabecera} ${p.t.spoken}`).join('. '), a.suffix),
        tone: a.stale ? 'muted' : 'default',
        sourceTimestamp: arribos.sourceTimestamp,
        ageText: a.suffix,
        primary: primeros[0]?.t.short ?? SIN_ARRIBOS_CORTO,
        primaryIsArribo: primeros.length > 0,
        ...(primeros[0] === undefined ? {} : { sentido: primeros[0].cabecera }),
      };
    }
    case 'ramal_tren': {
      const ramal = redTrenes.red?.ramalPorId.get(refId);
      if (estadoTren.data === undefined || (ramal === undefined && redTrenes.isPending)) {
        return estadoTren.isLoadingError || redTrenes.isLoadingError ? error : loading;
      }
      const e = estadoDeRamal(refId, estadoTren.data);
      const a = age(estadoTren.sourceTimestamp, estadoTren.dataUpdatedAt);
      const label = STATUS[e].label;
      return {
        status: a.stale ? 'stale' : 'ok',
        text: join(label, a.suffix),
        spoken: join(`Estado: ${label.toLowerCase()}`, a.suffix),
        tone: a.stale ? 'muted' : 'default',
        sourceTimestamp: estadoTren.sourceTimestamp,
        estado: e,
        ageText: a.suffix,
        primary: label,
        primaryIsArribo: false,
      };
    }
    case 'estacion_tren': {
      if (arribosTren.data === undefined) return arribosTren.isLoadingError ? error : loading;
      const a = age(arribosTren.sourceTimestamp, arribosTren.dataUpdatedAt);
      const bloques = agruparArribosTren(
        arribosTrenVigentes(arribosTren.data.arribos, Math.max(now, arribosTren.dataUpdatedAt)),
      ).filter((b) => b.arribos.length > 0);
      // Con dato de más de 10 min, un «4 min» engaña (S30): se muestra solo la antigüedad.
      if (bloques.length === 0 || a.veryStale) {
        return {
          status: a.stale ? 'stale' : 'ok',
          text: join(SIN_ARRIBOS, a.suffix),
          spoken: join(SIN_ARRIBOS, a.suffix),
          tone: 'muted',
          sourceTimestamp: arribosTren.sourceTimestamp,
          ageText: a.suffix,
          primary: SIN_ARRIBOS_CORTO,
          primaryIsArribo: false,
        };
      }
      // El destino con el tren (no cancelado) más próximo primero.
      const primeros = bloques
        .flatMap((b) => {
          const first = b.arribos[0];
          return first === undefined
            ? []
            : [{ destino: b.destino, en: first.enSegundos, t: formatArriboTren(first.enSegundos) }];
        })
        .sort((x, y) => x.en - y.en);
      return {
        status: a.stale ? 'stale' : 'ok',
        text: join(primeros.map((p) => `→ ${p.destino} ${p.t.short}`).join(' · '), a.suffix),
        spoken: join(primeros.map((p) => `Hacia ${p.destino} ${p.t.spoken}`).join('. '), a.suffix),
        tone: a.stale ? 'muted' : 'default',
        sourceTimestamp: arribosTren.sourceTimestamp,
        ageText: a.suffix,
        primary: primeros[0]?.t.short ?? SIN_ARRIBOS_CORTO,
        primaryIsArribo: primeros.length > 0,
        ...(primeros[0] === undefined ? {} : { sentido: primeros[0].destino }),
      };
    }
    case 'linea_colectivo': {
      if (posiciones.data === undefined) return posiciones.isLoadingError ? error : loading;
      const a = age(posiciones.sourceTimestamp, posiciones.dataUpdatedAt);
      const n = posiciones.data.vehiculos.length;
      return {
        status: a.stale ? 'stale' : 'ok',
        text: join(`${n} en servicio`, a.suffix),
        spoken: join(n === 1 ? '1 colectivo en servicio' : `${n} colectivos en servicio`, a.suffix),
        tone: a.stale ? 'muted' : 'default',
        sourceTimestamp: posiciones.sourceTimestamp,
        ageText: a.suffix,
        primary: `${n} en servicio`,
        primaryIsArribo: false,
      };
    }
    case 'parada_colectivo': {
      if (paradas.data !== undefined) {
        const parada = paradas.data.paradas.find((p) => p.id === refId);
        if (parada === undefined) return orphan();
        const lineas = describirLineas(numerosDeParada(parada));
        return {
          status: 'static',
          text: lineas,
          spoken: lineas,
          tone: 'default',
          sourceTimestamp: null,
          primary: lineas,
          primaryIsArribo: false,
        };
      }
      const sub = favorito.subtitulo ?? '';
      return {
        status: sub === '' ? 'none' : 'static',
        text: sub,
        spoken: sub,
        tone: 'default',
        sourceTimestamp: null,
        primary: sub === '' ? SIN_INFORMACION : sub,
        primaryIsArribo: false,
      };
    }
  }
}
