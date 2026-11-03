// Dato vivo de un favorito (Inicio y Favoritos). Reutiliza las queries de cada feature (misma
// query key, mismo polling en primer plano): no agrega endpoints ni otro polling.
//
// - `linea_subte`      → estado de la línea (`useEstadoSubtes`).
// - `estacion_subte`   → próximo arribo por sentido (`useArribosEstacion`).
// - `linea_colectivo`  → vehículos en servicio (`usePosicionesLinea`).
// - `parada_colectivo` → estático: las líneas que paran, desde `paradas.json` (archivo grande,
//                        `useStaticArchivoGrande`). Mientras no está cargado, el `subtitulo`
//                        guardado. Si la parada ya no figura en el listado: huérfano (`orphan`).
import type { EstadoServicioV1 } from '@transportate/contracts';
import { useEffect, useState } from 'react';

import { useArribosEstacion, useEstadoSubtes, usePosicionesLinea } from '@/shared/api';
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
import type { FavoritoV1 } from './model';

export type LiveDataStatus =
  | 'loading'
  | 'ok'
  | 'stale'
  | 'error'
  | 'static'
  | 'none'
  /** El destino ya no está en el listado (parada que desapareció del índice). */
  | 'orphan';

export const HUERFANO = 'Ya no figura en el listado';

export interface FavoritoLiveDataResult {
  status: LiveDataStatus;
  /** Lo que se ve ("→ Leandro N. Alem 2 min · → Juan Manuel de Rosas 5 min"). */
  text: string;
  /** Lo que lee el lector ("Hacia Leandro N. Alem en 2 minutos"). */
  spoken: string;
  /** `muted` = atenuado (error o dato viejo). */
  tone: 'default' | 'muted';
  sourceTimestamp: string | null;
  /** Solo `linea_subte`: para el `StatusChip`. */
  estado?: EstadoServicioV1;
  /** "hace 6 min" si el dato está viejo; vacío si no. */
  ageText?: string;
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

const loading: FavoritoLiveDataResult = {
  status: 'loading',
  text: '',
  spoken: 'Cargando',
  tone: 'default',
  sourceTimestamp: null,
};
const error: FavoritoLiveDataResult = {
  status: 'error',
  text: SIN_INFORMACION,
  spoken: SIN_INFORMACION,
  tone: 'muted',
  sourceTimestamp: null,
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
  const estado = useEstadoSubtes({ enabled: enabled && tipo === 'linea_subte' });
  const arribos = useArribosEstacion(tipo === 'estacion_subte' ? refId : null, { enabled });
  const posiciones = usePosicionesLinea(tipo === 'linea_colectivo' ? refId : null, { enabled });
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
      };
    }
    case 'parada_colectivo': {
      if (paradas.data !== undefined) {
        const parada = paradas.data.paradas.find((p) => p.id === refId);
        if (parada === undefined) {
          return {
            status: 'orphan',
            text: HUERFANO,
            spoken: HUERFANO,
            tone: 'muted',
            sourceTimestamp: null,
          };
        }
        const lineas = describirLineas(numerosDeParada(parada));
        return {
          status: 'static',
          text: lineas,
          spoken: lineas,
          tone: 'default',
          sourceTimestamp: null,
        };
      }
      const sub = favorito.subtitulo ?? '';
      return {
        status: sub === '' ? 'none' : 'static',
        text: sub,
        spoken: sub,
        tone: 'default',
        sourceTimestamp: null,
      };
    }
  }
}
