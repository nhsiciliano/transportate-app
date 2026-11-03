import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';

import { locationMock } from '../../../../test/mocks/expo-location';
import { toPermiso, usePermisoUbicacion, useUbicacion } from '../useUbicacion';

/** Captura los listeners de AppState para simular primer y segundo plano. */
function fakeAppState() {
  const listeners = new Set<(s: AppStateStatus) => void>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.add(listener);
    return {
      remove: () => {
        listeners.delete(listener);
      },
    };
  });
  return {
    listeners,
    emit: (s: AppStateStatus) => {
      for (const l of [...listeners]) l(s);
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('toPermiso', () => {
  const S = Location.PermissionStatus;
  it('distingue negado preguntable de bloqueado', () => {
    expect(toPermiso({ status: S.GRANTED, canAskAgain: true }).permission).toBe('granted');
    expect(toPermiso({ status: S.UNDETERMINED, canAskAgain: true }).permission).toBe(
      'undetermined',
    );
    expect(toPermiso({ status: S.DENIED, canAskAgain: true }).permission).toBe('denied');
    expect(toPermiso({ status: S.DENIED, canAskAgain: false }).permission).toBe('blocked');
  });
});

describe('usePermisoUbicacion', () => {
  it('lee el permiso al montar sin pedirlo', async () => {
    locationMock.setPermission('granted');
    const { result } = await renderHook(() => usePermisoUbicacion());
    await waitFor(() => {
      expect(result.current.permission).toBe('granted');
    });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('nunca preguntado: queda undetermined y no abre el diálogo al montar', async () => {
    const { result } = await renderHook(() => usePermisoUbicacion());
    await waitFor(() => {
      expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
    });
    expect(result.current.permission).toBe('undetermined');
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('request() concedido → granted', async () => {
    const { result } = await renderHook(() => usePermisoUbicacion());
    let answer: string | undefined;
    await act(async () => {
      answer = await result.current.request();
    });
    expect(answer).toBe('granted');
    expect(result.current.permission).toBe('granted');
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('request() negado → blocked cuando el sistema ya no deja volver a preguntar', async () => {
    locationMock.setRequestAnswer('denied');
    const { result } = await renderHook(() => usePermisoUbicacion());
    await act(async () => {
      await result.current.request();
    });
    expect(result.current.permission).toBe('blocked');
    expect(result.current.canAskAgain).toBe(false);
  });

  it('negado pero preguntable (Android) queda en denied', async () => {
    locationMock.setPermission('denied', { canAskAgain: true });
    const { result } = await renderHook(() => usePermisoUbicacion());
    await waitFor(() => {
      expect(result.current.permission).toBe('denied');
    });
    expect(result.current.canAskAgain).toBe(true);
  });

  it('al volver a la app vuelve a leer el permiso (cambió en la configuración)', async () => {
    const app = fakeAppState();
    locationMock.setPermission('denied', { canAskAgain: false });
    const { result } = await renderHook(() => usePermisoUbicacion());
    await waitFor(() => {
      expect(result.current.permission).toBe('blocked');
    });

    locationMock.setPermission('granted');
    await act(() => {
      app.emit('active');
    });
    await waitFor(() => {
      expect(result.current.permission).toBe('granted');
    });
  });

  it('openSettings abre la configuración del teléfono', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockClear().mockResolvedValue(undefined);
    const { result } = await renderHook(() => usePermisoUbicacion());
    await act(async () => {
      await result.current.openSettings();
    });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('suelta el listener de AppState al desmontar', async () => {
    const app = fakeAppState();
    const view = await renderHook(() => usePermisoUbicacion());
    expect(app.listeners.size).toBe(1);
    await view.unmount();
    expect(app.listeners.size).toBe(0);
  });
});

describe('useUbicacion', () => {
  it('sin permiso no hay posición ni suscripción', async () => {
    const { result } = await renderHook(() => useUbicacion());
    await waitFor(() => {
      expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
    });
    expect(result.current.position).toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(locationMock.activeWatchers).toBe(0);
  });

  it('con permiso lee la posición y se suscribe con precisión balanceada', async () => {
    locationMock.setPermission('granted');
    locationMock.setPosition({ latitude: -34.6, longitude: -58.4, accuracy: 15 }, 1234);
    const { result } = await renderHook(() => useUbicacion());
    await waitFor(() => {
      expect(result.current.position).toEqual({
        lat: -34.6,
        lon: -58.4,
        accuracy: 15,
        timestamp: 1234,
      });
    });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.Balanced,
    });
    expect(locationMock.activeWatchers).toBe(1);
    expect(Location.watchPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: Location.Accuracy.Balanced }),
      expect.any(Function),
    );
  });

  it('actualiza la posición con cada aviso del watch', async () => {
    locationMock.setPermission('granted');
    const { result } = await renderHook(() => useUbicacion());
    await waitFor(() => {
      expect(locationMock.activeWatchers).toBe(1);
    });
    await act(() => {
      locationMock.emitPosition({ latitude: -34.61, longitude: -58.41 });
    });
    expect(result.current.position?.lat).toBe(-34.61);
    expect(result.current.position?.lon).toBe(-58.41);
  });

  it('request() concedido arranca la posición', async () => {
    const { result } = await renderHook(() => useUbicacion());
    await waitFor(() => {
      expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled();
    });
    expect(result.current.position).toBeNull();
    await act(async () => {
      await result.current.request();
    });
    await waitFor(() => {
      expect(result.current.position).not.toBeNull();
    });
  });

  it('suelta el watch al desmontar', async () => {
    locationMock.setPermission('granted');
    const view = await renderHook(() => useUbicacion());
    await waitFor(() => {
      expect(locationMock.activeWatchers).toBe(1);
    });
    await view.unmount();
    expect(locationMock.activeWatchers).toBe(0);
  });

  it('suelta el watch en segundo plano y lo retoma al volver', async () => {
    const app = fakeAppState();
    locationMock.setPermission('granted');
    await renderHook(() => useUbicacion());
    await waitFor(() => {
      expect(locationMock.activeWatchers).toBe(1);
    });

    await act(() => {
      app.emit('background');
    });
    expect(locationMock.activeWatchers).toBe(0);

    await act(() => {
      app.emit('active');
    });
    await waitFor(() => {
      expect(locationMock.activeWatchers).toBe(1);
    });
  });

  it('con watch:false lee una vez y no se suscribe', async () => {
    locationMock.setPermission('granted');
    const { result } = await renderHook(() => useUbicacion({ watch: false }));
    await waitFor(() => {
      expect(result.current.position).not.toBeNull();
    });
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('si el GPS falla la posición queda en null y no tira', async () => {
    locationMock.setPermission('granted');
    locationMock.setPositionError(new Error('timeout'));
    const { result } = await renderHook(() => useUbicacion());
    await waitFor(() => {
      expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
    });
    expect(result.current.position).toBeNull();
    expect(result.current.permission).toBe('granted');
  });

  it('refresh() vuelve a leer permiso y posición', async () => {
    locationMock.setPermission('granted');
    const { result } = await renderHook(() => useUbicacion({ watch: false }));
    await waitFor(() => {
      expect(result.current.position).not.toBeNull();
    });
    locationMock.setPosition({ latitude: -34.65, longitude: -58.45 });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.position?.lat).toBe(-34.65);
  });

  it('si se pierde el permiso, la posición se borra', async () => {
    const app = fakeAppState();
    locationMock.setPermission('granted');
    const { result } = await renderHook(() => useUbicacion({ watch: false }));
    await waitFor(() => {
      expect(result.current.position).not.toBeNull();
    });
    locationMock.setPermission('denied', { canAskAgain: false });
    await act(() => {
      app.emit('active');
    });
    await waitFor(() => {
      expect(result.current.permission).toBe('blocked');
    });
    expect(result.current.position).toBeNull();
  });
});
