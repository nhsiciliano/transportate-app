// Contratos de los adaptadores upstream → v1. Cada servicio los implementa en su carpeta.
import type {
  AlertasTrenV1,
  AlertasV1,
  ArribosEstacionTrenV1,
  ArribosEstacionV1,
  ArribosParadaV1,
  EnvelopeV1,
  ErrorV1,
  EstadoLineasTrenV1,
  EstadoLineasV1,
  LineasColectivoV1,
  PosicionesLineaV1,
} from '@transportate/contracts';

export interface SubtesAdapter {
  estadoLineas(): Promise<EnvelopeV1<EstadoLineasV1>>;
  alertas(): Promise<EnvelopeV1<AlertasV1>>;
  arribos(estacionId: string): Promise<EnvelopeV1<ArribosEstacionV1>>;
}

/** Trenes metropolitanos (SOFSE). Con el kill-switch apagado, `estadoLineas()` responde
 * `sin_datos` y `alertas()`/`arribos()` lanzan `ApiError('upstream_unavailable', …, 503)`. */
export interface TrenesAdapter {
  estadoLineas(): Promise<EnvelopeV1<EstadoLineasTrenV1>>;
  alertas(): Promise<EnvelopeV1<AlertasTrenV1>>;
  arribos(estacionId: string): Promise<EnvelopeV1<ArribosEstacionTrenV1>>;
}

export interface ColectivosAdapter {
  lineas(): Promise<EnvelopeV1<LineasColectivoV1>>;
  posiciones(lineaId: string): Promise<EnvelopeV1<PosicionesLineaV1>>;
  arribos(paradaId: string): Promise<EnvelopeV1<ArribosParadaV1>>;
}

/** Diferido (tab Tránsito oculto): la implementación lanza `ApiError('upstream_unavailable', …)`. */
export interface TransitoAdapter {
  cortes(): Promise<never>;
}

/** Error tipado que el manejador global convierte en el sobre `ErrorV1`. */
export class ApiError extends Error {
  constructor(
    public code: ErrorV1['error']['code'],
    message: string,
    public status: number,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
