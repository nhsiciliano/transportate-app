// paradas.json: paradas oficiales de colectivo en CABA (BA Data "Colectivos: paradas").
import type { Readable } from 'node:stream';
import { eachCsvRow, type CsvRow } from '../lib/csv.js';
import { isValidCoord, round6 } from '../lib/geo.js';
import { shortHash } from '../lib/hash.js';
import {
  cleanText,
  MOJIBAKE_TEST,
  normalizeLinea,
  normalizeSentido,
  prettyStreet,
} from '../lib/text.js';
import type { Parada } from '../schemas.js';

export interface ParadasStats {
  filas: number;
  paradas: number;
  duplicadasFusionadas: number;
  sinCoordenadas: number;
  textosReparados: number;
  sinLineas: number;
  lineasDistintas: number;
  sentidosDesconocidos: number;
  barriosDesconocidos: number;
  /** Comunas fuera de 1–15 en el CSV, reemplazadas por la comuna mayoritaria de su barrio. */
  comunasCorregidas: number;
}

/**
 * Id estable y determinista: "p" + 10 hex de sha256(CALLE|ALT PLANO|lat 5 dec|lon 5 dec).
 * Usa los valores crudos normalizados (no el nombre "lindo"), así un cambio de formato del nombre
 * no cambia el id. 5 decimales ≈ 1 m: filas repetidas en el CSV colapsan en la misma parada.
 */
export function paradaId(calleRaw: string, alturaRaw: string, lat: number, lon: number): string {
  const key = `${cleanText(calleRaw).toUpperCase()}|${cleanText(alturaRaw)}|${lat.toFixed(5)}|${lon.toFixed(5)}`;
  return `p${shortHash(key)}`;
}

/**
 * Los 48 barrios oficiales de CABA, indexados por como aparecen en el CSV (mayúsculas, sin tildes,
 * con abreviaturas y errores: "VILLA ORTUZA", "VILLA GRAL MITRE", "VELEZ SARFIELD", "PATERNAL").
 */
const BARRIOS: Record<string, string> = {
  AGRONOMIA: 'Agronomía',
  ALMAGRO: 'Almagro',
  BALVANERA: 'Balvanera',
  BARRACAS: 'Barracas',
  BELGRANO: 'Belgrano',
  BOEDO: 'Boedo',
  CABALLITO: 'Caballito',
  CHACARITA: 'Chacarita',
  COGHLAN: 'Coghlan',
  COLEGIALES: 'Colegiales',
  CONSTITUCION: 'Constitución',
  FLORES: 'Flores',
  FLORESTA: 'Floresta',
  'LA BOCA': 'La Boca',
  BOCA: 'La Boca',
  'LA PATERNAL': 'La Paternal',
  PATERNAL: 'La Paternal',
  LINIERS: 'Liniers',
  MATADEROS: 'Mataderos',
  MONSERRAT: 'Monserrat',
  MONTSERRAT: 'Monserrat',
  'MONTE CASTRO': 'Monte Castro',
  'NUEVA POMPEYA': 'Nueva Pompeya',
  NUNEZ: 'Núñez',
  PALERMO: 'Palermo',
  'PARQUE AVELLANEDA': 'Parque Avellaneda',
  'PARQUE CHACABUCO': 'Parque Chacabuco',
  'PARQUE CHAS': 'Parque Chas',
  'PARQUE PATRICIOS': 'Parque Patricios',
  'PUERTO MADERO': 'Puerto Madero',
  RECOLETA: 'Recoleta',
  RETIRO: 'Retiro',
  SAAVEDRA: 'Saavedra',
  'SAN CRISTOBAL': 'San Cristóbal',
  'SAN NICOLAS': 'San Nicolás',
  'SAN TELMO': 'San Telmo',
  'VELEZ SARSFIELD': 'Vélez Sarsfield',
  'VELEZ SARFIELD': 'Vélez Sarsfield',
  VERSALLES: 'Versalles',
  'VILLA CRESPO': 'Villa Crespo',
  'VILLA DEL PARQUE': 'Villa del Parque',
  'VILLA DEVOTO': 'Villa Devoto',
  'VILLA GENERAL MITRE': 'Villa General Mitre',
  'VILLA GRAL MITRE': 'Villa General Mitre',
  'VILLA LUGANO': 'Villa Lugano',
  'VILLA LURO': 'Villa Luro',
  'VILLA ORTUZAR': 'Villa Ortúzar',
  'VILLA ORTUZA': 'Villa Ortúzar',
  'VILLA PUEYRREDON': 'Villa Pueyrredón',
  'VILLA REAL': 'Villa Real',
  'VILLA RIACHUELO': 'Villa Riachuelo',
  'VILLA SANTA RITA': 'Villa Santa Rita',
  'VILLA SOLDATI': 'Villa Soldati',
  'VILLA URQUIZA': 'Villa Urquiza',
};

/** Barrio oficial, o null si viene vacío. Si no está en la lista se devuelve en Title Case (y se cuenta). */
export function normalizeBarrio(raw: string | undefined): {
  barrio: string | null;
  conocido: boolean;
} {
  const key = cleanText(raw)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!key) return { barrio: null, conocido: true };
  const known = BARRIOS[key];
  if (known) return { barrio: known, conocido: true };
  const title = key
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
  return { barrio: title, conocido: false };
}

const validComuna = (c: number | null): number | null =>
  c !== null && c >= 1 && c <= 15 ? c : null;

function parseIntOrNull(s: string | undefined): number | null {
  const t = cleanText(s);
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

export function rowToParada(row: CsvRow, stats: ParadasStats): Parada | null {
  const lat = Number(row.coord_Y);
  const lon = Number(row.coord_X);
  if (!isValidCoord(lat, lon) || lat === 0 || lon === 0) {
    stats.sinCoordenadas++;
    return null;
  }
  const calleRaw = row.CALLE ?? '';
  const alturaRaw = row['ALT PLANO'] ?? '';
  if (MOJIBAKE_TEST.test(calleRaw) || MOJIBAKE_TEST.test(row.BARRIO ?? '')) stats.textosReparados++;
  const calle = prettyStreet(calleRaw);
  const altura = parseIntOrNull(alturaRaw);
  const lineas: Parada['lineas'] = [];
  for (let i = 1; i <= 6; i++) {
    const n = normalizeLinea(row[`L${i}`]);
    if (!n) continue;
    const senRaw = row[`l${i}_sen`] ?? '';
    const sentido = normalizeSentido(senRaw);
    if (sentido === null && cleanText(senRaw) !== '') stats.sentidosDesconocidos++;
    lineas.push({ linea: n.linea, numero: n.numero, sentido });
  }
  const { barrio, conocido } = normalizeBarrio(row.BARRIO);
  if (!conocido) stats.barriosDesconocidos++;
  return {
    id: paradaId(calleRaw, alturaRaw, lat, lon),
    calle,
    altura,
    nombre: altura === null || altura === 0 ? calle : `${calle} ${altura}`,
    lat: round6(lat),
    lon: round6(lon),
    comuna: validComuna(parseIntOrNull(row.COMUNA)),
    barrio,
    lineas,
  };
}

const lineaKey = (l: Parada['lineas'][number]): string => `${l.linea}|${l.sentido ?? ''}`;

function sortLineas(lineas: Parada['lineas']): Parada['lineas'] {
  return [...lineas].sort(
    (a, b) =>
      (a.numero ?? Infinity) - (b.numero ?? Infinity) ||
      a.linea.localeCompare(b.linea) ||
      (a.sentido ?? '').localeCompare(b.sentido ?? ''),
  );
}

export async function buildParadas(
  csv: Readable,
): Promise<{ paradas: Parada[]; stats: ParadasStats }> {
  const stats: ParadasStats = {
    filas: 0,
    paradas: 0,
    duplicadasFusionadas: 0,
    sinCoordenadas: 0,
    textosReparados: 0,
    sinLineas: 0,
    lineasDistintas: 0,
    sentidosDesconocidos: 0,
    barriosDesconocidos: 0,
    comunasCorregidas: 0,
  };
  const byId = new Map<string, Parada>();
  await eachCsvRow(csv, (row) => {
    stats.filas++;
    const p = rowToParada(row, stats);
    if (!p) return;
    const prev = byId.get(p.id);
    if (!prev) {
      byId.set(p.id, p);
      return;
    }
    // Fila repetida (misma calle, altura y punto): se fusionan las líneas.
    stats.duplicadasFusionadas++;
    const seen = new Set(prev.lineas.map(lineaKey));
    for (const l of p.lineas) if (!seen.has(lineaKey(l))) prev.lineas.push(l);
  });
  // Comuna inválida (p. ej. "76" en Saavedra): se infiere de la comuna más frecuente del barrio.
  const comunaPorBarrio = new Map<string, Map<number, number>>();
  for (const p of byId.values()) {
    if (p.comuna === null || p.barrio === null) continue;
    const m = comunaPorBarrio.get(p.barrio) ?? new Map<number, number>();
    m.set(p.comuna, (m.get(p.comuna) ?? 0) + 1);
    comunaPorBarrio.set(p.barrio, m);
  }
  for (const p of byId.values()) {
    if (p.comuna !== null || p.barrio === null) continue;
    const m = comunaPorBarrio.get(p.barrio);
    if (!m) continue;
    p.comuna = [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    stats.comunasCorregidas++;
  }
  const paradas = [...byId.values()]
    .map((p) => ({ ...p, lineas: sortLineas(p.lineas) }))
    .sort(
      (a, b) =>
        a.calle.localeCompare(b.calle, 'es') ||
        (a.altura ?? 0) - (b.altura ?? 0) ||
        a.id.localeCompare(b.id),
    );
  stats.paradas = paradas.length;
  stats.sinLineas = paradas.filter((p) => p.lineas.length === 0).length;
  stats.lineasDistintas = new Set(paradas.flatMap((p) => p.lineas.map((l) => l.linea))).size;
  return { paradas, stats };
}
