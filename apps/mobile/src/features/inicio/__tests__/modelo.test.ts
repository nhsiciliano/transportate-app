// Piezas puras de Inicio: línea de estado de la tira, líder por cercanía y mensaje de la banda.
import type { FavoritoLiveDataResult, FavoritoV1 } from '@/features/favoritos';
import type { LineaConEstado } from '@/features/subtes';

import {
  elegirLider,
  mensajeDeFavorito,
  modeloBanda,
  resumenSubte,
  SUBTE_NORMAL,
} from '../InicioScreen';

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

const live = (over: Partial<FavoritoLiveDataResult>): FavoritoLiveDataResult => ({
  status: 'ok',
  text: '',
  spoken: '',
  tone: 'default',
  sourceTimestamp: null,
  primary: '',
  primaryIsArribo: false,
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

describe('mensajeDeFavorito', () => {
  it('alias primero; si no, el nombre con lo que lo ubica', () => {
    const medrano = fav({
      tipo: 'estacion_subte',
      refId: '2002',
      nombre: 'Medrano',
      subtitulo: 'Línea B',
    });
    expect(mensajeDeFavorito({ ...medrano, alias: 'Trabajo' })).toBe('Trabajo');
    expect(mensajeDeFavorito(medrano)).toBe('Línea B · Medrano');
    expect(mensajeDeFavorito(medrano, 'Leandro N. Alem')).toBe(
      'Línea B · Medrano hacia Leandro N. Alem',
    );
    expect(
      mensajeDeFavorito(
        fav({ tipo: 'linea_colectivo', refId: '152', nombre: 'Línea 152', subtitulo: 'Ramal A' }),
      ),
    ).toBe('Línea 152 · Ramal A');
    expect(
      mensajeDeFavorito(fav({ tipo: 'parada_colectivo', refId: '1', nombre: 'Cabildo 2000' })),
    ).toBe('Parada Cabildo 2000');
  });
});

describe('modeloBanda', () => {
  const linea152 = fav({ tipo: 'linea_colectivo', refId: '152', nombre: 'Línea 152' });

  it('cargando: valor null (skeleton)', () => {
    expect(modeloBanda(linea152, live({ status: 'loading' }), { lider: true }).value).toBeNull();
  });

  it('línea de colectivo: «N en servicio» en escala de texto y sin «Próximo»', () => {
    const m = modeloBanda(
      linea152,
      live({ primary: '2 en servicio', spoken: '2 colectivos en servicio' }),
      { lider: true },
    );
    expect(m).toMatchObject({ value: '2 en servicio', valueStyle: 'text', label: undefined });
  });

  it('huérfano: «Ya no figura» y el lector lee el mensaje completo', () => {
    const m = modeloBanda(
      linea152,
      live({ status: 'orphan', primary: 'Ya no figura', spoken: 'Esta línea ya no figura' }),
      { lider: false },
    );
    expect(m.value).toBe('Ya no figura');
    expect(m.accessibilityLabel).toBe('Colectivo Línea 152, Esta línea ya no figura');
  });

  it('estación con línea interrumpida y dato viejo: danger con la antigüedad', () => {
    const m = modeloBanda(
      fav({ tipo: 'estacion_subte', refId: '2002', nombre: 'Medrano', subtitulo: 'Línea B' }),
      live({ status: 'stale', primary: '4 min', primaryIsArribo: true, ageText: 'hace 6 min' }),
      { lider: true, estadoLinea: 'interrumpida' },
    );
    expect(m).toMatchObject({
      label: 'Próximo',
      valueStyle: 'display',
      status: { tone: 'danger', text: 'Interrumpida · hace 6 min' },
    });
  });
});
