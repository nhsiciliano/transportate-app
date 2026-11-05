// Detalle de ramal («Señalética de terminal», Fase 6): la unidad que se guarda (S37). Banda fija
// con el estado del ramal, la estrella en el header nativo, las alertas del ramal (las de un
// sentido dicen «Hacia Moreno», S39) y de su línea, y las estaciones en orden de recorrido con el
// trazo del color de la línea. Cada estación abre sus arribos.
import { Stack, useRouter } from 'expo-router';

import { FavoriteToggle } from '@/features/favoritos';
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

import { AlertaTren, RIEL, Riel } from './components';
import {
  estadoBanda,
  RefreshErrorAlert,
  Rotulo,
  ScreenScroll,
  useFondo,
  usePullToRefresh,
} from './deps';
import { useRamalDetalle } from './hooks';
import { sentidoDeAlerta, type LineaTren, type RamalTren, type RedTrenes } from './model';

/** Estación que figura en el ramal pero no opera en él (brief §3, «Estación sin servicio»). */
export const SIN_SERVICIO_RAMAL = 'Sin servicio en este ramal';

export function RamalScreen({ id }: { id: string | undefined }) {
  const fondo = useFondo();
  const { seconds } = useRefreshInterval();
  const { red, ramal, linea, estado, estadoRamal, alertas, alertasRamal } = useRamalDetalle(id);
  const { refreshing, onRefresh } = usePullToRefresh([
    () => estado.refetch(),
    () => alertas.refetch(),
  ]);
  const title = ramal === undefined ? 'Ramal' : ramal.nombreVisible;

  let body;
  if (red.isLoadingError) {
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
    body = (
      <SkeletonGroup
        accessibilityLabel="Cargando el ramal…"
        testID="ramal-skeleton"
        style={{ gap: 12 }}
      >
        <SignBand.Skeleton variant="lead" />
        <Board.Skeleton rows={6} />
      </SkeletonGroup>
    );
  } else if (ramal === undefined || linea === undefined) {
    body = (
      <EmptyState
        title="No encontramos este ramal"
        message="Volvé a Trenes y elegilo desde su línea."
      />
    );
  } else {
    const e = estadoRamal ?? 'sin_datos';
    const n = alertasRamal.length;
    const cuantas = n === 0 ? STATUS[e].label : n === 1 ? '1 alerta' : `${n} alertas`;
    body = (
      <>
        <SignBand
          testID="ramal-banda"
          variant="lead"
          icon="tren"
          message={`${ramal.nombreVisible} · ${linea.nombre}`}
          value={estado.isPending ? null : STATUS[e].label}
          valueStyle="text"
          status={estadoBanda(e, cuantas)}
          transitionKey={estado.isPending ? undefined : e}
          accessibilityLabel={[
            `Ramal ${ramal.nombreVisible}, ${linea.nombre}`,
            estado.isPending ? 'cargando el estado' : `Estado: ${STATUS[e].label.toLowerCase()}`,
            n > 0 ? cuantas : undefined,
          ]
            .filter((x) => x !== undefined)
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
        ) : n === 0 ? (
          <Text variant="text.md" tone="secondary" testID="sin-novedades">
            Sin novedades informadas
          </Text>
        ) : (
          alertasRamal.map((a) => (
            <AlertaTren
              key={a.id}
              alerta={a}
              estado={e}
              sentido={a.ramalId === ramal.id ? sentidoDeAlerta(a, ramal) : undefined}
            />
          ))
        )}

        <Estaciones ramal={ramal} linea={linea} red={red.red} />
        {estado.data !== undefined ? (
          <FreshnessLabel sourceTimestamp={estado.sourceTimestamp} intervalSeconds={seconds} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title,
          // La estrella vive en el header nativo (44×44). Se guarda el ramal, nunca la línea.
          ...(ramal === undefined || linea === undefined
            ? {}
            : {
                headerRight: () => (
                  <FavoriteToggle
                    tipo="ramal_tren"
                    refId={ramal.id}
                    nombre={ramal.nombreVisible}
                    subtitulo={linea.nombre}
                  />
                ),
              }),
        }}
      />
      <ScreenScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        testID="ramal-screen"
        backgroundColor={fondo}
        gap={12}
      >
        {body}
      </ScreenScroll>
    </>
  );
}

/**
 * Estaciones en orden de recorrido, en una placa con el trazo del color de la línea (continuo
 * entre filas: el separador arranca después del riel). Las que no operan en este ramal no abren.
 */
function Estaciones({ ramal, linea, red }: { ramal: RamalTren; linea: LineaTren; red: RedTrenes }) {
  const router = useRouter();
  const total = ramal.estacionIds.length;
  return (
    <Board label="Estaciones" separatorInset={12 + RIEL + 12} testID="ramal-estaciones">
      {ramal.estacionIds.map((id, i) => {
        const estacion = red.estacionPorId.get(id);
        const nombre = estacion?.nombre ?? id;
        const opera = estacion !== undefined && estacion.ramalIds.includes(ramal.id);
        return (
          <Board.Row
            key={id}
            testID={`estacion-${id}`}
            leading={
              <Riel
                color={linea.color}
                primera={i === 0}
                ultima={i === total - 1}
                apagada={!opera}
              />
            }
            title={nombre}
            subtitle={opera ? undefined : SIN_SERVICIO_RAMAL}
            accessibilityLabel={opera ? nombre : `${nombre}, ${SIN_SERVICIO_RAMAL.toLowerCase()}`}
            onPress={
              opera
                ? () => {
                    router.push({ pathname: '/trenes/estacion/[id]', params: { id } });
                  }
                : undefined
            }
          />
        );
      })}
    </Board>
  );
}
