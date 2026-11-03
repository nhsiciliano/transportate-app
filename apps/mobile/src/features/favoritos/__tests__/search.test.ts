import { filterFavoritos, normalizeText } from '../search';
import type { FavoritoV1 } from '../model';

const fav = (over: Partial<FavoritoV1>): FavoritoV1 => ({
  id: 'x',
  tipo: 'parada_colectivo',
  refId: '1',
  nombre: 'Parada',
  orden: 0,
  creadoEn: '2026-11-03T12:00:00.000Z',
  ...over,
});

describe('búsqueda de favoritos', () => {
  it('normaliza tildes, eñes y mayúsculas', () => {
    expect(normalizeText('  Línea ÑANDÚ ')).toBe('linea nandu');
  });

  it('sin texto devuelve la misma lista', () => {
    const list = [fav({})];
    expect(filterFavoritos(list, '   ')).toBe(list);
  });

  it('busca en alias, nombre y subtítulo', () => {
    const list = [
      fav({ id: 'a', alias: 'Casa', nombre: 'Medrano' }),
      fav({ id: 'b', nombre: 'Rivadavia', subtitulo: 'Líneas 1, 25' }),
    ];
    expect(filterFavoritos(list, 'casa').map((f) => f.id)).toEqual(['a']);
    expect(filterFavoritos(list, 'medrano').map((f) => f.id)).toEqual(['a']);
    expect(filterFavoritos(list, 'lineas 25').map((f) => f.id)).toEqual([]);
    expect(filterFavoritos(list, 'líneas 1').map((f) => f.id)).toEqual(['b']);
  });
});
