// Mapa de la red de subte (tarea 4.3). Brief operativo y suposiciones F4-mapa-n:
// src/shared/map/README.md, "Mapa de la red de subte".
//
// - Trazos: `subte-red.geojson` con el `route_color` del GTFS de cada línea (N2) sobre un
//   contorno del color de texto del tema (oscuro en claro, claro en oscuro) y la letra de la línea
//   a lo largo del trazo: el color nunca es la única pista.
// - Estaciones: `subte-estaciones.json` (`useStaticArchivo`, el mismo que usa la lista) como
//   círculos; el nombre aparece desde zoom 14.
// - Tocar una estación → `/subtes/estacion/[id]`; tocar un trazo → `/subtes/[linea]`. Si un
//   toque cae sobre las dos cosas, gana la estación.
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/shared/icons';
import {
  boundsOf,
  MAP_FONT,
  MapView,
  pointCollection,
  pressedProperty,
  useStaticGeoJson,
} from '@/shared/map';
import { useIsOnline } from '@/shared/query';
import { useStaticArchivo } from '@/shared/static';
import { useTheme } from '@/shared/theme';
import { EmptyState, ErrorState, Skeleton, SkeletonGroup } from '@/shared/ui';

export const MAPA_RED_LABEL = 'Mapa de la red de subte';

/** Ids de fuentes y capas (también son los `testID` de los mocks de Jest). */
export const SOURCE_LINEAS = 'subte-lineas';
export const SOURCE_ESTACIONES = 'subte-estaciones';
export const LAYER = {
  contorno: 'subte-lineas-contorno',
  trazo: 'subte-lineas-trazo',
  letra: 'subte-lineas-letra',
  estacion: 'subte-estaciones-punto',
  nombre: 'subte-estaciones-nombre',
} as const;

/** Medio lado del área táctil alrededor del toque: 22 + 22 = 44 pt. */
const HITBOX = { top: 22, right: 22, bottom: 22, left: 22 };
/** Ventana para juntar los toques de las dos fuentes y quedarse con el de la estación. */
export const PRESS_SETTLE_MS = 60;

type Pressed = { kind: 'estacion'; id: string } | { kind: 'linea'; linea: string };

export function MapaRedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const red = useStaticGeoJson('subte-red.geojson');
  const estaciones = useStaticArchivo('subte-estaciones.json');
  const online = useIsOnline();

  const estacionesFc = useMemo(
    () =>
      pointCollection(estaciones.data?.estaciones ?? [], (e) => ({
        id: e.id,
        coordinates: [e.lon, e.lat],
        properties: { id: e.id, nombre: e.nombre },
      })),
    [estaciones.data],
  );

  const bounds = useMemo(() => (red.data ? boundsOf(red.data) : null), [red.data]);

  // Junta los toques de una misma pulsación (cada fuente avisa por separado) y navega una vez.
  const pending = useRef<Pressed | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const press = useCallback(
    (next: Pressed) => {
      if (pending.current?.kind !== 'estacion') pending.current = next;
      if (timer.current) return;
      timer.current = setTimeout(() => {
        const target = pending.current;
        pending.current = null;
        timer.current = null;
        if (!target) return;
        if (target.kind === 'estacion') {
          router.push({ pathname: '/subtes/estacion/[id]', params: { id: target.id } });
        } else {
          router.push({ pathname: '/subtes/[linea]', params: { linea: target.linea } });
        }
      }, PRESS_SETTLE_MS);
    },
    [router],
  );

  const retry = () => {
    void red.refetch();
    void estaciones.refetch();
  };

  const loadingError = red.isLoadingError ? red : estaciones.isLoadingError ? estaciones : null;
  if (loadingError?.error) {
    const message = loadingError.error.userMessage();
    return (
      <View style={styles.center}>
        <ErrorState
          title={message.title}
          cause={message.cause ?? 'Probá de nuevo en un rato.'}
          retryable={loadingError.error.retryable}
          onRetry={retry}
          retrying={red.isFetching || estaciones.isFetching}
          testID="mapa-red-error"
        />
      </View>
    );
  }

  if (!red.data || !estaciones.data) {
    if (!online) {
      return (
        <View style={styles.center}>
          <EmptyState
            title="Sin conexión"
            message="El mapa de la red se carga cuando vuelvas a tener conexión. Mientras tanto, la lista de Subtes sigue disponible."
            icon={<Icon name="sinConexion" />}
            testID="mapa-red-offline"
          />
        </View>
      );
    }
    return (
      <SkeletonGroup accessibilityLabel="Cargando el mapa de la red…" testID="mapa-red-cargando">
        <Skeleton height={height} radius={0} />
      </SkeletonGroup>
    );
  }

  if (red.data.features.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState
          message="Todavía no tenemos el mapa de la red. Mientras tanto, la lista de Subtes tiene todas las líneas y estaciones."
          icon={<Icon name="mapa" />}
          testID="mapa-red-vacio"
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        accessibilityLabel={MAPA_RED_LABEL}
        {...(bounds ? { initialBounds: bounds } : {})}
        testID="mapa-red"
      >
        <GeoJSONSource
          id={SOURCE_LINEAS}
          data={red.data}
          hitbox={HITBOX}
          onPress={(event) => {
            const linea = pressedProperty(event.nativeEvent.features, 'linea');
            if (linea) press({ kind: 'linea', linea });
          }}
        >
          <Layer
            id={LAYER.contorno}
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': colors.text.primary,
              'line-width': ['interpolate', ['linear'], ['zoom'], 11, 5, 15, 10],
            }}
          />
          <Layer
            id={LAYER.trazo}
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 6],
            }}
          />
          <Layer
            id={LAYER.letra}
            type="symbol"
            layout={{
              'symbol-placement': 'line',
              'symbol-spacing': 300,
              'text-field': ['get', 'linea'],
              'text-font': MAP_FONT,
              'text-size': 12,
            }}
            paint={{
              'text-color': colors.text.primary,
              'text-halo-color': colors.bg.base,
              'text-halo-width': 2,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource
          id={SOURCE_ESTACIONES}
          data={estacionesFc}
          hitbox={HITBOX}
          onPress={(event) => {
            const id = pressedProperty(event.nativeEvent.features, 'id');
            if (id) press({ kind: 'estacion', id });
          }}
        >
          <Layer
            id={LAYER.estacion}
            type="circle"
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 15, 6],
              'circle-color': colors.bg.base,
              'circle-stroke-color': colors.text.primary,
              'circle-stroke-width': 2,
            }}
          />
          <Layer
            id={LAYER.nombre}
            type="symbol"
            minzoom={14}
            layout={{
              'text-field': ['get', 'nombre'],
              'text-font': MAP_FONT,
              'text-size': 12,
              'text-anchor': 'top',
              'text-offset': [0, 0.9],
              'text-optional': true,
            }}
            paint={{
              'text-color': colors.text.primary,
              'text-halo-color': colors.bg.base,
              'text-halo-width': 1.5,
            }}
          />
        </GeoJSONSource>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
});
