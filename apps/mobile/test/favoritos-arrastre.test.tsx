// Favoritos: reorden por arrastre (tarea 4.9-drag). `react-native-reorderable-list` se mockea con
// un FlatList que deja a la vista `onReorder` y `dragEnabled` (el gesto real no corre en Jest);
// `useReorderableDrag` devuelve un `jest.fn` para verificar que la manija arranca el arrastre.
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  EditModeButton,
  EditModeProvider,
  FavoritosScreen,
  type MmkvFavoritosRepository,
  type NuevoFavorito,
} from '@/features/favoritos';
import { MOVE_DOWN } from '@/features/favoritos/FavoritoRow';
import { DRAG_HANDLE_LABEL, REORDER_ANIMATION_MS } from '@/features/favoritos/FavoritosScreen';

import { reorderableListMock } from './mocks/reorderable-list';
import { createHarness, defaultRoutes } from './subtes/fixtures';

// `react-native-reorderable-list` usa el mock global (jest.setup.ts → test/mocks/reorderable-list.tsx).
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const lineaA: NuevoFavorito = { tipo: 'linea_subte', refId: 'A', nombre: 'Línea A' };
const lineaB: NuevoFavorito = { tipo: 'linea_subte', refId: 'B', nombre: 'Línea B' };
const lineaC: NuevoFavorito = { tipo: 'linea_subte', refId: 'C', nombre: 'Línea C' };

function setup(items: readonly NuevoFavorito[] = [lineaA, lineaB, lineaC]) {
  const harness = createHarness(defaultRoutes());
  for (const item of items) harness.repository.add(item);
  const renderUi = (ui: ReactElement = <FavoritosScreen />) =>
    render(
      <harness.Wrapper>
        <EditModeProvider>
          <EditModeButton />
          {ui}
        </EditModeProvider>
      </harness.Wrapper>,
    );
  return { repo: harness.repository, renderUi };
}

const ids = (repo: MmkvFavoritosRepository) => repo.list().map((f) => f.refId);
type ListProps = { dragEnabled: boolean; animationDuration: number; onReorder: unknown };
const listProps = () => screen.getByTestId('favoritos-lista').props as ListProps;

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function editar() {
  await userEvent.setup().press(screen.getByRole('button', { name: 'Editar' }));
}

describe('Favoritos · arrastre', () => {
  it('fuera de edición no hay manijas ni arrastre', async () => {
    const { renderUi } = setup();
    await renderUi();
    expect(screen.queryAllByRole('button', { name: DRAG_HANDLE_LABEL })).toHaveLength(0);
    expect(listProps().dragEnabled).toBe(false);
  });

  it('en edición cada fila tiene su manija de 44 × 44 y la manija arranca el arrastre', async () => {
    const { renderUi } = setup();
    await renderUi();
    await editar();
    const handles = screen.getAllByRole('button', { name: DRAG_HANDLE_LABEL });
    expect(handles).toHaveLength(3);
    const [first] = handles;
    if (!first) throw new Error('sin manijas');
    expect(first).toHaveStyle({ width: 44, height: 44 });
    expect(listProps().dragEnabled).toBe(true);
    await fireEvent(first, 'pressIn');
    expect(reorderableListMock.drag).toHaveBeenCalledTimes(1);
  });

  it('soltar guarda el orden nuevo con repository.reorder', async () => {
    const { repo, renderUi } = setup();
    await renderUi();
    await editar();
    const onReorder = listProps().onReorder as (e: { from: number; to: number }) => void;
    await act(() => {
      onReorder({ from: 0, to: 2 });
    });
    expect(ids(repo)).toEqual(['B', 'C', 'A']);
    // Soltar en el mismo lugar no cambia nada.
    await act(() => {
      onReorder({ from: 1, to: 1 });
    });
    expect(ids(repo)).toEqual(['B', 'C', 'A']);
  });

  it('las acciones accesibles "Mover arriba / abajo" siguen funcionando', async () => {
    const { repo, renderUi } = setup();
    await renderUi();
    await editar();
    const first = screen.getByRole('button', { name: /^Línea A/ });
    await fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: MOVE_DOWN } });
    expect(ids(repo)).toEqual(['B', 'A', 'C']);
  });

  it('con Reducir movimiento las filas se reacomodan sin animar', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { renderUi } = setup();
    await renderUi();
    expect(listProps().animationDuration).toBe(0);
  });

  it('sin Reducir movimiento usa la animación de la librería', async () => {
    const { renderUi } = setup();
    await renderUi();
    await act(async () => {
      await Promise.resolve();
    });
    expect(listProps().animationDuration).toBe(REORDER_ANIMATION_MS);
  });
});
