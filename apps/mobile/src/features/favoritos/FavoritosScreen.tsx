// Pantalla Favoritos (tarea 4.9; brief `docs/briefs/05-favoritos.md`). Desde la Fase 5, con la
// dirección «Señalética de terminal» (contrato en
// `.impeccable/surfaces/src-features-favoritos-favoritosscreen-tsx.md`): el tablero completo, una
// banda `next` por favorito con el mismo contenido que en Inicio, en el orden guardado (pintado
// síncrono desde MMKV). La edición conserva la forma de las bandas (manija, «Quitar», alias).
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import ReorderableList, {
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';

import type { EstadoServicioV1 } from '@transportate/contracts';

import { useRedSubte, usePullToRefresh } from '@/features/subtes/hooks';
import { estadoDeLinea } from '@/features/subtes/model';
import { useRedTrenes } from '@/features/trenes/hooks';
import { estadoDeEstacionTren } from '@/features/trenes/model';
import { invalidateRealtime, useEstadoSubtes, useEstadoTrenes } from '@/shared/api';
import { useRefreshInterval } from '@/shared/query';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Alert,
  Button,
  EmptyState,
  FreshnessLabel,
  SearchInput,
  signBandPalette,
  SnackbarProvider,
  Text,
  triggerHaptic,
  useReduceMotion,
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
  const { space, colors, scheme } = useTheme();
  // Fondo del mundo: `bg.elevated` (#edf4ff) en claro, `bg.base` en oscuro (como Inicio).
  const fondo = scheme === 'light' ? colors.bg.elevated : colors.bg.base;
  const reduceMotion = useReduceMotion(); // 4.9-drag
  const router = useRouter();
  const snackbar = useSnackbar();
  const { favoritos, repository } = useFavoritos();
  const { editing, setEditing } = useEditMode();
  // Estado de la línea de cada estación guardada (cuadrado ámbar/rojo en su banda). El estado del
  // subte solo se pide si hay alguna estación; el huérfano lo decide `useFavoritoLiveData`
  // (único criterio, F4-favoritos-7).
  const { red } = useRedSubte();
  const hayEstaciones = favoritos.some((f) => f.tipo === 'estacion_subte');
  const estadoSubte = useEstadoSubtes({ enabled: hayEstaciones });
  // Lo mismo para las estaciones de tren: el peor estado de los ramales que la sirven.
  const redTrenes = useRedTrenes().red;
  const hayTrenes = favoritos.some((f) => f.tipo === 'estacion_tren');
  const estadoTrenes = useEstadoTrenes({ enabled: hayTrenes });
  const estadoDeEstacion = (f: FavoritoV1): EstadoServicioV1 | undefined => {
    if (f.tipo === 'estacion_tren') {
      const estacion = redTrenes?.estacionPorId.get(f.refId);
      return estacion === undefined || estadoTrenes.data === undefined
        ? undefined
        : estadoDeEstacionTren(estacion, estadoTrenes.data);
    }
    if (f.tipo !== 'estacion_subte' || estadoSubte.data === undefined) return undefined;
    const key = red?.estacionPorId.get(f.refId)?.linea;
    const linea = key === undefined ? undefined : red?.lineaPorKey.get(key);
    return linea === undefined ? undefined : estadoDeLinea(linea, estadoSubte.data.lineas).estado;
  };
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
      // Scroll con `contentInsetAdjustmentBehavior`: así el estado vacío queda debajo del header
      // (large title) como el resto de los tabs, y entra con Dynamic Type grande.
      <ScrollView
        style={[styles.flex, { backgroundColor: fondo }]}
        contentContainerStyle={styles.emptyContent}
        contentInsetAdjustmentBehavior="automatic"
        testID="favoritos-vacio"
      >
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
      </ScrollView>
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

  // 4.9-drag: el orden que queda al soltar se guarda igual que "Mover arriba / abajo".
  const dragEnabled = editing && canMove;
  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const ids = visible.map((f) => f.id);
    const [moved] = ids.splice(from, 1);
    if (moved === undefined || from === to) return;
    ids.splice(to, 0, moved);
    repository.reorder(ids);
  };

  return (
    <>
      {/* 4.9-drag: lista con arrastre (react-native-reorderable-list). Solo en edición y sin filtro;
          la alternativa sin gesto son las acciones "Mover arriba / abajo" de cada fila. */}
      {/* La lista es la raíz de la pantalla (sin View ni GestureHandlerRootView alrededor):
          el large title de iOS colapsa con el primer scroll que encuentra y los insets del header
          los pone `contentInsetAdjustmentBehavior`. La raíz de RNGH ya está en `app/_layout.tsx`. */}
      <ReorderableList
        testID="favoritos-lista"
        style={[styles.flex, { backgroundColor: fondo }]}
        dragEnabled={dragEnabled}
        onReorder={onReorder}
        onDragStart={onDragHaptic}
        onDragEnd={onDragHaptic}
        // Reducir movimiento: las filas se reacomodan sin animar.
        animationDuration={reduceMotion ? 0 : REORDER_ANIMATION_MS}
        // La librería pide un array mutable; `visible` es de solo lectura.
        data={[...visible]}
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
          return (
            <FavoritoItem
              favorito={item}
              visible={viewable === null ? index < INITIAL_VISIBLE : viewable.has(item.id)}
              onTimestamp={onTimestamp}
              onHealth={onHealth}
              estadoLinea={estadoDeEstacion(item)}
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
              {...(dragEnabled ? { dragHandle: <DragHandle /> } : {})}
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
    </>
  );
}

// ---------------------------------------------------------------- 4.9-drag

export const REORDER_ANIMATION_MS = 200;
export const DRAG_HANDLE_LABEL = 'Reordenar';

/** Háptico al levantar y al soltar una fila (corre en el hilo de UI: worklet). */
function onDragHaptic() {
  'worklet';
  scheduleOnRN(triggerHaptic, 'selection');
}

/** Manija de arrastre (44 × 44). Arranca el arrastre al apoyar el dedo. */
function DragHandle() {
  const drag = useReorderableDrag();
  const { component, colors, scheme } = useTheme();
  // En el color del texto de la banda `next` (la manija va dentro de la banda).
  const fg = signBandPalette(colors, scheme, 'next').foreground;
  return (
    <Pressable
      onPressIn={drag}
      accessibilityRole="button"
      accessibilityLabel={DRAG_HANDLE_LABEL}
      accessibilityHint="Mantené apretado y arrastrá. También podés usar las acciones Mover arriba y Mover abajo."
      style={[styles.handle, { width: component.hitSlop, height: component.hitSlop }]}
      testID="favorito-drag-handle"
    >
      <Icon name="reordenar" size={24} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  emptyButtons: { alignItems: 'center' },
  noResults: { textAlign: 'center', padding: 16 },
});
