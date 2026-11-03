// Integración de la base de la app (tarea 3.11): providers reales (tema + favoritos sobre un
// `MemoryKeyValueStore`), stores de preferencias, favoritos de punta a punta y componentes
// compartidos dentro de un tema oscuro.
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { renderRouter, screen as routerScreen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import TabsLayout from '@/app/(tabs)/_layout';
import InicioLayout from '@/app/(tabs)/inicio/_layout';
import InicioScreen from '@/app/(tabs)/inicio/index';
import {
  ALIAS_MAX_LENGTH,
  FavoritosProvider,
  MmkvFavoritosRepository,
  useFavoritos,
} from '@/features/favoritos';
import { MemoryKeyValueStore } from '@/shared/storage/kv';

import { createHarness, defaultRoutes } from './subtes/fixtures';
import { THEME_PREFERENCE_KEY, createThemePreferenceStore } from '@/shared/storage/preferences';
import { schemes, ThemeProvider, useTheme, type ThemePreferenceStore } from '@/shared/theme';
import { FreshnessLabel, OFFLINE_MESSAGE, OfflineBanner } from '@/shared/ui';

function AppProviders({
  kv,
  themeStore,
  children,
}: {
  kv: MemoryKeyValueStore;
  themeStore?: ThemePreferenceStore;
  children: ReactNode;
}) {
  return (
    <ThemeProvider store={themeStore ?? createThemePreferenceStore(kv)}>
      <FavoritosProvider repository={new MmkvFavoritosRepository(kv)}>{children}</FavoritosProvider>
    </ThemeProvider>
  );
}

describe('arranque', () => {
  it('con los providers (tema, datos, favoritos) renderiza la tab Inicio', async () => {
    // Cliente del proxy con `fetch` mockeado (test/subtes/fixtures): Inicio pide estado y estático.
    const { Wrapper } = createHarness(defaultRoutes());
    await renderRouter(
      {
        '(tabs)/_layout': TabsLayout,
        '(tabs)/inicio/_layout': InicioLayout,
        '(tabs)/inicio/index': InicioScreen,
      },
      {
        initialUrl: '/inicio',
        wrapper: Wrapper,
      },
    );
    expect(
      await routerScreen.findByText('Subte ahora', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      await routerScreen.findByTestId('subte-ahora-A', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(routerScreen).toHavePathname('/inicio');
  });
});

describe('preferencia de tema', () => {
  function Esquema() {
    const theme = useTheme();
    const { scheme } = theme;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          theme.setPreference('dark');
        }}
      >
        <Text>{`Esquema ${scheme}`}</Text>
      </Pressable>
    );
  }

  it('al elegir Oscuro cambia useTheme().scheme y queda guardado', async () => {
    const kv = new MemoryKeyValueStore();
    await render(
      <AppProviders kv={kv} themeStore={createThemePreferenceStore(kv)}>
        <Esquema />
      </AppProviders>,
    );
    // jest-expo responde 'light' en useColorScheme: con 'system' el esquema es claro.
    expect(screen.getByText('Esquema light')).toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button'));
    expect(screen.getByText('Esquema dark')).toBeOnTheScreen();
    expect(kv.getString(THEME_PREFERENCE_KEY)).toBe('"dark"');
    // Al "reiniciar" la app con el mismo almacenamiento, arranca en oscuro.
    expect(createThemePreferenceStore(kv).get()).toBe('dark');
  });
});

describe('favoritos de punta a punta', () => {
  function Lista() {
    const { favoritos } = useFavoritos();
    return <Text testID="lista">{favoritos.map((f) => f.alias ?? f.nombre).join(' | ')}</Text>;
  }

  it('add → lista; alias de 31 caracteres se trunca a 30; remove + restore', async () => {
    const kv = new MemoryKeyValueStore();
    const repo = new MmkvFavoritosRepository(kv);
    await render(
      <ThemeProvider>
        <FavoritosProvider repository={repo}>
          <Lista />
        </FavoritosProvider>
      </ThemeProvider>,
    );
    const lista = () => screen.getByTestId('lista');

    let id = '';
    await act(() => {
      id = repo.add({ tipo: 'linea_subte', refId: 'LineaD', nombre: 'Línea D' }).id;
      repo.add({ tipo: 'parada_colectivo', refId: '77', nombre: 'Plaza Italia' });
    });
    expect(lista()).toHaveTextContent('Línea D | Plaza Italia');

    const alias31 = 'a'.repeat(ALIAS_MAX_LENGTH + 1);
    await act(() => {
      repo.setAlias(id, alias31);
    });
    expect(repo.get(id)?.alias).toBe('a'.repeat(ALIAS_MAX_LENGTH));
    expect(lista()).toHaveTextContent(`${'a'.repeat(30)} | Plaza Italia`);

    let quitado: ReturnType<typeof repo.remove>;
    await act(() => {
      quitado = repo.remove(id);
    });
    expect(lista()).toHaveTextContent('Plaza Italia');
    await act(() => {
      if (quitado) repo.restore(quitado);
    });
    expect(lista()).toHaveTextContent(`${'a'.repeat(30)} | Plaza Italia`);
  });
});

describe('componentes en tema oscuro', () => {
  const T0 = Date.parse('2026-11-02T12:00:00Z');

  it('FreshnessLabel con dato viejo usa el warning del esquema oscuro', async () => {
    const kv = new MemoryKeyValueStore({ [THEME_PREFERENCE_KEY]: '"dark"' });
    // 4 min > 3·R (R = 20 s): dato viejo.
    const ts = new Date(T0 - 4 * 60_000).toISOString();
    await render(
      <AppProviders kv={kv}>
        <FreshnessLabel sourceTimestamp={ts} now={() => T0} />
      </AppProviders>,
    );
    const label = screen.getByText('⚠ Dato de hace 4 min');
    expect(label).toHaveStyle({ color: schemes.dark.role.warning.text });
    expect(schemes.dark.role.warning.text).not.toBe(schemes.light.role.warning.text);
  });

  it('OfflineBanner se muestra y se oculta', async () => {
    const kv = new MemoryKeyValueStore({ [THEME_PREFERENCE_KEY]: '"dark"' });
    const view = await render(
      <AppProviders kv={kv}>
        <OfflineBanner visible />
      </AppProviders>,
    );
    // `getByRole('alert')` no lo encuentra: el View tiene `accessibilityRole="alert"` pero no
    // `accessible`, y RNTL (como el lector de pantalla) solo expone roles de elementos accesibles.
    // Reportado al coordinador; acá se busca por texto.
    expect(screen.getByText(OFFLINE_MESSAGE)).toBeOnTheScreen();
    expect(screen.getByText(OFFLINE_MESSAGE)).toHaveStyle({ color: schemes.dark.role.warning.on });

    await view.rerender(
      <AppProviders kv={kv}>
        <OfflineBanner visible={false} />
      </AppProviders>,
    );
    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
  });
});
