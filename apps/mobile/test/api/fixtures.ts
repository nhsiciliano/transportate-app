// Respuestas mínimas del contrato v1, una por ruta. Se arman a mano a partir de los esquemas
// (los fixtures de apps/proxy/test/fixtures son del upstream, no del contrato) y se validan con
// Zod al cargarse: si el contrato cambia, estos fixtures fallan primero.
import {
  AlertasResponseV1,
  AlertasTrenResponseV1,
  ArribosEstacionResponseV1,
  ArribosEstacionTrenResponseV1,
  ArribosParadaResponseV1,
  EstadoLineasResponseV1,
  EstadoLineasTrenResponseV1,
  HealthV1,
  LineasColectivoResponseV1,
  ManifestV1,
  PosicionesLineaResponseV1,
  SubteEstacionesArchivoV1,
  type MetaV1,
} from '@transportate/contracts';

/** Reloj fijo de los tests. */
export const NOW = Date.parse('2026-11-02T12:00:00.000Z');
/** Dato upstream de hace 12 s. */
export const SOURCE_TS = '2026-11-02T11:59:48.000Z';

export function meta(overrides: Partial<MetaV1> = {}): MetaV1 {
  return {
    generatedAt: '2026-11-02T11:59:58.000Z',
    sourceTimestamp: SOURCE_TS,
    ttlSeconds: 20,
    stale: false,
    ageSeconds: 10,
    ...overrides,
  };
}

export const estado = EstadoLineasResponseV1.parse({
  meta: meta(),
  data: {
    lineas: [
      {
        linea: 'A',
        estado: 'normal',
        color: '#A5C8FF',
        colorTexto: '#000000',
        nombre: 'Línea A',
        alertaIds: [],
      },
      {
        linea: 'C',
        estado: 'demorada',
        color: '#0000FF',
        colorTexto: '#FFFFFF',
        nombre: 'Línea C',
        resumen: 'Servicio con demoras',
        alertaIds: ['al-1'],
      },
    ],
  },
});

export const alertas = AlertasResponseV1.parse({
  meta: meta(),
  data: {
    alertas: [
      {
        id: 'al-1',
        lineas: ['C'],
        titulo: 'Línea C',
        descripcion: 'Servicio con demoras por obras.',
        causa: 'CONSTRUCTION',
      },
    ],
  },
});

export const arribosEstacion = ArribosEstacionResponseV1.parse({
  meta: meta({ stale: true, ageSeconds: 600 }),
  data: {
    estacionId: '1001',
    arribos: [
      {
        linea: 'A',
        estacionId: '1001',
        estacion: 'Plaza de Mayo',
        destino: 'San Pedrito',
        enSegundos: 120,
        horaEstimada: '2026-11-02T12:02:00.000Z',
      },
    ],
  },
});

export const estadoTrenes = EstadoLineasTrenResponseV1.parse({
  meta: meta({ ttlSeconds: 60 }),
  data: {
    lineas: [
      {
        linea: 'sarmiento',
        nombre: 'Sarmiento',
        color: '#B8237A',
        colorTexto: '#FFFFFF',
        estado: 'demorada',
        resumen: 'El tren de las 08:42 hs. desde Moreno ha sido cancelado.',
        alertaIds: ['99285'],
        ramales: [{ ramalId: '1', nombre: 'Once-Moreno', estado: 'normal', alertaIds: [] }],
      },
    ],
  },
});

export const alertasTrenes = AlertasTrenResponseV1.parse({
  meta: meta({ ttlSeconds: 60 }),
  data: {
    alertas: [
      {
        id: '99285',
        linea: 'sarmiento',
        ramalId: '51',
        titulo: 'El tren de las 08:42 hs. desde Moreno ha sido cancelado.',
        descripcion: 'El tren de las 08:42 hs. desde Moreno ha sido cancelado.',
        efecto: 'SIGNIFICANT_DELAYS',
      },
    ],
  },
});

export const arribosTren = ArribosEstacionTrenResponseV1.parse({
  meta: meta({ ttlSeconds: 30 }),
  data: {
    estacionId: '50',
    arribos: [
      {
        estacionId: '50',
        linea: 'sarmiento',
        ramalId: '1',
        ramal: 'Once-Moreno',
        destino: 'Once',
        sentido: '2',
        enSegundos: 240,
        horaProgramada: '2026-11-02T12:03:00.000Z',
        horaEstimada: '2026-11-02T12:04:00.000Z',
        anden: '2',
        cancelado: false,
      },
    ],
  },
});

export const lineasColectivo = LineasColectivoResponseV1.parse({
  meta: meta({ ttlSeconds: 86_400, sourceTimestamp: null, ageSeconds: null }),
  data: { lineas: [{ lineaId: '1234', linea: '10', empresa: 'Empresa de prueba' }] },
});

export const posiciones = PosicionesLineaResponseV1.parse({
  meta: meta(),
  data: {
    lineaId: '1234',
    vehiculos: [
      {
        id: 'v1',
        lineaId: '1234',
        linea: '10',
        empresa: 'Empresa de prueba',
        lat: -34.6,
        lon: -58.4,
        ts: SOURCE_TS,
        edadSegundos: 12,
      },
    ],
  },
});

export const arribosParada = ArribosParadaResponseV1.parse({
  meta: meta(),
  data: {
    paradaId: '5678',
    arribos: [
      {
        paradaId: '5678',
        lineaId: '1234',
        linea: '10',
        enSegundos: 300,
        horaEstimada: '2026-11-02T12:05:00.000Z',
        viajeId: 'trip-1',
      },
    ],
  },
});

export const manifest = ManifestV1.parse({
  version: 'abc123',
  generatedAt: '2026-11-01T00:00:00.000Z',
  archivos: {
    'subte-estaciones.json': {
      url: 'abc123/subte-estaciones.json',
      bytes: 100,
      sha256: 'a'.repeat(64),
    },
  },
});

export const health = HealthV1.parse({ ok: true, version: '0.1.0', environment: 'test' });

export const subteEstaciones = SubteEstacionesArchivoV1.parse({
  version: 1,
  fuente: 'prueba',
  estaciones: [
    {
      id: '1001',
      nombre: 'Plaza de Mayo',
      nombreGtfs: 'Plaza de Mayo',
      lat: -34.6,
      lon: -58.37,
      lineas: ['A'],
      andenes: ['1001N', '1001S'],
      accesible: true,
    },
  ],
});

export function errorBody(
  code: 'upstream_unavailable' | 'not_found' | 'bad_request' | 'rate_limited' | 'internal',
  retryAfterSeconds?: number,
) {
  return {
    error: {
      code,
      message: 'mensaje del proxy',
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    },
  };
}

/** `Response` JSON real (Node 24 la trae global). */
export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...init.headers },
  });
}

export function notModified(etag: string): Response {
  return new Response(null, { status: 304, headers: { ETag: etag } });
}
