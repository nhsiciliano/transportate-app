// Detalle de parada (brief 02-colectivos §3): información estática (calle y altura, líneas que
// paran), favorito y "Próximos arribos" SOLO si el proxy trae arribos (N4, ADR-0006): sin
// equivalencia la lista llega vacía y la sección no existe.
import type { ArriboColectivoV1 } from '@transportate/contracts';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { FavoriteToggle, useNow } from '@/features/favoritos';
import {
  RefreshErrorAlert,
  ScreenScroll,
  Seccion,
  formatArribo,
  usePullToRefresh,
} from '@/features/subtes';
import { useArribosParada } from '@/shared/api';
import { useRefreshInterval } from '@/shared/query';
import { useTheme } from '@/shared/theme';
import {
  EmptyState,
  ErrorState,
  FreshnessLabel,
  LineBadge,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/shared/ui';

import { useIndiceColectivos } from './hooks';
import { describirLineas, lineaParaNumero, numerosDeParada } from './model';
import { useAbrirLinea } from './navigation';
import { ProgresoIndice } from './ProgresoIndice';
import { ERROR_INDICE, PREPARANDO } from './ColectivosScreen';

/** Hasta 3 tiempos por línea, como en Subtes (S9). */
export const ARRIBOS_POR_LINEA = 3;

export function ParadaScreen({ id }: { id: string | undefined }) {
  const indice = useIndiceColectivos();
  const parada = id === undefined ? undefined : indice.indice?.paradaPorId.get(id);
  const arribos = useArribosParada(id);
  const { refreshing, onRefresh } = usePullToRefresh([() => arribos.refetch()]);

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
      <ProgresoIndice progress={indice.progress} label={PREPARANDO} />
    ) : (
      <SkeletonGroup accessibilityLabel="Cargando la parada…" testID="parada-skeleton">
        <View style={{ gap: 12 }}>
          <Skeleton height={32} width={240} />
          <Skeleton height={24} width={160} />
        </View>
      </SkeletonGroup>
    );
  } else if (parada === undefined) {
    body = (
      <EmptyState
        testID="parada-inexistente"
        title="No encontramos esta parada"
        message="Puede haber cambiado de lugar. Buscala por el nombre de la calle."
      />
    );
  } else {
    const numeros = numerosDeParada(parada);
    body = (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="headline.lg" accessibilityRole="header">
              {parada.nombre}
            </Text>
            {parada.barrio !== null ? (
              <Text variant="text.sm" tone="secondary">
                {parada.barrio}
              </Text>
            ) : null}
          </View>
          <FavoriteToggle
            tipo="parada_colectivo"
            refId={parada.id}
            nombre={parada.nombre}
            subtitulo={describirLineas(numeros)}
          />
        </View>
        <Seccion>Líneas que paran</Seccion>
        <LineasDeParada paradaId={parada.id} numeros={numeros} indice={indice.indice} />
        <Arribos arribos={arribos} onRetry={onRefresh} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: parada?.nombre ?? 'Parada' }} />
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} testID="parada-screen">
        {body}
      </ScreenScroll>
    </>
  );
}

function LineasDeParada({
  paradaId,
  numeros,
  indice,
}: {
  paradaId: string;
  numeros: readonly string[];
  indice: Parameters<typeof lineaParaNumero>[0];
}) {
  const abrirLinea = useAbrirLinea();
  const { colors, component, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="list">
      {numeros.map((n) => {
        const linea = lineaParaNumero(indice, n);
        const badge = <LineBadge kind="colectivo" label={n} size="lg" />;
        // Sin ramal conocido (número que no está en el listado de líneas): insignia sin acción.
        if (linea === undefined) return <View key={n}>{badge}</View>;
        return (
          <Pressable
            key={n}
            testID={`linea-parada-${n}`}
            accessibilityRole="button"
            accessibilityLabel={`Línea ${n}. Ver en el mapa`}
            onPress={() => {
              abrirLinea(linea, paradaId);
            }}
            style={({ pressed }) => ({
              minWidth: component.hitSlop,
              minHeight: component.hitSlop,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.xl,
              backgroundColor: pressed ? colors.bg.pressed : 'transparent',
            })}
          >
            {badge}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Arribos agrupados por línea, el más próximo primero; hasta 3 por línea. */
function agrupar(arribos: readonly ArriboColectivoV1[], now: number) {
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

function Arribos({
  arribos,
  onRetry,
}: {
  arribos: ReturnType<typeof useArribosParada>;
  onRetry: () => void;
}) {
  const { seconds } = useRefreshInterval();
  const now = Math.max(useNow(15_000), arribos.dataUpdatedAt);
  const grupos = useMemo(
    () => (arribos.data === undefined ? [] : agrupar(arribos.data.arribos, now)),
    [arribos.data, now],
  );
  // Sin arribos (vacío, cargando o error sin datos): la sección no existe (N4, F4-colectivos-7).
  if (grupos.length === 0) return null;
  return (
    <View style={{ gap: 12 }} testID="proximos-arribos">
      <Seccion>Próximos arribos</Seccion>
      {arribos.isRefreshError ? <RefreshErrorAlert onRetry={onRetry} /> : null}
      {grupos.map((g) => {
        const t = g.tiempos.map(formatArribo);
        return (
          <View
            key={g.linea}
            accessible
            accessibilityLabel={`Línea ${g.linea}: ${t.map((x) => x.spoken).join(', ')}.`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <LineBadge kind="colectivo" label={g.linea} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, flex: 1 }}>
              {t.map((x, i) => (
                <Text
                  key={i}
                  variant={i === 0 ? 'headline.lg' : 'text.lg'}
                  tone={i === 0 ? 'primary' : 'secondary'}
                >
                  {x.short}
                </Text>
              ))}
            </View>
          </View>
        );
      })}
      <FreshnessLabel sourceTimestamp={arribos.sourceTimestamp} intervalSeconds={seconds} />
    </View>
  );
}
