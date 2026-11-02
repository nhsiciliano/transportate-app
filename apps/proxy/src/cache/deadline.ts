// Plazos por request. La promesa compartida por el coalescing no se cancela (otra request puede
// estar esperándola y su resultado igual se guarda en caché); cada llamador compite contra su
// propio plazo y, si se vence, sigue sin ese dato.

export class DeadlineExceeded extends Error {
  constructor() {
    super('deadline_exceeded');
    this.name = 'DeadlineExceeded';
  }
}

/** Resuelve con `p` o rechaza con `DeadlineExceeded` cuando `signal` se aborta (lo que pase primero). */
export function raceAbort<T>(p: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(new DeadlineExceeded());
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(new DeadlineExceeded());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (err: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}
