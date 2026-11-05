// Detalle de estación de tren («Señalética de terminal», Fase 6): el cartel de andén. Título
// nativo con el nombre y la estrella en el header; la fila de contexto con la insignia de cada
// línea; **una banda fija por destino** con el próximo tren a escala monumental («Hacia Moreno ·
// Próximo · 4 min»), el andén, el ramal, los siguientes y la hora programada si hay demora (S38);
// y debajo, las alertas de la estación y sus ramales (la banda es lo primero que se lee). Las dos bandas más próximas van arriba; el resto de los
// destinos baja a una placa. Un cancelado no cuenta como próximo (S40). Con dato de más de 10 min,
// los tiempos se reemplazan por la antigüedad (S30). Cuando cambia el próximo, la banda se vuelve a
// señalizar con el fundido de 200 ms de `SignBand` (corte seco con Reducir movimiento).
import type { ArriboTrenV1 } from '@transportate/contracts';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { FavoriteToggle } from '@/features/favoritos';
import { useRefreshInterval } from '@/shared/query';
import { useTheme } from '@/shared/theme';
import {
  Board,
  EmptyState,
  ErrorState,
  formatAge,
  FreshnessLabel,
  SignBand,
  SkeletonGroup,
  Text,
} from '@/shared/ui';

import { AlertaTren, LineaTrenBadge } from './components';
import {
  AvisoAlert,
  horaBsAs,
  RefreshErrorAlert,
  ScreenScroll,
  useFondo,
  usePullToRefresh,
} from './deps';
import { useEstacionTrenDetalle } from './hooks';
import {
  agruparArribosTren,
  arribosTrenVigentes,
  ARRIBOS_VIEJOS_SEGUNDOS,
  BANDAS_POR_ESTACION,
  demoraDe,
  DEMORA_VISIBLE_SEGUNDOS,
  estadoDeRamal,
  formatArriboTren,
  sentidoDeAlerta,
  type BloqueTren,
  type LineaTren,
} from './model';

export const SIN_PROXIMOS = 'No hay próximos trenes informados para esta estación.';
export const CANCELADO = 'Cancelado';
/** Estado de la banda con dato de más de 10 min (S30). */
export const PUEDE_NO_REFLEJAR = 'Puede no reflejar la situación actual';
export const SERVICIO_INTERRUMPIDO = 'Hay un ramal interrumpido en esta estación.';

/** Reloj que avanza cada `ms` mientras la pantalla está montada (recalcula los «4 min»). */
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

export function EstacionTrenScreen({ id }: { id: string | undefined }) {
  const router = useRouter();
  const fondo = useFondo();
  const { seconds } = useRefreshInterval();
  const { red, estacion, lineas, estado, alertas, alertasEstacion, arribos } =
    useEstacionTrenDetalle(id);
  const now = useNow(15_000);
  const { refreshing, onRefresh } = usePullToRefresh([
    () => arribos.refetch(),
    () => estado.refetch(),
    () => alertas.refetch(),
  ]);
  const title = estacion === undefined ? 'Estación' : estacion.nombre;

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
    body = <ArribosSkeleton />;
  } else if (estacion === undefined) {
    body = (
      <EmptyState
        title="No encontramos esta estación"
        message="Volvé a Trenes y buscala por su nombre."
      />
    );
  } else {
    const ramalPorId = red.red.ramalPorId;
    const interrumpida = estacion.ramalIds.some(
      (r) => estadoDeRamal(r, estado.data) === 'interrumpida',
    );
    const ts = arribos.sourceTimestamp === null ? NaN : Date.parse(arribos.sourceTimestamp);
    const edad = Number.isNaN(ts) ? null : Math.max(0, (now - ts) / 1000);
    const viejo = edad !== null && edad > ARRIBOS_VIEJOS_SEGUNDOS ? formatAge(edad).short : null;
    const bloques =
      arribos.data === undefined
        ? []
        : agruparArribosTren(arribosTrenVigentes(arribos.data.arribos, now));
    const bandas = bloques.slice(0, BANDAS_POR_ESTACION);
    const resto = bloques.slice(BANDAS_POR_ESTACION);

    body = (
      <>
        {lineas.map((l) => (
          <Contexto
            key={l.id}
            linea={l}
            onPress={() => {
              router.push({ pathname: '/trenes/[linea]', params: { linea: l.id } });
            }}
          />
        ))}

        {interrumpida ? (
          <AvisoAlert
            role="danger"
            variant="system"
            message={SERVICIO_INTERRUMPIDO}
            testID="estacion-interrumpida"
          />
        ) : null}
        {arribos.isRefreshError ? <RefreshErrorAlert onRetry={onRefresh} /> : null}

        {arribos.isPending ? (
          <ArribosSkeleton />
        ) : arribos.isLoadingError ? (
          <ErrorState
            title={arribos.error?.userMessage().title ?? 'Servicio no disponible'}
            cause={arribos.error?.userMessage().cause ?? 'Probá de nuevo en un rato.'}
            retryable={arribos.error?.retryable ?? true}
            onRetry={() => void arribos.refetch()}
          />
        ) : bloques.length === 0 ? (
          <Text variant="text.md" tone="secondary" testID="sin-proximos">
            {SIN_PROXIMOS}
          </Text>
        ) : (
          <>
            {bandas.map((b) => (
              <BandaDestino key={b.destino} bloque={b} viejo={viejo} />
            ))}
            {resto.length > 0 ? (
              <Board label="Otros destinos" testID="otros-destinos">
                {resto.map((b) => (
                  <FilaDestino key={b.destino} bloque={b} viejo={viejo} />
                ))}
              </Board>
            ) : null}
          </>
        )}
        {arribos.data !== undefined ? (
          <FreshnessLabel sourceTimestamp={arribos.sourceTimestamp} intervalSeconds={seconds} />
        ) : null}

        {/* Las alertas van después del «¿cuándo viene?»: la banda es lo primero que se lee. */}
        {alertasEstacion.map((a) => {
          const ramal = a.ramalId === undefined ? undefined : ramalPorId.get(a.ramalId);
          return (
            <AlertaTren
              key={a.id}
              alerta={a}
              estado={a.ramalId === undefined ? undefined : estadoDeRamal(a.ramalId, estado.data)}
              sentido={ramal === undefined ? undefined : sentidoDeAlerta(a, ramal)}
            />
          );
        })}
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title,
          ...(estacion === undefined
            ? {}
            : {
                headerRight: () => (
                  <FavoriteToggle
                    tipo="estacion_tren"
                    refId={estacion.id}
                    nombre={estacion.nombre}
                    subtitulo={lineas.map((l) => l.nombre).join(' · ')}
                  />
                ),
              }),
        }}
      />
      <ScreenScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        testID="estacion-tren-screen"
        backgroundColor={fondo}
        gap={12}
      >
        {body}
      </ScreenScroll>
    </>
  );
}

/** Fila de contexto bajo el header: la insignia de la línea y su nombre; toca → la línea. */
function Contexto({ linea, onPress }: { linea: LineaTren; onPress: () => void }) {
  const { colors, component } = useTheme();
  return (
    <Pressable
      testID={`estacion-contexto-${linea.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={linea.nombre}
      accessibilityHint="Abre la línea"
      style={({ pressed }) => [
        styles.contexto,
        { minHeight: component.hitSlop },
        pressed ? { opacity: 0.6 } : null,
      ]}
    >
      <LineaTrenBadge linea={linea} surface={colors.bg.elevated} />
      <Text variant="text.md" tone="secondary" style={styles.contextoTexto}>
        {linea.nombre}
      </Text>
    </Pressable>
  );
}

/** «Después 7 y 12 min» / «Único informado». */
export function despuesTren(resto: readonly ArriboTrenV1[]): string {
  if (resto.length === 0) return 'Único informado';
  const tiempos = resto.map((a) => formatArriboTren(a.enSegundos).short);
  const enMin = tiempos.every((t) => t.endsWith(' min'));
  const partes = tiempos.map((t) => (enMin ? t.replace(/ min$/, '') : t));
  const lista =
    partes.length === 1
      ? (partes[0] ?? '')
      : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1] ?? ''}`;
  return `Después ${lista}${enMin ? ' min' : ''}`;
}

/** «Andén 3 · Ramal Once – Moreno». */
function andenYRamal(bloque: BloqueTren): string {
  return [bloque.anden === undefined ? undefined : `Andén ${bloque.anden}`, bloque.ramal]
    .filter((x) => x !== undefined)
    .join(' · ');
}

/** «Programado 11:26» si el próximo viene demorado ≥ 2 min (S38). */
function programado(a: ArriboTrenV1 | undefined): string | undefined {
  if (a === undefined || demoraDe(a) < DEMORA_VISIBLE_SEGUNDOS) return undefined;
  const hora = horaBsAs(a.horaProgramada);
  return hora === undefined ? undefined : `Programado ${hora}`;
}

/** Contenido de un destino, compartido por la banda y la fila de la placa. */
function contenidoDestino(bloque: BloqueTren, viejo: string | null) {
  const [primero, ...siguientes] = bloque.arribos;
  const lugar = andenYRamal(bloque);
  if (viejo !== null) {
    return {
      value: `Dato de hace ${viejo}`,
      valueStyle: 'text' as const,
      lineas: [PUEDE_NO_REFLEJAR],
      key: 'viejo',
      spoken: `${bloque.titulo}: dato de hace ${viejo}. ${PUEDE_NO_REFLEJAR}.`,
      proximo: false,
    };
  }
  if (primero === undefined) {
    // Solo cancelados (S40): el destino dice «Cancelado».
    const cancelado = bloque.cancelados[0];
    const hora = cancelado === undefined ? undefined : horaBsAs(cancelado.horaProgramada);
    const lineas = [lugar, hora === undefined ? undefined : `Programado ${hora}`].filter(
      (x): x is string => x !== undefined && x !== '',
    );
    return {
      value: CANCELADO,
      valueStyle: 'text' as const,
      lineas,
      key: 'cancelado',
      spoken: `${bloque.titulo}: cancelado. ${lineas.join('. ')}.`,
      proximo: false,
    };
  }
  const t = formatArriboTren(primero.enSegundos);
  const prog = programado(primero);
  const cancelados = bloque.cancelados.length;
  const lineas = [
    lugar,
    despuesTren(siguientes),
    prog,
    cancelados === 0 ? undefined : cancelados === 1 ? '1 cancelado' : `${cancelados} cancelados`,
  ].filter((x): x is string => x !== undefined && x !== '');
  const siguientesHablado = siguientes.map((a) => formatArriboTren(a.enSegundos).spoken);
  return {
    value: t.short,
    valueStyle: 'display' as const,
    lineas,
    key: t.short,
    spoken: [
      `${bloque.titulo}: próximo ${t.spoken}${
        siguientesHablado.length > 0 ? `, después ${siguientesHablado.join(' y ')}` : ''
      }`,
      lugar,
      prog,
    ]
      .filter((x) => x !== undefined && x !== '')
      .join('. ')
      .concat('.'),
    proximo: true,
  };
}

/** Banda fija de un destino (sin flecha: ya estás en la estación). */
function BandaDestino({ bloque, viejo }: { bloque: BloqueTren; viejo: string | null }) {
  const c = contenidoDestino(bloque, viejo);
  return (
    <SignBand
      testID={`destino-${bloque.destino}`}
      variant="lead"
      icon="estacionTren"
      message={bloque.titulo}
      label={c.proximo ? 'Próximo' : undefined}
      value={c.value}
      valueStyle={c.valueStyle}
      status={{ text: c.lineas.join('\n'), tone: 'muted' }}
      transitionKey={`${bloque.destino}:${c.key}`}
      accessibilityLabel={c.spoken}
    />
  );
}

/** Destino que no entra en las dos bandas: una fila de la placa con su tiempo a la derecha. */
function FilaDestino({ bloque, viejo }: { bloque: BloqueTren; viejo: string | null }) {
  const c = contenidoDestino(bloque, viejo);
  const [lugar, ...resto] = c.lineas;
  return (
    <Board.Row
      testID={`destino-${bloque.destino}`}
      title={bloque.titulo}
      subtitle={lugar}
      note={resto.length === 0 ? undefined : { text: resto.join(' · '), tone: 'muted' }}
      trailing={
        <Text variant="headline.sm" style={styles.tiempo}>
          {c.value}
        </Text>
      }
      accessibilityLabel={c.spoken}
    />
  );
}

function ArribosSkeleton() {
  return (
    <SkeletonGroup
      accessibilityLabel="Cargando los próximos trenes…"
      testID="arribos-skeleton"
      style={{ gap: 12 }}
    >
      <SignBand.Skeleton variant="lead" />
      <SignBand.Skeleton variant="lead" />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  contexto: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contextoTexto: { flex: 1, fontSize: 15, lineHeight: 20 },
  tiempo: { textAlign: 'right' },
});
