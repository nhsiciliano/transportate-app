import { buildRed } from '@/features/subtes/model';

import { estaciones, lineas } from '../../../../test/subtes/fixtures';
import type { FavoritoV1 } from '../model';
import { orphanMessage, resolveFavorito } from '../subte';

const red = buildRed(lineas, estaciones);

const fav = (tipo: FavoritoV1['tipo'], refId: string): FavoritoV1 => ({
  id: `${tipo}:${refId}`,
  tipo,
  refId,
  nombre: 'x',
  orden: 0,
  creadoEn: '2026-11-03T12:00:00.000Z',
});

describe('resolveFavorito', () => {
  it('línea de subte: color y letra del estático', () => {
    expect(resolveFavorito(fav('linea_subte', 'B'), red)).toEqual({
      orphan: false,
      badge: { label: 'B', color: '#FF0000', textColor: '#000000' },
    });
    expect(resolveFavorito(fav('linea_subte', 'PM'), red).badge?.label).toBe('PM');
  });

  it('estación de subte: la insignia es la de su línea', () => {
    expect(resolveFavorito(fav('estacion_subte', '3001'), red).badge).toEqual({
      label: 'C',
      color: '#0000FF',
      textColor: '#FFFFFF',
    });
  });

  it('una estación en dos líneas toma la primera', () => {
    expect(resolveFavorito(fav('estacion_subte', '7001'), red).badge?.label).toBe('PM');
  });

  it('refId inexistente → huérfano, sin insignia', () => {
    expect(resolveFavorito(fav('linea_subte', 'Z'), red)).toEqual({ orphan: true });
    expect(resolveFavorito(fav('linea_subte', 'LineaA'), red)).toEqual({ orphan: true });
    expect(resolveFavorito(fav('estacion_subte', '999'), red)).toEqual({ orphan: true });
  });

  it('sin estático cargado no afirma nada', () => {
    expect(resolveFavorito(fav('linea_subte', 'A'), undefined)).toEqual({ orphan: false });
    expect(resolveFavorito(fav('estacion_subte', '999'), undefined)).toEqual({ orphan: false });
  });

  it('colectivos: sin criterio acá (lo decide useFavoritoLiveData), sin insignia ni huérfano', () => {
    expect(resolveFavorito(fav('linea_colectivo', '60'), red)).toEqual({ orphan: false });
    expect(resolveFavorito(fav('parada_colectivo', '1'), undefined)).toEqual({ orphan: false });
  });
});

describe('orphanMessage', () => {
  it('dice estación, línea o parada según el tipo', () => {
    expect(orphanMessage(fav('estacion_subte', '1'))).toBe(
      'Esta estación ya no figura en los datos oficiales',
    );
    expect(orphanMessage(fav('linea_subte', 'Z'))).toBe(
      'Esta línea ya no figura en los datos oficiales',
    );
    expect(orphanMessage(fav('linea_colectivo', '60'))).toBe(
      'Esta línea ya no figura en los datos oficiales',
    );
    expect(orphanMessage(fav('parada_colectivo', '1'))).toBe(
      'Esta parada ya no figura en los datos oficiales',
    );
  });
});
