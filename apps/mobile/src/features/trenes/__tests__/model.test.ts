// Funciones puras del modelo de Trenes.
import type { AlertaTrenV1, ArriboTrenV1, EstadoLineasTrenV1 } from '@transportate/contracts';

import {
  agruparArribosTren,
  alertasDeEstacion,
  alertasDeLinea,
  alertasDeRamal,
  arribosTrenVigentes,
  buildRedTrenes,
  buscarEstacionesTren,
  demoraDe,
  detalleLinea,
  estadoDeEstacionTren,
  estadoDeLineaTren,
  estadoDeRamal,
  formatArriboTren,
  formatearRamal,
  isLineaTrenId,
  lineasDeEstacion,
  nombreLinea,
  sentidoDeAlerta,
  siglasLinea,
} from '../model';
import { estacionesTren, lineasTren } from '../../../../test/trenes/data';

const red = buildRedTrenes(lineasTren, estacionesTren);

describe('buildRedTrenes', () => {
  it('arma las 6 líneas en el orden fijo con sus ramales', () => {
    expect(red.lineas.map((l) => l.id)).toEqual([
      'roca',
      'sarmiento',
      'mitre',
      'san-martin',
      'belgrano-sur',
      'tren-de-la-costa',
    ]);
    const sarmiento = red.lineaPorId.get('sarmiento');
    expect(sarmiento).toMatchObject({ nombre: 'Línea Sarmiento', siglas: 'S', color: '#B766C2' });
    expect(sarmiento?.ramales.map((r) => r.nombreVisible)).toEqual([
      'Once – Moreno',
      'Once – Bragado',
    ]);
    expect(red.ramalPorId.get('111')?.cabeceras).toBe('Once – Bragado');
    expect(red.estacionPorId.get('50')?.nombre).toBe('Caballito');
  });

  it('nombres, siglas e ids', () => {
    expect(nombreLinea('roca')).toBe('Línea Roca');
    expect(nombreLinea('san-martin')).toBe('Línea San Martín');
    expect(nombreLinea('tren-de-la-costa')).toBe('Tren de la Costa');
    expect(
      ['roca', 'sarmiento', 'mitre', 'san-martin', 'belgrano-sur', 'tren-de-la-costa'].map((id) =>
        isLineaTrenId(id) ? siglasLinea(id) : '?',
      ),
    ).toEqual(['R', 'S', 'M', 'SM', 'BS', 'TC']);
    expect(isLineaTrenId('urquiza')).toBe(false);
  });

  it('formatearRamal pone raya y deja pegadas las variantes de una letra', () => {
    expect(formatearRamal('Once-Moreno')).toBe('Once – Moreno');
    expect(formatearRamal('Constitución-Bosques-Q')).toBe('Constitución – Bosques-Q');
    expect(formatearRamal('González Catan -Navarro')).toBe('González Catan – Navarro');
    expect(formatearRamal('Retiro - Junín')).toBe('Retiro – Junín');
  });

  it('detalle de la fila: cabeceras con un ramal, cantidad con varios', () => {
    expect(detalleLinea(red.lineaPorId.get('tren-de-la-costa') ?? { ramales: [] })).toBe(
      'Maipú – Delta',
    );
    expect(detalleLinea(red.lineaPorId.get('sarmiento') ?? { ramales: [] })).toBe('2 ramales');
  });

  it('líneas de una estación en el orden fijo', () => {
    const once = red.estacionPorId.get('293');
    expect(once === undefined ? [] : lineasDeEstacion(once, red).map((l) => l.id)).toEqual([
      'sarmiento',
    ]);
  });
});

const estado: EstadoLineasTrenV1 = {
  lineas: [
    {
      linea: 'sarmiento',
      nombre: 'Sarmiento',
      color: '#B766C2',
      colorTexto: '#000000',
      estado: 'demorada',
      resumen: 'Demoras en Moreno – Mercedes.',
      alertaIds: ['a1'],
      ramales: [
        { ramalId: '1', nombre: 'Once-Moreno', estado: 'normal', alertaIds: [] },
        { ramalId: '111', nombre: 'Once-Bragado', estado: 'interrumpida', alertaIds: ['a2'] },
      ],
    },
    {
      linea: 'roca',
      nombre: 'Roca',
      color: '#FAB700',
      colorTexto: '#000000',
      estado: 'normal',
      alertaIds: [],
      // La fuente de ramales del Roca no respondió.
      ramales: [],
    },
  ],
};

describe('estado', () => {
  it('de línea, con resumen; sin la línea o sin dato es sin_datos', () => {
    expect(estadoDeLineaTren('sarmiento', estado)).toEqual({
      estado: 'demorada',
      resumen: 'Demoras en Moreno – Mercedes.',
    });
    expect(estadoDeLineaTren('mitre', estado).estado).toBe('sin_datos');
    expect(estadoDeLineaTren('roca', undefined).estado).toBe('sin_datos');
  });

  it('de ramal: el suyo; si la línea vino sin ramales, sin_datos (no se inventa)', () => {
    expect(estadoDeRamal('111', estado)).toBe('interrumpida');
    expect(estadoDeRamal('1', estado)).toBe('normal');
    expect(estadoDeRamal('11', estado)).toBe('sin_datos');
  });

  it('de estación: el peor de los ramales que la sirven', () => {
    expect(estadoDeEstacionTren({ ramalIds: ['1', '111'] }, estado)).toBe('interrumpida');
    expect(estadoDeEstacionTren({ ramalIds: ['1'] }, estado)).toBe('normal');
    expect(estadoDeEstacionTren({ ramalIds: ['11'] }, estado)).toBe('sin_datos');
  });
});

const alerta = (a: Partial<AlertaTrenV1> & Pick<AlertaTrenV1, 'id'>): AlertaTrenV1 => ({
  linea: 'sarmiento',
  titulo: `Alerta ${a.id}`,
  descripcion: `Alerta ${a.id}`,
  ...a,
});

describe('alertas', () => {
  const alertas = [
    alerta({ id: 'cud' }),
    alerta({ id: 'r1', ramalId: '1', sentido: '1' }),
    alerta({ id: 'r111', ramalId: '111' }),
    alerta({ id: 'e50', ramalId: '1', estacionId: '50' }),
    alerta({ id: 'roca', linea: 'roca' }),
  ];

  it('de línea: solo las que no apuntan a un ramal', () => {
    expect(alertasDeLinea('sarmiento', alertas).map((a) => a.id)).toEqual(['cud']);
  });

  it('de ramal: las propias y después las de su línea', () => {
    expect(alertasDeRamal({ id: '1', linea: 'sarmiento' }, alertas).map((a) => a.id)).toEqual([
      'r1',
      'e50',
      'cud',
    ]);
  });

  it('de estación: las que la nombran y las de sus ramales (sin las generales de línea)', () => {
    expect(
      alertasDeEstacion({ id: '50', ramalIds: ['1', '111'] }, alertas).map((a) => a.id),
    ).toEqual(['r1', 'r111', 'e50']);
    expect(alertasDeEstacion({ id: '278', ramalIds: ['1'] }, alertas).map((a) => a.id)).toEqual([
      'r1',
    ]);
  });

  it('sentido de una alerta con la cabecera (S39)', () => {
    const ramal = red.ramalPorId.get('1');
    if (ramal === undefined) throw new Error('falta el ramal');
    expect(sentidoDeAlerta({ sentido: '1' }, ramal)).toBe('Hacia Moreno');
    expect(sentidoDeAlerta({ sentido: '2' }, ramal)).toBe('Hacia Once');
    expect(sentidoDeAlerta({}, ramal)).toBeUndefined();
  });
});

describe('búsqueda', () => {
  it('sin tildes ni mayúsculas, en orden alfabético', () => {
    expect(buscarEstacionesTren(red, 'retiro').map((e) => e.nombre)).toEqual([
      'Retiro (LGM)',
      'Retiro (San Martín)',
    ]);
    expect(buscarEstacionesTren(red, 'MAIPU').map((e) => e.id)).toEqual(['248']);
    expect(buscarEstacionesTren(red, '  ')).toEqual([]);
  });
});

const NOW = Date.parse('2026-11-05T12:00:00.000Z');
const iso = (s: number) => new Date(NOW + s * 1000).toISOString();

function arribo(o: Partial<ArriboTrenV1> & { en: number; destino: string }): ArriboTrenV1 {
  const { en, ...rest } = o;
  return {
    estacionId: '50',
    linea: 'sarmiento',
    ramalId: '1',
    ramal: 'Once-Moreno',
    sentido: o.destino === 'Moreno' ? '1' : '2',
    enSegundos: en,
    horaProgramada: iso(en),
    cancelado: false,
    ...rest,
  };
}

describe('arribos', () => {
  it('vigentes: recalcula con la estimada (o la programada) y descarta los pasados', () => {
    const lista = [
      arribo({ en: 300, destino: 'Moreno', horaEstimada: iso(420) }),
      arribo({ en: -60, destino: 'Once' }),
      arribo({ en: 100, destino: 'Once' }),
    ];
    expect(arribosTrenVigentes(lista, NOW).map((a) => a.enSegundos)).toEqual([100, 420]);
    expect(arribosTrenVigentes(lista, NOW + 120_000).map((a) => a.enSegundos)).toEqual([-20, 300]);
  });

  it('agrupa por destino, ordena por el más próximo, hasta 3 y con ramal y andén', () => {
    const bloques = agruparArribosTren([
      arribo({ en: 600, destino: 'Moreno', anden: '1' }),
      arribo({ en: 240, destino: 'Once', anden: '2' }),
      arribo({ en: 900, destino: 'Moreno', anden: '1' }),
      arribo({ en: 1200, destino: 'Moreno' }),
      arribo({ en: 1500, destino: 'Moreno' }),
      arribo({ en: 400, destino: 'Bragado', ramal: 'Once-Bragado', ramalId: '111' }),
    ]);
    expect(bloques.map((b) => b.titulo)).toEqual(['Hacia Once', 'Hacia Bragado', 'Hacia Moreno']);
    const moreno = bloques[2];
    expect(moreno?.arribos.map((a) => a.enSegundos)).toEqual([600, 900, 1200]);
    expect(moreno).toMatchObject({ ramal: 'Ramal Once – Moreno', anden: '1' });
    expect(bloques[1]?.ramal).toBe('Ramal Once – Bragado');
  });

  it('un cancelado no cuenta como próximo (S40)', () => {
    const [bloque] = agruparArribosTren([
      arribo({ en: 120, destino: 'Moreno', cancelado: true }),
      arribo({ en: 600, destino: 'Moreno' }),
    ]);
    expect(bloque?.arribos.map((a) => a.enSegundos)).toEqual([600]);
    expect(bloque?.cancelados.map((a) => a.enSegundos)).toEqual([120]);
    const [solo] = agruparArribosTren([arribo({ en: 120, destino: 'Once', cancelado: true })]);
    expect(solo?.arribos).toEqual([]);
    expect(solo?.cancelados).toHaveLength(1);
  });

  it('demora y formato', () => {
    expect(demoraDe(arribo({ en: 0, destino: 'Once', horaEstimada: iso(180) }))).toBe(180);
    expect(demoraDe(arribo({ en: 0, destino: 'Once' }))).toBe(0);
    expect(formatArriboTren(45)).toEqual({ short: 'Ahora', spoken: 'ahora' });
    expect(formatArriboTren(240).short).toBe('4 min');
    expect(formatArriboTren(90)).toEqual({ short: '2 min', spoken: 'en 2 minutos' });
  });
});
