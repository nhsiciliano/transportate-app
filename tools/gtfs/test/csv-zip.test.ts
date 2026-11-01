import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { deflateRawSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { eachCsvRow, openCsv, parseCsvLine, readCsvRows } from '../src/lib/csv.js';
import { listZip, openZipEntry } from '../src/lib/zip.js';

describe('parseCsvLine', () => {
  it('respeta comillas, comas internas y "" escapadas', () => {
    expect(parseCsvLine('BARTOLOME MITRE,"906","906 MITRE, BARTOLOME",-58.37')).toEqual([
      'BARTOLOME MITRE',
      '906',
      '906 MITRE, BARTOLOME',
      '-58.37',
    ]);
    expect(parseCsvLine('a,"di ""hola""",,c')).toEqual(['a', 'di "hola"', '', 'c']);
  });
});

describe('eachCsvRow', () => {
  it('quita el BOM, mapea por cabecera y conserva el mojibake crudo (se repara después)', async () => {
    const csv =
      '\uFEFFCALLE,ALT PLANO,DIRECCION\r\nCASTAÑARES AV.,"5497",Av. CastaÃ±ares 5497\r\n\r\n';
    const rows = await readCsvRows(Readable.from([csv]));
    expect(rows).toEqual([
      { CALLE: 'CASTAÑARES AV.', 'ALT PLANO': '5497', DIRECCION: 'Av. CastaÃ±ares 5497' },
    ]);
  });

  it('lee .csv.gz con varios miembros gzip concatenados (formato de las capturas)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gtfs-test-'));
    const file = join(dir, 'posiciones.csv.gz');
    writeFileSync(file, Buffer.concat([gzipSync('a,b\n1,2\n'), gzipSync('3,4\n')]));
    const rows: string[] = [];
    await eachCsvRow(openCsv(file), (r) => rows.push(`${r.a}-${r.b}`));
    expect(rows).toEqual(['1-2', '3-4']);
  });
});

/** Zip mínimo (deflate y stored) para probar el lector sin depender de archivos externos. */
function makeZip(files: { name: string; data: string; deflate: boolean }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const raw = Buffer.from(f.data);
    const body = f.deflate ? deflateRawSync(raw) : raw;
    const name = Buffer.from(f.name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(f.deflate ? 8 : 0, 8);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(f.deflate ? 8 : 0, 10);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, body);
    centrals.push(ch, name);
    offset += lh.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

describe('zip', () => {
  it('lista entradas e infla en streaming (deflate y stored)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gtfs-zip-'));
    const file = join(dir, 'feed.zip');
    writeFileSync(
      file,
      makeZip([
        { name: 'routes.txt', data: 'route_id,route_short_name\nLineaA,A\n', deflate: true },
        { name: 'gtfs/stops.txt', data: 'stop_id\n1059\n', deflate: false },
      ]),
    );
    const entries = listZip(file);
    expect(entries.map((e) => e.name)).toEqual(['routes.txt', 'gtfs/stops.txt']);
    expect(await readCsvRows(openZipEntry(file, 'routes.txt', entries))).toEqual([
      { route_id: 'LineaA', route_short_name: 'A' },
    ]);
    // Encuentra entradas dentro de carpetas por nombre de archivo
    expect(await readCsvRows(openZipEntry(file, 'stops.txt', entries))).toEqual([
      { stop_id: '1059' },
    ]);
    expect(() => openZipEntry(file, 'shapes.txt', entries)).toThrow(/no contiene/);
  });
});
