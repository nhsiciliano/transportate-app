// Inicio, piloto de la dirección «Señalética de terminal» (Fase 5). Contrato de dirección:
// `apps/mobile/.impeccable/surfaces/src-features-inicio-inicioscreen-tsx.md`; brief operativo y
// estados en README.md.
//
// De arriba hacia abajo: Alert destacada (solo con líneas interrumpidas), tira «Subte ahora»
// (las 7 insignias y una línea de estado; abre Subtes), bandas de señal de los primeros 5
// favoritos (la líder es la más cercana si el permiso de ubicación ya está concedido; si no, la
// primera) y la fila meta (frescura + «Ver todos los favoritos»). Nunca se pide ubicación acá (S32).
import type { EstadoServicioV1 } from '@transportate/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  useFavoritoLiveData,
  useFavoritos,
  type FavoritoLiveDataResult,
  type FavoritoTipo,
  type FavoritoV1,
} from '@/features/favoritos';
import {
  RefreshErrorAlert,
  ScreenScroll,
  useLineasConEstado,
  usePullToRefresh,
  type LineaConEstado,
  type RedSubte,
} from '@/features/subtes';
import { distanceMeters, useUbicacion, type LatLon } from '@/features/ubicacion';
import { invalidateRealtime } from '@/shared/api';
import { Icon, type IconName } from '@/shared/icons';
import { useRefreshInterval } from '@/shared/query';
import { useStaticArchivoGrande } from '@/shared/static';
import { useTheme } from '@/shared/theme';
import {
  Alert,
  alertPalette,
  EmptyState,
  ErrorState,
  FreshnessLabel,
  LineBadge,
  SignBand,
  Skeleton,
  SkeletonGroup,
  Text,
  type SignBandProps,
  type SignBandStatus,
} from '@/shared/ui';

/** Favoritos que se muestran en Inicio (S28). */
export const FAVORITOS_EN_INICIO = 5;
export const SIN_FAVORITOS = 'Guardá tus líneas, paradas y estaciones para verlas acá.';
export const SUBTE_NORMAL = 'Todas las líneas funcionan con normalidad';

/** Separación entre bloques (boceto elegido: 12 pt) y entre bandas (8 pt). */
const GAP_BLOQUES = 12;
const GAP_BANDAS = 8;
/** Radio de la tira y de las bandas (contrato: radio 6). */
const RADIO = 6;
/** Insignias de la tira «Subte ahora» (28 pt; entre las `sm` de 24 y las `md` de 32). */
const INSIGNIA = 28;

export function InicioScreen() {
  const queryClient = useQueryClient();
  const { colors, scheme } = useTheme();
  const { lineas, estado, red } = useLineasConEstado();
  const { favoritos } = useFavoritos();
  const { seconds } = useRefreshInterval();
  // Estado del subte y datos vivos (arribos, posiciones): todo el tiempo real activo (F4-inicio-6).
  const { refreshing, onRefresh } = usePullToRefresh([() => invalidateRealtime(queryClient)]);

  return (
    <ScreenScroll
      refreshing={refreshing}
      onRefresh={onRefresh}
      testID="inicio-screen"
      // Fondo elevado en claro (#edf4ff, contrato OWN-WORLD); en oscuro el fondo de la app.
      backgroundColor={scheme === 'light' ? colors.bg.elevated : colors.bg.base}
      gap={GAP_BLOQUES}
    >
      {lineas !== undefined && estado.data !== undefined ? (
        <AlertaDestacada lineas={lineas} />
      ) : null}
      <SubteAhora lineas={lineas} estado={estado} red={red} />
      {favoritos.length === 0 ? (
        <>
          <SinFavoritos />
          {estado.data === undefined ? null : (
            <FreshnessLabel
              sourceTimestamp={estado.sourceTimestamp}
              intervalSeconds={seconds}
              testID="inicio-frescura"
            />
          )}
        </>
      ) : (
        <Favoritos
          favoritos={favoritos}
          lineas={lineas}
          red={red.red}
          subteTimestamp={estado.data === undefined ? null : estado.sourceTimestamp}
        />
      )}
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

// ---------------------------------------------------------------- tira «Subte ahora»

/** «B», «B y D», «A, B y D». Premetro se nombra entero. */
function enumerar(lineas: readonly LineaConEstado[]): string {
  const nombres = lineas.map((l) => (l.linea.key === 'PM' ? 'Premetro' : l.linea.key));
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1] ?? ''}`;
}

export interface ResumenSubte {
  text: string;
  tone: 'danger' | 'warning' | 'normal' | 'sinDatos';
}

/**
 * Línea de estado de la tira: primero las interrumpidas, después las demoradas; con una sola
 * línea con problemas se suma el `resumen` de su alerta («B con demoras · Obras entre…»).
 */
export function resumenSubte(lineas: readonly LineaConEstado[]): ResumenSubte {
  const interrumpidas = lineas.filter((l) => l.estado === 'interrumpida');
  const demoradas = lineas.filter((l) => l.estado === 'demorada');
  const conProblema = [...interrumpidas, ...demoradas];
  if (conProblema.length > 0) {
    const partes: string[] = [];
    if (interrumpidas.length > 0) {
      partes.push(
        `${enumerar(interrumpidas)} ${interrumpidas.length === 1 ? 'interrumpida' : 'interrumpidas'}`,
      );
    }
    if (demoradas.length > 0) partes.push(`${enumerar(demoradas)} con demoras`);
    const unica = conProblema.length === 1 ? conProblema[0] : undefined;
    if (unica?.resumen !== undefined && unica.resumen !== '') partes.push(unica.resumen);
    return { text: partes.join(' · '), tone: interrumpidas.length > 0 ? 'danger' : 'warning' };
  }
  const sinDatos = lineas.filter((l) => l.estado === 'sin_datos');
  if (sinDatos.length === lineas.length) {
    return { text: 'Sin información del estado del subte', tone: 'sinDatos' };
  }
  if (sinDatos.length > 0)
    return { text: `Sin información de ${enumerar(sinDatos)}`, tone: 'sinDatos' };
  return { text: SUBTE_NORMAL, tone: 'normal' };
}

function SubteAhora({
  lineas,
  estado,
  red,
}: Pick<ReturnType<typeof useLineasConEstado>, 'lineas' | 'estado' | 'red'>) {
  const router = useRouter();
  const { colors, borderWidth } = useTheme();
  const tarjeta = {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.subtle,
    borderWidth: borderWidth.hairline,
    borderRadius: RADIO,
  };
  const error = red.isLoadingError ? red.error : estado.isLoadingError ? estado.error : null;
  const retry = red.isLoadingError ? red.refetch : () => estado.refetch();

  if (error !== null) {
    const m = error.userMessage();
    return (
      <View style={[styles.tira, tarjeta]}>
        <Etiqueta />
        <ErrorState
          testID="estado-error"
          title={m.title}
          cause={m.cause ?? 'Probá de nuevo en un rato.'}
          retryable={error.retryable}
          onRetry={() => void retry()}
          style={styles.errorCompacto}
        />
      </View>
    );
  }
  if (lineas === undefined || estado.data === undefined) {
    return (
      // Misma silueta que la tira: etiqueta, 7 discos y la línea de estado.
      <SkeletonGroup
        accessibilityLabel="Cargando el estado del subte…"
        testID="estado-skeleton"
        style={[styles.tira, tarjeta]}
      >
        <View style={styles.tiraFila}>
          <Etiqueta />
          <View style={styles.insignias}>
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} height={INSIGNIA} circle />
            ))}
          </View>
        </View>
        <Skeleton height={16} width="70%" radius={4} />
      </SkeletonGroup>
    );
  }

  const resumen = resumenSubte(lineas);
  const colorEstado =
    resumen.tone === 'danger'
      ? colors.role.danger.text
      : resumen.tone === 'warning'
        ? colors.role.warning.text
        : colors.text.secondary;
  return (
    <>
      <Pressable
        testID="subte-ahora"
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Subte ahora. ${resumen.text.replaceAll(' · ', '. ')}.`}
        accessibilityHint="Abre el estado del subte"
        onPress={() => {
          router.push('/subtes');
        }}
        style={({ pressed }) => [
          styles.tira,
          tarjeta,
          pressed ? { backgroundColor: colors.bg.pressed } : null,
        ]}
      >
        <View style={styles.tiraFila}>
          <Etiqueta />
          <View style={styles.insignias}>
            {lineas.map(({ linea }) => (
              <LineBadge
                key={linea.key}
                kind="subte"
                label={linea.badge}
                color={linea.color}
                textColor={linea.colorTexto}
                size="sm"
                surface={colors.bg.card}
                accessibilityLabel={linea.nombre}
                testID={`subte-ahora-${linea.key}`}
                style={{ minWidth: INSIGNIA, height: INSIGNIA, borderRadius: INSIGNIA / 2 }}
              />
            ))}
          </View>
        </View>
        <Text
          variant="text.sm"
          color={colorEstado}
          numberOfLines={2}
          style={{ fontSize: 13, lineHeight: 16 }}
          testID="subte-ahora-estado"
        >
          {resumen.text}
        </Text>
      </Pressable>
      {estado.isRefreshError ? <RefreshErrorAlert onRetry={() => void estado.refetch()} /> : null}
    </>
  );
}

function Etiqueta() {
  const { fontFamily } = useTheme();
  return (
    <Text
      variant="text.sm"
      tone="secondary"
      style={[styles.etiqueta, { fontFamily: fontFamily.text[600], fontSize: 13, lineHeight: 16 }]}
    >
      Subte ahora
    </Text>
  );
}

// ---------------------------------------------------------------- favoritos

const TIPO_ICON: Record<FavoritoTipo, IconName> = {
  linea_subte: 'subtes',
  estacion_subte: 'estacion',
  linea_colectivo: 'colectivos',
  parada_colectivo: 'parada',
};

/** Cómo se lee el tipo antes del nombre ("Estación Medrano"); las líneas ya dicen "Línea". */
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

/**
 * Mensaje de la banda: el alias si lo hay; si no, el nombre con lo que lo ubica («Línea B ·
 * Medrano hacia Leandro N. Alem», «Línea 152 · Ramal A», «Parada Cabildo y Juramento»).
 */
export function mensajeDeFavorito(
  f: Pick<FavoritoV1, 'tipo' | 'nombre' | 'subtitulo' | 'alias'>,
  sentido?: string,
): string {
  if (f.alias !== undefined) return f.alias;
  const con = (a: string, b: string | undefined) =>
    b === undefined || b === '' ? a : `${a} · ${b}`;
  switch (f.tipo) {
    case 'linea_subte':
    case 'linea_colectivo':
      return con(f.nombre, f.subtitulo);
    case 'estacion_subte': {
      const estacion = sentido === undefined ? f.nombre : `${f.nombre} hacia ${sentido}`;
      return f.subtitulo === undefined ? `Estación ${estacion}` : con(f.subtitulo, estacion);
    }
    case 'parada_colectivo':
      return `Parada ${f.nombre}`;
  }
}

/** Lo que el lector lee antes del dato vivo: alias, tipo, nombre y subtítulo. */
function descripcionDeFavorito(f: FavoritoV1): string {
  const tipo = [TIPO_LECTOR[f.tipo], f.nombre].filter((x) => x !== '').join(' ');
  return [f.alias, f.subtitulo === undefined ? tipo : `${tipo}, ${f.subtitulo}`]
    .filter((x) => x !== undefined && x !== '')
    .join('. ');
}

type PosicionesEstaticas = ReadonlyMap<string, LatLon>;

/**
 * Favorito líder: el más cercano entre los visibles que tienen posición en el estático
 * (estaciones de subte y paradas de colectivo; las líneas no compiten). Sin posición de la
 * persona o sin candidatos: el primero en el orden guardado. Empates: gana el orden guardado.
 */
export function elegirLider(
  visibles: readonly Pick<FavoritoV1, 'id' | 'tipo' | 'refId'>[],
  posicion: LatLon | null,
  estaciones: PosicionesEstaticas | undefined,
  paradas: PosicionesEstaticas | undefined,
): string | undefined {
  const primero = visibles[0]?.id;
  if (posicion === null) return primero;
  let lider: { id: string; metros: number } | undefined;
  for (const f of visibles) {
    const lugar =
      f.tipo === 'estacion_subte'
        ? estaciones?.get(f.refId)
        : f.tipo === 'parada_colectivo'
          ? paradas?.get(f.refId)
          : undefined;
    if (lugar === undefined) continue;
    const metros = distanceMeters(posicion, lugar);
    if (lider === undefined || metros < lider.metros) lider = { id: f.id, metros };
  }
  return lider?.id ?? primero;
}

/** Sin favorito en un lugar de la lista: el hook igual se llama (cantidad fija), sin pedir nada. */
const VACIO: Pick<FavoritoV1, 'tipo' | 'refId'> = { tipo: 'linea_subte', refId: '-' };

/**
 * Dato vivo de los hasta 5 favoritos visibles. Los hooks no se llaman en un bucle de largo
 * variable: hay exactamente `FAVORITOS_EN_INICIO` llamadas y las que sobran van deshabilitadas.
 * Así Inicio tiene todos los datos juntos para elegir la frescura más vieja.
 */
function useLiveDeVisibles(visibles: readonly FavoritoV1[]): FavoritoLiveDataResult[] {
  const at = (i: number) => visibles[i] ?? VACIO;
  const on = (i: number) => ({ enabled: visibles[i] !== undefined });
  const live = [
    useFavoritoLiveData(at(0), on(0)),
    useFavoritoLiveData(at(1), on(1)),
    useFavoritoLiveData(at(2), on(2)),
    useFavoritoLiveData(at(3), on(3)),
    useFavoritoLiveData(at(4), on(4)),
  ];
  return live.slice(0, Math.min(visibles.length, FAVORITOS_EN_INICIO));
}

const ESTADO_DE_LINEA: Partial<Record<EstadoServicioV1, SignBandStatus>> = {
  demorada: { text: 'Con demoras', tone: 'warning' },
  interrumpida: { text: 'Interrumpida', tone: 'danger' },
};

type ModeloBanda = Omit<SignBandProps, 'variant' | 'onPress'>;

/** De favorito + dato vivo a lo que dibuja la banda. Puro: lo prueban los tests. */
export function modeloBanda(
  f: FavoritoV1,
  live: FavoritoLiveDataResult,
  { lider, estadoLinea }: { lider: boolean; estadoLinea?: EstadoServicioV1 | undefined },
): ModeloBanda {
  const message = mensajeDeFavorito(f, live.sentido);
  const base = { icon: TIPO_ICON[f.tipo], message, testID: `inicio-favorito-${f.id}` };
  const descripcion = descripcionDeFavorito(f);

  if (live.status === 'loading') {
    return { ...base, value: null, accessibilityLabel: `${descripcion}, cargando` };
  }
  if (live.status === 'error' || live.status === 'none' || live.status === 'orphan') {
    const value = live.primary === '' ? live.text : live.primary;
    return {
      ...base,
      value,
      valueStyle: 'text',
      accessibilityLabel: `${descripcion}, ${live.status === 'orphan' ? live.spoken : value}`,
    };
  }

  // Estado de la línea de una estación (cuadrado ámbar o rojo) y antigüedad si el dato está viejo.
  const linea = estadoLinea === undefined ? undefined : ESTADO_DE_LINEA[estadoLinea];
  const edad = live.status === 'stale' && live.ageText !== undefined ? live.ageText : '';
  const status: SignBandStatus | undefined =
    linea !== undefined
      ? { tone: linea.tone, text: edad === '' ? linea.text : `${linea.text} · ${edad}` }
      : edad !== ''
        ? { tone: 'muted', text: edad }
        : undefined;
  const label = lider && live.primaryIsArribo ? 'Próximo' : undefined;
  return {
    ...base,
    value: live.primary,
    valueStyle: live.primaryIsArribo ? 'display' : 'text',
    label,
    status,
    accessibilityLabel: [descripcion, live.spoken, linea?.text.toLowerCase()]
      .filter((x) => x !== undefined && x !== '')
      .join(', '),
  };
}

function Favoritos({
  favoritos,
  lineas,
  red,
  subteTimestamp,
}: {
  favoritos: readonly FavoritoV1[];
  lineas: readonly LineaConEstado[] | undefined;
  red: RedSubte | undefined;
  subteTimestamp: string | null;
}) {
  const router = useRouter();
  const { colors, fontFamily, component } = useTheme();
  const { seconds } = useRefreshInterval();
  const visibles = useMemo(() => favoritos.slice(0, FAVORITOS_EN_INICIO), [favoritos]);
  const live = useLiveDeVisibles(visibles);

  // Líder por cercanía: solo si el permiso YA está concedido (se lee sin diálogo, S32).
  const { position } = useUbicacion({ watch: false });
  const hayParadas = visibles.some((f) => f.tipo === 'parada_colectivo');
  const paradas = useStaticArchivoGrande('paradas.json', {
    enabled: position !== null && hayParadas,
  });
  const estaciones = red?.estacionPorId;
  const posParadas = useMemo(() => {
    if (paradas.data === undefined) return undefined;
    const ids = new Set(visibles.filter((f) => f.tipo === 'parada_colectivo').map((f) => f.refId));
    return new Map(
      paradas.data.paradas.filter((p) => ids.has(p.id)).map((p) => [p.id, p] as const),
    );
  }, [paradas.data, visibles]);
  const liderId = elegirLider(
    visibles,
    position === null ? null : { lat: position.lat, lon: position.lon },
    estaciones,
    posParadas,
  );

  const estadoDeEstacion = (f: FavoritoV1): EstadoServicioV1 | undefined => {
    if (f.tipo !== 'estacion_subte') return undefined;
    const key = estaciones?.get(f.refId)?.linea;
    return lineas?.find((l) => l.linea.key === key)?.estado;
  };

  const bandas = visibles.map((f, i) => ({ f, live: live[i] }));
  const lider = bandas.find((b) => b.f.id === liderId);
  const resto = bandas.filter((b) => b.f.id !== liderId);
  const abrir = (f: FavoritoV1) => () => {
    router.push(hrefDeFavorito(f));
  };

  // Frescura: el dato más viejo de lo que se ve (bandas y tira del subte).
  const masViejo = [subteTimestamp, ...live.map((l) => l.sourceTimestamp)]
    .filter((t): t is string => t !== null && Number.isFinite(Date.parse(t)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];

  const modeloLider =
    lider?.live === undefined
      ? undefined
      : modeloBanda(lider.f, lider.live, { lider: true, estadoLinea: estadoDeEstacion(lider.f) });
  const liderBanda =
    lider === undefined || modeloLider === undefined ? null : (
      <SignBand
        // Lugar fijo: si cambia el líder, la misma banda cruza en fundido (movimiento firma).
        key="lider"
        variant="lead"
        {...modeloLider}
        transitionKey={`${lider.f.id}|${modeloLider.value ?? ''}`}
        onPress={abrir(lider.f)}
      />
    );

  return (
    <>
      <View style={{ gap: GAP_BANDAS }} accessibilityRole="list">
        {liderBanda}
        {resto.map(({ f, live: l }) =>
          l === undefined ? null : (
            <SignBand
              key={f.id}
              variant="next"
              {...modeloBanda(f, l, { lider: false, estadoLinea: estadoDeEstacion(f) })}
              onPress={abrir(f)}
            />
          ),
        )}
      </View>
      <View style={styles.meta}>
        {masViejo === undefined ? (
          <View />
        ) : (
          <FreshnessLabel
            sourceTimestamp={masViejo}
            intervalSeconds={seconds}
            testID="inicio-frescura"
          />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            router.push('/favoritos');
          }}
          hitSlop={8}
          style={{ minHeight: component.hitSlop, justifyContent: 'center' }}
        >
          <Text
            variant="text.md"
            color={colors.text.link}
            style={{ fontFamily: fontFamily.text[600], fontSize: 15, lineHeight: 20 }}
          >
            {`Ver todos los favoritos (${favoritos.length})`}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function SinFavoritos() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
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
  );
}

const styles = StyleSheet.create({
  tira: { padding: 10, gap: 8 },
  tiraFila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  etiqueta: { marginRight: 'auto' },
  insignias: { flexDirection: 'row', gap: 6 },
  errorCompacto: { padding: 8, gap: 8 },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
});
