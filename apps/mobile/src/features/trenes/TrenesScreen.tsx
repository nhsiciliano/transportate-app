// Raíz del tab Trenes con la dirección «Señalética de terminal» (Fase 6; contrato en
// `.impeccable/surfaces/src-features-trenes-trenesscreen-tsx.md`): el tablero de salidas de la red.
// Las 6 líneas en una sola placa con el estado alineado a la derecha y la frescura al pie; la
// búsqueda local de estaciones arriba. Sin mapa en esta fase (S34). Estados en README.md.
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { useRefreshInterval } from '@/shared/query';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Board, EmptyState, ErrorState, FreshnessLabel, SearchInput, STATUS } from '@/shared/ui';

import { LineaTrenBadge } from './components';
import {
  AvisoAlert,
  EstadoBoard,
  RefreshErrorAlert,
  ScreenScroll,
  tonoNota,
  useFondo,
  usePullToRefresh,
} from './deps';
import { useLineasTrenConEstado, type LineaTrenConEstado } from './hooks';
import { buscarEstacionesTren, detalleLinea, lineasDeEstacion, type RedTrenes } from './model';

/** Separación entre bloques (12 pt, como Inicio y Subtes). */
const GAP = 12;

/** La fuente comunitaria no responde y no hay estado de ninguna línea (S42). */
export const FUENTE_CAIDA = 'La fuente de datos de trenes no responde.';

export function TrenesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const fondo = useFondo();
  const { seconds } = useRefreshInterval();
  const { lineas, estado, red } = useLineasTrenConEstado();
  const [consulta, setConsulta] = useState('');
  const { refreshing, onRefresh } = usePullToRefresh([() => estado.refetch()]);
  const buscando = consulta.trim() !== '';
  // Respuesta 200 pero sin dato de ninguna línea (fuente caída sin caché o kill-switch).
  const sinFuente =
    estado.data !== undefined &&
    estado.data.lineas.length > 0 &&
    estado.data.lineas.every((l) => l.estado === 'sin_datos');

  return (
    <>
      <Stack.Screen options={{ title: 'Trenes', headerLargeTitleEnabled: true }} />
      <ScreenScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        testID="trenes-screen"
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
            {sinFuente ? (
              <AvisoAlert role="warning" message={FUENTE_CAIDA} testID="trenes-sin-fuente" />
            ) : null}
            {red.isLoadingError ? (
              <ErrorState
                {...messageOf(red.error)}
                retryable={red.error?.retryable ?? true}
                onRetry={() => void red.refetch()}
              />
            ) : lineas === undefined || (estado.isPending && !estado.isLoadingError) ? (
              <Board.Skeleton
                rows={6}
                accessibilityLabel="Cargando el estado de las líneas…"
                testID="trenes-skeleton"
              />
            ) : (
              <>
                {/* Sin estado ni caché: las filas en «Sin información» + ErrorState (S42). */}
                {estado.isLoadingError ? (
                  <ErrorState
                    {...messageOf(estado.error)}
                    retryable={estado.error?.retryable ?? true}
                    onRetry={() => void estado.refetch()}
                  />
                ) : null}
                <Board testID="trenes-lineas">
                  {lineas.map((item) => (
                    <LineaRow
                      key={item.linea.id}
                      item={item}
                      onPress={() => {
                        router.push({
                          pathname: '/trenes/[linea]',
                          params: { linea: item.linea.id },
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

function LineaRow({ item, onPress }: { item: LineaTrenConEstado; onPress: () => void }) {
  const { colors } = useTheme();
  const { linea, estado, resumen } = item;
  const detalle = detalleLinea(linea);
  const label = [`${linea.nombre}, ${STATUS[estado].label.toLowerCase()}`, detalle, resumen]
    .filter((x) => x !== undefined && x !== '')
    .join('. ');
  return (
    <Board.Row
      testID={`linea-${linea.id}`}
      leading={<LineaTrenBadge linea={linea} surface={colors.bg.card} />}
      title={linea.nombre}
      subtitle={detalle}
      note={
        resumen === undefined || resumen === ''
          ? undefined
          : { text: resumen, tone: tonoNota(estado) }
      }
      trailing={<EstadoBoard estado={estado} testID={`linea-${linea.id}-estado`} />}
      accessibilityLabel={label}
      onPress={onPress}
    />
  );
}

function Resultados({ red, consulta }: { red: RedTrenes | undefined; consulta: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const resultados = useMemo(
    () => (red === undefined ? [] : buscarEstacionesTren(red, consulta)),
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
    <Board testID="trenes-resultados">
      {resultados.map((e) => {
        const lineas = lineasDeEstacion(e, red);
        const nombres = lineas.map((l) => l.nombre).join(' · ');
        const [primera] = lineas;
        return (
          <Board.Row
            key={e.id}
            testID={`resultado-${e.id}`}
            leading={
              primera === undefined ? undefined : (
                <LineaTrenBadge linea={primera} size="sm" surface={colors.bg.card} />
              )
            }
            title={e.nombre}
            subtitle={nombres}
            accessibilityLabel={`${e.nombre}, ${nombres}`}
            onPress={() => {
              router.push({ pathname: '/trenes/estacion/[id]', params: { id: e.id } });
            }}
          />
        );
      })}
    </Board>
  );
}
