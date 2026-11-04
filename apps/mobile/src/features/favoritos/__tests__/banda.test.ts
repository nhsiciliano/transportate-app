// Contenido de la banda de un favorito (Inicio y Favoritos): mensaje y modelo.
import type { FavoritoLiveDataResult, FavoritoV1 } from '..';
import { mensajeDeFavorito, modeloBanda } from '../banda';

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
