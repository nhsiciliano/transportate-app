// Raíz del tab Subtes con la dirección «Señalética de terminal» (Fase 5; contrato en
// `.impeccable/surfaces/src-features-subtes-subtesscreen-tsx.md`): el tablero de estado de la red.
// Las 7 líneas en una sola placa con el estado alineado a la derecha, la frescura y el acceso al
// mapa; la búsqueda local de las 108 estaciones arriba. Estados en README.md ("Brief operativo").
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { useRefreshInterval } from '@/shared/query';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Board,
  EmptyState,
  ErrorState,
  FreshnessLabel,
  LineBadge,
  Pictogram,
  SearchInput,
  STATUS,
} from '@/shared/ui';

import { EstadoBoard, RefreshErrorAlert, ScreenScroll, tonoNota, useFondo } from './components';
import { useLineasConEstado, usePullToRefresh, type LineaConEstado } from './hooks';
import { buscarEstaciones, type EstacionSubte, type LineaSubte, type RedSubte } from './model';

/** Separación entre bloques (12 pt, como Inicio). */
const GAP = 12;

export function SubtesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const fondo = useFondo();
  const { seconds } = useRefreshInterval();
  const { lineas, estado, red } = useLineasConEstado();
  const [consulta, setConsulta] = useState('');
  const { refreshing, onRefresh } = usePullToRefresh([() => estado.refetch()]);

  const buscando = consulta.trim() !== '';

  return (
    <>
      <Stack.Screen options={{ title: 'Subtes', headerLargeTitleEnabled: true }} />
      <ScreenScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        testID="subtes-screen"
        backgroundColor={fondo}
        gap={GAP}
      >
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
              <Board.Skeleton
                rows={7}
                layout="cards"
                accessibilityLabel="Cargando el estado de las líneas…"
                testID="subtes-skeleton"
              />
            ) : (
              <>
                {/* F4-subtes-4: sin estado ni caché, las 7 filas en "Sin información" + ErrorState. */}
                {estado.isLoadingError ? (
                  <ErrorState
                    {...messageOf(estado.error)}
                    retryable={estado.error?.retryable ?? true}
                    onRetry={() => void estado.refetch()}
                  />
                ) : null}
                {/* Una placa por línea (pedido del usuario, 2026-11-06), del mismo material. */}
                <Board layout="cards" testID="subtes-lineas">
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
                </Board>
                {estado.data !== undefined ? (
                  <FreshnessLabel
                    sourceTimestamp={estado.sourceTimestamp}
                    intervalSeconds={seconds}
                  />
                ) : null}
              </>
            )}
            <Board>
              <Board.Row
                testID="subtes-mapa"
                leading={<Pictogram icon="mapa" tone="board" size={32} />}
                title="Mapa de la red"
                accessibilityLabel="Mapa de la red"
                onPress={() => {
                  router.push('/subtes/mapa');
                }}
              />
            </Board>
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

/** Disco de la línea a 32 (`md`) sobre la placa: el borde se decide contra `bg.card`. */
function DiscoLinea({
  linea,
  size = 'md',
}: {
  linea: Pick<LineaSubte, 'badge' | 'color' | 'colorTexto' | 'nombre'>;
  size?: 'sm' | 'md';
}) {
  const { colors } = useTheme();
  return (
    <LineBadge
      kind="subte"
      label={linea.badge}
      color={linea.color}
      textColor={linea.colorTexto}
      size={size}
      surface={colors.bg.card}
      accessibilityLabel={linea.nombre}
    />
  );
}

function LineaRow({ item, onPress }: { item: LineaConEstado; onPress: () => void }) {
  const { linea, estado, resumen } = item;
  const label = [`${linea.nombre}, ${STATUS[estado].label.toLowerCase()}`, linea.cabeceras, resumen]
    .filter((x) => x !== undefined && x !== '')
    .join('. ');
  return (
    <Board.Row
      testID={`linea-${linea.key}`}
      leading={<DiscoLinea linea={linea} />}
      title={linea.nombre}
      subtitle={linea.cabeceras}
      note={
        resumen === undefined || resumen === ''
          ? undefined
          : { text: resumen, tone: tonoNota(estado) }
      }
      trailing={<EstadoBoard estado={estado} testID={`linea-${linea.key}-estado`} />}
      accessibilityLabel={label}
      onPress={onPress}
    />
  );
}

function Resultados({ red, consulta }: { red: RedSubte | undefined; consulta: string }) {
  const router = useRouter();
  const resultados = useMemo(
    () => (red === undefined ? [] : buscarEstaciones(red.estaciones, consulta)),
    [red, consulta],
  );
  if (red === undefined) {
    return <Board.Skeleton rows={3} accessibilityLabel="Cargando las estaciones…" />;
  }
  if (resultados.length === 0) {
    return (
      <EmptyState
        message={`No encontramos «${consulta.trim()}». Probá con otro nombre de estación.`}
      />
    );
  }
  return (
    <Board testID="subtes-resultados">
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
    </Board>
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
    <Board.Row
      testID={`resultado-${estacion.id}`}
      leading={linea === undefined ? undefined : <DiscoLinea linea={linea} size="sm" />}
      title={estacion.nombre}
      subtitle={linea?.nombre}
      accessibilityLabel={`${estacion.nombre}, ${linea?.nombre ?? ''}`}
      onPress={onPress}
    />
  );
}
