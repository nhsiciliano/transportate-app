// Ubicación sobre `expo-location` (docs de Expo SDK: `getForegroundPermissionsAsync`,
// `requestForegroundPermissionsAsync`, `getCurrentPositionAsync`, `watchPositionAsync`).
//
// - Solo "mientras se usa" (`docs/05-privacidad.md` §3): nada de segundo plano.
// - El permiso se lee al montar (sin diálogo) y se vuelve a leer al volver a la app (por ejemplo,
//   desde la configuración del teléfono). `request()` solo lo llama una acción de la persona (S32).
// - La posición vive solo en memoria de este hook: nunca va a MMKV, a la caché de consultas ni a la red.
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

export type PermisoUbicacion = 'undetermined' | 'granted' | 'denied' | 'blocked';

export interface PosicionUsuario {
  lat: number;
  lon: number;
  /** Metros, o `null` si el sistema no la informa. */
  accuracy: number | null;
  /** Milisegundos desde epoch. */
  timestamp: number;
}

/** Cada cuánto como mucho (ms) y cuántos metros hacen falta para una posición nueva. */
export const WATCH_TIME_INTERVAL_MS = 10_000;
export const WATCH_DISTANCE_INTERVAL_M = 25;

interface PermisoState {
  permission: PermisoUbicacion;
  canAskAgain: boolean;
}

export function toPermiso(
  response: Pick<Location.LocationPermissionResponse, 'status' | 'canAskAgain'>,
): PermisoState {
  const { status, canAskAgain } = response;
  if (status === Location.PermissionStatus.GRANTED) return { permission: 'granted', canAskAgain };
  if (status === Location.PermissionStatus.DENIED) {
    return { permission: canAskAgain ? 'denied' : 'blocked', canAskAgain };
  }
  return { permission: 'undetermined', canAskAgain };
}

export interface UsePermisoUbicacion extends PermisoState {
  /** Pide el permiso (diálogo del sistema). Solo desde una acción de la persona. */
  request: () => Promise<PermisoUbicacion>;
  /** Vuelve a leer el permiso, sin diálogo. */
  refresh: () => Promise<PermisoUbicacion>;
  /** Abre la configuración del teléfono para esta app. */
  openSettings: () => Promise<void>;
}

/** Solo el permiso: para Ajustes, que no necesita la posición. */
export function usePermisoUbicacion(): UsePermisoUbicacion {
  const [state, setState] = useState<PermisoState>({
    permission: 'undetermined',
    canAskAgain: true,
  });

  const apply = useCallback((response: Location.LocationPermissionResponse): PermisoUbicacion => {
    const next = toPermiso(response);
    setState(next);
    return next.permission;
  }, []);

  const refresh = useCallback(async () => {
    try {
      return apply(await Location.getForegroundPermissionsAsync());
    } catch {
      return 'undetermined' as const;
    }
  }, [apply]);

  const request = useCallback(async () => {
    try {
      return apply(await Location.requestForegroundPermissionsAsync());
    } catch {
      return 'undetermined' as const;
    }
  }, [apply]);

  const openSettings = useCallback(() => Linking.openSettings(), []);

  useEffect(() => {
    let alive = true;
    void Location.getForegroundPermissionsAsync()
      .then((response) => {
        if (alive) apply(response);
      })
      .catch(() => undefined);
    // Al volver de la configuración del teléfono, el permiso pudo haber cambiado.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [apply, refresh]);

  return { ...state, request, refresh, openSettings };
}

export interface UseUbicacionOptions {
  /** `false`: una sola lectura de la posición, sin suscripción. Default `true`. */
  watch?: boolean;
}

export interface UseUbicacion extends UsePermisoUbicacion {
  /** Última posición conocida, solo en memoria. `null` sin permiso o sin posición todavía. */
  position: PosicionUsuario | null;
}

function toPosicion(location: Location.LocationObject): PosicionUsuario {
  return {
    lat: location.coords.latitude,
    lon: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

/** Permiso + posición. El `watch` vive solo con el permiso concedido y la app en primer plano. */
export function useUbicacion({ watch = true }: UseUbicacionOptions = {}): UseUbicacion {
  const permiso = usePermisoUbicacion();
  const [raw, setRaw] = useState<PosicionUsuario | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const granted = permiso.permission === 'granted';

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setForeground(next === 'active');
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!granted || !foreground) return undefined;
    let alive = true;
    let subscription: Location.LocationSubscription | undefined;

    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((location) => {
        if (alive) setRaw(toPosicion(location));
      })
      // F4-ubicacion-5: sin posición, la pantalla ofrece buscar a mano.
      .catch(() => undefined);

    if (watch) {
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: WATCH_TIME_INTERVAL_MS,
          distanceInterval: WATCH_DISTANCE_INTERVAL_M,
        },
        (location) => {
          if (alive) setRaw(toPosicion(location));
        },
      )
        .then((sub) => {
          // Si el componente se desmontó mientras se armaba la suscripción, se suelta enseguida.
          if (alive) subscription = sub;
          else sub.remove();
        })
        .catch(() => undefined);
    }

    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [granted, foreground, watch]);

  const refresh = permiso.refresh;
  const refreshAll = useCallback(async () => {
    const next = await refresh();
    if (next === 'granted') {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setRaw(toPosicion(location));
      } catch {
        // F4-ubicacion-5
      }
    }
    return next;
  }, [refresh]);

  return { ...permiso, refresh: refreshAll, position: granted ? raw : null };
}
