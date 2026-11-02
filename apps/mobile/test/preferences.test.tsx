import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { REFRESH_INTERVAL_OPTIONS, THEME_OPTIONS, usePreference } from '@/features/ajustes';
import { MemoryKeyValueStore } from '@/shared/storage/kv';
import {
  DEFAULT_REFRESH_INTERVAL,
  REFRESH_INTERVAL_KEY,
  THEME_PREFERENCE_KEY,
  createRefreshIntervalStore,
  createThemePreferenceStore,
  type PreferenceStore,
} from '@/shared/storage/preferences';

describe('createThemePreferenceStore', () => {
  it('default "system" y persiste lo que se elige', () => {
    const kv = new MemoryKeyValueStore();
    const store = createThemePreferenceStore(kv);
    expect(store.get()).toBe('system');
    store.set('dark');
    expect(store.get()).toBe('dark');
    expect(kv.getString(THEME_PREFERENCE_KEY)).toBe('"dark"');
    // Otra instancia sobre el mismo almacenamiento lee lo mismo (sobrevive a reiniciar).
    expect(createThemePreferenceStore(kv).get()).toBe('dark');
  });

  it.each(['"sepia"', '42', '{roto', '"DARK"'])('valor inválido %s → "system"', (raw) => {
    const kv = new MemoryKeyValueStore({ [THEME_PREFERENCE_KEY]: raw });
    expect(createThemePreferenceStore(kv).get()).toBe('system');
  });

  it('avisa a los suscriptores y deja de avisar al desuscribirse', () => {
    const kv = new MemoryKeyValueStore();
    const store = createThemePreferenceStore(kv);
    const listener = jest.fn();
    const off = store.subscribe(listener);
    store.set('light');
    // Un cambio hecho por otra instancia también llega (vía onChange del KeyValueStore).
    createThemePreferenceStore(kv).set('dark');
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    store.set('system');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('avisa aunque el KeyValueStore no tenga onChange', () => {
    const base = new MemoryKeyValueStore();
    const kv = {
      getString: (k: string) => base.getString(k),
      set: (k: string, v: string) => {
        base.set(k, v);
      },
      remove: (k: string) => {
        base.remove(k);
      },
    };
    const store = createThemePreferenceStore(kv);
    const listener = jest.fn();
    store.subscribe(listener);
    store.set('dark');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('createRefreshIntervalStore', () => {
  it('default 20 s (S17) y persiste', () => {
    const kv = new MemoryKeyValueStore();
    const store = createRefreshIntervalStore(kv);
    expect(store.get()).toBe(DEFAULT_REFRESH_INTERVAL);
    expect(store.get()).toBe(20);
    store.set(60);
    expect(kv.getString(REFRESH_INTERVAL_KEY)).toBe('60');
    expect(createRefreshIntervalStore(kv).get()).toBe(60);
  });

  it.each(['10', '"20"', '20.5', 'null', 'x'])('valor inválido %s → 20', (raw) => {
    const kv = new MemoryKeyValueStore({ [REFRESH_INTERVAL_KEY]: raw });
    expect(createRefreshIntervalStore(kv).get()).toBe(20);
  });

  it('no persiste valores fuera de la lista', () => {
    const store = createRefreshIntervalStore(new MemoryKeyValueStore());
    // Simula un valor que llega sin tipar (p. ej. de un deep link o una migración).
    const loose = store as unknown as PreferenceStore<number>;
    expect(() => {
      loose.set(45);
    }).toThrow();
    expect(store.get()).toBe(20);
  });
});

describe('opciones de Ajustes', () => {
  it('tema: Sistema, Claro, Oscuro; intervalo: 15, 20, 30, 60 s', () => {
    expect(THEME_OPTIONS.map((o) => o.label)).toEqual(['Sistema', 'Claro', 'Oscuro']);
    expect(REFRESH_INTERVAL_OPTIONS.map((o) => o.label)).toEqual(['15 s', '20 s', '30 s', '60 s']);
  });
});

describe('usePreference', () => {
  function Intervalo({ store }: { store: ReturnType<typeof createRefreshIntervalStore> }) {
    const [value, set] = usePreference(store);
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          set(30);
        }}
      >
        <Text>{`Cada ${String(value)} s`}</Text>
      </Pressable>
    );
  }

  it('lee, escribe y re-renderiza con cambios externos', async () => {
    const kv = new MemoryKeyValueStore();
    const store = createRefreshIntervalStore(kv);
    await render(<Intervalo store={store} />);
    expect(screen.getByText('Cada 20 s')).toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button'));
    expect(screen.getByText('Cada 30 s')).toBeOnTheScreen();
    expect(store.get()).toBe(30);

    await act(() => {
      createRefreshIntervalStore(kv).set(15);
    });
    expect(screen.getByText('Cada 15 s')).toBeOnTheScreen();
  });
});
