// Piezas puras de Inicio: línea de estado de la tira y líder por cercanía. El mensaje y el modelo
// de la banda viven en `features/favoritos` (banda.test.ts).
import type { FavoritoV1 } from '@/features/favoritos';
import type { LineaConEstado } from '@/features/subtes';

import { elegirLider, resumenSubte, SUBTE_NORMAL } from '../InicioScreen';

const linea = (
  key: string,
  estado: LineaConEstado['estado'],
  resumen?: string,
): LineaConEstado => ({ linea: { key } as LineaConEstado['linea'], estado, resumen });

const fav = (over: Partial<FavoritoV1> & Pick<FavoritoV1, 'tipo' | 'refId' | 'nombre'>) => ({
  id: `${over.tipo}:${over.refId}`,
  orden: 0,
  creadoEn: '2026-11-03T00:00:00Z',
  ...over,
});

describe('resumenSubte', () => {
  it('todo normal', () => {
    expect(resumenSubte([linea('A', 'normal'), linea('B', 'normal')])).toEqual({
      text: SUBTE_NORMAL,
      tone: 'normal',
    });
  });

  it('una demorada con resumen; varias sin resumen; Premetro con nombre entero', () => {
    expect(resumenSubte([linea('A', 'normal'), linea('B', 'demorada', 'Obras')])).toEqual({
      text: 'B con demoras · Obras',
      tone: 'warning',
    });
    expect(
      resumenSubte([linea('B', 'demorada', 'x'), linea('D', 'demorada'), linea('PM', 'demorada')])
        .text,
    ).toBe('B, D y Premetro con demoras');
  });

  it('interrumpidas primero y en danger', () => {
    expect(resumenSubte([linea('B', 'interrumpida'), linea('D', 'demorada')])).toEqual({
      text: 'B interrumpida · D con demoras',
      tone: 'danger',
    });
  });

  it('sin datos: de todas o de algunas', () => {
    expect(resumenSubte([linea('A', 'sin_datos'), linea('B', 'sin_datos')]).text).toBe(
      'Sin información del estado del subte',
    );
    expect(resumenSubte([linea('A', 'normal'), linea('H', 'sin_datos')]).text).toBe(
      'Sin información de H',
    );
  });
});

describe('elegirLider', () => {
  const visibles = [
    fav({ tipo: 'linea_subte', refId: 'D', nombre: 'Línea D' }),
    fav({ tipo: 'estacion_subte', refId: 'lejos', nombre: 'Lejos' }),
    fav({ tipo: 'parada_colectivo', refId: 'cerca', nombre: 'Cerca' }),
  ];
  const estaciones = new Map([['lejos', { lat: -34.7, lon: -58.5 }]]);
  const paradas = new Map([['cerca', { lat: -34.6037, lon: -58.3816 }]]);
  const obelisco = { lat: -34.6037, lon: -58.3816 };

  it('sin posición: la primera', () => {
    expect(elegirLider(visibles, null, estaciones, paradas)).toBe('linea_subte:D');
  });

  it('con posición: la más cercana entre estaciones y paradas; las líneas no compiten', () => {
    expect(elegirLider(visibles, obelisco, estaciones, paradas)).toBe('parada_colectivo:cerca');
  });

  it('con posición pero sin lugares conocidos: la primera', () => {
    expect(elegirLider(visibles, obelisco, undefined, undefined)).toBe('linea_subte:D');
  });

  it('sin favoritos: nada', () => {
    expect(elegirLider([], obelisco, estaciones, paradas)).toBeUndefined();
  });
});
