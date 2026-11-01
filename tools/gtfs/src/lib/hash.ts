import { createHash } from 'node:crypto';

export const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

/** Hash corto (hex) para ids y versiones. 10 hex = 40 bits: sin colisiones prácticas para ~10⁴ ids. */
export const shortHash = (data: string, length = 10): string => sha256(data).slice(0, length);
