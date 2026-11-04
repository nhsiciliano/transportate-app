// Modelo de Colectivos (tareas 4.5 y 4.7): índice de líneas y paradas, búsqueda local, paradas
// cercanas. Funciones puras: se testean sin React. La ubicación entra como argumento y no se
// guarda en ningún lado (docs/05-privacidad.md).
import type { LineaColectivoV1, ParadaV1 } from '@transportate/contracts';

import { distanceMeters, type LatLon } from '../ubicacion/geo';

/** Lo que trae `lineas-colectivos.json` (o `/v1/colectivos/lineas`, que no trae los extras). */
export type LineaColectivoFuente = LineaColectivoV1 & {
  numero?: number | null;
  enCaba?: boolean;
};

export interface LineaColectivo {
  /** `route_id` del proxy: el id que usa `/v1/colectivos/lineas/:lineaId/posiciones`. */
  lineaId: string;
  /** Como viene ("60 A"). */
  linea: string;
  /** Lo que va en la insignia: el número ("60") o el nombre si no tiene ("EBUS"). */
  numero: string;
  ramal: string | undefined;
  empresa: string;
  cabeceras: readonly string[];
  /** "Ramal A · a Constitución". */
  descripcion: string;
  enCaba: boolean;
}

export interface IndiceColectivos {
  lineas: readonly LineaColectivo[];
  /** Número ("60") → sus ramales, los de CABA primero. */
  lineasPorNumero: ReadonlyMap<string, readonly LineaColectivo[]>;
  paradas: readonly ParadaV1[];
  paradaPorId: ReadonlyMap<string, ParadaV1>;
}

/** Minúsculas, sin tildes ni signos. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "60 A" → "60"; "EBUS" → "EBUS". */
export function numeroDeLinea(linea: string): string {
  const m = /^\s*(\d+)/.exec(linea);
  return m?.[1] ?? linea.trim();
}

function toLinea(l: LineaColectivoFuente): LineaColectivo {
  const numero =
    l.numero === null || l.numero === undefined ? numeroDeLinea(l.linea) : String(l.numero);
  const ramal = l.ramal ?? (/^\s*\d+\s+(.+)$/.exec(l.linea)?.[1] || undefined);
  const cabeceras = l.cabeceras ?? [];
  const descripcion = [ramal === undefined ? '' : `Ramal ${ramal}`, cabeceras.join(' – ')]
    .filter((x) => x !== '')
    .join(' · ');
  return {
    lineaId: l.lineaId,
    linea: l.linea,
    numero,
    ramal,
    empresa: l.empresa,
    cabeceras,
    descripcion: descripcion === '' ? l.empresa : descripcion,
    enCaba: l.enCaba ?? true,
  };
}

const compareNumero = (a: string, b: string) => {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, 'es');
};

export function buildIndice(
  lineas: readonly LineaColectivoFuente[],
  paradas: readonly ParadaV1[],
): IndiceColectivos {
  const todas = lineas
    .map(toLinea)
    .sort(
      (a, b) =>
        compareNumero(a.numero, b.numero) ||
        Number(b.enCaba) - Number(a.enCaba) ||
        a.linea.localeCompare(b.linea, 'es'),
    );
  const lineasPorNumero = new Map<string, LineaColectivo[]>();
  for (const l of todas)
    lineasPorNumero.set(l.numero, [...(lineasPorNumero.get(l.numero) ?? []), l]);
  return {
    lineas: todas,
    lineasPorNumero,
    paradas,
    paradaPorId: new Map(paradas.map((p) => [p.id, p])),
  };
}

/** Números de línea que paran, sin repetir y en orden numérico. */
export function numerosDeParada(parada: Pick<ParadaV1, 'lineas'>): string[] {
  const set = new Set(parada.lineas.map((l) => (l.numero === null ? l.linea : String(l.numero))));
  return [...set].sort(compareNumero);
}

/** Cuántas líneas se nombran en una fila de parada antes de resumir con «y N más». */
export const LINEAS_VISIBLES_MAX = 6;
/** Cuántas quedan nombradas cuando se resume. */
export const LINEAS_VISIBLES_RESUMEN = 3;

/**
 * Las líneas que paran, para el subtítulo de una fila: «60 · 152 · 168». Con más de 6 se nombran
 * 3 y el resto se resume: «60 · 152 · 168 y 4 más».
 */
export function textoDeLineas(numeros: readonly string[]): string {
  if (numeros.length <= LINEAS_VISIBLES_MAX) return numeros.join(' · ');
  const visibles = numeros.slice(0, LINEAS_VISIBLES_RESUMEN);
  return `${visibles.join(' · ')} y ${String(numeros.length - visibles.length)} más`;
}

/** "Líneas 28, 117" (para el subtítulo del favorito y el lector). */
export function describirLineas(numeros: readonly string[]): string {
  if (numeros.length === 0) return 'Sin líneas informadas';
  return `${numeros.length === 1 ? 'Línea' : 'Líneas'} ${numeros.join(', ')}`;
}

/** Ramal al que lleva tocar un número (F4-colectivos-3): el primero en CABA. */
export function lineaParaNumero(
  indice: Pick<IndiceColectivos, 'lineasPorNumero'>,
  numero: string,
): LineaColectivo | undefined {
  return indice.lineasPorNumero.get(numero)?.[0];
}

/** Paradas por las que pasa un número de línea. */
export function paradasDeNumero(paradas: readonly ParadaV1[], numero: string): ParadaV1[] {
  return paradas.filter((p) => numerosDeParada(p).includes(numero));
}

// ---------------------------------------------------------------- búsqueda

export const MAX_RESULTADOS = 20;

export interface ResultadoBusqueda {
  lineas: LineaColectivo[];
  paradas: ParadaV1[];
}

/**
 * Búsqueda local (F4-colectivos-2). Líneas, con ranking: número exacto, nombre exacto ("60 a"),
 * número que empieza igual, y después ramal, cabecera o empresa. Paradas (desde 3 caracteres):
 * calle y altura.
 */
export function buscar(
  indice: Pick<IndiceColectivos, 'lineas' | 'paradas'>,
  consulta: string,
  max = MAX_RESULTADOS,
): ResultadoBusqueda {
  const q = normalizar(consulta);
  if (q === '') return { lineas: [], paradas: [] };
  const rank = (l: LineaColectivo): number => {
    const numero = normalizar(l.numero);
    if (numero === q) return 0;
    if (normalizar(l.linea) === q) return 1;
    if (numero.startsWith(q)) return 2;
    // Ramal, cabecera o empresa; el número no ("60" no tiene que traer la 160).
    const texto = normalizar(`${l.ramal ?? ''} ${l.cabeceras.join(' ')} ${l.empresa}`);
    return texto.includes(q) ? 3 : -1;
  };
  const lineas = indice.lineas
    .map((l, i) => ({ l, r: rank(l), i }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, max)
    .map((x) => x.l);
  const paradas =
    q.length < 3
      ? []
      : indice.paradas
          .filter((p) => normalizar(p.nombre).includes(q))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
          .slice(0, max);
  return { lineas, paradas };
}

// ---------------------------------------------------------------- cercanía

// Geografía (haversine y el rectángulo de CABA): una sola fuente, `features/ubicacion/geo.ts`.
const rad = (g: number) => (g * Math.PI) / 180;

export interface ParadaCercana {
  parada: ParadaV1;
  metros: number;
}

/** Radio de búsqueda de cercanas: 1,5 km (unas 15 cuadras). */
export const RADIO_CERCANAS_M = 1500;

/**
 * Las `limit` paradas más cercanas dentro de `radio`. Primero un filtro por rectángulo (dos
 * comparaciones por parada) y el haversine solo para las que quedan adentro.
 */
export function paradasCercanas(
  paradas: readonly ParadaV1[],
  punto: LatLon,
  limit: number,
  radio = RADIO_CERCANAS_M,
): ParadaCercana[] {
  const dLat = radio / 111_320;
  const dLon = radio / (111_320 * Math.cos(rad(punto.lat)));
  const out: ParadaCercana[] = [];
  for (const p of paradas) {
    if (Math.abs(p.lat - punto.lat) > dLat || Math.abs(p.lon - punto.lon) > dLon) continue;
    const metros = distanceMeters(punto, { lat: p.lat, lon: p.lon });
    if (metros <= radio) out.push({ parada: p, metros });
  }
  return out.sort((a, b) => a.metros - b.metros).slice(0, limit);
}

/** "a 120 m" / "a 1,2 km". */
export function formatDistancia(metros: number): string {
  if (metros < 1000) return `a ${String(Math.max(10, Math.round(metros / 10) * 10))} m`;
  return `a ${(Math.round(metros / 100) / 10).toFixed(1).replace('.', ',')} km`;
}
