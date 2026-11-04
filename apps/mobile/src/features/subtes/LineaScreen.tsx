// Detalle de línea con la dirección «Señalética de terminal» (Fase 5): arriba una banda fija con
// el estado de la línea (se vuelve a señalizar con fundido si cambia), la estrella en el header
// nativo, las alertas completas y las estaciones en una placa con el trazo del color de la línea.
import type { AlertaV1 } from '@transportate/contracts';
import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { FavoriteToggle } from '@/features/favoritos';
import { useRefreshInterval } from '@/shared/query';
import { useTheme } from '@/shared/theme';
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

import {
  AvisoAlert,
  estadoBanda,
  RefreshErrorAlert,
  Rotulo,
  ScreenScroll,
  useFondo,
} from './components';
import { useLineaDetalle, usePullToRefresh } from './hooks';
import { isLineaKey, nombreLinea, periodoAlerta, type LineaSubte, type RedSubte } from './model';

/** Ancho del riel (trazo + punto) a la izquierda de cada estación. */
const RIEL = 24;

export function LineaScreen({ lineaParam }: { lineaParam: string | undefined }) {
  const key = lineaParam !== undefined && isLineaKey(lineaParam) ? lineaParam : undefined;
  const { red, linea, estado, estadoLinea, alertas, alertasLinea } = useLineaDetalle(key);
  const { seconds } = useRefreshInterval();
  const { refreshing, onRefresh } = usePullToRefresh([
    () => estado.refetch(),
    () => alertas.refetch(),
  ]);
  const title = key === undefined ? 'Línea' : nombreLinea(key);

  let body;
  if (key === undefined) {
    body = (
      <EmptyState
        title="No encontramos esta línea"
        message="Volvé a Subtes y elegí una de la lista."
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
  } else if (linea === undefined || red.red === undefined) {
    body = <LineaSkeleton />;
  } else {
    const alertasError = alertas.isLoadingError;
    const e = estadoLinea?.estado ?? 'sin_datos';
    const n = alertasLinea.length;
    const cuantas = n === 0 ? STATUS[e].label : n === 1 ? '1 alerta' : `${n} alertas`;
    body = (
      <>
        <SignBand
          testID="linea-banda"
          variant="lead"
          icon="subtes"
          message={`${linea.nombre} · ${linea.cabeceras}`}
          value={estado.isPending ? null : STATUS[e].label}
          valueStyle="text"
          status={estadoBanda(e, cuantas)}
          transitionKey={estado.isPending ? undefined : e}
          accessibilityLabel={[
            `${linea.nombre}, ${linea.cabeceras}`,
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
        ) : alertasError ? (
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
          alertasLinea.map((a) => (
            <AlertaCompleta
              key={a.id}
              alerta={a}
              interrumpida={estadoLinea?.estado === 'interrumpida'}
            />
          ))
        )}
        {alertas.data !== undefined ? (
          <FreshnessLabel sourceTimestamp={alertas.sourceTimestamp} intervalSeconds={seconds} />
        ) : null}

        <Diagrama linea={linea} red={red.red} alertas={alertasLinea} />
      </>
    );
  }

  const fondo = useFondo();
  return (
    <>
      <Stack.Screen
        options={{
          title,
          // La estrella vive en el header nativo (44×44), no en el contenido.
          ...(linea === undefined
            ? {}
            : {
                headerRight: () => (
                  <FavoriteToggle
                    tipo="linea_subte"
                    refId={linea.key}
                    nombre={linea.nombre}
                    subtitulo={linea.cabeceras}
                  />
                ),
              }),
        }}
      />
      <ScreenScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        testID="linea-screen"
        backgroundColor={fondo}
        gap={12}
      >
        {body}
      </ScreenScroll>
    </>
  );
}

/** El título en negrita con el ícono; debajo, la descripción solo si agrega algo, y el período.
 *  GCBA suele mandar `header_text` y `description_text` iguales: el texto va una sola vez. */
function AlertaCompleta({ alerta, interrumpida }: { alerta: AlertaV1; interrumpida: boolean }) {
  const periodo = periodoAlerta(alerta);
  const titulo = alerta.titulo.trim();
  const descripcion = alerta.descripcion.trim();
  const texto =
    descripcion.toLocaleLowerCase('es') === titulo.toLocaleLowerCase('es') ? '' : descripcion;
  const message = [texto, periodo].filter((x) => x !== undefined && x !== '').join('\n');
  return (
    <AvisoAlert
      role={interrumpida ? 'danger' : 'warning'}
      title={titulo}
      {...(message === '' ? {} : { message })}
      testID={`alerta-${alerta.id}`}
    />
  );
}

/**
 * Estaciones en orden de recorrido, en una placa: a la izquierda de cada fila, el trazo vertical
 * del color de la línea (continuo entre filas: el separador arranca después del riel) con un
 * punto por estación. Cada fila abre la estación (flecha al borde).
 */
function Diagrama({
  linea,
  red,
  alertas,
}: {
  linea: LineaSubte;
  red: RedSubte;
  alertas: readonly AlertaV1[];
}) {
  const router = useRouter();
  const afectadas = new Set(alertas.flatMap((a) => a.estacionIds ?? []));
  const total = linea.estaciones.length;
  return (
    <Board label="Estaciones" separatorInset={12 + RIEL + 12} testID="linea-estaciones">
      {linea.estaciones.map((e, i) => {
        const estacion = red.estacionPorId.get(e.id);
        const nombre = estacion?.nombre ?? e.id;
        const afectada = afectadas.has(e.id);
        const ramalNuevo = e.ramal !== undefined && linea.estaciones[i - 1]?.ramal !== e.ramal;
        const primera = i === 0 || ramalNuevo;
        const ultima = i === total - 1 || linea.estaciones[i + 1]?.ramal !== e.ramal;
        return (
          <Board.Row
            key={e.id}
            testID={`estacion-${e.id}`}
            leading={<Riel color={linea.color} primera={primera} ultima={ultima} />}
            title={nombre}
            // Premetro: el ramal se nombra en la primera estación de cada uno.
            subtitle={ramalNuevo ? e.ramal : undefined}
            note={afectada ? { text: 'Con novedades', tone: 'warning' } : undefined}
            accessibilityLabel={[
              nombre,
              ramalNuevo ? e.ramal : undefined,
              afectada ? 'con novedades' : undefined,
            ]
              .filter((x) => x !== undefined)
              .join(', ')}
            onPress={() => {
              router.push({ pathname: '/subtes/estacion/[id]', params: { id: e.id } });
            }}
          />
        );
      })}
    </Board>
  );
}

/** Trazo del color de la línea (dato GTFS) a todo el alto de la fila, con el punto de la estación. */
function Riel({ color, primera, ultima }: { color: string; primera: boolean; ultima: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.riel} accessible={false} importantForAccessibility="no-hide-descendants">
      <View
        style={[
          styles.trazo,
          { backgroundColor: color, top: primera ? '50%' : 0, bottom: ultima ? '50%' : 0 },
        ]}
      />
      <View style={[styles.punto, { backgroundColor: colors.bg.card, borderColor: color }]}>
        <View style={[styles.puntoBorde, { borderColor: colors.text.primary }]} />
      </View>
    </View>
  );
}

/** Silueta de la línea: la banda del estado y la placa de estaciones. */
function LineaSkeleton() {
  return (
    <SkeletonGroup
      accessibilityLabel="Cargando la línea…"
      testID="linea-skeleton"
      style={{ gap: 12 }}
    >
      <SignBand.Skeleton variant="lead" />
      <Board.Skeleton rows={6} />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  riel: { width: RIEL, flex: 1, alignItems: 'center', justifyContent: 'center' },
  trazo: { position: 'absolute', width: 6, left: (RIEL - 6) / 2 },
  punto: { width: 16, height: 16, borderRadius: 8, borderWidth: 4 },
  puntoBorde: { position: 'absolute', inset: -5, borderRadius: 13, borderWidth: 1 },
});
