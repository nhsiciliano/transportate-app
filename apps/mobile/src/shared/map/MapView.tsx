// Mapa base de la app sobre MapLibre v11 (ADR-0002). Lo usan Subtes (4.3) y Colectivos (4.6).
//
// - Estilo claro u oscuro de OpenFreeMap según `useTheme().scheme`; cambia solo con el tema.
// - Atribución propia siempre visible (abajo a la izquierda); la nativa y el logo se apagan.
// - Controles (abajo a la derecha, ≥ 44 pt): "Norte arriba" siempre; "Centrar en mí" solo si el
//   permiso de ubicación YA está concedido (este componente nunca lo pide, S32).
// - Reducir movimiento: la cámara salta (duración 0) en lugar de animar.
// - iOS: una franja de 20 pt en el borde izquierdo no le pasa toques al mapa, así el gesto de
//   volver del stack no queda capturado por el arrastre del mapa.
// - La posición de "Centrar en mí" vive solo en memoria (docs/05-privacidad.md §3).
import {
  Camera,
  Map,
  UserLocation,
  type CameraRef,
  type InitialViewState,
  type LngLat,
  type LngLatBounds,
  type MapProps,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useCallback, useImperativeHandle, useMemo, useRef, type ReactNode, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../icons';
import { useTheme } from '../theme';
import { Text, useReduceMotion } from '../ui';
import { CABA_BOUNDS, MAP_ATTRIBUTION, mapStyleFor } from './styles';
import { useLocationGranted } from './useLocationGranted';

/** Duración de los movimientos de cámara cuando se puede animar. */
export const CAMERA_ANIMATION_MS = 500;
/** Zoom al centrar en la persona: se ven las cuadras y las paradas cercanas. */
export const USER_ZOOM = 15;
/** Ancho de la franja izquierda reservada al gesto de volver de iOS. */
export const EDGE_GESTURE_GUTTER = 20;
/** Lado de los botones de control: más que el mínimo de 44 pt. */
const CONTROL_SIZE = 48;

/** Lo que una pantalla puede pedirle a la cámara (respeta "Reducir movimiento"). */
export interface MapViewHandle {
  flyTo(center: LngLat, zoom?: number): void;
  fitBounds(bounds: LngLatBounds): void;
  /** Mueve la cámara sin cambiar el zoom (seguir un vehículo). */
  centerOn(center: LngLat): void;
  resetNorth(): void;
}

/**
 * Permiso de ubicación que maneja la pantalla (`useUbicacion()` de `features/ubicacion`). Con
 * esto, "Centrar en mi ubicación" aparece también sin permiso y, al tocarlo, lo pide en contexto
 * (S32). Sin esta prop el mapa solo consulta el permiso y nunca lo pide.
 */
export interface MapLocationControl {
  granted: boolean;
  /** Abre el diálogo del sistema; devuelve si quedó concedido. */
  request: () => Promise<boolean>;
}

export interface MapViewProps {
  /** Lo anuncia el lector de pantalla ("Mapa de la red de subte"). */
  accessibilityLabel: string;
  /** Fuentes y capas (`GeoJSONSource` + `Layer`). */
  children?: ReactNode;
  /** Extensión inicial `[oeste, sur, este, norte]`. Default: CABA. Gana sobre `initialCenter`. */
  initialBounds?: LngLatBounds;
  initialCenter?: LngLat;
  /** Con `initialCenter`. Default 13. */
  initialZoom?: number;
  /** Toque en el mapa (fuera de las fuentes con `onPress` propio). */
  onPress?: MapProps['onPress'];
  /** Dibuja el punto de la persona si ya hay permiso. Default `true`. */
  showsUserLocation?: boolean;
  /**
   * Suma el área segura inferior a los controles y la atribución. Default `false`: en las tabs,
   * la barra ya deja el contenido por encima del indicador de inicio.
   */
  insetBottom?: boolean;
  /** Alto (pt) que tapa algo propio de la pantalla abajo (un panel): sube controles y atribución. */
  bottomOffset?: number;
  /** Ver `MapLocationControl`. */
  location?: MapLocationControl;
  testID?: string;
  ref?: Ref<MapViewHandle>;
}

interface ControlButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID: string;
  rotate?: string;
}

function ControlButton({ icon, label, onPress, testID, rotate }: ControlButtonProps) {
  const { colors, borderWidth } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.control,
        {
          backgroundColor: pressed ? colors.bg.pressed : colors.bg.card,
          borderColor: colors.border.strong,
          borderWidth: borderWidth.hairline,
        },
      ]}
    >
      <View style={rotate === undefined ? undefined : { transform: [{ rotate }] }}>
        <Icon name={icon} size={24} color={colors.text.primary} />
      </View>
    </Pressable>
  );
}

export function MapView({
  accessibilityLabel,
  children,
  initialBounds,
  initialCenter,
  initialZoom = 13,
  onPress,
  showsUserLocation = true,
  insetBottom = false,
  bottomOffset = 0,
  location,
  testID = 'map-view',
  ref,
}: MapViewProps) {
  const { scheme, colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const consulted = useLocationGranted();
  const locationGranted = location?.granted ?? consulted;
  const camera = useRef<CameraRef>(null);

  const duration = reduceMotion ? 0 : CAMERA_ANIMATION_MS;

  const flyTo = useCallback(
    (center: LngLat, zoom = USER_ZOOM) => {
      if (reduceMotion) camera.current?.jumpTo({ center, zoom });
      else camera.current?.flyTo({ center, zoom, duration });
    },
    [reduceMotion, duration],
  );
  const fitBounds = useCallback(
    (bounds: LngLatBounds) => {
      camera.current?.fitBounds(bounds, { duration, padding: boundsPadding });
    },
    [duration],
  );
  const resetNorth = useCallback(() => {
    void camera.current?.setStop({ bearing: 0, pitch: 0, duration });
  }, [duration]);

  const centerOn = useCallback(
    (center: LngLat) => {
      if (reduceMotion) camera.current?.jumpTo({ center });
      else camera.current?.easeTo({ center, duration });
    },
    [reduceMotion, duration],
  );

  useImperativeHandle(ref, () => ({ flyTo, fitBounds, centerOn, resetNorth }), [
    flyTo,
    fitBounds,
    centerOn,
    resetNorth,
  ]);

  const centerOnUser = useCallback(async () => {
    // Con `location`, sin permiso todavía: se pide en contexto y se centra solo si lo dio.
    if (!locationGranted && location) {
      const granted = await location.request().catch(() => false);
      if (!granted) return;
    }
    await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(({ coords }) => {
        flyTo([coords.longitude, coords.latitude]);
      })
      .catch(() => {
        // Sin fix de GPS o servicios apagados: el mapa queda donde estaba.
      });
  }, [flyTo, location, locationGranted]);

  // Se calcula una vez: la cámara inicial no se vuelve a aplicar después de montar.
  const initialViewState = useMemo<InitialViewState>(
    () =>
      initialBounds !== undefined || initialCenter === undefined
        ? { bounds: initialBounds ?? CABA_BOUNDS, padding: boundsPadding }
        : { center: initialCenter, zoom: initialZoom },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo la vista inicial
    [],
  );

  const bottom = space[3] + bottomOffset + (insetBottom ? insets.bottom : 0);

  return (
    <View style={styles.root} testID={testID}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyleFor(scheme)}
        attribution={false}
        logo={false}
        compass={false}
        {...(onPress === undefined ? {} : { onPress })}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        testID={`${testID}-map`}
      >
        <Camera ref={camera} initialViewState={initialViewState} />
        {children}
        {showsUserLocation && locationGranted ? <UserLocation /> : null}
      </Map>

      {Platform.OS === 'ios' ? (
        <View
          style={[styles.edgeGutter, { width: EDGE_GESTURE_GUTTER }]}
          accessible={false}
          importantForAccessibility="no"
          testID={`${testID}-edge-gutter`}
        />
      ) : null}

      <View
        style={[
          styles.attribution,
          {
            left: space[2] + insets.left,
            bottom,
            backgroundColor: colors.bg.base,
            borderRadius: radius.md,
            paddingHorizontal: space[1],
          },
        ]}
      >
        <Text variant="text.xs" tone="secondary" testID={`${testID}-attribution`}>
          {MAP_ATTRIBUTION}
        </Text>
      </View>

      <View
        style={[styles.controls, { right: space[3] + insets.right, bottom, gap: space[2] }]}
        testID={`${testID}-controls`}
      >
        {locationGranted || location !== undefined ? (
          <ControlButton
            icon="centrarUbicacion"
            label="Centrar en mi ubicación"
            onPress={() => {
              void centerOnUser();
            }}
            testID={`${testID}-center-user`}
          />
        ) : null}
        <ControlButton
          icon="sentidoHacia"
          rotate="-90deg"
          label="Orientar el mapa con el norte arriba"
          onPress={resetNorth}
          testID={`${testID}-north-up`}
        />
      </View>
    </View>
  );
}

const boundsPadding = { top: 48, right: 48, bottom: 96, left: 48 };

const styles = StyleSheet.create({
  root: { flex: 1 },
  edgeGutter: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  attribution: { position: 'absolute', maxWidth: '62%', pointerEvents: 'none' },
  controls: { position: 'absolute', alignItems: 'center' },
  control: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
