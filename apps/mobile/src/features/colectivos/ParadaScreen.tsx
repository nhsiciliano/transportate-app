// Detalle de parada (brief 02-colectivos §3; dirección «Señalética de terminal», F5-MID-B):
// título nativo con calle y altura, favorito en el header, barrio debajo y una placa de tablero
// «Líneas que paran» con una fila por línea. Si el proxy trae arribos (N4, ADR-0006) el primero
// va a la derecha de su fila a 24 pt y los siguientes debajo; sin arribos la fila no los muestra.
// No hay banda: la parada no tiene un valor vivo que señalizar (F5-colectivos-1).
import type { ArriboColectivoV1 } from '@transportate/contracts';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { FavoriteToggle, useNow } from '@/features/favoritos';
import { RefreshErrorAlert, ScreenScroll, formatArribo, usePullToRefresh } from '@/features/subtes';
import { useArribosParada } from '@/shared/api';
import { useRefreshInterval } from '@/shared/query';
import { useTheme } from '@/shared/theme';
import { Board, EmptyState, ErrorState, FreshnessLabel, LineBadge, Text } from '@/shared/ui';

import { useIndiceColectivos } from './hooks';
import { describirLineas, lineaParaNumero, numerosDeParada } from './model';
import { useAbrirLinea } from './navigation';
import { ProgresoIndice } from './ProgresoIndice';
import { ERROR_INDICE, PREPARANDO } from './ColectivosScreen';

/** Hasta 3 tiempos por línea, como en Subtes (S9). */
export const ARRIBOS_POR_LINEA = 3;

export function ParadaScreen({ id }: { id: string | undefined }) {
  const { colors, scheme } = useTheme();
  const indice = useIndiceColectivos();
  const parada = id === undefined ? undefined : indice.indice?.paradaPorId.get(id);
  const arribos = useArribosParada(id);
  const { refreshing, onRefresh } = usePullToRefresh([() => arribos.refetch()]);
  const { seconds } = useRefreshInterval();
  const now = Math.max(useNow(15_000), arribos.dataUpdatedAt);
  const grupos = useMemo(
    () => (arribos.data === undefined ? [] : agrupar(arribos.data.arribos, now)),
    [arribos.data, now],
  );

  let body;
  if (indice.isLoadingError) {
    body = (
      <ErrorState
        title={ERROR_INDICE}
        cause={indice.error?.userMessage().cause ?? 'Revisá tu conexión y volvé a intentar.'}
        retryable={indice.error?.retryable ?? true}
        onRetry={() => void indice.refetch()}
      />
    );
  } else if (indice.indice === undefined) {
    body = indice.isDownloading ? (
      <Board>
        <View style={styles.relleno}>
          <ProgresoIndice progress={indice.progress} label={PREPARANDO} />
        </View>
      </Board>
    ) : (
      <Board.Skeleton rows={3} accessibilityLabel="Cargando la parada…" testID="parada-skeleton" />
    );
  } else if (parada === undefined) {
    body = (
      <Board>
        <EmptyState
          testID="parada-inexistente"
          title="No encontramos esta parada"
          message="Puede haber cambiado de lugar. Buscala por el nombre de la calle."
        />
      </Board>
    );
  } else {
    const numeros = numerosDeParada(parada);
    body = (
      <>
        {parada.barrio !== null ? (
          <Text variant="text.md" tone="secondary" testID="parada-barrio" style={styles.barrio}>
            {parada.barrio}
          </Text>
        ) : null}
        {arribos.isRefreshError && grupos.length > 0 ? (
          <RefreshErrorAlert onRetry={onRefresh} />
        ) : null}
        <LineasDeParada
          paradaId={parada.id}
          numeros={numeros}
          grupos={grupos}
          indice={indice.indice}
        />
        {/* Frescura solo si hay arribos (N4, F4-colectivos-7). */}
        {grupos.length > 0 ? (
          <FreshnessLabel sourceTimestamp={arribos.sourceTimestamp} intervalSeconds={seconds} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: parada?.nombre ?? 'Parada',
          // La estrella vive en el header nativo (44×44, `FavoriteToggle`).
          headerRight:
            parada === undefined
              ? () => null
              : () => (
                  <FavoriteToggle
                    tipo="parada_colectivo"
                    refId={parada.id}
                    nombre={parada.nombre}
                    subtitulo={describirLineas(numerosDeParada(parada))}
                  />
                ),
        }}
      />
      <ScreenScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        testID="parada-screen"
        backgroundColor={scheme === 'light' ? colors.bg.elevated : colors.bg.base}
        gap={12}
      >
        {body}
      </ScreenScroll>
    </>
  );
}

interface GrupoArribos {
  linea: string;
  tiempos: number[];
}

/** «2 min» a la derecha de la fila: el primero grande y los siguientes chicos, debajo. */
function ArribosDeFila({ tiempos }: { tiempos: readonly number[] }) {
  const { fontFamily } = useTheme();
  const [primero, ...resto] = tiempos.map(formatArribo);
  if (primero === undefined) return null;
  return (
    <View style={styles.arribos}>
      <Text
        variant="headline.lg"
        maxFontSizeMultiplier={1.2}
        style={{ fontFamily: fontFamily.heading[700], fontSize: 24, lineHeight: 28 }}
      >
        {primero.short}
      </Text>
      {resto.length === 0 ? null : (
        <Text
          variant="text.sm"
          tone="secondary"
          style={{ fontFamily: fontFamily.text[400], fontSize: 13, lineHeight: 16 }}
        >
          {resto.map((x) => x.short).join(' · ')}
        </Text>
      )}
    </View>
  );
}

function LineasDeParada({
  paradaId,
  numeros,
  grupos,
  indice,
}: {
  paradaId: string;
  numeros: readonly string[];
  grupos: readonly GrupoArribos[];
  indice: Parameters<typeof lineaParaNumero>[0];
}) {
  const abrirLinea = useAbrirLinea();
  // Una fila por línea que para; las que traen arribos sin figurar en la parada se suman al final.
  const extra = grupos.map((g) => g.linea).filter((l) => !numeros.includes(l));
  return (
    <Board label="Líneas que paran" testID="lineas-que-paran">
      {[...numeros, ...extra].map((n) => {
        const linea = lineaParaNumero(indice, n);
        const tiempos = grupos.find((g) => g.linea === n)?.tiempos ?? [];
        const spoken = tiempos.map((t) => formatArribo(t).spoken);
        const subtitle = linea?.descripcion;
        return (
          <Board.Row
            key={n}
            testID={`linea-parada-${n}`}
            leading={<LineBadge kind="colectivo" label={n} />}
            title={`Línea ${n}`}
            subtitle={subtitle}
            trailing={tiempos.length === 0 ? undefined : <ArribosDeFila tiempos={tiempos} />}
            accessibilityLabel={[
              `Línea ${n}`,
              subtitle,
              spoken.length === 0
                ? undefined
                : `Próximo ${spoken[0] ?? ''}${
                    spoken.length > 1 ? `, después ${spoken.slice(1).join(' y ')}` : ''
                  }`,
            ]
              .filter((x) => x !== undefined && x !== '')
              .join('. ')}
            // Sin ramal conocido (número que no está en el listado de líneas): sin destino, sin flecha.
            {...(linea === undefined
              ? {}
              : {
                  onPress: () => {
                    abrirLinea(linea, paradaId);
                  },
                  accessibilityHint: 'Ver en el mapa',
                })}
          />
        );
      })}
    </Board>
  );
}

/** Arribos agrupados por línea, el más próximo primero; hasta 3 por línea. */
function agrupar(arribos: readonly ArriboColectivoV1[], now: number): GrupoArribos[] {
  const porLinea = new Map<string, number[]>();
  for (const a of arribos) {
    const t = Date.parse(a.horaEstimada);
    const en = Number.isNaN(t) ? a.enSegundos : Math.round((t - now) / 1000);
    if (en < -30) continue;
    porLinea.set(a.linea, [...(porLinea.get(a.linea) ?? []), en]);
  }
  return [...porLinea.entries()]
    .map(([linea, tiempos]) => ({
      linea,
      tiempos: tiempos.sort((x, y) => x - y).slice(0, ARRIBOS_POR_LINEA),
    }))
    .sort((a, b) => (a.tiempos[0] ?? 0) - (b.tiempos[0] ?? 0));
}

const styles = StyleSheet.create({
  relleno: { padding: 12 },
  barrio: { fontSize: 15, lineHeight: 20 },
  arribos: { alignItems: 'flex-end', gap: 2 },
});
