/** Saca el prefijo débil y las comillas para comparar ETags (comparación débil, RFC 9110). */
function opaque(tag: string): string {
  return tag.trim().replace(/^W\//, '');
}

/** `true` si el header `If-None-Match` coincide con el ETag de la representación. */
export function ifNoneMatchHits(header: string | undefined | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;
  const target = opaque(etag);
  return header.split(',').some((candidate) => opaque(candidate) === target);
}

/** Corre una tarea en segundo plano si hay ExecutionContext; si no (tests), la espera. */
export async function runInBackground(
  ctx: ExecutionContext | undefined,
  task: Promise<unknown>,
): Promise<void> {
  if (ctx) {
    ctx.waitUntil(task);
    return;
  }
  await task;
}
