// Raíz del tab Subtes (brief 03-subtes §3): 7 líneas con su estado, búsqueda local de las 108
// estaciones y acceso al mapa. Estados en README.md ("Brief operativo").
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useRefreshInterval } from '@/shared/query';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Button,
  EmptyState,
  ErrorState,
  FreshnessLabel,
  SearchInput,
  Skeleton,
  SkeletonGroup,
  STATUS,
  Text,
} from '@/shared/ui';

import { EstadoChip, FilaTocable, LineaBadge, RefreshErrorAlert, ScreenScroll } from './components';
import { useLineasConEstado, usePullToRefresh, type LineaConEstado } from './hooks';
import { buscarEstaciones, type EstacionSubte, type RedSubte } from './model';

export function SubtesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { seconds } = useRefreshInterval();
  const { lineas, estado, red } = useLineasConEstado();
  const [consulta, setConsulta] = useState('');
  const { refreshing, onRefresh } = usePullToRefresh([() => estado.refetch()]);

  const buscando = consulta.trim() !== '';

  return (
    <>
      <Stack.Screen options={{ title: 'Subtes', headerLargeTitle: true }} />
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} testID="subtes-screen">
        <SearchInput
          value={consulta}
          onChangeText={setConsulta}
          onClear={() => {
            setConsulta('');
          }}
          label="Buscá una estación"
          placeholder="Buscá una estación"
          icon={<Icon name="buscar" size={20} color={colors.text.secondary} />}
          clearIcon={<Icon name="limpiarBusqueda" size={20} color={colors.text.secondary} />}
        />

        {buscando ? (
          <Resultados red={red.red} consulta={consulta} />
        ) : (
          <>
            <Button
              label="Ver mapa"
              variant="secondary"
              outline
              size="md"
              icon={<Icon name="mapa" size={20} color={colors.role.secondary.text} />}
              onPress={() => {
                router.push('/subtes/mapa');
              }}
            />
            {estado.isRefreshError ? (
              <RefreshErrorAlert onRetry={() => void estado.refetch()} />
            ) : null}
            {red.isLoadingError ? (
              <ErrorState
                {...messageOf(red.error)}
                retryable={red.error?.retryable ?? true}
                onRetry={() => void red.refetch()}
              />
            ) : lineas === undefined || (estado.isPending && !estado.isLoadingError) ? (
              <FilasSkeleton />
            ) : (
              <>
                {estado.isLoadingError ? (
                  <ErrorState
                    {...messageOf(estado.error)}
                    retryable={estado.error?.retryable ?? true}
                    onRetry={() => void estado.refetch()}
                  />
                ) : null}
                <View style={{ gap: 8 }} accessibilityRole="list">
                  {lineas.map((item) => (
                    <LineaRow
                      key={item.linea.key}
                      item={item}
                      onPress={() => {
                        router.push({
                          pathname: '/subtes/[linea]',
                          params: { linea: item.linea.key },
                        });
                      }}
                    />
                  ))}
                </View>
                {estado.data !== undefined ? (
                  <FreshnessLabel
                    sourceTimestamp={estado.sourceTimestamp}
                    intervalSeconds={seconds}
                  />
                ) : null}
              </>
            )}
          </>
        )}
      </ScreenScroll>
    </>
  );
}

function messageOf(error: { userMessage(): { title: string; cause: string | null } } | null) {
  const m = error?.userMessage() ?? { title: 'Algo falló de nuestro lado.', cause: null };
  return { title: m.title, cause: m.cause ?? 'Probá de nuevo en un rato.' };
}

function LineaRow({ item, onPress }: { item: LineaConEstado; onPress: () => void }) {
  const { linea, estado, resumen } = item;
  const label = [`${linea.nombre}, ${STATUS[estado].label.toLowerCase()}`, linea.cabeceras, resumen]
    .filter((x) => x !== undefined && x !== '')
    .join('. ');
  return (
    <FilaTocable onPress={onPress} accessibilityLabel={label} testID={`linea-${linea.key}`}>
      <LineaBadge linea={linea} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="headline.sm">{linea.cabeceras}</Text>
        <EstadoChip estado={estado} />
        {resumen !== undefined && resumen !== '' ? (
          <Text variant="text.sm" tone="secondary" numberOfLines={1}>
            {resumen}
          </Text>
        ) : null}
      </View>
    </FilaTocable>
  );
}

function FilasSkeleton() {
  return (
    <SkeletonGroup accessibilityLabel="Cargando el estado de las líneas…" testID="subtes-skeleton">
      <View style={{ gap: 8 }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} height={72} radius={16} />
        ))}
      </View>
    </SkeletonGroup>
  );
}

function Resultados({ red, consulta }: { red: RedSubte | undefined; consulta: string }) {
  const router = useRouter();
  const resultados = useMemo(
    () => (red === undefined ? [] : buscarEstaciones(red.estaciones, consulta)),
    [red, consulta],
  );
  if (red === undefined) return <FilasSkeleton />;
  if (resultados.length === 0) {
    return (
      <EmptyState
        message={`No encontramos «${consulta.trim()}». Probá con otro nombre de estación.`}
      />
    );
  }
  return (
    <View style={{ gap: 8 }} accessibilityRole="list">
      {resultados.map((e) => (
        <EstacionResultado
          key={e.id}
          estacion={e}
          red={red}
          onPress={() => {
            router.push({ pathname: '/subtes/estacion/[id]', params: { id: e.id } });
          }}
        />
      ))}
    </View>
  );
}

function EstacionResultado({
  estacion,
  red,
  onPress,
}: {
  estacion: EstacionSubte;
  red: RedSubte;
  onPress: () => void;
}) {
  const linea = red.lineaPorKey.get(estacion.linea);
  return (
    <FilaTocable
      onPress={onPress}
      accessibilityLabel={`${estacion.nombre}, ${linea?.nombre ?? ''}`}
      testID={`resultado-${estacion.id}`}
    >
      {linea !== undefined ? <LineaBadge linea={linea} size="sm" /> : null}
      <Text variant="text.md" style={{ flex: 1 }}>
        {estacion.nombre}
      </Text>
    </FilaTocable>
  );
}
