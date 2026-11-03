// "Última versión conocida" de cada archivo estático, guardada aparte de la caché de TanStack
// Query. La caché persistida se descarta entera si la app no se abre en 24 h (`maxAge` del
// persister); el estático, en cambio, sirve igual aunque tenga semanas: con esto la app arranca
// sin red con las estaciones y líneas que bajó la última vez.
//
// Solo para archivos chicos (subte: 5 KB y 17 KB). Los grandes de colectivos (234 KB, 1,7 MB)
// necesitan otra estrategia (tarea 4.5): `LastKnownStore` es la interfaz que se puede cambiar.
import { ARCHIVOS_ESTATICOS_V1 } from '@transportate/contracts';
import type { z } from 'zod';

import type { ArchivoEstatico } from '../api';
import type { KeyValueStore } from '../storage/kv';

export type ArchivoData<K extends ArchivoEstatico> = z.infer<(typeof ARCHIVOS_ESTATICOS_V1)[K]>;

export interface LastKnown<K extends ArchivoEstatico> {
  /** `version` del manifiesto con la que se bajó. */
  version: string;
  /** Cuándo se bajó (ms). */
  savedAt: number;
  data: ArchivoData<K>;
}

export interface LastKnownStore {
  read<K extends ArchivoEstatico>(archivo: K): LastKnown<K> | undefined;
  write<K extends ArchivoEstatico>(archivo: K, entry: LastKnown<K>): void;
}

/** Clave MMKV por archivo: `transportate.static.subte-lineas.json.v1`. */
export function lastKnownKey(archivo: ArchivoEstatico): string {
  return `transportate.static.${archivo}.v1`;
}

/**
 * Sobre un `KeyValueStore` (MMKV en la app, memoria en los tests). Lectura defensiva: un JSON
 * roto o fuera de contrato se ignora (y se vuelve a bajar), nunca rompe la pantalla.
 */
export function createLastKnownStore(kv: KeyValueStore): LastKnownStore {
  // Memo en memoria: parsear y validar 17 KB en cada pantalla que se monta no hace falta.
  const memo = new Map<ArchivoEstatico, LastKnown<ArchivoEstatico> | undefined>();
  const parse = <K extends ArchivoEstatico>(archivo: K): LastKnown<K> | undefined => {
    const raw = kv.getString(lastKnownKey(archivo));
    if (raw === undefined) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return undefined;
      const { version, savedAt, data } = parsed as Record<string, unknown>;
      if (typeof version !== 'string' || typeof savedAt !== 'number') return undefined;
      const schema: z.ZodType = ARCHIVOS_ESTATICOS_V1[archivo];
      const result = schema.safeParse(data);
      if (!result.success) return undefined;
      // `schema` es el de `K`, pero TS no sigue el tipo a través del índice genérico.
      return { version, savedAt, data: result.data as ArchivoData<K> };
    } catch {
      return undefined;
    }
  };
  return {
    read<K extends ArchivoEstatico>(archivo: K): LastKnown<K> | undefined {
      if (!memo.has(archivo)) memo.set(archivo, parse(archivo));
      return memo.get(archivo);
    },
    write(archivo, entry) {
      memo.set(archivo, entry);
      try {
        kv.set(lastKnownKey(archivo), JSON.stringify(entry));
      } catch {
        // Sin espacio o MMKV no disponible: la próxima vez se vuelve a bajar.
      }
    },
  };
}
