// Almacenamiento clave-valor local (tarea 3.10). La app depende de la interfaz `KeyValueStore`,
// no de MMKV: los tests usan `MemoryKeyValueStore` y la implementación se puede cambiar sin tocar
// features (`docs/00-plan.md`, decisión de arquitectura 3).
import { createMMKV, type MMKV } from 'react-native-mmkv';

export interface KeyValueStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Avisa qué clave cambió (escrituras propias o de otra instancia). Devuelve cómo desuscribirse. */
  onChange?(callback: (key: string) => void): () => void;
}

/** Id de la instancia MMKV de la app (archivo separado del default `mmkv.default`). */
export const MMKV_INSTANCE_ID = 'transportate';

/**
 * `KeyValueStore` sobre `react-native-mmkv` 4 (Nitro Modules): `createMMKV()`, `getString`, `set`,
 * `remove` y `addOnValueChangedListener` (github.com/margelo/react-native-mmkv, README y
 * docs/LISTENERS.md). En Jest, `createMMKV()` devuelve el mock en memoria de la propia librería.
 *
 * Sin cifrado: solo se guardan favoritos y la caché de datos públicos de transporte, nada
 * personal (`docs/05-privacidad.md`). El archivo queda protegido por el sandbox de cada sistema.
 */
export class MmkvKeyValueStore implements KeyValueStore {
  private readonly mmkv: MMKV;

  constructor(mmkv: MMKV = createMMKV({ id: MMKV_INSTANCE_ID })) {
    this.mmkv = mmkv;
  }

  getString(key: string): string | undefined {
    return this.mmkv.getString(key);
  }

  set(key: string, value: string): void {
    this.mmkv.set(key, value);
  }

  remove(key: string): void {
    this.mmkv.remove(key);
  }

  onChange(callback: (key: string) => void): () => void {
    const listener = this.mmkv.addOnValueChangedListener(callback);
    return () => {
      listener.remove();
    };
  }
}

/** Implementación en memoria para tests y para entornos sin el módulo nativo. */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, string>();
  private readonly listeners = new Set<(key: string) => void>();

  constructor(initial?: Record<string, string>) {
    if (initial) for (const [k, v] of Object.entries(initial)) this.data.set(k, v);
  }

  getString(key: string): string | undefined {
    return this.data.get(key);
  }

  set(key: string, value: string): void {
    this.data.set(key, value);
    this.emit(key);
  }

  remove(key: string): void {
    if (this.data.delete(key)) this.emit(key);
  }

  onChange(callback: (key: string) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private emit(key: string): void {
    for (const listener of this.listeners) listener(key);
  }
}

let defaultStore: KeyValueStore | undefined;

/** Instancia compartida de la app (MMKV `transportate`), creada a demanda. */
export function getDefaultKeyValueStore(): KeyValueStore {
  defaultStore ??= new MmkvKeyValueStore();
  return defaultStore;
}
