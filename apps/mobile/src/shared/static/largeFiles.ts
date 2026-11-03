// Archivos grandes del paquete estático (tarea 4.5): `paradas.json` (1,7 MB),
// `lineas-colectivos.json` (161 KB) y los demás de colectivos.
//
// No pasan por la caché de TanStack Query: su persister guarda TODA la caché en una sola clave
// MMKV y la reescribe entera en cada cambio (throttle de 1 s); con 2 MB adentro, cada refresco
// del estado del subte reescribiría 2 MB. Acá:
//
// - **MMKV por archivo, una versión:** `transportate.static.file.<archivo>.data` (el cuerpo tal
//   cual llegó) y `.meta` (`{ version, savedAt, bytes }`). La meta se escribe última: si la app se
//   cierra en el medio, la copia anterior queda inválida y se vuelve a bajar. Al guardar una
//   versión nueva se pisa la anterior (no se acumulan versiones).
// - **Validación con Zod solo al descargar.** Leer de MMKV no vuelve a validar (`JSON.parse` de
//   1,7 MB: ~6 ms en Node; Zod sobre 7.000 paradas: ~15 ms más, que en Hermes se multiplica). Una
//   copia rota (JSON inválido, sin `version: 1` o un `.geojson` que no es `FeatureCollection`) se
//   borra y se vuelve a bajar. Los `.geojson` (`GEOJSON_ESTATICOS_V1`) se validan con su esquema.
// - **Un administrador compartido:** el JSON se parsea una vez por sesión y todas las pantallas
//   ven el mismo estado (`useSyncExternalStore`), incluido el progreso de descarga.
// - **Versión nueva:** se baja en segundo plano y la vieja se sigue mostrando hasta que termina.
import { ARCHIVOS_ESTATICOS_V1, GEOJSON_ESTATICOS_V1 } from '@transportate/contracts';
import type { z } from 'zod';

import { ContractError, toApiError, type ApiError, type ArchivoEstatico } from '../api';
import type { KeyValueStore } from '../storage/kv';
import { STATIC_FILE_ROUTE, type StaticDownloader } from './downloader';

/** Los `.geojson` del paquete (`GEOJSON_ESTATICOS_V1`): mapa de subte y recorridos de colectivos. */
export type ArchivoGeoJson = keyof typeof GEOJSON_ESTATICOS_V1;
/** Todo lo que puede manejar el administrador: los JSON con contrato y los `.geojson`. */
export type ArchivoGrande = ArchivoEstatico | ArchivoGeoJson;
/** Tipo del contenido validado de cada archivo. */
export type ArchivoGrandeData<K extends ArchivoGrande> = K extends ArchivoEstatico
  ? z.infer<(typeof ARCHIVOS_ESTATICOS_V1)[K]>
  : K extends ArchivoGeoJson
    ? z.infer<(typeof GEOJSON_ESTATICOS_V1)[K]>
    : never;

const isGeoJson = (archivo: ArchivoGrande): archivo is ArchivoGeoJson =>
  archivo in GEOJSON_ESTATICOS_V1;

/** Esquema de validación (Zod) del archivo. */
function schemaFor(archivo: ArchivoGrande): z.ZodType {
  return isGeoJson(archivo) ? GEOJSON_ESTATICOS_V1[archivo] : ARCHIVOS_ESTATICOS_V1[archivo];
}

/** Chequeo barato al leer de MMKV (sin Zod): forma mínima del archivo. */
function looksValid(archivo: ArchivoGrande, data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  return isGeoJson(archivo)
    ? (data as { type?: unknown }).type === 'FeatureCollection'
    : (data as { version?: unknown }).version === 1;
}

export interface LargeFileState<K extends ArchivoGrande = ArchivoGrande> {
  data: ArchivoGrandeData<K> | undefined;
  /** Versión de `data`. */
  version: string | undefined;
  savedAt: number | undefined;
  /** Ya se intentó leer la copia guardada (con o sin éxito). */
  loaded: boolean;
  downloading: boolean;
  /** 0 a 1 mientras baja; `null` sin descarga en curso. */
  progress: number | null;
  /** Error de la última descarga (se limpia al reintentar). */
  error: ApiError | null;
  /** Versión cuya descarga falló: no se reintenta sola en cada render. */
  failedVersion: string | undefined;
}

interface Meta {
  version: string;
  savedAt: number;
  bytes: number;
}

export function largeFileKeys(archivo: ArchivoGrande) {
  return {
    data: `transportate.static.file.${archivo}.data`,
    meta: `transportate.static.file.${archivo}.meta`,
  };
}

const EMPTY: LargeFileState = {
  data: undefined,
  version: undefined,
  savedAt: undefined,
  loaded: false,
  downloading: false,
  progress: null,
  error: null,
  failedVersion: undefined,
};

export class LargeFileManager {
  private readonly states = new Map<ArchivoGrande, LargeFileState>();
  private readonly listeners = new Map<ArchivoGrande, Set<() => void>>();

  constructor(
    private readonly kv: KeyValueStore,
    private readonly downloader: StaticDownloader,
    private readonly now: () => number = Date.now,
  ) {}

  getState<K extends ArchivoGrande>(archivo: K): LargeFileState<K> {
    return this.states.get(archivo) ?? EMPTY;
  }

  subscribe(archivo: ArchivoGrande, listener: () => void): () => void {
    const set = this.listeners.get(archivo) ?? new Set();
    set.add(listener);
    this.listeners.set(archivo, set);
    return () => {
      set.delete(listener);
    };
  }

  private set(archivo: ArchivoGrande, patch: Partial<LargeFileState>) {
    this.states.set(archivo, { ...this.getState(archivo), ...patch });
    for (const l of this.listeners.get(archivo) ?? []) l();
  }

  /** Lee la copia guardada (una vez por sesión). Síncrono: MMKV lo es. */
  loadStored(archivo: ArchivoGrande): void {
    if (this.getState(archivo).loaded) return;
    const keys = largeFileKeys(archivo);
    let patch: Partial<LargeFileState> = { loaded: true };
    try {
      const metaRaw = this.kv.getString(keys.meta);
      const raw = this.kv.getString(keys.data);
      if (metaRaw !== undefined && raw !== undefined) {
        const meta = JSON.parse(metaRaw) as Partial<Meta>;
        const data: unknown = JSON.parse(raw);
        const ok =
          typeof meta.version === 'string' &&
          typeof meta.savedAt === 'number' &&
          looksValid(archivo, data);
        if (ok) {
          patch = {
            loaded: true,
            data: data as ArchivoGrandeData<typeof archivo>,
            version: meta.version,
            savedAt: meta.savedAt,
          };
        } else {
          this.removeStored(archivo);
        }
      }
    } catch {
      this.removeStored(archivo);
    }
    this.set(archivo, patch);
  }

  private removeStored(archivo: ArchivoGrande) {
    const keys = largeFileKeys(archivo);
    try {
      this.kv.remove(keys.meta);
      this.kv.remove(keys.data);
    } catch {
      // Nada que hacer: la próxima descarga pisa lo que haya.
    }
  }

  /**
   * Baja `version` si no es la que hay y no hay otra descarga en curso. Una versión que falló no
   * se reintenta sola: hace falta `retry`.
   */
  ensure(archivo: ArchivoGrande, version: string, bytes?: number): Promise<void> {
    const s = this.getState(archivo);
    if (s.version === version || s.downloading || s.failedVersion === version) {
      return Promise.resolve();
    }
    return this.download(archivo, version, bytes);
  }

  retry(archivo: ArchivoGrande, version: string, bytes?: number): Promise<void> {
    if (this.getState(archivo).downloading) return Promise.resolve();
    this.set(archivo, { failedVersion: undefined, error: null });
    return this.ensure(archivo, version, bytes);
  }

  private async download(archivo: ArchivoGrande, version: string, bytes?: number) {
    this.set(archivo, { downloading: true, progress: 0, error: null, failedVersion: undefined });
    try {
      const text = await this.downloader.download(version, archivo, {
        onProgress: (loaded, total) => {
          const t = total ?? bytes ?? null;
          // Sin total conocido no se inventa: se queda en 0 hasta terminar.
          const p = t === null || t <= 0 ? 0 : Math.min(loaded / t, 0.99);
          if (p !== this.getState(archivo).progress) this.set(archivo, { progress: p });
        },
      });
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new ContractError(STATIC_FILE_ROUTE, ['(json)']);
      }
      const schema = schemaFor(archivo);
      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new ContractError(
          STATIC_FILE_ROUTE,
          result.error.issues.slice(0, 10).map((i) => i.path.join('.')),
        );
      }
      const savedAt = this.now();
      const keys = largeFileKeys(archivo);
      try {
        this.kv.set(keys.data, text);
        this.kv.set(keys.meta, JSON.stringify({ version, savedAt, bytes: text.length }));
      } catch {
        // Sin espacio: queda en memoria por esta sesión y se vuelve a bajar la próxima.
      }
      this.set(archivo, {
        data: result.data as ArchivoGrandeData<typeof archivo>,
        version,
        savedAt,
        loaded: true,
        downloading: false,
        progress: null,
        error: null,
      });
    } catch (error) {
      this.set(archivo, {
        downloading: false,
        progress: null,
        error: toApiError(error, STATIC_FILE_ROUTE),
        failedVersion: version,
      });
    }
  }
}
