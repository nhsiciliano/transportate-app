// Contenido de la banda de señal de un favorito (dirección «Señalética de terminal», Fase 5). Lo
// usan Inicio y Favoritos: la fuente de verdad del favorito es su feature. Funciones puras.
import type { EstadoServicioV1 } from '@transportate/contracts';

import type { SignBandProps, SignBandStatus } from '@/shared/ui';

import { TIPO_ICON } from './describe';
import type { FavoritoTipo, FavoritoV1 } from './model';
import type { FavoritoLiveDataResult } from './useFavoritoLiveData';

/** Cómo se lee el tipo antes del nombre ("Estación Medrano"); las líneas ya dicen "Línea". */
export const TIPO_LECTOR: Record<FavoritoTipo, string> = {
  linea_subte: '',
  estacion_subte: 'Estación',
  linea_colectivo: 'Colectivo',
  parada_colectivo: 'Parada',
  ramal_tren: 'Ramal',
  estacion_tren: 'Estación',
};

/**
 * Mensaje de la banda: el alias si lo hay; si no, el nombre con lo que lo ubica («Línea B ·
 * Medrano hacia Leandro N. Alem», «Línea 152 · Ramal A», «Parada Cabildo y Juramento»).
 */
export function mensajeDeFavorito(
  f: Pick<FavoritoV1, 'tipo' | 'nombre' | 'subtitulo' | 'alias'>,
  sentido?: string,
): string {
  if (f.alias !== undefined) return f.alias;
  const con = (a: string, b: string | undefined) =>
    b === undefined || b === '' ? a : `${a} · ${b}`;
  switch (f.tipo) {
    case 'linea_subte':
    case 'linea_colectivo':
      return con(f.nombre, f.subtitulo);
    case 'estacion_subte': {
      const estacion = sentido === undefined ? f.nombre : `${f.nombre} hacia ${sentido}`;
      return f.subtitulo === undefined ? `Estación ${estacion}` : con(f.subtitulo, estacion);
    }
    case 'parada_colectivo':
      return `Parada ${f.nombre}`;
    // «Ramal Once – Moreno · Línea Sarmiento».
    case 'ramal_tren':
      return con(`Ramal ${f.nombre}`, f.subtitulo);
    // «Estación Caballito hacia Moreno» (el destino del próximo tren, como en subte).
    case 'estacion_tren': {
      const estacion = sentido === undefined ? f.nombre : `${f.nombre} hacia ${sentido}`;
      return `Estación ${estacion}`;
    }
  }
}

/** Lo que el lector lee antes del dato vivo: alias, tipo, nombre y subtítulo. */
export function descripcionDeFavorito(
  f: Pick<FavoritoV1, 'tipo' | 'nombre' | 'subtitulo' | 'alias'>,
): string {
  const tipo = [TIPO_LECTOR[f.tipo], f.nombre].filter((x) => x !== '').join(' ');
  return [f.alias, f.subtitulo === undefined ? tipo : `${tipo}, ${f.subtitulo}`]
    .filter((x) => x !== undefined && x !== '')
    .join('. ');
}

const ESTADO_DE_LINEA: Partial<Record<EstadoServicioV1, SignBandStatus>> = {
  demorada: { text: 'Con demoras', tone: 'warning' },
  interrumpida: { text: 'Interrumpida', tone: 'danger' },
};

export type ModeloBanda = Omit<SignBandProps, 'variant' | 'onPress'>;

/**
 * De favorito + dato vivo a lo que dibuja la banda. `lider` agrega «Próximo» a un arribo;
 * `estadoLinea` (estaciones de subte o de tren) suma el cuadrado ámbar o rojo; `testID` por pantalla.
 */
export function modeloBanda(
  f: FavoritoV1,
  live: FavoritoLiveDataResult,
  {
    lider,
    estadoLinea,
    testID = `favorito-${f.id}`,
  }: { lider: boolean; estadoLinea?: EstadoServicioV1 | undefined; testID?: string },
): ModeloBanda {
  const message = mensajeDeFavorito(f, live.sentido);
  const base = { icon: TIPO_ICON[f.tipo], message, testID };
  const descripcion = descripcionDeFavorito(f);

  if (live.status === 'loading') {
    return { ...base, value: null, accessibilityLabel: `${descripcion}, cargando` };
  }
  if (live.status === 'error' || live.status === 'none' || live.status === 'orphan') {
    const value = live.primary === '' ? live.text : live.primary;
    return {
      ...base,
      value,
      valueStyle: 'text',
      accessibilityLabel: `${descripcion}, ${live.status === 'orphan' ? live.spoken : value}`,
    };
  }

  // Estado de la línea de una estación (cuadrado ámbar o rojo) y antigüedad si el dato está viejo.
  const linea = estadoLinea === undefined ? undefined : ESTADO_DE_LINEA[estadoLinea];
  const edad = live.status === 'stale' && live.ageText !== undefined ? live.ageText : '';
  const status: SignBandStatus | undefined =
    linea !== undefined
      ? { tone: linea.tone, text: edad === '' ? linea.text : `${linea.text} · ${edad}` }
      : edad !== ''
        ? { tone: 'muted', text: edad }
        : undefined;
  const label = lider && live.primaryIsArribo ? 'Próximo' : undefined;
  return {
    ...base,
    value: live.primary,
    valueStyle: live.primaryIsArribo ? 'display' : 'text',
    label,
    status,
    // La parada guarda sus líneas como subtítulo y el dato estático son esas mismas líneas: no se
    // leen dos veces.
    accessibilityLabel: [
      descripcion,
      f.subtitulo !== undefined && live.spoken === f.subtitulo ? undefined : live.spoken,
      linea?.text.toLowerCase(),
    ]
      .filter((x) => x !== undefined && x !== '')
      .join(', '),
  };
}
