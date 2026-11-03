// Detalle de línea (brief 03-subtes §3): encabezado, alertas completas y estaciones en orden de
// recorrido con un diagrama vertical del color de la línea.
import type { AlertaV1 } from '@transportate/contracts';
import { Stack, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FavoriteToggle } from '@/features/favoritos';
import { Icon } from '@/shared/icons';
import { useRefreshInterval } from '@/shared/query';
import { useTheme } from '@/shared/theme';
import { EmptyState, ErrorState, FreshnessLabel, Skeleton, SkeletonGroup, Text } from '@/shared/ui';

import {
  AvisoAlert,
  EstadoChip,
  LineaBadge,
  RefreshErrorAlert,
  ScreenScroll,
  Seccion,
} from './components';
import { useLineaDetalle, usePullToRefresh } from './hooks';
import { isLineaKey, nombreLinea, periodoAlerta, type LineaSubte, type RedSubte } from './model';

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
    body = (
      <>
        <View style={styles.encabezado}>
          <LineaBadge linea={linea} size="lg" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="headline.lg" accessibilityRole="header">
              {linea.cabeceras}
            </Text>
            {estado.isPending ? (
              <Skeleton width={120} height={24} />
            ) : (
              <EstadoChip estado={estadoLinea?.estado ?? 'sin_datos'} testID="linea-estado" />
            )}
          </View>
          <FavoriteToggle
            tipo="linea_subte"
            refId={linea.key}
            nombre={linea.nombre}
            subtitulo={linea.cabeceras}
          />
        </View>

        {estado.isRefreshError || alertas.isRefreshError ? (
          <RefreshErrorAlert onRetry={onRefresh} />
        ) : null}

        <Seccion>Alertas</Seccion>
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

        <Seccion>Estaciones</Seccion>
        <Diagrama linea={linea} red={red.red} alertas={alertasLinea} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} testID="linea-screen">
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

/** Trazo vertical del color de la línea con un punto por estación; cada fila es tocable. */
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
  const { colors, space } = useTheme();
  const afectadas = new Set(alertas.flatMap((a) => a.estacionIds ?? []));
  const total = linea.estaciones.length;
  return (
    <View accessibilityRole="list">
      {linea.estaciones.map((e, i) => {
        const estacion = red.estacionPorId.get(e.id);
        const nombre = estacion?.nombre ?? e.id;
        const afectada = afectadas.has(e.id);
        const ramalNuevo = e.ramal !== undefined && linea.estaciones[i - 1]?.ramal !== e.ramal;
        const primera = i === 0 || ramalNuevo;
        const ultima = i === total - 1 || linea.estaciones[i + 1]?.ramal !== e.ramal;
        return (
          <View key={e.id}>
            {ramalNuevo ? (
              <Text variant="text.sm" tone="secondary" style={{ marginTop: space[3] }}>
                {e.ramal}
              </Text>
            ) : null}
            <PressableRow
              pressedColor={colors.bg.pressed}
              label={`${nombre}${afectada ? ', con novedades' : ''}`}
              testID={`estacion-${e.id}`}
              onPress={() => {
                router.push({ pathname: '/subtes/estacion/[id]', params: { id: e.id } });
              }}
            >
              <View style={styles.riel}>
                <View
                  style={[
                    styles.trazo,
                    {
                      backgroundColor: linea.color,
                      top: primera ? 22 : 0,
                      bottom: ultima ? 22 : 0,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.punto,
                    { backgroundColor: colors.bg.base, borderColor: linea.color },
                  ]}
                >
                  <View style={[styles.puntoBorde, { borderColor: colors.text.primary }]} />
                </View>
              </View>
              <Text variant="text.md" style={{ flex: 1 }}>
                {nombre}
              </Text>
              {afectada ? <Icon name="alerta" size={20} color={colors.role.warning.text} /> : null}
              <Icon name="chevron" size={24} color={colors.text.secondary} />
            </PressableRow>
          </View>
        );
      })}
    </View>
  );
}

function PressableRow({
  label,
  onPress,
  children,
  testID,
  pressedColor,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  testID: string;
  pressedColor: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fila, pressed ? { backgroundColor: pressedColor } : null]}
    >
      {children}
    </Pressable>
  );
}

function LineaSkeleton() {
  return (
    <SkeletonGroup accessibilityLabel="Cargando la línea…" testID="linea-skeleton">
      <View style={{ gap: 12 }}>
        <Skeleton height={44} width={200} />
        <Skeleton height={64} radius={6} />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={44} />
        ))}
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12, borderRadius: 8 },
  riel: { width: 24, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  trazo: { position: 'absolute', width: 6, left: 9 },
  punto: { width: 16, height: 16, borderRadius: 8, borderWidth: 4 },
  puntoBorde: { position: 'absolute', inset: -5, borderRadius: 13, borderWidth: 1 },
});
