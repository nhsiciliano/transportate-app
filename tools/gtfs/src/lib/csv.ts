// CSV en streaming (GTFS y dataset BA). Portado de tools/gtfs-cruce/cruce.mjs (parseCsvLine/eachRow).
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';

/** Parte una línea CSV respetando comillas dobles y "" escapadas. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export type CsvRow = Record<string, string>;

/**
 * Recorre un CSV línea por línea y llama a onRow por fila (objeto columna → valor, con trim).
 * Devuelve la cabecera. Nunca junta el archivo entero en memoria.
 */
export async function eachCsvRow(input: Readable, onRow: (row: CsvRow) => void): Promise<string[]> {
  const rl = createInterface({ input, crlfDelay: Infinity });
  let header: string[] | null = null;
  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = parseCsvLine(line.replace(/^\uFEFF/, '')).map((h) => h.trim());
      continue;
    }
    const cols = parseCsvLine(line);
    const row: CsvRow = {};
    for (let i = 0; i < header.length; i++) {
      const key = header[i];
      if (key !== undefined) row[key] = (cols[i] ?? '').trim();
    }
    onRow(row);
  }
  return header ?? [];
}

/** CSV suelto o .csv.gz (incluye gzip de varios miembros concatenados, como el de las capturas). */
export function openCsv(path: string): Readable {
  const raw = createReadStream(path);
  return path.endsWith('.gz') ? raw.pipe(createGunzip()) : raw;
}

/** Lee todas las filas de un CSV chico (para tests y archivos de pocos KB). */
export async function readCsvRows(input: Readable): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  await eachCsvRow(input, (r) => rows.push(r));
  return rows;
}
