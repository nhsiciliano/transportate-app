// Coalescing por isolate: N llamadas concurrentes con la misma clave comparten una sola promesa
// (y por lo tanto un solo fetch upstream). El mapa vive a nivel de módulo porque los adaptadores
// se arman por request: si viviera en la instancia, dos requests concurrentes no se verían.

export class Coalescer<T> {
  private readonly inFlight = new Map<string, Promise<T>>();

  /** Devuelve la promesa en vuelo para `key` o arranca `task`. La entrada se limpia al resolver. */
  run(key: string, task: () => Promise<T>): Promise<T> {
    const current = this.inFlight.get(key);
    if (current) return current;
    const p = task().finally(() => {
      if (this.inFlight.get(key) === p) this.inFlight.delete(key);
    });
    this.inFlight.set(key, p);
    return p;
  }

  get size(): number {
    return this.inFlight.size;
  }
}
