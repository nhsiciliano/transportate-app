// Raíz del tab Colectivos (brief 02-colectivos §3; dirección «Señalética de terminal», F5-MID-B).
// Buscar (`SearchInput`), paradas cercanas y recientes en placas de tablero (`Board`) y, solo para
// los favoritos —las únicas decisiones vivas de esta pantalla—, bandas de señal. Estados en
// README.md ("Brief operativo F5").
import type { ParadaV1 } from '@transportate/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFavoritoLiveData, useFavoritos, type FavoritoV1 } from '@/features/favoritos';
import { hrefDeFavorito } from '@/features/inicio';
import { modeloBanda } from '@/features/favoritos';
import { ScreenScroll, usePullToRefresh } from '@/features/subtes';
import { isInsideCaba, PermisoUbicacionBloque, useUbicacion } from '@/features/ubicacion';
import { invalidateColectivos } from '@/shared/api';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Board,
  Button,
  EmptyState,
  ErrorState,
  LineBadge,
  Pictogram,
  SearchInput,
  SignBand,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/shared/ui';

import { useIndiceColectivos } from './hooks';
import {
  buscar,
  describirLineas,
  formatDistancia,
  numerosDeParada,
  paradasCercanas,
  textoDeLineas,
  type IndiceColectivos,
  type LineaColectivo,
} from './model';
import { useAbrirLinea } from './navigation';
import { ProgresoIndice } from './ProgresoIndice';
import { useRecientes } from './recientes';

export const PREPARANDO = 'Preparando el listado de líneas y paradas…';
export const ERROR_INDICE = 'No pudimos descargar las líneas y paradas';
export const FUERA_DE_CABA =
  'No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires.';
/** El texto del bloque de permiso es el de `features/ubicacion` (`PERMISO_TITLE`/`PERMISO_DETAIL`). */
export const SIN_POSICION =
  'No pudimos saber dónde estás. Revisá que la ubicación del teléfono esté activada.';
export const CERCANAS_INICIAL = 10;
export const CERCANAS_MAX = 30;

/** Separación entre bloques (la de Inicio: 12 pt) y entre bandas (8 pt). */
const GAP_BLOQUES = 12;
const GAP_BANDAS = 8;

export function ColectivosScreen() {
  const { colors, scheme } = useTheme();
  const queryClient = useQueryClient();
  const indice = useIndiceColectivos();
  const [consulta, setConsulta] = useState('');
  // "Buscar a mano": se vuelve a montar el campo con foco.
  const [focusNonce, setFocusNonce] = useState(0);
  const { refreshing, onRefresh } = usePullToRefresh([() => invalidateColectivos(queryClient)]);
  const buscando = consulta.trim() !== '';
  const listo = indice.indice !== undefined;

  return (
    <>
      <Stack.Screen options={{ title: 'Colectivos', headerLargeTitleEnabled: true }} />
      <ScreenScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
        testID="colectivos-screen"
        // Mismo mundo que Inicio: fondo elevado en claro, el de la app en oscuro.
        backgroundColor={scheme === 'light' ? colors.bg.elevated : colors.bg.base}
        gap={GAP_BLOQUES}
      >
        <SearchInput
          key={focusNonce}
          autoFocus={focusNonce > 0}
          value={consulta}
          onChangeText={setConsulta}
          onClear={() => {
            setConsulta('');
          }}
          editable={listo}
          label="Buscá una línea o parada"
          icon={<Icon name="buscar" size={20} color={colors.text.secondary} />}
          clearIcon={<Icon name="limpiarBusqueda" size={20} color={colors.text.secondary} />}
        />
        {indice.isLoadingError ? (
          <ErrorState
            testID="indice-error"
            title={ERROR_INDICE}
            cause={indice.error?.userMessage().cause ?? 'Revisá tu conexión y volvé a intentar.'}
            retryable={indice.error?.retryable ?? true}
            onRetry={() => void indice.refetch()}
          />
        ) : indice.indice === undefined ? (
          <Placa>
            <ProgresoIndice progress={indice.progress} label={PREPARANDO} />
          </Placa>
        ) : buscando ? (
          <Resultados indice={indice.indice} consulta={consulta} />
        ) : (
          <>
            <Cercanas
              indice={indice.indice}
              onBuscarAMano={() => {
                setFocusNonce((n) => n + 1);
              }}
            />
            <Recientes />
            <FavoritosColectivo />
          </>
        )}
      </ScreenScroll>
    </>
  );
}

/** Contenido suelto dentro de una placa sin etiqueta (progreso de la descarga). */
function Placa({ children }: { children: React.ReactNode }) {
  return (
    <Board testID="indice-placa">
      <View style={styles.relleno}>{children}</View>
    </Board>
  );
}

// ---------------------------------------------------------------- búsqueda

function Resultados({ indice, consulta }: { indice: IndiceColectivos; consulta: string }) {
  const abrirLinea = useAbrirLinea();
  const router = useRouter();
  const r = useMemo(() => buscar(indice, consulta), [indice, consulta]);
  if (r.lineas.length === 0 && r.paradas.length === 0) {
    return (
      <Board>
        <EmptyState
          testID="sin-resultados"
          message={`No encontramos «${consulta.trim()}». Probá con el número de línea o el nombre de una calle.`}
        />
      </Board>
    );
  }
  return (
    <Board testID="resultados">
      {r.lineas.map((l) => (
        <LineaFila
          key={`l-${l.lineaId}`}
          linea={l}
          onPress={() => {
            abrirLinea(l);
          }}
        />
      ))}
      {r.paradas.map((p) => (
        <ParadaFila
          key={`p-${p.id}`}
          parada={p}
          onPress={() => {
            router.push({ pathname: '/colectivos/parada/[id]', params: { id: p.id } });
          }}
        />
      ))}
    </Board>
  );
}

/** Fila de línea: la insignia, «Línea 60» y su ramal y cabecera. Va dentro de un `Board`. */
export function LineaFila({ linea, onPress }: { linea: LineaColectivo; onPress: () => void }) {
  return (
    <Board.Row
      onPress={onPress}
      testID={`linea-${linea.lineaId}`}
      leading={<LineBadge kind="colectivo" label={linea.numero} />}
      title={`Línea ${linea.numero}`}
      subtitle={linea.descripcion}
      accessibilityLabel={`Línea ${linea.numero}. ${linea.descripcion}`}
    />
  );
}

/**
 * Fila de parada: pictograma, calle y altura, las líneas que paran («60 · 152 · 168») y, si hay,
 * la distancia («a 120 m») a la derecha. Va dentro de un `Board`.
 */
export function ParadaFila({
  parada,
  distancia,
  onPress,
}: {
  parada: ParadaV1;
  distancia?: string;
  onPress: () => void;
}) {
  const { fontFamily } = useTheme();
  const numeros = numerosDeParada(parada);
  return (
    <Board.Row
      onPress={onPress}
      testID={`parada-${parada.id}`}
      leading={<Pictogram icon="parada" size={32} tone="board" />}
      title={parada.nombre}
      subtitle={textoDeLineas(numeros)}
      trailing={
        distancia === undefined ? undefined : (
          <Text
            variant="headline.sm"
            style={{ fontFamily: fontFamily.text[600], fontSize: 15, lineHeight: 20 }}
          >
            {distancia}
          </Text>
        )
      }
      accessibilityLabel={[`Parada ${parada.nombre}`, distancia, describirLineas(numeros)]
        .filter((x) => x !== undefined)
        .join('. ')}
    />
  );
}

// ---------------------------------------------------------------- cercanas

/** Silueta de la carga: tres filas con pictograma, calle y líneas. Va dentro de la placa. */
function FilasEsqueleto() {
  return (
    <SkeletonGroup accessibilityLabel="Buscando paradas cerca tuyo…" testID="cercanas-skeleton">
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.filaEsqueleto}>
          <Skeleton height={32} width={32} radius={4} />
          <View style={styles.textosEsqueleto}>
            <Skeleton height={16} width="55%" radius={4} />
            <Skeleton height={12} width="35%" radius={4} />
          </View>
          <Skeleton height={14} width={48} radius={4} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

function Cercanas({
  indice,
  onBuscarAMano,
}: {
  indice: IndiceColectivos;
  onBuscarAMano: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  // Una lectura de la posición, sin `watch` (F4-colectivos-4): `features/ubicacion`.
  const ubicacion = useUbicacion({ watch: false });
  const [limite, setLimite] = useState(CERCANAS_INICIAL);
  const posicion = ubicacion.position;
  const cercanas = useMemo(
    () =>
      posicion === null
        ? []
        : paradasCercanas(indice.paradas, { lat: posicion.lat, lon: posicion.lon }, CERCANAS_MAX),
    [indice.paradas, posicion],
  );
  const punto = posicion === null ? null : { lat: posicion.lat, lon: posicion.lon };

  let contenido;
  if (
    !ubicacion.checked ||
    (ubicacion.permission === 'granted' && punto === null && !ubicacion.positionUnavailable)
  ) {
    contenido = <FilasEsqueleto />;
  } else if (ubicacion.permission !== 'granted') {
    contenido = (
      <PermisoUbicacionBloque
        inset
        testID="permiso-ubicacion"
        permission={ubicacion.permission}
        onRequest={() => void ubicacion.request()}
        onOpenSettings={() => void ubicacion.openSettings()}
        onManual={onBuscarAMano}
      />
    );
  } else if (punto === null) {
    contenido = (
      <View style={[styles.relleno, styles.sinPosicion]} testID="sin-posicion">
        <View style={styles.sinPosicionTexto}>
          <Icon name="sinUbicacion" size={24} color={colors.text.secondary} />
          <Text variant="text.md" style={styles.flex}>
            {SIN_POSICION}
          </Text>
        </View>
        <View style={styles.botones}>
          <Button label="Volver a intentar" size="md" onPress={() => void ubicacion.refresh()} />
          <Button
            label="Buscar a mano"
            size="md"
            variant="secondary"
            outline
            onPress={onBuscarAMano}
          />
        </View>
      </View>
    );
  } else if (!isInsideCaba(punto.lat, punto.lon)) {
    contenido = <EmptyState testID="fuera-de-caba" message={FUERA_DE_CABA} />;
  } else if (cercanas.length === 0) {
    contenido = (
      <EmptyState
        testID="sin-cercanas"
        message="No encontramos paradas cerca. Probá buscando una calle."
      />
    );
  } else {
    return (
      <Board label="Paradas cercanas" testID="cercanas">
        {cercanas.slice(0, limite).map(({ parada, metros }) => (
          <ParadaFila
            key={parada.id}
            parada={parada}
            distancia={formatDistancia(metros)}
            onPress={() => {
              router.push({ pathname: '/colectivos/parada/[id]', params: { id: parada.id } });
            }}
          />
        ))}
        {cercanas.length > limite ? (
          <Board.Row
            key="ver-mas"
            testID="cercanas-ver-mas"
            title="Ver más"
            onPress={() => {
              setLimite(CERCANAS_MAX);
            }}
          />
        ) : null}
      </Board>
    );
  }

  return (
    <Board label="Paradas cercanas" testID="cercanas">
      {contenido}
    </Board>
  );
}

// ---------------------------------------------------------------- recientes y favoritos

function Recientes() {
  const { recientes } = useRecientes();
  const abrirLinea = useAbrirLinea();
  if (recientes.length === 0) return null;
  return (
    <Board label="Recientes" testID="recientes">
      {recientes.map((r) => (
        <Board.Row
          key={r.lineaId}
          testID={`reciente-${r.lineaId}`}
          leading={<LineBadge kind="colectivo" label={r.numero} />}
          title={`Línea ${r.numero}`}
          subtitle={r.descripcion}
          accessibilityLabel={`Línea ${r.numero}. ${r.descripcion}`}
          onPress={() => {
            abrirLinea(r);
          }}
        />
      ))}
    </Board>
  );
}

/** Un favorito de colectivo: la misma banda `next` que en Inicio, con su dato vivo. */
function FavoritoBanda({ favorito }: { favorito: FavoritoV1 }) {
  const router = useRouter();
  const live = useFavoritoLiveData(favorito);
  const modelo = modeloBanda(favorito, live, { lider: false });
  return (
    <SignBand
      variant="next"
      {...modelo}
      testID={`favorito-${favorito.id}`}
      // Si cambia el valor, la banda cruza en fundido (movimiento firma, ya resuelto en SignBand).
      transitionKey={`${favorito.id}|${modelo.value ?? ''}`}
      onPress={() => {
        router.push(hrefDeFavorito(favorito));
      }}
    />
  );
}

function FavoritosColectivo() {
  const { fontFamily } = useTheme();
  const { favoritos } = useFavoritos();
  const propios = favoritos.filter(
    (f) => f.tipo === 'linea_colectivo' || f.tipo === 'parada_colectivo',
  );
  if (propios.length === 0) return null;
  return (
    <View style={styles.favoritos} testID="favoritos-colectivo">
      <Text
        variant="text.sm"
        tone="secondary"
        accessibilityRole="header"
        style={{ fontFamily: fontFamily.text[600], fontSize: 13, lineHeight: 16 }}
      >
        Tus favoritos
      </Text>
      {propios.map((f) => (
        <FavoritoBanda key={f.id} favorito={f} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  relleno: { padding: 12 },
  sinPosicion: { gap: 12 },
  sinPosicionTexto: { flexDirection: 'row', gap: 12 },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filaEsqueleto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
  },
  textosEsqueleto: { flex: 1, gap: 6 },
  favoritos: { gap: GAP_BANDAS },
});
