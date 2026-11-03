// Raíz del tab Colectivos (brief 02-colectivos §3): búsqueda local, paradas cercanas, líneas
// recientes y favoritos de colectivo. Estados en README.md ("Brief operativo").
import type { ParadaV1 } from '@transportate/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { FavoritoLiveData, useFavoritos, type FavoritoV1 } from '@/features/favoritos';
import { FilaTocable, ScreenScroll, Seccion, usePullToRefresh } from '@/features/subtes';
import { invalidateColectivos } from '@/shared/api';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Button,
  EmptyState,
  ErrorState,
  LineBadge,
  SearchInput,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/shared/ui';

import { useIndiceColectivos } from './hooks';
import {
  buscar,
  describirLineas,
  formatDistancia,
  isInsideCaba,
  numerosDeParada,
  paradasCercanas,
  type IndiceColectivos,
  type LineaColectivo,
} from './model';
import { useAbrirLinea } from './navigation';
import { ProgresoIndice } from './ProgresoIndice';
import { useRecientes } from './recientes';
import { useUbicacionCercana } from './useUbicacionCercana';

export const PREPARANDO = 'Preparando el listado de líneas y paradas…';
export const ERROR_INDICE = 'No pudimos descargar las líneas y paradas';
export const FUERA_DE_CABA =
  'No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires.';
export const PERMISO_TEXTO =
  'Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono.';
export const CERCANAS_INICIAL = 10;
export const CERCANAS_MAX = 30;

export function ColectivosScreen() {
  const { colors } = useTheme();
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
      <ScreenScroll refreshing={refreshing} onRefresh={onRefresh} testID="colectivos-screen">
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
          <ProgresoIndice progress={indice.progress} label={PREPARANDO} />
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

// ---------------------------------------------------------------- búsqueda

function Resultados({ indice, consulta }: { indice: IndiceColectivos; consulta: string }) {
  const abrirLinea = useAbrirLinea();
  const router = useRouter();
  const r = useMemo(() => buscar(indice, consulta), [indice, consulta]);
  if (r.lineas.length === 0 && r.paradas.length === 0) {
    return (
      <EmptyState
        testID="sin-resultados"
        message={`No encontramos «${consulta.trim()}». Probá con el número de línea o el nombre de una calle.`}
      />
    );
  }
  return (
    <View style={{ gap: 8 }} accessibilityRole="list">
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
    </View>
  );
}

export function LineaFila({ linea, onPress }: { linea: LineaColectivo; onPress: () => void }) {
  return (
    <FilaTocable
      onPress={onPress}
      testID={`linea-${linea.lineaId}`}
      accessibilityLabel={`Línea ${linea.numero}. ${linea.descripcion}`}
    >
      <LineBadge kind="colectivo" label={linea.numero} />
      <Text variant="text.md" style={{ flex: 1 }} numberOfLines={2}>
        {linea.descripcion}
      </Text>
    </FilaTocable>
  );
}

export function ParadaFila({
  parada,
  distancia,
  onPress,
}: {
  parada: ParadaV1;
  distancia?: string;
  onPress: () => void;
}) {
  const numeros = numerosDeParada(parada);
  return (
    <FilaTocable
      onPress={onPress}
      testID={`parada-${parada.id}`}
      accessibilityLabel={[`Parada ${parada.nombre}`, distancia, describirLineas(numeros)]
        .filter((x) => x !== undefined)
        .join('. ')}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}>
          <Text variant="headline.sm" style={{ flex: 1 }} numberOfLines={2}>
            {parada.nombre}
          </Text>
          {distancia !== undefined ? (
            <Text variant="text.sm" tone="secondary">
              {distancia}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {numeros.map((n) => (
            <LineBadge key={n} kind="colectivo" label={n} size="sm" />
          ))}
        </View>
      </View>
    </FilaTocable>
  );
}

// ---------------------------------------------------------------- cercanas

function Cercanas({
  indice,
  onBuscarAMano,
}: {
  indice: IndiceColectivos;
  onBuscarAMano: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const ubicacion = useUbicacionCercana();
  const [limite, setLimite] = useState(CERCANAS_INICIAL);
  const punto = ubicacion.punto;
  const cercanas = useMemo(
    () => (punto === null ? [] : paradasCercanas(indice.paradas, punto, CERCANAS_MAX)),
    [indice.paradas, punto],
  );

  let contenido;
  switch (ubicacion.status) {
    case 'checking':
    case 'locating':
      contenido = (
        <SkeletonGroup accessibilityLabel="Buscando paradas cerca tuyo…" testID="cercanas-skeleton">
          <View style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={64} radius={16} />
            ))}
          </View>
        </SkeletonGroup>
      );
      break;
    case 'prompt':
    case 'blocked':
    case 'unavailable':
      contenido = (
        <View style={{ gap: 12 }} testID="permiso-ubicacion">
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Icon name="sinUbicacion" size={24} color={colors.text.secondary} />
            <Text variant="text.md" style={{ flex: 1 }}>
              {ubicacion.status === 'unavailable'
                ? 'No pudimos saber dónde estás. Revisá que la ubicación del teléfono esté activada.'
                : PERMISO_TEXTO}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ubicacion.status === 'blocked' ? (
              <Button
                label="Abrir configuración"
                size="md"
                onPress={() => void ubicacion.openSettings()}
              />
            ) : (
              <Button
                label={ubicacion.status === 'unavailable' ? 'Volver a intentar' : 'Activar'}
                size="md"
                icon={<Icon name="paradasCercanas" size={20} color={colors.role.primary.on} />}
                onPress={() => void ubicacion.request()}
              />
            )}
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
      break;
    case 'located':
      if (punto === null || !isInsideCaba(punto)) {
        contenido = <EmptyState testID="fuera-de-caba" message={FUERA_DE_CABA} />;
      } else if (cercanas.length === 0) {
        contenido = (
          <EmptyState
            testID="sin-cercanas"
            message="No encontramos paradas cerca. Probá buscando una calle."
          />
        );
      } else {
        contenido = (
          <>
            <View style={{ gap: 8 }} accessibilityRole="list">
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
            </View>
            {cercanas.length > limite ? (
              <Button
                label="Ver más"
                variant="link"
                size="md"
                onPress={() => {
                  setLimite(CERCANAS_MAX);
                }}
              />
            ) : null}
          </>
        );
      }
      break;
  }

  return (
    <View style={{ gap: 12 }}>
      <Seccion>Paradas cercanas</Seccion>
      {contenido}
    </View>
  );
}

// ---------------------------------------------------------------- recientes y favoritos

function Recientes() {
  const { recientes } = useRecientes();
  const abrirLinea = useAbrirLinea();
  if (recientes.length === 0) return null;
  return (
    <View style={{ gap: 12 }}>
      <Seccion>Líneas recientes</Seccion>
      <View style={{ gap: 8 }} accessibilityRole="list">
        {recientes.map((r) => (
          <FilaTocable
            key={r.lineaId}
            testID={`reciente-${r.lineaId}`}
            accessibilityLabel={`Línea ${r.numero}. ${r.descripcion}`}
            onPress={() => {
              abrirLinea(r);
            }}
          >
            <LineBadge kind="colectivo" label={r.numero} />
            <Text variant="text.md" style={{ flex: 1 }} numberOfLines={2}>
              {r.descripcion}
            </Text>
          </FilaTocable>
        ))}
      </View>
    </View>
  );
}

function FavoritosColectivo() {
  const router = useRouter();
  const { colors } = useTheme();
  const { favoritos } = useFavoritos();
  const propios = favoritos.filter(
    (f) => f.tipo === 'linea_colectivo' || f.tipo === 'parada_colectivo',
  );
  if (propios.length === 0) return null;
  const abrir = (f: FavoritoV1) => {
    if (f.tipo === 'parada_colectivo') {
      router.push({ pathname: '/colectivos/parada/[id]', params: { id: f.refId } });
    } else {
      router.push({ pathname: '/colectivos/[linea]', params: { linea: f.refId } });
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Seccion>Tus favoritos</Seccion>
      <View style={{ gap: 8 }} accessibilityRole="list">
        {propios.map((f) => (
          <FilaTocable
            key={f.id}
            testID={`favorito-${f.id}`}
            accessibilityLabel={[f.alias, f.nombre, f.subtitulo]
              .filter((x) => x !== undefined)
              .join('. ')}
            onPress={() => {
              abrir(f);
            }}
          >
            <Icon
              name={f.tipo === 'parada_colectivo' ? 'parada' : 'colectivos'}
              size={24}
              color={colors.text.secondary}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="headline.sm" numberOfLines={1}>
                {f.alias ?? f.nombre}
              </Text>
              <FavoritoLiveData favorito={f} />
            </View>
          </FilaTocable>
        ))}
      </View>
    </View>
  );
}
