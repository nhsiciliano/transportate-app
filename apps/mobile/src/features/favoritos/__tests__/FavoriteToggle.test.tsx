// FavoriteToggle: agrega y quita, con estado accesible, háptico y anuncio para el lector.
import { render, screen, userEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

import { MemoryKeyValueStore } from '@/shared/storage/kv';
import { createMemoryPreferenceStore, ThemeProvider } from '@/shared/theme';

import {
  FavoriteToggle,
  FavoritosProvider,
  MmkvFavoritosRepository,
  REMOVED_ANNOUNCEMENT,
  SAVED_ANNOUNCEMENT,
} from '..';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

describe('FavoriteToggle', () => {
  it('guarda y quita el favorito', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const repository = new MmkvFavoritosRepository(new MemoryKeyValueStore());
    await render(
      <ThemeProvider store={createMemoryPreferenceStore('dark')}>
        <FavoritosProvider repository={repository}>
          <FavoriteToggle tipo="estacion_subte" refId="2002" nombre="Medrano" subtitulo="Línea B" />
        </FavoritosProvider>
      </ThemeProvider>,
    );
    const user = userEvent.setup();
    const boton = screen.getByRole('button', { name: 'Guardar en favoritos' });
    expect(boton).not.toBeSelected();
    expect(screen.getByTestId('svg:star', { includeHiddenElements: true })).toBeOnTheScreen();

    await user.press(boton);
    expect(repository.list()).toEqual([
      expect.objectContaining({
        tipo: 'estacion_subte',
        refId: '2002',
        nombre: 'Medrano',
        subtitulo: 'Línea B',
      }),
    ]);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith(SAVED_ANNOUNCEMENT);
    const quitar = screen.getByRole('button', { name: 'Quitar de favoritos' });
    expect(quitar).toBeSelected();
    expect(screen.getByTestId('svg:star-fill', { includeHiddenElements: true })).toBeOnTheScreen();

    await user.press(quitar);
    expect(repository.list()).toEqual([]);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenLastCalledWith(REMOVED_ANNOUNCEMENT);
  });
});
