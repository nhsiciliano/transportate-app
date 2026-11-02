import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  FAVORITOS_STORAGE_KEY,
  FavoritosProvider,
  MmkvFavoritosRepository,
  useFavoritos,
  type FavoritoV1,
} from '@/features/favoritos';
import { migrateFavoritosDoc } from '@/features/favoritos/migrations';
import { MemoryKeyValueStore } from '@/shared/storage/kv';

const now = () => new Date('2026-11-02T12:00:00.000Z');

function setup(initial?: Record<string, string>) {
  const store = new MemoryKeyValueStore(initial);
  const repo = new MmkvFavoritosRepository(store, { now });
  return { store, repo };
}

const lineaA = { tipo: 'linea_subte', refId: 'LineaA', nombre: 'Línea A' } as const;
const parada = {
  tipo: 'parada_colectivo',
  refId: '1234',
  nombre: 'Av. Corrientes 1200',
  subtitulo: 'Líneas 24, 26',
} as const;
const linea60 = { tipo: 'linea_colectivo', refId: '60', nombre: 'Línea 60' } as const;

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
});

describe('MmkvFavoritosRepository', () => {
  it('agrega al final, sin duplicar, y responde has()', () => {
    const { repo } = setup();
    const a = repo.add(lineaA);
    const p = repo.add(parada);
    expect(a).toEqual({
      id: 'linea_subte:LineaA',
      tipo: 'linea_subte',
      refId: 'LineaA',
      nombre: 'Línea A',
      orden: 0,
      creadoEn: '2026-11-02T12:00:00.000Z',
    });
    expect(p.orden).toBe(1);
    expect(p.subtitulo).toBe('Líneas 24, 26');

    expect(repo.add({ ...lineaA, nombre: 'Otro nombre' })).toBe(a);
    expect(repo.list()).toHaveLength(2);
    expect(repo.has('linea_subte', 'LineaA')).toBe(true);
    expect(repo.has('estacion_subte', 'LineaA')).toBe(false);
  });

  it('alias: recorta, trunca a 30 caracteres y se quita con null o vacío', () => {
    const { repo } = setup();
    const { id } = repo.add(lineaA);
    expect(repo.setAlias(id, '  Casa  ')?.alias).toBe('Casa');
    const largo = 'Parada del laburo de los martes y jueves';
    const conAlias = repo.setAlias(id, largo);
    expect(conAlias?.alias).toBe(largo.slice(0, 30).trim());
    expect(Array.from(conAlias?.alias ?? '').length).toBeLessThanOrEqual(30);
    expect(repo.setAlias(id, null)?.alias).toBeUndefined();
    expect(repo.get(id)).not.toHaveProperty('alias');
    repo.setAlias(id, 'x');
    expect(repo.setAlias(id, '   ')?.alias).toBeUndefined();
    expect(repo.setAlias('no-existe', 'x')).toBeUndefined();
  });

  it('reordena; ignora ids desconocidos y deja al final los que faltan', () => {
    const { repo } = setup();
    const a = repo.add(lineaA);
    const p = repo.add(parada);
    const c = repo.add(linea60);
    repo.reorder([c.id, 'fantasma', a.id]);
    expect(repo.list().map((f) => [f.id, f.orden])).toEqual([
      [c.id, 0],
      [a.id, 1],
      [p.id, 2],
    ]);
  });

  it('remove devuelve el favorito y restore lo vuelve a su lugar', () => {
    const { repo } = setup();
    repo.add(lineaA);
    const p = repo.add(parada);
    repo.add(linea60);
    const removed = repo.remove(p.id);
    expect(removed).toEqual(p);
    expect(repo.list().map((f) => f.orden)).toEqual([0, 1]);
    expect(repo.remove(p.id)).toBeUndefined();

    repo.restore(removed as FavoritoV1);
    expect(repo.list().map((f) => f.id)).toEqual([
      'linea_subte:LineaA',
      'parada_colectivo:1234',
      'linea_colectivo:60',
    ]);
    repo.restore(p); // ya está: no duplica
    expect(repo.list()).toHaveLength(3);
  });

  it('clear vacía la lista', () => {
    const { repo } = setup();
    repo.add(lineaA);
    repo.add(parada);
    repo.clear();
    expect(repo.list()).toEqual([]);
  });

  it('persiste entre dos instancias sobre el mismo store y en una sola escritura', () => {
    const { store, repo } = setup();
    const set = jest.spyOn(store, 'set');
    repo.add(lineaA);
    expect(set).toHaveBeenCalledTimes(1);
    repo.add(parada);

    const otra = new MmkvFavoritosRepository(store, { now });
    expect(otra.list()).toEqual(repo.list());
    otra.remove('linea_subte:LineaA');
    expect(repo.list().map((f) => f.id)).toEqual(['parada_colectivo:1234']);
  });

  it('list() devuelve la misma referencia mientras no haya cambios', () => {
    const { repo } = setup();
    repo.add(lineaA);
    expect(repo.list()).toBe(repo.list());
  });

  it('JSON corrupto o inválido → lista vacía (y se puede seguir usando)', () => {
    for (const raw of ['{no es json', '[]', JSON.stringify({ schemaVersion: 1, items: [{}] })]) {
      const { repo } = setup({ [FAVORITOS_STORAGE_KEY]: raw });
      expect(repo.list()).toEqual([]);
      repo.add(lineaA);
      expect(repo.list()).toHaveLength(1);
    }
    expect(warn).toHaveBeenCalled();
  });

  it('versión más nueva o sin migrador → lista vacía', () => {
    const futura = JSON.stringify({ schemaVersion: 2, items: [] });
    expect(setup({ [FAVORITOS_STORAGE_KEY]: futura }).repo.list()).toEqual([]);
    // Sin schemaVersion cuenta como v0 y hoy no hay migrador 0 → 1.
    const v0 = JSON.stringify({ favoritos: [] });
    expect(setup({ [FAVORITOS_STORAGE_KEY]: v0 }).repo.list()).toEqual([]);
  });

  it('aplica una migración 0 → 1 (ficticia) al leer', () => {
    const v0 = JSON.stringify({
      favoritos: [
        { clave: 'linea_subte:LineaB', nombre: 'Línea B', fecha: '2026-01-01T00:00:00.000Z' },
      ],
    });
    const migrations = {
      0: (doc: Record<string, unknown>) => {
        const viejos = doc.favoritos as { clave: string; nombre: string; fecha: string }[];
        return {
          items: viejos.map((f, orden) => {
            const [tipo = '', refId = ''] = f.clave.split(':');
            return { id: f.clave, tipo, refId, nombre: f.nombre, orden, creadoEn: f.fecha };
          }),
        };
      },
    };
    const store = new MemoryKeyValueStore({ [FAVORITOS_STORAGE_KEY]: v0 });
    const repo = new MmkvFavoritosRepository(store, { migrations, now });
    expect(repo.list()).toEqual([
      {
        id: 'linea_subte:LineaB',
        tipo: 'linea_subte',
        refId: 'LineaB',
        nombre: 'Línea B',
        orden: 0,
        creadoEn: '2026-01-01T00:00:00.000Z',
      },
    ]);
    // La próxima escritura guarda el documento ya en v1.
    repo.add(lineaA);
    expect(JSON.parse(store.getString(FAVORITOS_STORAGE_KEY) ?? '')).toMatchObject({
      schemaVersion: 1,
    });
  });

  it('migrateFavoritosDoc rechaza lo que no es un objeto', () => {
    expect(migrateFavoritosDoc('texto')).toEqual({
      ok: false,
      reason: 'el documento no es un objeto',
    });
  });
});

describe('useFavoritos', () => {
  function Lista() {
    const { favoritos } = useFavoritos();
    return <Text testID="lista">{favoritos.map((f) => f.alias ?? f.nombre).join(', ')}</Text>;
  }

  it('re-renderiza con cada cambio del repositorio', async () => {
    const { repo } = setup();
    await render(
      <FavoritosProvider repository={repo}>
        <Lista />
      </FavoritosProvider>,
    );
    expect(screen.getByTestId('lista')).toHaveTextContent('');

    await act(() => {
      repo.add(lineaA);
      repo.add(parada);
    });
    expect(screen.getByTestId('lista')).toHaveTextContent('Línea A, Av. Corrientes 1200');

    await act(() => {
      repo.setAlias('linea_subte:LineaA', 'Al laburo');
      repo.reorder(['parada_colectivo:1234']);
    });
    expect(screen.getByTestId('lista')).toHaveTextContent('Av. Corrientes 1200, Al laburo');

    await act(() => {
      repo.clear();
    });
    expect(screen.getByTestId('lista')).toHaveTextContent('');
  });

  it('sin provider tira un error claro', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<Lista />)).rejects.toThrow('FavoritosProvider');
    error.mockRestore();
  });
});
