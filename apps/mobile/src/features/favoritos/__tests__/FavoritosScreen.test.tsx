import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  EditModeButton,
  EditModeProvider,
  FavoritosScreen,
  MmkvFavoritosRepository,
  type NuevoFavorito,
} from '@/features/favoritos';

import { createHarness, defaultRoutes } from '../../../../test/subtes/fixtures';

import { MOVE_DOWN, MOVE_UP } from '../FavoritoRow';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const casa: NuevoFavorito = {
  tipo: 'estacion_subte',
  refId: '2002',
  nombre: 'Medrano',
  subtitulo: 'Línea B',
  alias: 'Casa',
};
const lineaA: NuevoFavorito = { tipo: 'linea_subte', refId: 'A', nombre: 'Línea A' };
const parada: NuevoFavorito = {
  tipo: 'parada_colectivo',
  refId: '9002',
  nombre: 'Av. Rivadavia y Acoyte',
  subtitulo: 'Líneas 1, 25, 132',
};
const colectivo: NuevoFavorito = { tipo: 'linea_colectivo', refId: '60', nombre: 'Línea 60' };

function setup(items: readonly NuevoFavorito[] = []) {
  // Providers reales (tema, datos, estático, favoritos) y un proxy mockeado por ruta: el estático
  // de subte (7 líneas) sale de los fixtures de `test/subtes`.
  const harness = createHarness(defaultRoutes());
  const repo = harness.repository;
  for (const item of items) repo.add(item);
  const renderUi = (ui: ReactElement = <FavoritosScreen />) =>
    render(
      <harness.Wrapper>
        <EditModeProvider>
          <EditModeButton />
          {ui}
        </EditModeProvider>
      </harness.Wrapper>,
    );
  return { repo, renderUi, harness };
}

const ids = (repo: MmkvFavoritosRepository) => repo.list().map((f) => f.refId);

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
});

describe('Favoritos · lista', () => {
  it('muestra los favoritos en el orden guardado, con alias y nombre oficial', async () => {
    const { renderUi } = setup([casa, lineaA, parada]);
    await renderUi();

    const rows = screen.getAllByRole('button', { name: /\.$/ });
    expect(rows).toHaveLength(3);
    expect(screen.getByText('Casa')).toBeOnTheScreen();
    // Con alias, el nombre oficial va debajo; sin alias, el nombre es el principal.
    expect(screen.getByText('Medrano · Línea B')).toBeOnTheScreen();
    expect(screen.getByText('Línea A')).toBeOnTheScreen();
    expect(screen.getByText('Av. Rivadavia y Acoyte')).toBeOnTheScreen();
    expect(screen.getByText('Líneas 1, 25, 132')).toBeOnTheScreen();
  });

  it('cada fila se lee como una unidad: alias, tipo y nombre', async () => {
    const { renderUi } = setup([casa, parada, colectivo, lineaA]);
    await renderUi();
    expect(
      screen.getByRole('button', { name: /^Casa\. Estación Medrano, Línea B\./ }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Parada Av. Rivadavia y Acoyte, Líneas 1, 25, 132.',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Línea 60 de colectivo\./ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Línea A de subte\./ })).toBeOnTheScreen();
  });

  it('tocar una fila va al detalle de su tipo', async () => {
    const user = userEvent.setup();
    const { renderUi } = setup([casa, lineaA, parada, colectivo]);
    await renderUi();

    await user.press(screen.getByRole('button', { name: /^Casa\./ }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/subtes/estacion/[id]',
      params: { id: '2002' },
    });
    await user.press(screen.getByRole('button', { name: /^Línea A/ }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/subtes/[linea]',
      params: { linea: 'A' },
    });
    await user.press(screen.getByRole('button', { name: /^Parada/ }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/colectivos/parada/[id]',
      params: { id: '9002' },
    });
    await user.press(screen.getByRole('button', { name: /^Línea 60/ }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/colectivos/[linea]',
      params: { linea: '60' },
    });
  });
});

describe('Favoritos · vacío', () => {
  it('enseña qué hacer y ofrece Ver subtes y Buscar colectivo', async () => {
    const user = userEvent.setup();
    const { renderUi } = setup();
    await renderUi();

    expect(screen.getByText('Todavía no guardaste favoritos.')).toBeOnTheScreen();
    expect(
      screen.getByText('Tocá la estrella en una línea, parada o estación para tenerla acá.'),
    ).toBeOnTheScreen();
    // Sin favoritos no hay nada que editar.
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Ver subtes' }));
    expect(mockPush).toHaveBeenLastCalledWith('/subtes');
    await user.press(screen.getByRole('button', { name: 'Buscar colectivo' }));
    expect(mockPush).toHaveBeenLastCalledWith('/colectivos');
  });

  it('pasa del vacío a la lista cuando se agrega un favorito', async () => {
    const { renderUi, repo } = setup();
    await renderUi();
    expect(screen.getByText('Todavía no guardaste favoritos.')).toBeOnTheScreen();
    await act(() => {
      repo.add(lineaA);
    });
    expect(screen.getByRole('button', { name: /^Línea A de subte\./ })).toBeOnTheScreen();
    expect(screen.queryByText('Todavía no guardaste favoritos.')).toBeNull();
  });
});

describe('Favoritos · edición', () => {
  it('Editar muestra Cambiar nombre y Quitar; Listo vuelve a la lista', async () => {
    const user = userEvent.setup();
    const { renderUi } = setup([casa, lineaA]);
    await renderUi();
    expect(screen.queryByRole('button', { name: 'Quitar Casa' })).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('button', { name: 'Quitar Casa' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cambiar nombre de Casa' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('button', { name: 'Quitar Casa' })).toBeNull();
  });

  it('quitar es inmediato, avisa con Deshacer y lo devuelve a la misma posición', async () => {
    const user = userEvent.setup();
    const { renderUi, repo } = setup([casa, lineaA, parada]);
    await renderUi();
    await user.press(screen.getByRole('button', { name: 'Editar' }));

    await user.press(screen.getByRole('button', { name: 'Quitar Línea A' }));
    expect(ids(repo)).toEqual(['2002', '9002']);
    expect(screen.getByText('Quitaste «Línea A».')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Deshacer' }));
    expect(ids(repo)).toEqual(['2002', 'A', '9002']);
  });

  it('el aviso nombra el alias cuando hay', async () => {
    const user = userEvent.setup();
    const { renderUi } = setup([casa]);
    await renderUi();
    await user.press(screen.getByRole('button', { name: 'Editar' }));
    await user.press(screen.getByRole('button', { name: 'Quitar Casa' }));
    expect(screen.getByText('Quitaste «Casa».')).toBeOnTheScreen();
    // Se quedó sin favoritos: aparece el vacío y se sale de la edición.
    expect(screen.getByText('Todavía no guardaste favoritos.')).toBeOnTheScreen();
  });

  it('las acciones de accesibilidad mueven la fila arriba y abajo', async () => {
    const user = userEvent.setup();
    const { renderUi, repo } = setup([casa, lineaA, parada]);
    await renderUi();
    await user.press(screen.getByRole('button', { name: 'Editar' }));

    const first = screen.getByRole('button', { name: /^Casa\./ });
    // La primera no se puede subir; la última no se puede bajar.
    expect(first.props.accessibilityActions).toEqual([{ name: MOVE_DOWN, label: 'Mover abajo' }]);
    const last = screen.getByRole('button', { name: /^Parada/ });
    expect(last.props.accessibilityActions).toEqual([{ name: MOVE_UP, label: 'Mover arriba' }]);

    await fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: MOVE_DOWN } });
    expect(ids(repo)).toEqual(['A', '2002', '9002']);

    await fireEvent(screen.getByRole('button', { name: /^Parada/ }), 'accessibilityAction', {
      nativeEvent: { actionName: MOVE_UP },
    });
    expect(ids(repo)).toEqual(['A', '9002', '2002']);
  });
});

describe('Favoritos · alias', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.press(screen.getByRole('button', { name: 'Editar' }));
    await user.press(screen.getByRole('button', { name: 'Cambiar nombre de Línea A' }));
  };

  it('guarda el alias y lo muestra', async () => {
    const user = userEvent.setup();
    const { renderUi, repo } = setup([lineaA]);
    await renderUi();
    await open(user);

    const input = screen.getByLabelText('Nombre para Línea A');
    await user.type(input, 'Al trabajo');
    expect(screen.getByText('10/30')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(repo.list()[0]?.alias).toBe('Al trabajo');
    expect(screen.getByText('Al trabajo')).toBeOnTheScreen();
    expect(screen.getByText('Línea A')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Nombre para Línea A')).toBeNull();
  });

  it('corta en 30 caracteres, también con emojis', async () => {
    const user = userEvent.setup();
    const { renderUi, repo } = setup([lineaA]);
    await renderUi();
    await open(user);

    const largo = `${'a'.repeat(28)}🚇🚇🚇🚇`;
    await fireEvent.changeText(screen.getByLabelText('Nombre para Línea A'), largo);
    expect(screen.getByText('30/30')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    const alias = repo.list()[0]?.alias ?? '';
    expect(Array.from(alias)).toHaveLength(30);
    expect(alias.endsWith('🚇🚇')).toBe(true);
  });

  it('Cancelar no cambia nada y un campo vacío quita el alias', async () => {
    const user = userEvent.setup();
    const { renderUi, repo } = setup([casa]);
    await renderUi();
    await user.press(screen.getByRole('button', { name: 'Editar' }));

    await user.press(screen.getByRole('button', { name: 'Cambiar nombre de Casa' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre para Casa'), 'Otra cosa');
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));
    expect(repo.list()[0]?.alias).toBe('Casa');

    await user.press(screen.getByRole('button', { name: 'Cambiar nombre de Casa' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre para Casa'), '   ');
    await user.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(repo.list()[0]?.alias).toBeUndefined();
  });
});

describe('Favoritos · búsqueda', () => {
  const muchos = (n: number): NuevoFavorito[] =>
    Array.from({ length: n }, (_, i) => ({
      tipo: 'parada_colectivo',
      refId: String(i),
      nombre: i === n - 1 ? 'Plaza Ñandú' : `Parada ${String(i)}`,
    }));

  it('con 15 favoritos no hay búsqueda; con 16 aparece', async () => {
    const quince = setup(muchos(15));
    const view = await quince.renderUi();
    expect(screen.queryByLabelText('Buscar en favoritos')).toBeNull();
    await view.unmount();

    const dieciseis = setup(muchos(16));
    await dieciseis.renderUi();
    expect(screen.getByLabelText('Buscar en favoritos')).toBeOnTheScreen();
  });

  it('filtra por alias y nombre sin tildes ni mayúsculas, y avisa si no hay resultados', async () => {
    const user = userEvent.setup();
    const items = [...muchos(16)];
    items[2] = { ...items[2], alias: 'Trabajo' } as NuevoFavorito;
    const { renderUi } = setup(items);
    await renderUi();

    await user.type(screen.getByLabelText('Buscar en favoritos'), 'NANDU');
    expect(screen.getByText('Plaza Ñandú')).toBeOnTheScreen();
    expect(screen.queryByText('Parada 0')).toBeNull();

    await user.clear(screen.getByLabelText('Buscar en favoritos'));
    await user.type(screen.getByLabelText('Buscar en favoritos'), 'trabajo');
    expect(screen.getByText('Trabajo')).toBeOnTheScreen();
    expect(screen.queryByText('Plaza Ñandú')).toBeNull();

    await user.clear(screen.getByLabelText('Buscar en favoritos'));
    await user.type(screen.getByLabelText('Buscar en favoritos'), 'zzz');
    expect(screen.getByText('No encontramos favoritos con «zzz».')).toBeOnTheScreen();
  });
});
