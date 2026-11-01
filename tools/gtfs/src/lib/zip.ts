// Lectura de .zip sin dependencias y sin cargar el archivo entero: se parsea el directorio
// central (con ZIP64) y cada entrada se infla en streaming. Portado de tools/api-probe/probe.mjs.
import { closeSync, createReadStream, openSync, readSync, statSync } from 'node:fs';
import { createInflateRaw } from 'node:zlib';
import type { Readable } from 'node:stream';

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  dataStart: number;
}

function readAt(fd: number, length: number, position: number): Buffer {
  const buf = Buffer.alloc(length);
  readSync(fd, buf, 0, length, position);
  return buf;
}

export function listZip(file: string): ZipEntry[] {
  const fd = openSync(file, 'r');
  try {
    const size = statSync(file).size;
    const tailLen = Math.min(size, 65_557 + 20);
    const tail = readAt(fd, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error(`${file}: no es un zip (sin EOCD)`);
    let entries = tail.readUInt16LE(eocd + 10);
    let cdSize = tail.readUInt32LE(eocd + 12);
    let cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdOffset === 0xffffffff || entries === 0xffff) {
      const loc = eocd - 20;
      if (loc >= 0 && tail.readUInt32LE(loc) === 0x07064b50) {
        const z64 = readAt(fd, 56, Number(tail.readBigUInt64LE(loc + 8)));
        entries = Number(z64.readBigUInt64LE(32));
        cdSize = Number(z64.readBigUInt64LE(40));
        cdOffset = Number(z64.readBigUInt64LE(48));
      }
    }
    const cd = readAt(fd, cdSize, cdOffset);
    const list: ZipEntry[] = [];
    let p = 0;
    for (let i = 0; i < entries && p + 46 <= cd.length; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) break;
      const method = cd.readUInt16LE(p + 10);
      let compressedSize = cd.readUInt32LE(p + 20);
      let uncompressedSize = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      let localHeaderOffset = cd.readUInt32LE(p + 42);
      const name = cd.subarray(p + 46, p + 46 + nameLen).toString('utf8');
      let e = p + 46 + nameLen;
      const extraEnd = e + extraLen;
      while (e + 4 <= extraEnd) {
        const tag = cd.readUInt16LE(e);
        const len = cd.readUInt16LE(e + 2);
        if (tag === 0x0001) {
          let q = e + 4;
          if (uncompressedSize === 0xffffffff) {
            uncompressedSize = Number(cd.readBigUInt64LE(q));
            q += 8;
          }
          if (compressedSize === 0xffffffff) {
            compressedSize = Number(cd.readBigUInt64LE(q));
            q += 8;
          }
          if (localHeaderOffset === 0xffffffff) localHeaderOffset = Number(cd.readBigUInt64LE(q));
        }
        e += 4 + len;
      }
      const lh = readAt(fd, 30, localHeaderOffset);
      const dataStart = localHeaderOffset + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
      list.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset, dataStart });
      p = extraEnd + commentLen;
    }
    return list;
  } finally {
    closeSync(fd);
  }
}

/** Stream descomprimido de una entrada (por nombre de archivo, ignorando carpetas internas). */
export function openZipEntry(file: string, fileName: string, entries = listZip(file)): Readable {
  const entry = entries.find((e) => e.name === fileName || e.name.split('/').pop() === fileName);
  if (!entry) throw new Error(`${file}: no contiene ${fileName}`);
  const src = createReadStream(file, {
    start: entry.dataStart,
    end: entry.dataStart + entry.compressedSize - 1,
  });
  if (entry.method === 0) return src;
  if (entry.method === 8) return src.pipe(createInflateRaw());
  throw new Error(`${file}/${fileName}: método de compresión ${entry.method} no soportado`);
}
