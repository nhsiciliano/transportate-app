// Favoritos de tren: insignia de la línea, huérfanos, textos, destino y banda.
import { buildRedTrenes } from '@/features/trenes/model';

import { estacionesTren, lineasTren } from '../../../../test/trenes/data';
import { mensajeDeFavorito, descripcionDeFavorito, TIPO_LECTOR } from '../banda';
import { accessibleLabel, hrefFor, TIPO_ICON } from '../describe';
import { FAVORITOS_SCHEMA_VERSION, FavoritoV1Schema, type FavoritoV1 } from '../model';
import { liveQueryKey } from '../servicio';
import { orphanMessage, resolveFavorito } from '../subte';
import { resolveFavoritoTren } from '../tren';

const red = buildRedTrenes(lineasTren, estacionesTren);

const fav = (over: Partial<FavoritoV1> & Pick<FavoritoV1, 'tipo' | 'refId' | 'nombre'>) => ({
  id: `${over.tipo}:${over.refId}`,
  orden: 0,
  creadoEn: '2026-11-05T12:00:00.000Z',
  ...over,
});

const ramal = fav({
  tipo: 'ramal_tren',
  refId: '1',
  nombre: 'Once – Moreno',
  subtitulo: 'Línea Sarmiento',
});
const estacion = fav({
  tipo: 'estacion_tren',
  refId: '50',
  nombre: 'Caballito',
  subtitulo: 'Línea Sarmiento',
});

describe('modelo', () => {
  it('los tipos de tren son aditivos: el esquema sigue en la versión 1', () => {
    expect(FAVORITOS_SCHEMA_VERSION).toBe(1);
    expect(FavoritoV1Schema.safeParse(ramal).success).toBe(true);
    expect(FavoritoV1Schema.safeParse(estacion).success).toBe(true);
    expect(FavoritoV1Schema.safeParse({ ...ramal, tipo: 'linea_tren' }).success).toBe(false);
  });
});

describe('resolveFavoritoTren', () => {
  it('ramal y estación toman la insignia (siglas y color) de su línea', () => {
    expect(resolveFavoritoTren(ramal, red)).toEqual({
      orphan: false,
      badge: { label: 'S', color: '#B766C2', textColor: '#000000' },
    });
    expect(
      resolveFavoritoTren(fav({ tipo: 'estacion_tren', refId: '248', nombre: 'Maipú' }), red),
    ).toEqual({ orphan: false, badge: { label: 'TC', color: '#002D9A', textColor: '#FFFFFF' } });
  });

  it('id que ya no está en el estático → huérfano; sin estático no se afirma nada', () => {
    expect(resolveFavoritoTren({ tipo: 'ramal_tren', refId: '999' }, red)).toEqual({
      orphan: true,
    });
    expect(resolveFavoritoTren({ tipo: 'estacion_tren', refId: '999999' }, red).orphan).toBe(true);
    expect(resolveFavoritoTren(ramal, undefined)).toEqual({ orphan: false });
    // El resolvedor de subte no opina sobre trenes.
    expect(resolveFavorito(ramal, undefined)).toEqual({ orphan: false });
  });

  it('mensaje del huérfano', () => {
    expect(orphanMessage(ramal)).toBe('Este ramal ya no figura en los datos oficiales');
    expect(orphanMessage(estacion)).toBe('Esta estación ya no figura en los datos oficiales');
  });
});

describe('describe', () => {
  it('ícono, etiqueta del lector y destino', () => {
    expect(TIPO_ICON.ramal_tren).toBe('tren');
    expect(TIPO_ICON.estacion_tren).toBe('estacionTren');
    expect(accessibleLabel(ramal)).toBe('Ramal Once – Moreno de tren, Línea Sarmiento.');
    expect(accessibleLabel({ ...estacion, alias: 'Facu' })).toBe(
      'Facu. Estación Caballito de tren, Línea Sarmiento.',
    );
    expect(hrefFor(ramal)).toEqual({ pathname: '/trenes/ramal/[id]', params: { id: '1' } });
    expect(hrefFor(estacion)).toEqual({
      pathname: '/trenes/estacion/[id]',
      params: { id: '50' },
    });
  });

  it('query del dato vivo de cada tipo', () => {
    expect(liveQueryKey(ramal)).toEqual(['trenes', 'estado']);
    expect(liveQueryKey(estacion)).toEqual(['trenes', 'arribos', '50']);
  });
});

describe('banda', () => {
  it('mensaje y lectura', () => {
    expect(TIPO_LECTOR.ramal_tren).toBe('Ramal');
    expect(mensajeDeFavorito(ramal)).toBe('Ramal Once – Moreno · Línea Sarmiento');
    expect(mensajeDeFavorito(estacion)).toBe('Estación Caballito');
    expect(mensajeDeFavorito(estacion, 'Moreno')).toBe('Estación Caballito hacia Moreno');
    expect(mensajeDeFavorito({ ...estacion, alias: 'Facu' }, 'Moreno')).toBe('Facu');
    expect(descripcionDeFavorito(estacion)).toBe('Estación Caballito, Línea Sarmiento');
  });
});
