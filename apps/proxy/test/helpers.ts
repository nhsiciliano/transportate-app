import type {
  AlertasV1,
  ArribosEstacionV1,
  ArribosParadaV1,
  EnvelopeV1,
  EstadoLineasV1,
  LineasColectivoV1,
  MetaV1,
  PosicionesLineaV1,
} from '@transportate/contracts';
import { env } from 'cloudflare:workers';
import { createTransitoAdapter } from '../src/adapters/transito';
import type { Adapters } from '../src/container';

/** Valor de secret ficticio: los tests verifican que nunca aparece en una respuesta. */
export const FAKE_SECRET = 'secreto-de-prueba-NO-FILTRAR-7f3a';

export const meta: MetaV1 = {
  generatedAt: '2026-11-01T20:00:05Z',
  sourceTimestamp: '2026-11-01T19:59:40Z',
  ttlSeconds: 20,
  stale: false,
  ageSeconds: 25,
};

export function wrap<T>(data: T, overrides: Partial<MetaV1> = {}): EnvelopeV1<T> {
  return { meta: { ...meta, ...overrides }, data };
}

export const estado: EnvelopeV1<EstadoLineasV1> = wrap({
  lineas: [
    {
      linea: 'B',
      estado: 'demorada',
      color: '#FF0000',
      colorTexto: '#000000',
      nombre: 'Leandro N. Alem - Juan Manuel de Rosas',
      alertaIds: ['Alert_LineaB'],
    },
  ],
});
export const alertas: EnvelopeV1<AlertasV1> = wrap(
  { alertas: [] },
  { stale: true, ttlSeconds: 15 },
);
export const lineas: EnvelopeV1<LineasColectivoV1> = wrap({
  lineas: [{ lineaId: '1858', linea: '10', empresa: 'LINEA 10 S.A.' }],
});

export interface Calls {
  arribosSubte: string[];
  posiciones: string[];
  arribosColectivo: string[];
}

/** Adaptadores falsos que devuelven sobres fijos y registran los ids recibidos. */
export function fakeAdapters(
  calls: Calls = { arribosSubte: [], posiciones: [], arribosColectivo: [] },
): Adapters {
  return {
    subtes: {
      estadoLineas: () => Promise.resolve(estado),
      alertas: () => Promise.resolve(alertas),
      arribos: (estacionId): Promise<EnvelopeV1<ArribosEstacionV1>> => {
        calls.arribosSubte.push(estacionId);
        return Promise.resolve(wrap({ estacionId, arribos: [] }));
      },
    },
    colectivos: {
      lineas: () => Promise.resolve(lineas),
      posiciones: (lineaId): Promise<EnvelopeV1<PosicionesLineaV1>> => {
        calls.posiciones.push(lineaId);
        return Promise.resolve(wrap({ lineaId, vehiculos: [] }));
      },
      arribos: (paradaId): Promise<EnvelopeV1<ArribosParadaV1>> => {
        calls.arribosColectivo.push(paradaId);
        return Promise.resolve(wrap({ paradaId, arribos: [] }));
      },
    },
    transito: createTransitoAdapter(),
  };
}

export const allowAll: RateLimit = { limit: () => Promise.resolve({ success: true }) };

/**
 * `env` de test: bindings reales del plugin (R2 local) + secrets ficticios + limitador
 * inyectado (por defecto deja pasar todo, para que los tests no dependan del contador real).
 */
export function testEnv(overrides: Partial<CloudflareBindings> = {}): CloudflareBindings {
  return {
    ...env,
    GCBA_CLIENT_ID: 'id-de-prueba',
    GCBA_CLIENT_SECRET: FAKE_SECRET,
    RATE_LIMITER: allowAll,
    ...overrides,
  };
}
