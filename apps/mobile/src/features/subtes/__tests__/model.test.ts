// Funciones puras del modelo de Subtes.
import { act, renderHook } from '@testing-library/react-native';

import { usePullToRefresh } from '../hooks';
import {
  agruparArribos,
  alertasDeLinea,
  buscarEstaciones,
  buildRed,
  estadoDeLinea,
  formatArribo,
  horaBsAs,
  isLineaKey,
  normalizar,
  periodoAlerta,
  toLineaKey,
} from '../model';
import { estaciones, lineas } from '../../../../test/subtes/fixtures';

const red = buildRed(lineas, estaciones);

describe('buildRed', () => {
  it('arma 7 líneas en orden fijo con Premetro unificado', () => {
    expect(red.lineas.map((l) => l.key)).toEqual(['A', 'B', 'C', 'D', 'E', 'H', 'PM']);
    const pm = red.lineaPorKey.get('PM');
    expect(pm?.ids).toEqual(['PM-S', 'PM-C']);
    expect(pm?.badge).toBe('PM');
    expect(pm?.estaciones.at(-1)).toEqual({ id: '7003', ramal: 'Ramal Centro Cívico' });
    expect(pm?.sentidos.map((s) => s.cabecera)).toEqual([
      'General Savio',
      'Saguier',
      'Centro Cívico',
    ]);
    expect(red.estacionPorId.get('7002')?.linea).toBe('PM');
  });

  it('claves de línea', () => {
    expect(toLineaKey('PM-C')).toBe('PM');
    expect(toLineaKey('B')).toBe('B');
    expect(isLineaKey('PM')).toBe(true);
    expect(isLineaKey('PM-C')).toBe(false);
  });
});

describe('estado y alertas', () => {
  const base = { color: '#000000', colorTexto: '#FFFFFF', nombre: 'x', alertaIds: [] };
  it('toma el estado más severo de los ramales; sin dato es sin_datos', () => {
    const pm = { ids: ['PM-C', 'PM-S'] as const };
    expect(
      estadoDeLinea({ ids: [...pm.ids] }, [
        { ...base, linea: 'PM-C', estado: 'demorada', resumen: 'demora' },
        { ...base, linea: 'PM-S', estado: 'interrumpida', resumen: 'corte' },
      ]),
    ).toEqual({ estado: 'interrumpida', resumen: 'corte' });
    expect(estadoDeLinea({ ids: ['A'] }, undefined)).toEqual({
      estado: 'sin_datos',
      resumen: undefined,
    });
  });

  it('filtra alertas por línea', () => {
    const a = [
      { id: '1', lineas: ['PM-S' as const], titulo: 't', descripcion: 'd' },
      { id: '2', lineas: ['A' as const], titulo: 't', descripcion: 'd' },
    ];
    expect(alertasDeLinea({ ids: ['PM-C', 'PM-S'] }, a).map((x) => x.id)).toEqual(['1']);
    expect(alertasDeLinea({ ids: ['B'] }, undefined)).toEqual([]);
  });

  it('período en hora de Buenos Aires', () => {
    expect(horaBsAs('2026-11-02T17:05:00.000Z')).toBe('14:05');
    expect(horaBsAs('no')).toBeUndefined();
    expect(
      periodoAlerta({ desde: '2026-11-02T17:05:00.000Z', hasta: '2026-11-02T21:00:00.000Z' }),
    ).toBe('De 14:05 a 18:00');
    expect(periodoAlerta({ hasta: '2026-11-02T21:00:00.000Z' })).toBe('Hasta las 18:00');
    expect(periodoAlerta({})).toBeUndefined();
  });
});

describe('búsqueda', () => {
  it('ignora tildes, mayúsculas y signos', () => {
    expect(normalizar('  Ntra. Sra. de FÁTIMA ')).toBe('ntra sra de fatima');
    expect(buscarEstaciones(red.estaciones, 'peru').map((e) => e.id)).toEqual(['1002']);
    expect(buscarEstaciones(red.estaciones, 'retiro').map((e) => e.id)).toEqual(['3001', '5001']);
    expect(buscarEstaciones(red.estaciones, '   ')).toEqual([]);
  });
});

describe('arribos', () => {
  it('formatea "Llegando" y minutos', () => {
    expect(formatArribo(10).short).toBe('Llegando');
    expect(formatArribo(30)).toEqual({ short: '1 min', spoken: 'en 1 minuto' });
    expect(formatArribo(125).short).toBe('3 min');
  });

  it('agrupa por sentido; destinos desconocidos arman su bloque; terminal con un sentido', () => {
    const pm = red.lineaPorKey.get('PM');
    if (pm === undefined) throw new Error('falta PM');
    const a = (destino: string, enSegundos: number) => ({
      linea: 'PM-C' as const,
      estacionId: '7002',
      estacion: 'Pola',
      destino,
      enSegundos,
      horaEstimada: '2026-11-02T12:00:00.000Z',
    });
    const bloques = agruparArribos(
      '7002',
      pm,
      [a('Centro Civico', 60), a('Intendente Saguier', 30), a('Otro destino', 90), a('', 5)],
      red.estacionPorId,
    );
    expect(bloques.map((b) => [b.titulo, b.arribos.length])).toEqual([
      ['Hacia General Savio', 0],
      ['Hacia Saguier', 1],
      ['Hacia Centro Cívico', 1],
      ['Hacia Otro destino', 1],
    ]);
    const a1 = red.lineaPorKey.get('A');
    if (a1 === undefined) throw new Error('falta A');
    expect(agruparArribos('1059', a1, [], red.estacionPorId).map((b) => b.titulo)).toEqual([
      'Hacia Plaza de Mayo',
    ]);
  });
});

describe('usePullToRefresh', () => {
  it('muestra el indicador solo mientras dura el refresco pedido', async () => {
    let resolve: () => void = () => undefined;
    const refetch = jest.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const { result } = await renderHook(() => usePullToRefresh([refetch]));
    expect(result.current.refreshing).toBe(false);
    await act(() => {
      result.current.onRefresh();
    });
    expect(result.current.refreshing).toBe(true);
    await act(async () => {
      resolve();
      await Promise.resolve();
    });
    expect(result.current.refreshing).toBe(false);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
