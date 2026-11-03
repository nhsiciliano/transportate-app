// Mock de `expo-location` para Jest, con estado controlable desde los tests. Lo registra
// `jest.setup.ts` y `setup-after-env.ts` lo vuelve al estado inicial antes de cada test.
//
// Estado inicial: permiso `undetermined` (nunca se preguntó), `canAskAgain: true`, servicios de
// ubicación activos y, si se pide el permiso, la persona responde "permitir". Posición: el
// Obelisco. Los enums (`Accuracy`, `PermissionStatus`…) son los reales de la librería.
//
// Uso típico:
//   import { locationMock } from '../../test/mocks/expo-location';
//   locationMock.setPermission('denied', { canAskAgain: false });
//   locationMock.setRequestAnswer('denied');
//   locationMock.setPosition({ latitude: -34.6, longitude: -58.4 });
//   locationMock.emitPosition({ latitude: -34.61, longitude: -58.41 }); // a cada watchPositionAsync
//
// Solo hay "mientras se usa" (docs/05-privacidad.md §3): los métodos de segundo plano, geofencing
// y tareas tiran, así un test falla si una pantalla llegara a pedirlos.
import type * as ExpoLocation from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

type Location = typeof ExpoLocation;
type PermissionStatusValue = 'granted' | 'denied' | 'undetermined';
type Coords = Pick<ExpoLocation.LocationObjectCoords, 'latitude' | 'longitude'> &
  Partial<ExpoLocation.LocationObjectCoords>;

const actual = jest.requireActual<Location>('expo-location');

const STATUS: Record<PermissionStatusValue, ExpoLocation.PermissionStatus> = {
  granted: actual.PermissionStatus.GRANTED,
  denied: actual.PermissionStatus.DENIED,
  undetermined: actual.PermissionStatus.UNDETERMINED,
};

const OBELISCO: Coords = { latitude: -34.6037, longitude: -58.3816 };

interface State {
  status: PermissionStatusValue;
  canAskAgain: boolean;
  requestAnswer: PermissionStatusValue;
  servicesEnabled: boolean;
  position: ExpoLocation.LocationObject;
  positionError: Error | null;
}

function toLocation(coords: Coords, timestamp = Date.now()): ExpoLocation.LocationObject {
  return {
    coords: {
      altitude: null,
      accuracy: 10,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      ...coords,
    },
    timestamp,
  };
}

function initialState(): State {
  return {
    status: 'undetermined',
    canAskAgain: true,
    requestAnswer: 'granted',
    servicesEnabled: true,
    position: toLocation(OBELISCO, 0),
    positionError: null,
  };
}

let state = initialState();
const watchers = new Set<ExpoLocation.LocationCallback>();

function permissionResponse(): ExpoLocation.LocationPermissionResponse {
  const granted = state.status === 'granted';
  return {
    status: STATUS[state.status],
    granted,
    canAskAgain: state.canAskAgain,
    expires: 'never',
    ios: { scope: granted ? 'whenInUse' : 'none', accuracy: 'full' },
    android: { accuracy: granted ? 'fine' : 'none' },
  };
}

function position(): Promise<ExpoLocation.LocationObject> {
  if (state.status !== 'granted') {
    return Promise.reject(new Error('Not authorized to use location services'));
  }
  if (!state.servicesEnabled) {
    return Promise.reject(new Error('Location services are disabled'));
  }
  if (state.positionError) return Promise.reject(state.positionError);
  return Promise.resolve(state.position);
}

const getForegroundPermissionsAsync = jest.fn<
  ReturnType<Location['getForegroundPermissionsAsync']>,
  []
>(() => Promise.resolve(permissionResponse()));

const requestForegroundPermissionsAsync = jest.fn<
  ReturnType<Location['requestForegroundPermissionsAsync']>,
  []
>(() => {
  // Como el sistema: solo pregunta si nunca se preguntó (o si todavía se puede volver a preguntar).
  if (state.status === 'undetermined' || (state.status === 'denied' && state.canAskAgain)) {
    state.status = state.requestAnswer;
    if (state.requestAnswer === 'denied') state.canAskAgain = false;
  }
  return Promise.resolve(permissionResponse());
});

const getCurrentPositionAsync = jest.fn<
  ReturnType<Location['getCurrentPositionAsync']>,
  Parameters<Location['getCurrentPositionAsync']>
>(() => position());

const getLastKnownPositionAsync = jest.fn<
  ReturnType<Location['getLastKnownPositionAsync']>,
  Parameters<Location['getLastKnownPositionAsync']>
>(() => position().catch(() => null));

const watchPositionAsync = jest.fn<
  ReturnType<Location['watchPositionAsync']>,
  Parameters<Location['watchPositionAsync']>
>((_options, callback) => {
  if (state.status !== 'granted') {
    return Promise.reject(new Error('Not authorized to use location services'));
  }
  watchers.add(callback);
  return Promise.resolve({
    remove: () => {
      watchers.delete(callback);
    },
  });
});

const hasServicesEnabledAsync = jest.fn<ReturnType<Location['hasServicesEnabledAsync']>, []>(() =>
  Promise.resolve(state.servicesEnabled),
);

/** Mismo contrato que el hook real: `[respuesta | null, pedir, consultar]`. */
function useForegroundPermissions(): ReturnType<Location['useForegroundPermissions']> {
  const [response, setResponse] = useState<ExpoLocation.LocationPermissionResponse | null>(null);
  const get = useCallback(async () => {
    const next = await getForegroundPermissionsAsync();
    setResponse(next);
    return next;
  }, []);
  const request = useCallback(async () => {
    const next = await requestForegroundPermissionsAsync();
    setResponse(next);
    return next;
  }, []);
  useEffect(() => {
    let mounted = true;
    void getForegroundPermissionsAsync().then((next) => {
      if (mounted) setResponse(next);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return [response, request, get];
}

function notAllowed(name: string) {
  return () => {
    throw new Error(
      `expo-location.${name}: Transportate solo usa la ubicación mientras la app está abierta (docs/05-privacidad.md §3).`,
    );
  };
}

/** Helpers para los tests. */
export const locationMock = {
  /** Estado actual del permiso (lo que devuelve `getForegroundPermissionsAsync`). */
  setPermission(status: PermissionStatusValue, { canAskAgain = status !== 'denied' } = {}): void {
    state.status = status;
    state.canAskAgain = canAskAgain;
  },
  /** Qué responde la persona cuando la app pide el permiso. */
  setRequestAnswer(answer: Exclude<PermissionStatusValue, 'undetermined'>): void {
    state.requestAnswer = answer;
  },
  setServicesEnabled(enabled: boolean): void {
    state.servicesEnabled = enabled;
  },
  setPosition(coords: Coords, timestamp?: number): void {
    state.position = toLocation(coords, timestamp);
  },
  /** Hace fallar `getCurrentPositionAsync` (por ejemplo, timeout del GPS); `null` lo restablece. */
  setPositionError(error: Error | null): void {
    state.positionError = error;
  },
  /** Entrega una posición nueva a cada suscripción activa de `watchPositionAsync`. */
  emitPosition(coords: Coords, timestamp?: number): void {
    state.position = toLocation(coords, timestamp);
    for (const callback of [...watchers]) void callback(state.position);
  },
  /** Suscripciones activas de `watchPositionAsync` (para verificar que la pantalla las suelta). */
  get activeWatchers(): number {
    return watchers.size;
  },
  reset(): void {
    state = initialState();
    watchers.clear();
    for (const fn of [
      getForegroundPermissionsAsync,
      requestForegroundPermissionsAsync,
      getCurrentPositionAsync,
      getLastKnownPositionAsync,
      watchPositionAsync,
      hasServicesEnabledAsync,
    ]) {
      fn.mockClear();
    }
  },
};

export const mockedExpoLocation: Location = {
  ...actual,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  getLastKnownPositionAsync,
  watchPositionAsync,
  hasServicesEnabledAsync,
  useForegroundPermissions,
  getBackgroundPermissionsAsync: notAllowed('getBackgroundPermissionsAsync'),
  requestBackgroundPermissionsAsync: notAllowed('requestBackgroundPermissionsAsync'),
  useBackgroundPermissions: notAllowed('useBackgroundPermissions'),
  startLocationUpdatesAsync: notAllowed('startLocationUpdatesAsync'),
  startGeofencingAsync: notAllowed('startGeofencingAsync'),
};
