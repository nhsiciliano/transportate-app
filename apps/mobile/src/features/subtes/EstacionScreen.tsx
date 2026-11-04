// Detalle de estación con la dirección «Señalética de terminal» (Fase 5): el cartel de andén.
// Título nativo con el nombre y la estrella en el header; una fila de contexto con la línea
// (toca → línea); la alerta resumida de la línea; una banda fija por sentido con el próximo
// arribo a escala monumental, y la frescura al pie. `forecastGTFS` está congelado en el upstream
// (docs/06-proxy.md §5): lo normal hoy es «Sin trenes informados» con dato viejo, y la pantalla
// tiene que verse bien igual.
import type { ArriboSubteV1 } from '@transportate/contracts';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { FavoriteToggle } from '@/features/favoritos';
import { useArribosEstacion } from '@/shared/api';
import { useRefreshInterval } from '@/shared/query';
import { useTheme } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  formatAge,
  FreshnessLabel,
  LineBadge,
  SignBand,
  SkeletonGroup,
  Text,
} from '@/shared/ui';

import { AvisoAlert, RefreshErrorAlert, ScreenScroll, useFondo } from './components';
import { useLineaDetalle, usePullToRefresh, useRedSubte } from './hooks';
import {
  agruparArribos,
  ARRIBOS_VIEJOS_SEGUNDOS,
  formatArribo,
  LLEGANDO_SEGUNDOS,
  type BloqueArribos,
  type LineaSubte,
} from './model';

/** Valor de la banda de un sentido sin arribos. */
export const SIN_TRENES = 'Sin trenes informados';
/** Estado de la banda con dato de más de 10 min (S30). */
export const PUEDE_NO_REFLEJAR = 'Puede no reflejar la situación actual';
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
  const fondo = useFondo();
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

  const title = estacion === undefined ? 'Estación' : estacion.nombre;
  const abrirLinea = (l: LineaSubte) => () => {
    router.push({ pathname: '/subtes/[linea]', params: { linea: l.key } });
  };

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
    body = <ArribosSkeleton sentidos={2} />;
  } else if (estacion === undefined || linea === undefined) {
    body = (
      <EmptyState
        title="No encontramos esta estación"
        message="Volvé a Subtes y buscala por su nombre."
      />
    );
  } else {
    const bloques = agruparArribos(
      estacion.id,
      linea,
      arribos.data ? vigentes(arribos.data.arribos, now) : [],
      red.red.estacionPorId,
    );
    const ts = arribos.sourceTimestamp === null ? NaN : Date.parse(arribos.sourceTimestamp);
    const edad = Number.isNaN(ts) ? null : Math.max(0, (now - ts) / 1000);
    const viejo = edad !== null && edad > ARRIBOS_VIEJOS_SEGUNDOS ? formatAge(edad).short : null;
    const interrumpida = estadoLinea?.estado === 'interrumpida';
    const resumen = estadoLinea?.resumen;

    body = (
      <>
        <Contexto linea={linea} onPress={abrirLinea(linea)} />

        {resumen !== undefined && resumen !== '' ? (
          <AvisoAlert
            role={interrumpida ? 'danger' : 'warning'}
            variant={interrumpida ? 'system' : 'standard'}
            title={linea.nombre}
            message={resumen}
            action={{ label: 'Ver la línea', onPress: abrirLinea(linea) }}
            testID="alerta-linea"
          />
        ) : null}

        {arribos.isRefreshError ? <RefreshErrorAlert onRetry={onRefresh} /> : null}

        {arribos.isPending ? (
          <ArribosSkeleton sentidos={bloques.length} />
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
        ) : (
          bloques.map((b) => <BandaSentido key={b.cabecera} bloque={b} viejo={viejo} />)
        )}
        {arribos.data !== undefined ? (
          <FreshnessLabel sourceTimestamp={arribos.sourceTimestamp} intervalSeconds={seconds} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title,
          ...(estacion === undefined || linea === undefined
            ? {}
            : {
                headerRight: () => (
                  <FavoriteToggle
                    tipo="estacion_subte"
                    refId={estacion.id}
                    nombre={estacion.nombre}
                    subtitulo={linea.nombre}
                  />
                ),
              }),
        }}
      />
      <ScreenScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        testID="estacion-screen"
        backgroundColor={fondo}
        gap={12}
      >
        {body}
      </ScreenScroll>
    </>
  );
}

/** Fila de contexto bajo el header: disco de la línea y su recorrido; toca → la línea. */
function Contexto({ linea, onPress }: { linea: LineaSubte; onPress: () => void }) {
  const { colors, component } = useTheme();
  const texto = `${linea.nombre} · ${linea.cabeceras}`;
  return (
    <Pressable
      testID="estacion-contexto"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityHint="Abre la línea"
      style={({ pressed }) => [
        styles.contexto,
        { minHeight: component.hitSlop },
        pressed ? { opacity: 0.6 } : null,
      ]}
    >
      <LineBadge
        kind="subte"
        label={linea.badge}
        color={linea.color}
        textColor={linea.colorTexto}
        size="md"
        surface={colors.bg.elevated}
        accessibilityLabel={linea.nombre}
      />
      <Text variant="text.md" tone="secondary" style={styles.contextoTexto}>
        {texto}
      </Text>
    </Pressable>
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

/** «Después 7 y 12 min» / «Después Llegando y 7 min». */
export function despues(resto: readonly { short: string }[]): string {
  if (resto.length === 0) return 'Único informado';
  const enMin = resto.every((t) => t.short.endsWith(' min'));
  const partes = resto.map((t) => (enMin ? t.short.replace(/ min$/, '') : t.short));
  const lista =
    partes.length === 1
      ? (partes[0] ?? '')
      : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1] ?? ''}`;
  return `Después ${lista}${enMin ? ' min' : ''}`;
}

/**
 * Una banda fija por sentido (sin flecha: ya estás en la estación). El próximo arribo a escala
 * monumental con «Próximo»; los siguientes como estado. Con dato de más de 10 min (S30) los
 * tiempos se reemplazan por la antigüedad. Cuando cambia el próximo arribo, la banda se vuelve a
 * señalizar con el fundido de `SignBand`.
 */
function BandaSentido({
  bloque,
  viejo,
}: {
  bloque: BloqueArribos;
  /** "12 min" si el dato tiene más de 10 min (S30). */
  viejo: string | null;
}) {
  const tiempos = bloque.arribos.map((a) => formatArribo(a.enSegundos));
  const [primero, ...resto] = tiempos;
  const comun = {
    testID: `bloque-${bloque.cabecera}`,
    variant: 'lead' as const,
    icon: 'estacion' as const,
    message: bloque.titulo,
  };
  if (viejo !== null) {
    return (
      <SignBand
        {...comun}
        value={`Dato de hace ${viejo}`}
        valueStyle="text"
        status={{ text: PUEDE_NO_REFLEJAR, tone: 'muted' }}
        transitionKey={`${bloque.cabecera}:viejo`}
        accessibilityLabel={`${bloque.titulo}: dato de hace ${viejo}. ${PUEDE_NO_REFLEJAR}.`}
      />
    );
  }
  if (primero === undefined) {
    return (
      <SignBand
        {...comun}
        value={SIN_TRENES}
        valueStyle="text"
        transitionKey={`${bloque.cabecera}:-`}
        accessibilityLabel={`${bloque.titulo}: ${SIN_TRENES.toLowerCase()}.`}
      />
    );
  }
  const spoken = `${bloque.titulo}: próximo ${primero.spoken}${
    resto.length > 0 ? `, siguientes ${resto.map((t) => t.spoken).join(' y ')}` : ''
  }.`;
  return (
    <SignBand
      {...comun}
      label="Próximo"
      value={primero.short}
      status={{ text: despues(resto), tone: 'muted' }}
      transitionKey={`${bloque.cabecera}:${primero.short}`}
      accessibilityLabel={spoken}
    />
  );
}

function ArribosSkeleton({ sentidos }: { sentidos: number }) {
  return (
    <SkeletonGroup
      accessibilityLabel="Cargando los próximos trenes…"
      testID="arribos-skeleton"
      style={{ gap: 12 }}
    >
      {Array.from({ length: Math.max(1, sentidos) }, (_, i) => (
        <SignBand.Skeleton key={i} variant="lead" />
      ))}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  contexto: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contextoTexto: { flex: 1, fontSize: 15, lineHeight: 20 },
});
