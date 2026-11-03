// Formatos del índice estático para la fila de Ajustes. Sin `Intl`: Hermes no siempre trae los
// datos de `es-AR`, y así el texto es idéntico en iOS, Android y los tests.
import type { ManifestV1 } from '@transportate/contracts';

/** Argentina no tiene horario de verano desde 2009: UTC−3 fijo (suposición F4-ajustes-2). */
const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-12T01:30:00Z` → `11/10/2026` (día/mes/año, hora de Buenos Aires). */
export function formatFechaAR(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '—';
  const d = new Date(time + ARGENTINA_OFFSET_MS);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear())}`;
}

/** `4_900_000` → `4,7 MB` (1 MB = 1.048.576 bytes, una decimal con coma). */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

/** Suma de los archivos del manifiesto: lo que pesa el índice completo. */
export function totalBytes(manifest: ManifestV1): number {
  return Object.values(manifest.archivos).reduce((sum, archivo) => sum + archivo.bytes, 0);
}

/** "Versión del 12/10/2026 · 4,8 MB". */
export function describeIndice(manifest: ManifestV1): string {
  return `Versión del ${formatFechaAR(manifest.generatedAt)} · ${formatMegabytes(totalBytes(manifest))}`;
}
