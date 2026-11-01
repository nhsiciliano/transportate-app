import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  AlertasResponseV1,
  AlertaV1,
  ArriboColectivoV1,
  ArribosEstacionV1,
  ArribosParadaV1,
  ArriboSubteV1,
  EquivalenciaParadaV1,
  ErrorV1,
  EstacionSubteV1,
  EstadoLineasV1,
  EstadoLineaV1,
  HealthV1,
  LineaColectivoV1,
  LineasColectivoV1,
  LineaSubteV1,
  ManifestV1,
  MetaV1,
  ParadaV1,
  PosicionesLineaResponseV1,
  PosicionesLineaV1,
  VehiculoV1,
} from '../src/index.js';

const meta = {
  generatedAt: '2026-11-01T20:00:05Z',
  sourceTimestamp: '2026-11-01T19:59:40-03:00',
  ttlSeconds: 20,
  stale: false,
  ageSeconds: 25,
};
const estadoLinea = {
  linea: 'B',
  estado: 'demorada',
  color: '#FF0000',
  colorTexto: '#000000',
  nombre: 'Leandro N. Alem - Juan Manuel de Rosas',
  resumen: 'Estación Medrano cerrada por obras.',
  alertaIds: ['Alert_LineaB'],
};
const alerta = {
  id: 'Alert_LineaC',
  lineas: ['C'],
  titulo: 'El 02/11 cierra Independencia por obras',
  descripcion: 'El 02/11 cierra Independencia por obras de renovación.',
  causa: 'CONSTRUCTION',
  efecto: 'REDUCED_SERVICE',
};
const arriboSubte = {
  linea: 'A',
  estacionId: '1059N',
  estacion: 'San Pedrito',
  destino: 'Plaza de Mayo',
  enSegundos: 120,
  horaEstimada: '2026-11-01T20:02:05Z',
  sentido: 'N',
};
const vehiculo = {
  id: '3826',
  lineaId: '1553',
  linea: '228B',
  empresa: 'LINEA SESENTA SA',
  destino: 'a Puente Saavedra',
  lat: -34.47115,
  lon: -58.66361,
  velocidad: 2.5,
  rumbo: null,
  ts: '2026-11-01T19:59:40Z',
  edadSegundos: 25,
};
const lineaColectivo = {
  lineaId: '1858',
  linea: '10',
  empresa: 'LINEA 10 S.A.',
  cabeceras: ['Constitución'],
};
const arriboColectivo = {
  paradaId: 'ba-1524-defensa',
  lineaId: '2',
  linea: '22',
  enSegundos: 300,
  horaEstimada: '2026-11-01T20:05:00Z',
  retrasoSegundos: -60,
  incertidumbre: 7,
  viajeId: '152167-1',
};
const parada = {
  id: 'ba-1524-defensa',
  calle: 'DEFENSA',
  altura: '1524',
  nombre: 'Defensa 1524',
  lat: -34.625676,
  lon: -58.371,
  comuna: '1',
  barrio: 'SAN TELMO',
  lineas: [{ linea: '22', sentido: 'V' }, { linea: '53' }],
};

// [nombre, esquema, válido, inválido]
const casos: [string, z.ZodType, unknown, unknown][] = [
  ['MetaV1', MetaV1, meta, { ...meta, generatedAt: '01/11/2026' }],
  [
    'MetaV1 (sourceTimestamp null)',
    MetaV1,
    { ...meta, sourceTimestamp: null, ageSeconds: null },
    { ...meta, stale: 'no' },
  ],
  [
    'ErrorV1',
    ErrorV1,
    { error: { code: 'rate_limited', message: 'Demasiadas consultas', retryAfterSeconds: 30 } },
    { error: { code: 'teapot', message: 'x' } },
  ],
  [
    'HealthV1',
    HealthV1,
    { ok: true, version: '0.1.0', environment: 'dev' },
    { ok: false, version: '0.1.0', environment: 'dev' },
  ],
  ['EstadoLineaV1', EstadoLineaV1, estadoLinea, { ...estadoLinea, linea: 'F' }],
  [
    'EstadoLineasV1',
    EstadoLineasV1,
    { lineas: [estadoLinea] },
    { lineas: [{ ...estadoLinea, color: 'red' }] },
  ],
  ['AlertaV1', AlertaV1, alerta, { ...alerta, lineas: ['Z'] }],
  ['ArriboSubteV1', ArriboSubteV1, arriboSubte, { ...arriboSubte, enSegundos: 1.5 }],
  [
    'ArribosEstacionV1',
    ArribosEstacionV1,
    { estacionId: '1059N', arribos: [arriboSubte] },
    { estacionId: 1059, arribos: [] },
  ],
  ['VehiculoV1', VehiculoV1, vehiculo, { ...vehiculo, lat: 91 }],
  [
    'PosicionesLineaV1',
    PosicionesLineaV1,
    { lineaId: '1553', vehiculos: [vehiculo] },
    { lineaId: '1553' },
  ],
  ['LineaColectivoV1', LineaColectivoV1, lineaColectivo, { ...lineaColectivo, empresa: undefined }],
  ['LineasColectivoV1', LineasColectivoV1, { lineas: [lineaColectivo] }, { lineas: 'todas' }],
  [
    'ArriboColectivoV1',
    ArriboColectivoV1,
    arriboColectivo,
    { ...arriboColectivo, incertidumbre: -1 },
  ],
  [
    'ArribosParadaV1',
    ArribosParadaV1,
    { paradaId: 'x', arribos: [arriboColectivo] },
    { paradaId: 'x', arribos: [{}] },
  ],
  [
    'ManifestV1',
    ManifestV1,
    {
      version: 'a1b2c3',
      generatedAt: '2026-11-01T00:00:00Z',
      archivos: {
        'paradas.json': {
          url: '/v1/static/a1b2c3/paradas.json',
          bytes: 123456,
          sha256: 'a'.repeat(64),
        },
      },
    },
    { version: '', generatedAt: '2026-11-01T00:00:00Z', archivos: {} },
  ],
  ['ParadaV1', ParadaV1, parada, { ...parada, lineas: [{ sentido: 'V' }] }],
  [
    'EstacionSubteV1',
    EstacionSubteV1,
    { id: '1059', nombre: 'San Pedrito', linea: 'A', lat: -34.63, lon: -58.47, orden: 0 },
    { id: '1059', nombre: 'San Pedrito', linea: 'A', lat: -34.63, lon: -58.47, orden: -1 },
  ],
  [
    'LineaSubteV1',
    LineaSubteV1,
    {
      id: 'PM-C',
      nombre: 'Premetro',
      color: '#FFBD33',
      colorTexto: '#000000',
      estacionIds: ['1142'],
    },
    { id: 'PM', nombre: 'Premetro', color: '#FFBD33', colorTexto: '#000000', estacionIds: [] },
  ],
  [
    'EquivalenciaParadaV1',
    EquivalenciaParadaV1,
    {
      stopId: '6441111945',
      paradaId: 'ba-1',
      origen: 'gtfs2021',
      confianza: 0.8,
      observaciones: 12,
    },
    { stopId: '6441111945', paradaId: 'ba-1', origen: 'osm', confianza: 0.8, observaciones: 12 },
  ],
];

describe('contratos v1', () => {
  it.each(casos)('%s acepta un ejemplo válido', (_nombre, schema, valido) => {
    expect(schema.safeParse(valido).success).toBe(true);
  });

  it.each(casos)('%s rechaza un ejemplo inválido', (_nombre, schema, _valido, invalido) => {
    expect(schema.safeParse(invalido).success).toBe(false);
  });

  it('envelope() arma { meta, data } con el esquema interno', () => {
    expect(
      PosicionesLineaResponseV1.safeParse({
        meta,
        data: { lineaId: '1553', vehiculos: [vehiculo] },
      }).success,
    ).toBe(true);
    expect(
      AlertasResponseV1.safeParse({ meta, data: { alertas: [{ ...alerta, id: 1 }] } }).success,
    ).toBe(false);
  });
});
