const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash hexadecimal (SHA-1 por defecto) de un texto, con `crypto.subtle`. */
export async function hashHex(
  text: string,
  algorithm: 'SHA-1' | 'SHA-256' = 'SHA-1',
): Promise<string> {
  return toHex(await crypto.subtle.digest(algorithm, encoder.encode(text)));
}
