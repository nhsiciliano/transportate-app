// Detalle de línea de colectivos (tarea 4.6; brief 02-colectivos §3, §5 y §6; S10, S24, S29, S31).
// Brief operativo y suposiciones F4-colectivos-mapa-n: README.md, "Línea y mapa".
//
// - Una línea por vez (S10): `usePosicionesLinea(lineaId)` con polling SOLO mientras la pantalla
//   está enfocada (`useIsFocused`); al apilar otra pantalla o cambiar de tab, se corta.
// - Mapa casi a pantalla completa y un panel abajo con tres alturas (`BottomPanel`).
// - Cámara: se encuadra UNA vez (la parada de `?parada=`, si no el recorrido, si no los
//   vehículos); después la mueve la persona, o "Seguir".
import type { LngLat } from '@maplibre/maplibre-react-native';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useUbicacion } from '@/features/ubicacion';
import { usePosicionesLinea } from '@/shared/api';
import {
  BottomPanel,
  boundsOf,
  panelHeights,
  pointCollection,
  type MapViewHandle,
  type PanelIndex,
} from '@/shared/map';
import { useIsOnline, useRefreshInterval } from '@/shared/query';
import { useStaticArchivoGrande } from '@/shared/static';
import { useTheme } from '@/shared/theme';
import { triggerHaptic } from '@/shared/ui';

import { useIndiceColectivos } from './hooks';
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_MIN_VEHICULOS,
  FEED_VIEJO_S,
  mensajeDeLinea,
  ordenarVehiculos,
  POSICIONES_NO_DISPONIBLES,
  recorridoDe,
  vehiculosCollection,
  vistaVehiculo,
} from './lineaModel';
import { MapaLinea } from './MapaLinea';
import { numeroDeLinea, paradasDeNumero } from './model';
import { PARAM_PARADA } from './navigation';
import {
  VehiculosSheetBody,
  VehiculosSheetHeader,
  type RamalOpcion,
  type SheetEstado,
} from './VehiculosSheet';

/** Zoom al abrir la línea desde una parada. */
export const PARADA_ZOOM = 16;
/** Cada cuánto se recalculan las edades de la lista ("actualizado hace 25 s"). */
const TICK_MS = 5000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

export function LineaScreen() {
  const params = useLocalSearchParams<{ linea: string; [PARAM_PARADA]?: string }>();
  const lineaId = params.linea;
  const paradaId = params[PARAM_PARADA];
  const router = useRouter();
  const focused = useIsFocused();
  const { space } = useTheme();
  const { seconds } = useRefreshInterval();
  const online = useIsOnline();
  const now = useNow(TICK_MS);

  const indice = useIndiceColectivos();
  const recorridos = useStaticArchivoGrande('recorridos-colectivos.geojson');
  const posiciones = usePosicionesLinea(lineaId, { enabled: focused });
  const ubicacion = useUbicacion({ watch: focused });

  // ---- línea y ramales (índice estático de mid-dev; sin índice todavía, lo que diga el feed)
  const lineaIndice = indice.indice?.lineas.find((l) => l.lineaId === lineaId);
  const vehiculoLinea = posiciones.data?.vehiculos[0]?.linea;
  const linea = useMemo(() => {
    if (lineaIndice) {
      return {
        lineaId: lineaIndice.lineaId,
        numero: lineaIndice.numero,
        nombre: `Línea ${lineaIndice.linea}`,
        descripcion: lineaIndice.descripcion,
        mensaje: mensajeDeLinea({
          numero: lineaIndice.numero,
          ramal: lineaIndice.ramal,
          cabecera: lineaIndice.cabeceras.join(' – '),
        }),
      };
    }
    if (indice.indice === undefined && vehiculoLinea === undefined) return null;
    const visible = vehiculoLinea ?? lineaId;
    return {
      lineaId,
      numero: numeroDeLinea(visible),
      nombre: `Línea ${visible}`,
      descripcion: `Línea ${visible}`,
      mensaje: mensajeDeLinea({ numero: numeroDeLinea(visible) }),
    };
  }, [lineaIndice, indice.indice, vehiculoLinea, lineaId]);

  const ramales: RamalOpcion[] = useMemo(() => {
    if (!linea || !indice.indice) return [];
    return (indice.indice.lineasPorNumero.get(linea.numero) ?? []).map((l) => ({
      lineaId: l.lineaId,
      label: l.descripcion,
      selected: l.lineaId === lineaId,
    }));
  }, [linea, indice.indice, lineaId]);

  // ---- vehículos
  const posicion =
    ubicacion.permission === 'granted' && ubicacion.position
      ? { lat: ubicacion.position.lat, lon: ubicacion.position.lon }
      : null;
  const vistas = useMemo(
    () =>
      ordenarVehiculos(
        (posiciones.data?.vehiculos ?? []).map((v) => vistaVehiculo(v, { now, posicion })),
      ),
    // `posicion` se compara por valor para no recalcular en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posiciones.data, now, posicion?.lat, posicion?.lon],
  );
  const feedEdad =
    posiciones.sourceTimestamp === null
      ? null
      : Math.max(0, (now - Date.parse(posiciones.sourceTimestamp)) / 1000);
  // El dato más viejo de las posiciones: lo que dice la banda del panel («hace 25 s»).
  const edadMasVieja = vistas.length === 0 ? null : Math.max(...vistas.map((v) => v.edad));
  const feedViejo = feedEdad !== null && feedEdad > FEED_VIEJO_S;
  const todosAtenuados = feedViejo || !online || posiciones.isRefreshError || posiciones.isPaused;

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [siguiendo, setSiguiendo] = useState(false);
  const seleccionado = vistas.find((v) => v.id === seleccionadoId) ?? null;

  const vehiculosFc = useMemo(
    () =>
      vehiculosCollection(vistas, {
        etiqueta: linea?.numero ?? '',
        todosAtenuados,
        seleccionadoId: seleccionado?.id ?? null,
      }),
    [vistas, linea?.numero, todosAtenuados, seleccionado?.id],
  );

  // ---- recorrido y paradas de la línea
  const recorrido = useMemo(
    () => (linea ? recorridoDe(recorridos.data, linea.numero) : null),
    [recorridos.data, linea],
  );
  const paradasFc = useMemo(() => {
    if (!linea || !indice.indice) return null;
    return pointCollection(paradasDeNumero(indice.indice.paradas, linea.numero), (p) => ({
      id: p.id,
      coordinates: [p.lon, p.lat],
      properties: { id: p.id, nombre: p.nombre },
    }));
  }, [linea, indice.indice]);
  const parada = paradaId ? indice.indice?.paradaPorId.get(paradaId) : undefined;

  // ---- cámara
  const map = useRef<MapViewHandle>(null);
  const encuadrado = useRef(false);
  useEffect(() => {
    if (encuadrado.current) return;
    if (parada) {
      map.current?.flyTo([parada.lon, parada.lat], PARADA_ZOOM);
      encuadrado.current = true;
      return;
    }
    // Esperar al índice si hay que centrar en una parada (todavía puede aparecer).
    if (paradaId && indice.isPending) return;
    const bounds =
      (recorrido ? boundsOf(recorrido) : null) ??
      (vistas.length > 0 ? boundsOf(vehiculosFc) : null);
    if (bounds) {
      map.current?.fitBounds(bounds);
      encuadrado.current = true;
    }
  }, [parada, paradaId, indice.isPending, recorrido, vistas.length, vehiculosFc]);

  // "Seguir": la cámara acompaña al vehículo en cada actualización (salta con Reducir movimiento).
  useEffect(() => {
    if (siguiendo && seleccionado) map.current?.centerOn([seleccionado.lon, seleccionado.lat]);
  }, [siguiendo, seleccionado]);

  const select = useCallback(
    (id: string) => {
      setSeleccionadoId(id);
      setSiguiendo(false);
      triggerHaptic('selection');
      const v = vistas.find((x) => x.id === id);
      if (v) map.current?.centerOn([v.lon, v.lat]);
    },
    [vistas],
  );

  // ---- panel
  const [panel, setPanel] = useState<PanelIndex>(0);
  // Arranca con el alto de la ventana (el panel se ve desde el primer render) y se ajusta al medir.
  const window = useWindowDimensions();
  const [available, setAvailable] = useState(window.height);
  const [headerHeight, setHeaderHeight] = useState(120);
  const heights = panelHeights(available, headerHeight);

  const refresh = () => {
    void posiciones.refetch();
    if (indice.isLoadingError) void indice.refetch();
  };

  let estado: SheetEstado;
  if (posiciones.isLoadingError && posiciones.error) {
    const message = posiciones.error.userMessage();
    estado = posiciones.error.retryable
      ? {
          kind: 'error',
          title: message.title,
          cause: message.cause ?? 'Probá de nuevo en un rato.',
          retryable: true,
        }
      : {
          kind: 'error',
          title: POSICIONES_NO_DISPONIBLES,
          cause: 'La búsqueda de líneas y las paradas siguen funcionando.',
          retryable: false,
        };
  } else if (posiciones.data === undefined) {
    estado = { kind: 'cargando' };
  } else if (vistas.length === 0) {
    estado = { kind: 'vacio' };
  } else {
    estado = { kind: 'datos' };
  }

  const mapLabel = linea
    ? `Mapa de la línea ${linea.numero} con ${String(vistas.length)} colectivos. La lista está en el panel de abajo.`
    : 'Mapa de la línea';

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        setAvailable(e.nativeEvent.layout.height);
      }}
    >
      <Stack.Screen options={{ title: linea ? linea.nombre : 'Línea' }} />
      <MapaLinea
        accessibilityLabel={mapLabel}
        recorrido={recorrido}
        paradas={paradasFc}
        vehiculos={vehiculosFc}
        cluster={vistas.length > CLUSTER_MIN_VEHICULOS}
        onSelectVehiculo={select}
        onPressCluster={(center: LngLat) => {
          map.current?.flyTo(center, CLUSTER_MAX_ZOOM + 1);
        }}
        bottomOffset={heights[panel === 2 ? 0 : panel] - space[2]}
        location={{
          granted: ubicacion.permission === 'granted',
          request: async () => (await ubicacion.request()) === 'granted',
        }}
        mapRef={map}
      />
      {available > 0 ? (
        <BottomPanel
          index={panel}
          onIndexChange={setPanel}
          availableHeight={available}
          headerHeight={headerHeight}
          onHeaderHeight={setHeaderHeight}
          testID="linea-panel"
          header={
            <VehiculosSheetHeader
              linea={linea}
              estado={estado}
              cantidad={vistas.length}
              edadMasVieja={edadMasVieja}
              sourceTimestamp={posiciones.sourceTimestamp}
              intervalSeconds={seconds}
              refreshing={posiciones.isFetching}
              onRefresh={refresh}
              feedViejo={feedViejo}
              refreshError={posiciones.isRefreshError}
              seleccionado={seleccionado}
              siguiendo={siguiendo}
              onToggleSeguir={() => {
                if (!siguiendo) triggerHaptic('selection');
                setSiguiendo(!siguiendo);
              }}
              onCerrarSeleccion={() => {
                setSeleccionadoId(null);
                setSiguiendo(false);
              }}
            />
          }
        >
          <VehiculosSheetBody
            ramales={ramales}
            onSelectRamal={(id) => {
              if (id === lineaId) return;
              setSeleccionadoId(null);
              setSiguiendo(false);
              encuadrado.current = false;
              router.setParams({ linea: id });
            }}
            vehiculos={vistas}
            seleccionadoId={seleccionado?.id ?? null}
            onSelectVehiculo={select}
            ramal={
              lineaIndice?.ramal === undefined || lineaIndice.ramal === ''
                ? undefined
                : `Ramal ${lineaIndice.ramal}`
            }
          />
        </BottomPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
