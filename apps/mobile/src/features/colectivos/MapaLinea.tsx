// Mapa del detalle de línea (tarea 4.6): recorrido aproximado, paradas a zoom cercano y vehículos.
// - Vehículos: círculo con el número de línea encima; flecha ▲ rotada por `rumbo` solo si el feed
//   lo trae (hoy nunca: `rumbo: null`), así no se inventa una dirección.
// - Atenuado (S31): vehículo con > 5 min, o todos con feed > 10 min, sin conexión o con la
//   actualización fallida.
// - Sin interpolación (S29): el marcador salta a la posición nueva. MapLibre no anima un
//   `setData`, así que no hay crossfade (F4-colectivos-mapa-6).
// - Agrupamiento (F4-colectivos-mapa-3): con más de 80 vehículos, `cluster` hasta zoom 13.
import {
  GeoJSONSource,
  Layer,
  type LngLat,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import type { Ref } from 'react';

import {
  MAP_FONT,
  MapView,
  pressedProperty,
  type MapLocationControl,
  type MapViewHandle,
} from '@/shared/map';
import { useTheme } from '@/shared/theme';

import { CLUSTER_MAX_ZOOM, type VehiculoProps } from './lineaModel';

/** Ids de fuentes y capas (también los `testID` de los mocks de Jest). */
export const SOURCE = {
  recorrido: 'colectivo-recorrido',
  paradas: 'colectivo-paradas',
  vehiculos: 'colectivo-vehiculos',
} as const;
export const LAYER = {
  recorridoContorno: 'colectivo-recorrido-contorno',
  recorrido: 'colectivo-recorrido-trazo',
  parada: 'colectivo-paradas-punto',
  cluster: 'colectivo-vehiculos-cluster',
  clusterCantidad: 'colectivo-vehiculos-cluster-cantidad',
  vehiculo: 'colectivo-vehiculos-punto',
  rumbo: 'colectivo-vehiculos-rumbo',
  numero: 'colectivo-vehiculos-numero',
} as const;

/** Medio lado del área táctil: 22 + 22 = 44 pt. */
const HITBOX = { top: 22, right: 22, bottom: 22, left: 22 };
const NO_CLUSTER: ['!', ['has', string]] = ['!', ['has', 'point_count']];

export interface MapaLineaProps {
  accessibilityLabel: string;
  recorrido: GeoJSON.FeatureCollection | null;
  paradas: GeoJSON.FeatureCollection<GeoJSON.Point> | null;
  vehiculos: GeoJSON.FeatureCollection<GeoJSON.Point, VehiculoProps>;
  cluster: boolean;
  onSelectVehiculo: (id: string) => void;
  /** Tocar un grupo acerca la cámara a ese punto. */
  onPressCluster: (center: LngLat) => void;
  initialBounds?: LngLatBounds;
  initialCenter?: LngLat;
  initialZoom?: number;
  bottomOffset: number;
  location: MapLocationControl;
  mapRef: Ref<MapViewHandle>;
}

export function MapaLinea({
  accessibilityLabel,
  recorrido,
  paradas,
  vehiculos,
  cluster,
  onSelectVehiculo,
  onPressCluster,
  initialBounds,
  initialCenter,
  initialZoom,
  bottomOffset,
  location,
  mapRef,
}: MapaLineaProps) {
  const { colors } = useTheme();

  return (
    <MapView
      accessibilityLabel={accessibilityLabel}
      {...(initialBounds ? { initialBounds } : {})}
      {...(initialCenter ? { initialCenter } : {})}
      {...(initialZoom === undefined ? {} : { initialZoom })}
      bottomOffset={bottomOffset}
      location={location}
      ref={mapRef}
      testID="mapa-linea"
    >
      {recorrido ? (
        <GeoJSONSource id={SOURCE.recorrido} data={recorrido}>
          <Layer
            id={LAYER.recorridoContorno}
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.bg.base, 'line-width': 7 }}
          />
          <Layer
            id={LAYER.recorrido}
            type="line"
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            // Punteado: el recorrido es aproximado (`aproximado: true` en el estático).
            paint={{
              'line-color': colors.role.secondary.base,
              'line-width': 4,
              'line-dasharray': [2, 1],
            }}
          />
        </GeoJSONSource>
      ) : null}

      {paradas ? (
        <GeoJSONSource id={SOURCE.paradas} data={paradas}>
          <Layer
            id={LAYER.parada}
            type="circle"
            minzoom={14}
            paint={{
              'circle-radius': 4,
              'circle-color': colors.bg.base,
              'circle-stroke-color': colors.text.secondary,
              'circle-stroke-width': 2,
            }}
          />
        </GeoJSONSource>
      ) : null}

      {/* `key`: cambiar `cluster` en una fuente montada no la reconfigura. */}
      <GeoJSONSource
        key={cluster ? 'cluster' : 'puntos'}
        id={SOURCE.vehiculos}
        data={vehiculos}
        cluster={cluster}
        clusterRadius={40}
        clusterMaxZoom={CLUSTER_MAX_ZOOM}
        hitbox={HITBOX}
        onPress={(event) => {
          const [first] = event.nativeEvent.features;
          if (first?.properties?.['cluster'] === true && first.geometry.type === 'Point') {
            const [lon, lat] = first.geometry.coordinates;
            if (lon !== undefined && lat !== undefined) onPressCluster([lon, lat]);
            return;
          }
          const id = pressedProperty(event.nativeEvent.features, 'id');
          if (id) onSelectVehiculo(id);
        }}
      >
        <Layer
          id={LAYER.cluster}
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-radius': 20,
            'circle-color': colors.role.primary.base,
            'circle-stroke-color': colors.bg.base,
            'circle-stroke-width': 2,
          }}
        />
        <Layer
          id={LAYER.clusterCantidad}
          type="symbol"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': MAP_FONT,
            'text-size': 13,
            'text-allow-overlap': true,
          }}
          paint={{ 'text-color': colors.role.primary.on }}
        />
        <Layer
          id={LAYER.vehiculo}
          type="circle"
          filter={NO_CLUSTER}
          paint={{
            'circle-radius': ['case', ['get', 'seleccionado'], 17, 14],
            'circle-color': colors.role.primary.base,
            'circle-opacity': ['case', ['get', 'atenuado'], 0.4, 1],
            'circle-stroke-color': [
              'case',
              ['get', 'seleccionado'],
              colors.focusRing.color,
              colors.bg.base,
            ],
            'circle-stroke-width': ['case', ['get', 'seleccionado'], 4, 2],
          }}
        />
        <Layer
          id={LAYER.rumbo}
          type="symbol"
          filter={['all', NO_CLUSTER, ['!=', ['get', 'rumbo'], null]]}
          layout={{
            'text-field': '▲',
            'text-font': MAP_FONT,
            'text-size': 12,
            'text-rotate': ['coalesce', ['get', 'rumbo'], 0],
            'text-rotation-alignment': 'map',
            'text-offset': [0, -1.9],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{
            'text-color': colors.role.primary.base,
            'text-halo-color': colors.bg.base,
            'text-halo-width': 1,
            'text-opacity': ['case', ['get', 'atenuado'], 0.4, 1],
          }}
        />
        <Layer
          id={LAYER.numero}
          type="symbol"
          filter={NO_CLUSTER}
          layout={{
            'text-field': ['get', 'etiqueta'],
            'text-font': MAP_FONT,
            'text-size': 11,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{
            'text-color': colors.role.primary.on,
            'text-opacity': ['case', ['get', 'atenuado'], 0.6, 1],
          }}
        />
      </GeoJSONSource>
    </MapView>
  );
}
