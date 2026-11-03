// Pantalla Favoritos (tarea 4.9; brief `docs/briefs/05-favoritos.md`). Lista única en el orden
// guardado, pintada síncrona desde MMKV. Sin datos vivos ni arrastre todavía: ver los slots
// `liveData` y `dragHandle` de `FavoritoRow` y el README de la feature.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useRedSubte, usePullToRefresh } from '@/features/subtes/hooks';
import { invalidateRealtime } from '@/shared/api';
import { useRefreshInterval } from '@/shared/query';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Alert,
  Button,
  EmptyState,
  FreshnessLabel,
  SearchInput,
  SnackbarProvider,
  Text,
  useSnackbar,
} from '@/shared/ui';

import { AliasSheet } from './AliasSheet';
import { displayName, hrefFor } from './describe';
import { useEditMode } from './EditMode';
import { FavoritoItem } from './FavoritoItem';
import { useFavoritos } from './FavoritosProvider';
import type { FavoritoV1 } from './model';
import { filterFavoritos, SEARCH_THRESHOLD } from './search';
import { isServiceDown, type ServiceHealth } from './servicio';
import { resolveFavorito } from './subte';

/** Hasta que la lista informe qué filas se ven, se consideran visibles las primeras. */
export const INITIAL_VISIBLE = 10;
const VIEWABILITY = { itemVisiblePercentThreshold: 1 } as const;

export const SERVICE_DOWN_MESSAGE = 'El servicio de la Ciudad no responde';

export const EMPTY_TITLE = 'Todavía no guardaste favoritos.';
export const EMPTY_MESSAGE = 'Tocá la estrella en una línea, parada o estación para tenerla acá.';

export function FavoritosScreen() {
  return (
    <SnackbarProvider>
      <FavoritosContent />
    </SnackbarProvider>
  );
}

function FavoritosContent() {
  const { space, colors } = useTheme();
  const router = useRouter();
  const snackbar = useSnackbar();
  const { favoritos, repository } = useFavoritos();
  const { editing, setEditing } = useEditMode();
  // El color de las insignias de subte y los huérfanos salen del estático (F4-favoritos-9).
  const { red } = useRedSubte();
  const queryClient = useQueryClient();
  const { seconds } = useRefreshInterval();
  // Pull to refresh: vuelve a pedir los datos en vivo (los estáticos no se tocan).
  const { refreshing, onRefresh } = usePullToRefresh([() => invalidateRealtime(queryClient)]);
  // Filas en pantalla (null = todavía no se sabe) y el dato más viejo de las que se ven.
  const [viewable, setViewable] = useState<ReadonlySet<string> | null>(null);
  const [stamps, setStamps] = useState<Readonly<Record<string, string>>>({});
  // Salud del dato vivo de cada fila visible: si todas fallan por un error reintentable, el servicio
  // está caído y se avisa una sola vez (en vez de una vez por fila).
  const [health, setHealth] = useState<Readonly<Record<string, ServiceHealth>>>({});
  const onHealth = useCallback((id: string, h: ServiceHealth | null) => {
    setHealth((prev) => {
      if (h === null) {
        if (!(id in prev)) return prev;
        return Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id));
      }
      return prev[id] === h ? prev : { ...prev, [id]: h };
    });
  }, []);
  const serviceDown = isServiceDown(health);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: readonly { key: string }[] }) => {
      setViewable(new Set(viewableItems.map((v) => v.key)));
    },
    [],
  );
  const onTimestamp = useCallback((id: string, ts: string | null) => {
    setStamps((prev) => {
      if (ts === null) {
        if (!(id in prev)) return prev;
        return Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id));
      }
      return prev[id] === ts ? prev : { ...prev, [id]: ts };
    });
  }, []);
  // La más vieja de las visibles (brief §3.4): si una fila está atrasada, la etiqueta lo dice.
  const oldest = useMemo(() => {
    const values = Object.values(stamps);
    if (values.length === 0) return null;
    return values.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
  }, [stamps]);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<FavoritoV1 | null>(null);

  // Sin favoritos no hay nada que editar: se sale solo del modo edición.
  const isEmpty = favoritos.length === 0;
  useEffect(() => {
    if (isEmpty && editing) setEditing(false);
  }, [isEmpty, editing, setEditing]);

  if (isEmpty) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg.base }]}>
        <EmptyState
          icon={<Icon name="favoritoOff" size={32} />}
          title={EMPTY_TITLE}
          message={EMPTY_MESSAGE}
        />
        <View style={[styles.emptyButtons, { gap: space[2], padding: space[3] }]}>
          <Button
            label="Ver subtes"
            variant="primary"
            onPress={() => {
              router.push('/subtes');
            }}
          />
          <Button
            label="Buscar colectivo"
            variant="secondary"
            onPress={() => {
              router.push('/colectivos');
            }}
          />
        </View>
      </View>
    );
  }

  const showSearch = favoritos.length > SEARCH_THRESHOLD;
  // La búsqueda solo vale si el campo está a la vista; se ignora si la lista vuelve a ser corta.
  const visible = showSearch ? filterFavoritos(favoritos, query) : favoritos;
  // Con filtro activo el orden manual no se toca: mover sobre una lista filtrada confunde.
  const canMove = query.trim() === '';

  const remove = (fav: FavoritoV1) => {
    const removed = repository.remove(fav.id);
    if (!removed) return;
    snackbar.show(`Quitaste «${displayName(removed)}».`, {
      action: {
        label: 'Deshacer',
        onPress: () => {
          repository.restore(removed);
        },
      },
    });
  };

  const move = (fav: FavoritoV1, delta: -1 | 1) => {
    const ids = favoritos.map((f) => f.id);
    const from = ids.indexOf(fav.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const moved = ids[from];
    const swapped = ids[to];
    if (moved === undefined || swapped === undefined) return;
    ids[from] = swapped;
    ids[to] = moved;
    repository.reorder(ids);
  };

  // Encabezado de la lista: Alert de servicio caído, búsqueda y frescura (las filas no dependen de él).
  const showHeader = showSearch || oldest !== null || serviceDown;
  const listHeader = showHeader ? (
    <View style={{ gap: space[2], marginBottom: space[2] }}>
      {serviceDown ? (
        <Alert
          role="danger"
          message={SERVICE_DOWN_MESSAGE}
          icon={<Icon name="error" size={24} color={colors.role.danger.text} />}
          action={{
            label: 'Reintentar',
            onPress: () => {
              void invalidateRealtime(queryClient);
            },
          }}
        />
      ) : null}
      {showSearch ? (
        <SearchInput
          value={query}
          onChangeText={setQuery}
          label="Buscar en favoritos"
          placeholder="Buscar en favoritos"
          icon={<Icon name="buscar" size={16} />}
          clearIcon={<Icon name="limpiarBusqueda" size={20} />}
        />
      ) : null}
      {oldest !== null ? (
        <FreshnessLabel sourceTimestamp={oldest} intervalSeconds={seconds} />
      ) : null}
    </View>
  ) : undefined;

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg.base }]}>
      {/* 4.9-drag: high-dev reemplaza este FlatList por la lista con arrastre. */}
      <FlatList
        testID="favoritos-lista"
        data={visible}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        initialNumToRender={20}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space[3], gap: space[2] }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text tone="secondary" style={styles.noResults}>
            {`No encontramos favoritos con «${query.trim()}».`}
          </Text>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        viewabilityConfig={VIEWABILITY}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item, index }) => {
          const resolved = resolveFavorito(item, red);
          return (
            <FavoritoItem
              favorito={item}
              visible={viewable === null ? index < INITIAL_VISIBLE : viewable.has(item.id)}
              onTimestamp={onTimestamp}
              onHealth={onHealth}
              subteBadge={resolved.badge}
              orphan={resolved.orphan}
              editing={editing}
              isFirst={!canMove || index === 0}
              isLast={!canMove || index === visible.length - 1}
              onOpen={() => {
                router.push(hrefFor(item));
              }}
              onRename={() => {
                setRenaming(item);
              }}
              onRemove={() => {
                remove(item);
              }}
              onMoveUp={() => {
                move(item, -1);
              }}
              onMoveDown={() => {
                move(item, 1);
              }}
            />
          );
        }}
      />
      <AliasSheet
        favorito={renaming}
        onCancel={() => {
          setRenaming(null);
        }}
        onSave={(id, alias) => {
          repository.setAlias(id, alias);
          setRenaming(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyButtons: { alignItems: 'center' },
  noResults: { textAlign: 'center', padding: 16 },
});
