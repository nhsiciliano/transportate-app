// Inicio (brief 01-inicio §3): Alert destacada si hay interrupciones, estado del subte en 7 filas
// fijas y los primeros 5 favoritos con su dato vivo. Estados en README.md ("Brief operativo").
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import {
  FavoritoLiveData,
  useFavoritoLiveData,
  useFavoritos,
  type FavoritoTipo,
  type FavoritoV1,
} from '@/features/favoritos';
import {
  EstadoChip,
  FilaTocable,
  LineaBadge,
  RefreshErrorAlert,
  ScreenScroll,
  Seccion,
  useLineasConEstado,
  usePullToRefresh,
  type LineaConEstado,
} from '@/features/subtes';
import { invalidateRealtime } from '@/shared/api';
import { Icon, type IconName } from '@/shared/icons';
import { useRefreshInterval } from '@/shared/query';
import { useTheme } from '@/shared/theme';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  FreshnessLabel,
  Skeleton,
  SkeletonGroup,
  STATUS,
  Text,
  alertPalette,
} from '@/shared/ui';

/** Favoritos que se muestran en Inicio (S28). */
export const FAVORITOS_EN_INICIO = 5;
export const SIN_FAVORITOS = 'Guardá tus líneas, paradas y estaciones para verlas acá.';

export function InicioScreen() {
  const queryClient = useQueryClient();
  const { lineas, estado, red } = useLineasConEstado();
  const { favoritos } = useFavoritos();
  // Estado del subte y datos vivos (arribos, posiciones): todo el tiempo real activo.
  const { refreshing, onRefresh } = usePullToRefresh([() => invalidateRealtime(queryClient)]);

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} testID="inicio-screen">
      {lineas !== undefined && estado.data !== undefined ? (
        <AlertaDestacada lineas={lineas} />
      ) : null}
      <EstadoSubte lineas={lineas} estado={estado} red={red} />
      <Favoritos favoritos={favoritos} />
    </ScreenScroll>
  );
}

// ---------------------------------------------------------------- Alert destacada

function AlertaDestacada({ lineas }: { lineas: readonly LineaConEstado[] }) {
  const router = useRouter();
  const { colors } = useTheme();
  const interrumpidas = lineas.filter((l) => l.estado === 'interrumpida');
  const primera = interrumpidas[0];
  if (primera === undefined) return null;
  const fg = alertPalette(colors, 'danger', 'system').fg;
  const una = interrumpidas.length === 1;
  const todas = interrumpidas.length === lineas.length;
  const title = todas
    ? 'El subte no está funcionando'
    : una
      ? `${primera.linea.nombre} interrumpida`
      : `${interrumpidas.length} líneas con problemas`;
  const message = una
    ? (primera.resumen ?? 'Sin servicio informado.')
    : interrumpidas.map((l) => l.linea.nombre).join(', ');
  return (
    <Alert
      role="danger"
      variant="system"
      testID="alerta-destacada"
      icon={<Icon name="interrumpida" size={24} color={fg} />}
      title={title}
      // Solo el `header_text`, 2 líneas como máximo: el texto completo vive en Subtes.
      message={message.length > 140 ? `${message.slice(0, 139).trimEnd()}…` : message}
      action={
        una && !todas
          ? {
              label: 'Ver la línea',
              onPress: () => {
                router.push({ pathname: '/subtes/[linea]', params: { linea: primera.linea.key } });
              },
            }
          : {
              label: 'Ver el subte',
              onPress: () => {
                router.push('/subtes');
              },
            }
      }
    />
  );
}

// ---------------------------------------------------------------- estado del subte

function EstadoSubte({
  lineas,
  estado,
  red,
}: Pick<ReturnType<typeof useLineasConEstado>, 'lineas' | 'estado' | 'red'>) {
  const router = useRouter();
  const { seconds } = useRefreshInterval();
  const error = red.isLoadingError ? red.error : estado.isLoadingError ? estado.error : null;
  const retry = red.isLoadingError ? red.refetch : () => estado.refetch();

  let contenido;
  if (error !== null) {
    const m = error.userMessage();
    contenido = (
      <ErrorState
        testID="estado-error"
        title={m.title}
        cause={m.cause ?? 'Probá de nuevo en un rato.'}
        retryable={error.retryable}
        onRetry={() => void retry()}
      />
    );
  } else if (lineas === undefined || estado.data === undefined) {
    contenido = (
      <SkeletonGroup accessibilityLabel="Cargando el estado del subte…" testID="estado-skeleton">
        <View style={{ gap: 8 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} height={56} radius={16} />
          ))}
        </View>
      </SkeletonGroup>
    );
  } else {
    contenido = (
      <>
        {estado.isRefreshError ? <RefreshErrorAlert onRetry={() => void estado.refetch()} /> : null}
        <View style={{ gap: 8 }} accessibilityRole="list">
          {lineas.map(({ linea, estado: e, resumen }) => (
            <FilaTocable
              key={linea.key}
              testID={`inicio-linea-${linea.key}`}
              accessibilityLabel={[`${linea.nombre}, ${STATUS[e].label.toLowerCase()}`, resumen]
                .filter((x) => x !== undefined && x !== '')
                .join('. ')}
              onPress={() => {
                router.push({ pathname: '/subtes/[linea]', params: { linea: linea.key } });
              }}
            >
              <LineaBadge linea={linea} size="sm" />
              <Text variant="headline.sm" style={{ flex: 1 }}>
                {linea.nombre}
              </Text>
              <EstadoChip estado={e} />
            </FilaTocable>
          ))}
        </View>
        <FreshnessLabel sourceTimestamp={estado.sourceTimestamp} intervalSeconds={seconds} />
      </>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Seccion>Estado del subte</Seccion>
      {contenido}
    </View>
  );
}

// ---------------------------------------------------------------- favoritos

const TIPO_ICON: Record<FavoritoTipo, IconName> = {
  linea_subte: 'subtes',
  estacion_subte: 'estacion',
  linea_colectivo: 'colectivos',
  parada_colectivo: 'parada',
};

/** Cómo se lee el tipo antes del nombre ("Estación Medrano"); las líneas de subte ya dicen "Línea". */
const TIPO_LECTOR: Record<FavoritoTipo, string> = {
  linea_subte: '',
  estacion_subte: 'Estación',
  linea_colectivo: 'Colectivo',
  parada_colectivo: 'Parada',
};

/** Detalle del favorito en su tab (S3, F4-inicio-2). */
export function hrefDeFavorito(f: Pick<FavoritoV1, 'tipo' | 'refId'>): Href {
  switch (f.tipo) {
    case 'linea_subte':
      return { pathname: '/subtes/[linea]', params: { linea: f.refId } };
    case 'estacion_subte':
      return { pathname: '/subtes/estacion/[id]', params: { id: f.refId } };
    case 'linea_colectivo':
      return { pathname: '/colectivos/[linea]', params: { linea: f.refId } };
    case 'parada_colectivo':
      return { pathname: '/colectivos/parada/[id]', params: { id: f.refId } };
  }
}

function Favoritos({ favoritos }: { favoritos: readonly FavoritoV1[] }) {
  const router = useRouter();
  const { colors } = useTheme();
  const visibles = favoritos.slice(0, FAVORITOS_EN_INICIO);
  return (
    <View style={{ gap: 12 }}>
      <Seccion>Favoritos</Seccion>
      {favoritos.length === 0 ? (
        <EmptyState
          testID="sin-favoritos"
          icon={<Icon name="favoritoOff" size={32} color={colors.text.secondary} />}
          message={SIN_FAVORITOS}
          action={{
            label: 'Explorar subtes',
            onPress: () => {
              router.push('/subtes');
            },
          }}
        />
      ) : (
        <>
          <View style={{ gap: 8 }} accessibilityRole="list">
            {visibles.map((f) => (
              <FavoritoFila
                key={f.id}
                favorito={f}
                onPress={() => {
                  router.push(hrefDeFavorito(f));
                }}
              />
            ))}
          </View>
          {favoritos.length > FAVORITOS_EN_INICIO ? (
            <Button
              label={`Ver todos (${favoritos.length})`}
              variant="link"
              size="md"
              onPress={() => {
                router.push('/favoritos');
              }}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

function FavoritoFila({ favorito, onPress }: { favorito: FavoritoV1; onPress: () => void }) {
  const { colors } = useTheme();
  const live = useFavoritoLiveData(favorito);
  const titulo = favorito.alias ?? favorito.nombre;
  const descripcion = [TIPO_LECTOR[favorito.tipo], favorito.nombre]
    .filter((x) => x !== '')
    .join(' ');
  const label = [
    favorito.alias,
    favorito.subtitulo === undefined ? descripcion : `${descripcion}, ${favorito.subtitulo}`,
    live.status === 'static' ? undefined : live.spoken,
  ]
    .filter((x) => x !== undefined && x !== '')
    .join('. ');
  return (
    <FilaTocable
      onPress={onPress}
      accessibilityLabel={`${label}.`}
      testID={`inicio-favorito-${favorito.id}`}
    >
      <Icon name={TIPO_ICON[favorito.tipo]} size={24} color={colors.text.secondary} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="headline.sm" numberOfLines={1}>
          {titulo}
        </Text>
        <FavoritoLiveData favorito={favorito} live={live} />
      </View>
    </FilaTocable>
  );
}
