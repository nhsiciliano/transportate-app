// Detalle de línea de tren («Señalética de terminal», Fase 6): banda fija con el estado de la línea
// (sin flecha: ya estás ahí), las alertas de la línea que no apuntan a un ramal y la placa de
// ramales, cada uno con su estado. **Sin estrella**: en trenes se guarda el ramal o la estación,
// nunca la línea (S37).
import type { EstadoServicioV1 } from '@transportate/contracts';
import { Stack, useRouter } from 'expo-router';

import { useRefreshInterval } from '@/shared/query';
import {
  Board,
  EmptyState,
  ErrorState,
  FreshnessLabel,
  SignBand,
  Skeleton,
  SkeletonGroup,
  STATUS,
  Text,
} from '@/shared/ui';

import { AlertaTren } from './components';
import {
  EstadoBoard,
  estadoBanda,
  RefreshErrorAlert,
  Rotulo,
  ScreenScroll,
  useFondo,
  usePullToRefresh,
} from './deps';
import { useLineaTrenDetalle } from './hooks';
import { estadoDeRamal, isLineaTrenId, nombreLinea, type RamalTren } from './model';

export function LineaTrenScreen({ lineaParam }: { lineaParam: string | undefined }) {
  const router = useRouter();
  const fondo = useFondo();
  const { seconds } = useRefreshInterval();
  const { red, lineaId, linea, estado, estadoLinea, alertas, alertasLinea } =
    useLineaTrenDetalle(lineaParam);
  const { refreshing, onRefresh } = usePullToRefresh([
    () => estado.refetch(),
    () => alertas.refetch(),
  ]);
  const title = lineaId === undefined ? 'Línea' : nombreLinea(lineaId);

  let body;
  if (lineaParam === undefined || !isLineaTrenId(lineaParam)) {
    body = (
      <EmptyState
        title="No encontramos esta línea"
        message="Volvé a Trenes y elegí una de la lista."
      />
    );
  } else if (red.isLoadingError) {
    const m = red.error?.userMessage();
    body = (
      <ErrorState
        title={m?.title ?? 'Algo falló de nuestro lado.'}
        cause={m?.cause ?? 'Probá de nuevo en un rato.'}
        retryable={red.error?.retryable ?? true}
        onRetry={() => void red.refetch()}
      />
    );
  } else if (red.red === undefined) {
    body = <LineaSkeleton />;
  } else if (linea === undefined) {
    body = (
      <EmptyState
        title="No encontramos esta línea"
        message="Volvé a Trenes y elegí una de la lista."
      />
    );
  } else {
    const e = estadoLinea?.estado ?? 'sin_datos';
    const n = linea.ramales.length;
    const ramales = n === 1 ? '1 ramal' : `${n} ramales`;
    const valor = estado.isPending ? null : STATUS[e].label;
    body = (
      <>
        <SignBand
          testID="linea-banda"
          variant="lead"
          icon="tren"
          message={`${linea.nombre} · ${ramales}`}
          value={valor}
          valueStyle="text"
          status={estadoBanda(e, estadoLinea?.resumen ?? STATUS[e].label)}
          transitionKey={estado.isPending ? undefined : e}
          accessibilityLabel={[
            `${linea.nombre}, ${ramales}`,
            estado.isPending ? 'cargando el estado' : `Estado: ${STATUS[e].label.toLowerCase()}`,
            estadoLinea?.resumen,
          ]
            .filter((x) => x !== undefined && x !== '')
            .join('. ')}
        />

        {estado.isRefreshError || alertas.isRefreshError ? (
          <RefreshErrorAlert onRetry={onRefresh} />
        ) : null}

        <Rotulo>Alertas</Rotulo>
        {alertas.isPending ? (
          <SkeletonGroup accessibilityLabel="Cargando las alertas…">
            <Skeleton height={64} radius={6} />
          </SkeletonGroup>
        ) : alertas.isLoadingError ? (
          <ErrorState
            title={alertas.error?.userMessage().title ?? 'Servicio no disponible'}
            cause={alertas.error?.userMessage().cause ?? 'Probá de nuevo en un rato.'}
            retryable={alertas.error?.retryable ?? true}
            onRetry={() => void alertas.refetch()}
          />
        ) : alertasLinea.length === 0 ? (
          <Text variant="text.md" tone="secondary" testID="sin-novedades">
            Sin novedades informadas
          </Text>
        ) : (
          alertasLinea.map((a) => <AlertaTren key={a.id} alerta={a} estado={e} />)
        )}

        <Board label="Ramales" testID="linea-ramales">
          {linea.ramales.map((r) => (
            <RamalRow
              key={r.id}
              ramal={r}
              estado={estadoDeRamal(r.id, estado.data)}
              onPress={() => {
                router.push({ pathname: '/trenes/ramal/[id]', params: { id: r.id } });
              }}
            />
          ))}
        </Board>
        {estado.data !== undefined ? (
          <FreshnessLabel sourceTimestamp={estado.sourceTimestamp} intervalSeconds={seconds} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScreenScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        testID="linea-tren-screen"
        backgroundColor={fondo}
        gap={12}
      >
        {body}
      </ScreenScroll>
    </>
  );
}

/** «Once – Moreno» con las cabeceras (o la cantidad de estaciones si el nombre ya las dice). */
function RamalRow({
  ramal,
  estado,
  onPress,
}: {
  ramal: RamalTren;
  estado: EstadoServicioV1;
  onPress: () => void;
}) {
  const repite = ramal.cabeceras === ramal.nombreVisible;
  const subtitulo = repite ? `${ramal.estacionIds.length} estaciones` : ramal.cabeceras;
  return (
    <Board.Row
      testID={`ramal-${ramal.id}`}
      title={ramal.nombreVisible}
      subtitle={subtitulo}
      trailing={<EstadoBoard estado={estado} testID={`ramal-${ramal.id}-estado`} />}
      accessibilityLabel={`Ramal ${ramal.nombreVisible}, ${STATUS[estado].label.toLowerCase()}. ${subtitulo}`}
      onPress={onPress}
    />
  );
}

/** Silueta de la línea: la banda del estado y la placa de ramales. */
function LineaSkeleton() {
  return (
    <SkeletonGroup
      accessibilityLabel="Cargando la línea…"
      testID="linea-skeleton"
      style={{ gap: 12 }}
    >
      <SignBand.Skeleton variant="lead" />
      <Board.Skeleton rows={4} />
    </SkeletonGroup>
  );
}
