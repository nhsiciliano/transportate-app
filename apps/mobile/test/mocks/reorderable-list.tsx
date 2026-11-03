// Mock de `react-native-reorderable-list` para Jest (lo registra `jest.setup.ts`).
//
// Por qué: la librería llama a `useAnimatedRef()` como función (en el dispositivo lo es), pero en
// Jest Reanimated resuelve su implementación web (`react-native-reanimated/jest/resolver`), que
// devuelve un objeto: "flatListRef is not a function" al montar o desmontar la lista.
//
// La lista es un `FlatList` con todas sus props a la vista (`onReorder`, `dragEnabled`,
// `animationDuration`), así un test puede simular el soltar con
// `screen.getByTestId(...).props.onReorder({ from, to })`. `useReorderableDrag` devuelve el
// `jest.fn` compartido `reorderableListMock.drag`.
import { FlatList, ScrollView } from 'react-native';

export const reorderableListMock = {
  drag: jest.fn(),
};

export function resetReorderableListMock(): void {
  reorderableListMock.drag.mockClear();
}

export function reorderItems<T>(data: readonly T[], from: number, to: number): T[] {
  const copy = [...data];
  const [moved] = copy.splice(from, 1);
  if (moved !== undefined) copy.splice(to, 0, moved);
  return copy;
}

export const useReorderableDrag = () => reorderableListMock.drag;
export const useIsActive = () => false;
export const useReorderableDragStart = () => undefined;
export const useReorderableDragEnd = () => undefined;
export const ReorderableList = FlatList;
export const NestedReorderableList = FlatList;
export const ScrollViewContainer = ScrollView;
export default FlatList;
