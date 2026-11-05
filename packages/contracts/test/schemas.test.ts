import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  AlertasResponseV1,
  AlertasTrenResponseV1,
  AlertasTrenV1,
  AlertaTrenV1,
  AlertaV1,
  ArribosEstacionTrenResponseV1,
  ArribosEstacionTrenV1,
  ArriboTrenV1,
  ArriboColectivoV1,
  ArribosEstacionV1,
  ArribosParadaV1,
  ArriboSubteV1,
  EquivalenciaParadaV1,
  EquivalenciasArchivoV1,
  ErrorV1,
  IndiceColectivosArchivoV1,
  EstacionSubteV1,
  EstadoLineasTrenResponseV1,
  EstadoLineasTrenV1,
  EstadoLineaTrenV1,
  EstadoLineasV1,
  EstadoLineaV1,
  EstadoRamalTrenV1,
  HealthV1,
  LineaColectivoV1,
  LineasColectivoV1,
  LineasColectivoArchivoV1,
  LineaSubteV1,
  LineaTrenId,
  ManifestV1,
  MetaV1,
  ParadaV1,
  ParadasArchivoV1,
  SubteEstacionesArchivoV1,
  SubteLineasArchivoV1,
  TrenesEstacionesArchivoV1,
  TrenesLineasArchivoV1,
  PosicionesLineaResponseV1,
  PosicionesLineaV1,
  SentidoTrenV1,
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
// Forma real de tools/gtfs/out/paradas.json
const parada = {
  id: 'pabb406ba9f',
  calle: 'Defensa',
  altura: 1524,
  nombre: 'Defensa 1524',
  lat: -34.625676,
  lon: -58.371,
  comuna: 1,
  barrio: 'San Telmo',
  lineas: [
    { linea: '22', numero: 22, sentido: 'vuelta' },
    { linea: 'EBUS', numero: null, sentido: null },
  ],
};

const estacion = {
  id: '1059',
  nombre: 'San Pedrito',
  nombreGtfs: 'San Pedrito',
  lat: -34.63,
  lon: -58.47,
  lineas: ['A'],
  andenes: ['1059N', '1059S'],
  accesible: true,
};

const lineaSubte = {
  id: 'PM-C',
  routeId: 'PM-Civico',
  nombre: 'Saguier - Centro Cívico',
  tipo: 'premetro',
  color: '#FFBD33',
  colorTexto: '#000000',
  estacionIds: ['1142', '1143'],
  sentidos: [{ directionId: 0, cabecera: 'Centro Cívico', estacionIds: ['1142', '1143'] }],
};

const equivalencia = {
  stopId: '6441111945',
  paradaId: 'pabb406ba9f',
  origen: 'ajustada-ba',
  confianza: 0.8,
  observaciones: 12,
};

const ramalTren = {
  ramalId: '51',
  nombre: 'Moreno-Mercedes',
  estado: 'demorada',
  alertaIds: ['99284', '98462'],
};
const estadoLineaTren = {
  linea: 'sarmiento',
  nombre: 'Sarmiento',
  color: '#00A650',
  colorTexto: '#000000',
  estado: 'demorada',
  resumen: 'El tren de las 08:11 hs. de Fco. Álvarez hacia Moreno se encuentra demorado.',
  alertaIds: ['99284'],
  ramales: [ramalTren],
};
const alertaTren = {
  id: '99284',
  linea: 'sarmiento',
  ramalId: '51',
  sentido: '2',
  titulo: 'El tren de las 08:11 hs. de Fco. Álvarez hacia Moreno se encuentra demorado.',
  descripcion: 'El tren de las 08:11 hs. de Fco. Álvarez hacia Moreno se encuentra demorado.',
  causa: 'TECHNICAL_PROBLEM',
  efecto: 'SIGNIFICANT_DELAYS',
  desde: '2026-11-05T08:32:00-03:00',
};
const arriboTren = {
  estacionId: '50',
  linea: 'sarmiento',
  ramalId: '1',
  ramal: 'Once-Moreno',
  destino: 'Once',
  sentido: '2',
  enSegundos: 240,
  horaProgramada: '2026-11-05T12:00:15.000Z',
  horaEstimada: '2026-11-05T12:01:12.000Z',
  anden: '2',
  cancelado: false,
  servicioId: '41167f5a-f7fd-4e06-ab9e-7ff18cb1f835',
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
  ['LineaTrenId', LineaTrenId, 'san-martin', 'San Martín'],
  ['SentidoTrenV1', SentidoTrenV1, '2', '3'],
  ['EstadoRamalTrenV1', EstadoRamalTrenV1, ramalTren, { ...ramalTren, ramalId: 51 }],
  [
    'EstadoLineaTrenV1',
    EstadoLineaTrenV1,
    estadoLineaTren,
    { ...estadoLineaTren, linea: 'urquiza' },
  ],
  [
    'EstadoLineaTrenV1 (sin ramales ni resumen)',
    EstadoLineaTrenV1,
    { ...estadoLineaTren, estado: 'sin_datos', resumen: undefined, ramales: [] },
    { ...estadoLineaTren, ramales: undefined },
  ],
  [
    'EstadoLineasTrenV1',
    EstadoLineasTrenV1,
    { lineas: [estadoLineaTren] },
    { lineas: [{ ...estadoLineaTren, color: 'verde' }] },
  ],
  ['AlertaTrenV1', AlertaTrenV1, alertaTren, { ...alertaTren, desde: '2026-11-05 08:32:00' }],
  [
    'AlertasTrenV1',
    AlertasTrenV1,
    { alertas: [alertaTren] },
    { alertas: [{ ...alertaTren, sentido: 1 }] },
  ],
  ['ArriboTrenV1', ArriboTrenV1, arriboTren, { ...arriboTren, cancelado: 'no' }],
  [
    'ArriboTrenV1 (solo programado, sin andén)',
    ArriboTrenV1,
    { ...arriboTren, horaEstimada: undefined, anden: undefined, servicioId: undefined },
    { ...arriboTren, enSegundos: 1.5 },
  ],
  [
    'ArribosEstacionTrenV1',
    ArribosEstacionTrenV1,
    { estacionId: '50', arribos: [arriboTren] },
    { estacionId: 50, arribos: [] },
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
          url: 'a1b2c3/paradas.json',
          bytes: 123456,
          sha256: 'a'.repeat(64),
        },
      },
    },
    { version: '', generatedAt: '2026-11-01T00:00:00Z', archivos: {} },
  ],
  ['ParadaV1', ParadaV1, parada, { ...parada, altura: '1524' }],
  [
    'ParadaV1 (sentido)',
    ParadaV1,
    parada,
    { ...parada, lineas: [{ linea: '22', numero: 22, sentido: 'V' }] },
  ],
  [
    'ParadaV1 (comuna)',
    ParadaV1,
    { ...parada, comuna: null, barrio: null, altura: null },
    { ...parada, comuna: 76 },
  ],
  ['EstacionSubteV1', EstacionSubteV1, estacion, { ...estacion, lineas: [] }],
  ['EstacionSubteV1 (id)', EstacionSubteV1, estacion, { ...estacion, id: '1059N' }],
  ['LineaSubteV1', LineaSubteV1, lineaSubte, { ...lineaSubte, id: 'PM' }],
  ['LineaSubteV1 (estaciones)', LineaSubteV1, lineaSubte, { ...lineaSubte, estacionIds: ['1142'] }],
  ['EquivalenciaParadaV1', EquivalenciaParadaV1, equivalencia, { ...equivalencia, origen: 'osm' }],
  [
    'EquivalenciaParadaV1 (sin parada)',
    EquivalenciaParadaV1,
    equivalencia,
    { ...equivalencia, paradaId: null },
  ],
  [
    'ParadasArchivoV1',
    ParadasArchivoV1,
    { version: 1, fuente: 'https://cdn.buenosaires.gob.ar/x.csv', paradas: [parada] },
    { version: 2, fuente: 'x', paradas: [] },
  ],
  [
    'EquivalenciasArchivoV1',
    EquivalenciasArchivoV1,
    { version: 1, metodo: 'docs/01b', equivalencias: [equivalencia] },
    { version: 1, metodo: 'docs/01b', equivalencias: [{ ...equivalencia, observaciones: 'x' }] },
  ],
  [
    'SubteLineasArchivoV1',
    SubteLineasArchivoV1,
    { version: 1, fuente: 'x', feedEndDate: '20261231', lineas: [lineaSubte] },
    { version: 1, fuente: 'x', lineas: [lineaSubte] },
  ],
  [
    'SubteEstacionesArchivoV1',
    SubteEstacionesArchivoV1,
    { version: 1, fuente: 'x', estaciones: [estacion] },
    { version: 1, fuente: 'x', estaciones: [{ ...estacion, linea: 'A', lineas: undefined }] },
  ],
  [
    'IndiceColectivosArchivoV1',
    IndiceColectivosArchivoV1,
    {
      version: 1,
      lineasPorNumero: { '152': ['834', '835'] },
      paradas: { pabb406ba9f: [['6441111945'], [22, 152]], p0000000000: [[], [10]] },
    },
    { version: 1, lineasPorNumero: {}, paradas: { x: [['1']] } },
  ],
  [
    'LineasColectivoArchivoV1',
    LineasColectivoArchivoV1,
    {
      version: 1,
      fuente: 'x',
      nota: 'semilla',
      capturadoEn: '2026-11-01',
      lineas: [
        {
          lineaId: '1858',
          linea: '10',
          empresa: 'LINEA 10 S.A.',
          numero: 10,
          agencyId: '17',
          enCaba: true,
        },
      ],
    },
    {
      version: 1,
      fuente: 'x',
      nota: 'semilla',
      capturadoEn: '2026-11-01',
      lineas: [{ lineaId: '1858', linea: '10', empresa: 'LINEA 10 S.A.' }],
    },
  ],
  [
    'TrenesLineasArchivoV1',
    TrenesLineasArchivoV1,
    {
      version: 1,
      fuente: 'https://ariedro.dev/api-trenes',
      capturadoEn: '2026-11-05T12:00:00.000Z',
      lineas: [
        {
          id: 'sarmiento',
          idGerencia: '1',
          nombre: 'Sarmiento',
          color: '#B766C2',
          colorTexto: '#000000',
          ramales: [
            {
              id: '1',
              linea: 'sarmiento',
              nombre: 'Once-Moreno',
              siglas: 'OM',
              cabeceraInicial: { id: '293', nombre: 'Once' },
              cabeceraFinal: { id: '278', nombre: 'Moreno' },
              electrico: true,
              estacionIds: ['293', '50', '278'],
            },
          ],
        },
      ],
    },
    // Una línea sin ramales no sirve para nada en la app.
    {
      version: 1,
      fuente: 'x',
      capturadoEn: '2026-11-05',
      lineas: [
        {
          id: 'roca',
          idGerencia: '11',
          nombre: 'Roca',
          color: '#FAB700',
          colorTexto: '#000000',
          ramales: [],
        },
      ],
    },
  ],
  [
    'TrenesEstacionesArchivoV1',
    TrenesEstacionesArchivoV1,
    {
      version: 1,
      fuente: 'x',
      capturadoEn: '2026-11-05',
      estaciones: [
        {
          id: '50',
          nombre: 'Caballito',
          lat: -34.619244,
          lon: -58.443652,
          lineas: ['sarmiento'],
          ramalIds: ['1', '111'],
        },
      ],
    },
    // `linea` suelta en vez de `lineas` (como el error clásico de subtes).
    {
      version: 1,
      fuente: 'x',
      capturadoEn: '2026-11-05',
      estaciones: [
        {
          id: '50',
          nombre: 'Caballito',
          lat: -34.6,
          lon: -58.4,
          linea: 'sarmiento',
          ramalIds: ['1'],
        },
      ],
    },
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

  it('los sobres de trenes arman { meta, data }', () => {
    expect(
      EstadoLineasTrenResponseV1.safeParse({ meta, data: { lineas: [estadoLineaTren] } }).success,
    ).toBe(true);
    expect(AlertasTrenResponseV1.safeParse({ meta, data: { alertas: [alertaTren] } }).success).toBe(
      true,
    );
    expect(
      ArribosEstacionTrenResponseV1.safeParse({
        meta,
        data: { estacionId: '50', arribos: [{ ...arriboTren, linea: 'urquiza' }] },
      }).success,
    ).toBe(false);
  });
});
