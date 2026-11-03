// Pantalla Favoritos (tarea 4.9; brief `docs/briefs/05-favoritos.md`). Lista única en el orden
// guardado, pintada síncrona desde MMKV. Sin datos vivos ni arrastre todavía: ver los slots
// `liveData` y `dragHandle` de `FavoritoRow` y el README de la feature.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useRedSubte } from '@/features/subtes/hooks';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Button, EmptyState, SearchInput, SnackbarProvider, Text, useSnackbar } from '@/shared/ui';

import { AliasSheet } from './AliasSheet';
import { displayName, hrefFor } from './describe';
import { useEditMode } from './EditMode';
import { FavoritoRow } from './FavoritoRow';
import { useFavoritos } from './FavoritosProvider';
import type { FavoritoV1 } from './model';
import { filterFavoritos, SEARCH_THRESHOLD } from './search';
import { resolveFavorito } from './subte';

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

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg.base }]}>
      {/* 4.9-drag: high-dev reemplaza este FlatList por la lista con arrastre. */}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        initialNumToRender={20}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space[3], gap: space[2] }}
        ListHeaderComponent={
          showSearch ? (
            <SearchInput
              value={query}
              onChangeText={setQuery}
              label="Buscar en favoritos"
              placeholder="Buscar en favoritos"
              icon={<Icon name="buscar" size={16} />}
              clearIcon={<Icon name="limpiarBusqueda" size={20} />}
              style={{ marginBottom: space[2] }}
            />
          ) : undefined
        }
        ListEmptyComponent={
          <Text tone="secondary" style={styles.noResults}>
            {`No encontramos favoritos con «${query.trim()}».`}
          </Text>
        }
        renderItem={({ item, index }) => {
          const resolved = resolveFavorito(item, red);
          return (
            <FavoritoRow
              favorito={item}
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
