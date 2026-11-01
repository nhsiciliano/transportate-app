// Normalización de texto: mojibake, números de línea, sentidos y nombres de calle.

/**
 * Caracteres de Windows-1252 en el rango 0x80–0x9F (donde difiere de latin-1).
 * El mojibake de la API es UTF-8 decodificado como cp1252: "Ñ" (C3 91) llega como "Ã‘".
 */
const CP1252_HIGH: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

/** Byte cp1252 de un carácter, o null si no es representable. */
function cp1252Byte(ch: string): number | null {
  const mapped = CP1252_HIGH[ch];
  if (mapped !== undefined) return mapped;
  const code = ch.codePointAt(0) ?? 0;
  return code <= 0xff ? code : null;
}

/** Continuación UTF-8 vista como cp1252: bytes 0x80–0xBF. */
const CONT = '[\\u0080-\\u00BF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]';
/** Secuencia UTF-8 mal decodificada: byte líder (Â–ô) + 1 a 3 continuaciones. "Ã?" = Ã + byte perdido. */
const MOJIBAKE_SEQ = new RegExp(`[\\u00C2-\\u00F4](?:${CONT}{1,3}|\\?)`, 'g');
export const MOJIBAKE_TEST = /[Â-ô](?:[\u0080-¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]|\?)/;

const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Repara texto UTF-8 que fue decodificado como Windows-1252 (o latin-1), secuencia por secuencia,
 * sin tocar el resto del string (puede mezclar partes sanas y rotas).
 *
 * Caso con pérdida: los bytes 0x81, 0x8D, 0x8F, 0x90 y 0x9D no existen en cp1252 y la API los
 * convierte en "?". Para "Ã?" se asume "Í" (0xC3 0x8D), el único de esos que aparece en español
 * ("COMPAÃ‘Ã?A" → "COMPAÑÍA"). Queda documentado en el README.
 */
export function repairMojibake(input: string): string {
  if (!MOJIBAKE_TEST.test(input)) return input;
  return input.replace(MOJIBAKE_SEQ, (seq) => {
    if (seq === 'Ã?') return 'Í';
    const bytes: number[] = [];
    for (const ch of seq) {
      const b = cp1252Byte(ch);
      if (b === null) return seq;
      bytes.push(b);
    }
    try {
      return utf8.decode(Uint8Array.from(bytes));
    } catch {
      return seq;
    }
  });
}

/** Limpia espacios (incluye NBSP) y repara mojibake. */
export function cleanText(input: string | null | undefined): string {
  return repairMojibake(input ?? '')
    .replace(/[\u00A0\s]+/g, ' ')
    .trim();
}

export interface LineaNormalizada {
  /** Nombre visible normalizado: mayúsculas, espacios simples ("228B", "85 A - P. ALSINA"). */
  linea: string;
  /** Parte numérica inicial, o null si la línea no empieza con dígitos ("EBUS"). */
  numero: number | null;
  /** Lo que sigue al número, sin separadores iniciales ("B", "R1", "-5" → "5"), o null. */
  ramal: string | null;
}

/** "10A" → { linea: "10A", numero: 10, ramal: "A" }; "247-5" → ramal "5"; "eBUS" → numero null. */
export function normalizeLinea(raw: string | number | null | undefined): LineaNormalizada | null {
  const linea = cleanText(String(raw ?? ''))
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!linea) return null;
  const m = /^(\d+)(.*)$/.exec(linea);
  if (!m) return { linea, numero: null, ramal: null };
  const numero = Number(m[1]);
  const resto = (m[2] ?? '').replace(/^[\s\-–_.]+/, '').trim();
  return { linea, numero, ramal: resto === '' ? null : resto };
}

export type Sentido = 'ida' | 'vuelta';

/** Columnas l*_sen del CSV BA: "I"/"i" = ida, "V"/"v" = vuelta; otros valores ("A-B") → null. */
export function normalizeSentido(raw: string | null | undefined): Sentido | null {
  const s = cleanText(raw).toUpperCase();
  if (s === 'I') return 'ida';
  if (s === 'V') return 'vuelta';
  return null;
}

const MINUSCULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'E', 'A', 'AL', 'EN']);
const SIGLAS = new Set([
  'II',
  'III',
  'IV',
  'VI',
  'VII',
  'VIII',
  'IX',
  'XI',
  'XII',
  'XX',
  'YPF',
  'ACA',
]);

function titleWord(word: string, first: boolean): string {
  if (SIGLAS.has(word)) return word;
  if (!first && MINUSCULAS.has(word)) return word.toLowerCase();
  // "O'HIGGINS" / "D'ELIA": capitalizar después del apóstrofo
  return word
    .toLowerCase()
    .replace(/(^|['’´.\-(])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
}

/**
 * Nombre de calle legible desde la columna CALLE (mayúsculas en el CSV):
 * "REGIMIENTO DE PATRICIOS AV." → "Av. Regimiento de Patricios"; "DEFENSA" → "Defensa".
 */
export function prettyStreet(raw: string): string {
  let s = cleanText(raw).toUpperCase();
  let prefijo = '';
  const sufijos: [RegExp, string][] = [
    [/\s+AV\.?$/, 'Av.'],
    [/\s+AVDA\.?$/, 'Av.'],
    [/\s+PJE\.?$/, 'Pje.'],
    [/\s+PASAJE$/, 'Pje.'],
    [/\s+DIAG\.?$/, 'Diag.'],
    [/\s+AU\.?$/, 'Au.'],
  ];
  for (const [re, p] of sufijos) {
    if (re.test(s)) {
      s = s.replace(re, '');
      prefijo = `${p} `;
      break;
    }
  }
  const words = s.split(' ').filter(Boolean);
  return prefijo + words.map((w, i) => titleWord(w, i === 0)).join(' ');
}
