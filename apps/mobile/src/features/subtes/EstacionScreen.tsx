// Detalle de estación (brief 03-subtes §3): encabezado, alerta resumida de la línea y próximos
// arribos por sentido. `forecastGTFS` está congelado en el upstream (docs/06-proxy.md §5): lo
// normal hoy es lista vacía con dato viejo, y la pantalla tiene que verse bien igual.
import type { ArriboSubteV1 } from '@transportate/contracts';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FavoriteToggle } from '@/features/favoritos';
import { useArribosEstacion } from '@/shared/api';
import { useRefreshInterval } from '@/shared/query';
import {
  EmptyState,
  ErrorState,
  formatAge,
  FreshnessLabel,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/shared/ui';

import { AvisoAlert, LineaBadge, RefreshErrorAlert, ScreenScroll, Seccion } from './components';
import { useLineaDetalle, usePullToRefresh, useRedSubte } from './hooks';
import {
  agruparArribos,
  ARRIBOS_VIEJOS_SEGUNDOS,
  formatArribo,
  LLEGANDO_SEGUNDOS,
  type BloqueArribos,
} from './model';

export const SIN_ARRIBOS = 'No hay próximos trenes informados para esta estación.';
export const ARRIBOS_NO_DISPONIBLES = 'Los próximos arribos no están disponibles por ahora';

/** Reloj que avanza cada `ms` mientras la pantalla está montada (recalcula los "2 min"). */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, ms);
    return () => {
      clearInterval(id);
    };
  }, [ms]);
  return now;
}

export function EstacionScreen({ id }: { id: string | undefined }) {
  const router = useRouter();
  const { seconds } = useRefreshInterval();
  const red = useRedSubte();
  const estacion = id === undefined ? undefined : red.red?.estacionPorId.get(id);
  const { linea, estado, estadoLinea, alertas } = useLineaDetalle(estacion?.linea);
  const arribos = useArribosEstacion(id);
  const now = useNow(15_000);
  const { refreshing, onRefresh } = usePullToRefresh([
    () => arribos.refetch(),
    () => estado.refetch(),
    () => alertas.refetch(),
  ]);

  const title =
    estacion === undefined ? 'Estación' : `${estacion.nombre}${linea ? ` (${linea.badge})` : ''}`;

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
    body = <ArribosSkeleton encabezado />;
  } else if (estacion === undefined || linea === undefined) {
    body = (
      <EmptyState
        title="No encontramos esta estación"
        message="Volvé a Subtes y buscala por su nombre."
      />
    );
  } else {
    const bloques = arribos.data
      ? agruparArribos(
          estacion.id,
          linea,
          vigentes(arribos.data.arribos, now),
          red.red.estacionPorId,
        )
      : [];
    const ts = arribos.sourceTimestamp === null ? NaN : Date.parse(arribos.sourceTimestamp);
    const edad = Number.isNaN(ts) ? null : Math.max(0, (now - ts) / 1000);
    const muyViejo = edad !== null && edad > ARRIBOS_VIEJOS_SEGUNDOS;
    const sinArribos = bloques.every((b) => b.arribos.length === 0);
    const interrumpida = estadoLinea?.estado === 'interrumpida';
    const resumen = estadoLinea?.resumen;

    body = (
      <>
        <View style={styles.encabezado}>
          <LineaBadge linea={linea} size="lg" />
          <Text variant="headline.lg" accessibilityRole="header" style={{ flex: 1 }}>
            {estacion.nombre}
          </Text>
          <FavoriteToggle
            tipo="estacion_subte"
            refId={estacion.id}
            nombre={estacion.nombre}
            subtitulo={linea.nombre}
          />
        </View>

        {resumen !== undefined && resumen !== '' ? (
          <AvisoAlert
            role={interrumpida ? 'danger' : 'warning'}
            variant={interrumpida ? 'system' : 'standard'}
            title={linea.nombre}
            message={resumen}
            action={{
              label: 'Ver la línea',
              onPress: () => {
                router.push({ pathname: '/subtes/[linea]', params: { linea: linea.key } });
              },
            }}
            testID="alerta-linea"
          />
        ) : null}

        {arribos.isRefreshError ? <RefreshErrorAlert onRetry={onRefresh} /> : null}

        <Seccion>Próximos trenes</Seccion>
        {arribos.isPending ? (
          <ArribosSkeleton />
        ) : arribos.isLoadingError ? (
          arribos.error?.retryable === false ? (
            <ErrorState
              title={ARRIBOS_NO_DISPONIBLES}
              cause="Mientras tanto, revisá el estado de la línea."
              retryable={false}
            />
          ) : (
            <ErrorState
              title={arribos.error?.userMessage().title ?? 'Servicio no disponible'}
              cause={arribos.error?.userMessage().cause ?? 'Probá de nuevo en un rato.'}
              onRetry={() => void arribos.refetch()}
            />
          )
        ) : sinArribos ? (
          <EmptyState message={SIN_ARRIBOS} testID="sin-arribos" />
        ) : (
          bloques
            .filter((b) => b.arribos.length > 0)
            .map((b) => (
              <Bloque key={b.cabecera} bloque={b} viejo={muyViejo ? formatAge(edad).short : null} />
            ))
        )}
        {arribos.data !== undefined ? (
          <FreshnessLabel sourceTimestamp={arribos.sourceTimestamp} intervalSeconds={seconds} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} testID="estacion-screen">
        {body}
      </ScreenScroll>
    </>
  );
}

/** Segundos que faltan según `horaEstimada` (el dato puede venir de la caché). */
function segundosHasta(a: ArriboSubteV1, now: number): number {
  const t = Date.parse(a.horaEstimada);
  return Number.isNaN(t) ? a.enSegundos : Math.round((t - now) / 1000);
}

/** Descarta los que ya pasaron (más de 30 s atrás, igual que el proxy) y recalcula `enSegundos`. */
function vigentes(arribos: readonly ArriboSubteV1[], now: number): ArriboSubteV1[] {
  return arribos
    .map((a) => ({ ...a, enSegundos: segundosHasta(a, now) }))
    .filter((a) => a.enSegundos >= -LLEGANDO_SEGUNDOS);
}

function Bloque({
  bloque,
  viejo,
}: {
  bloque: BloqueArribos;
  /** "12 min" si el dato tiene más de 10 min (S30): los tiempos no se muestran. */
  viejo: string | null;
}) {
  const tiempos = bloque.arribos.map((a) => formatArribo(a.enSegundos));
  const [primero, ...resto] = tiempos;
  const spoken =
    viejo !== null
      ? `${bloque.titulo}: dato de hace ${viejo}.`
      : `${bloque.titulo}: próximo ${primero?.spoken ?? ''}${
          resto.length > 0 ? `, siguientes ${resto.map((t) => t.spoken).join(' y ')}` : ''
        }.`;
  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={styles.bloque}
      testID={`bloque-${bloque.cabecera}`}
    >
      <Text variant="headline.sm" tone="secondary">
        {bloque.titulo}
      </Text>
      {viejo !== null ? (
        <Text variant="text.md" tone="tertiary" testID="arribos-viejos">
          {`Dato de hace ${viejo}`}
        </Text>
      ) : (
        <View style={styles.tiempos}>
          {primero !== undefined ? <Text variant="heading.h4">{primero.short}</Text> : null}
          {resto.map((t, i) => (
            <Text key={i} variant="text.lg" tone="secondary">
              {t.short}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function ArribosSkeleton({ encabezado = false }: { encabezado?: boolean }) {
  return (
    <SkeletonGroup accessibilityLabel="Cargando los próximos trenes…" testID="arribos-skeleton">
      <View style={{ gap: 16 }}>
        {encabezado ? <Skeleton height={44} width={220} /> : null}
        {[0, 1].map((b) => (
          <View key={b} style={{ gap: 8 }}>
            <Skeleton height={20} width={180} />
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={24} width={i === 0 ? 96 : 64} />
            ))}
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bloque: { gap: 4 },
  tiempos: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 16 },
});
