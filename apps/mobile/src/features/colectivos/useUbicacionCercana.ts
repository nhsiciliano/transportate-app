// Ubicación para "Paradas cercanas" (tarea 4.7, S32): permiso "mientras se usa" pedido en
// contexto (al tocar "Activar"), nunca al abrir la app. La posición vive solo en el estado de
// este hook: no se guarda ni se manda a ningún lado (docs/05-privacidad.md).
//
// Mínimo propio de la feature: cuando `features/ubicacion` (useUbicacion, PermisoUbicacionBloque)
// esté en `main`, esta pantalla puede pasar a usarlo sin cambiar el modelo (`model.ts`).
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import type { Punto } from './model';

export type UbicacionStatus =
  | 'checking'
  /** Nunca se preguntó (o se puede volver a preguntar). */
  | 'prompt'
  /** Negado sin poder volver a preguntar: solo queda Configuración. */
  | 'blocked'
  | 'locating'
  | 'located'
  /** Servicios de ubicación apagados o sin posición. */
  | 'unavailable';

export interface UbicacionCercana {
  status: UbicacionStatus;
  punto: Punto | null;
  /** Pide el permiso (diálogo del sistema) y, si lo dan, la posición. */
  request: () => Promise<void>;
  openSettings: () => Promise<void>;
}

export function useUbicacionCercana(): UbicacionCercana {
  const [status, setStatus] = useState<UbicacionStatus>('checking');
  const [punto, setPunto] = useState<Punto | null>(null);
  const mounted = useRef(true);

  const locate = useCallback(async () => {
    setStatus('locating');
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        if (mounted.current) setStatus('unavailable');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!mounted.current) return;
      setPunto({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setStatus('located');
    } catch {
      if (mounted.current) setStatus('unavailable');
    }
  }, []);

  const apply = useCallback(
    async (res: Location.LocationPermissionResponse) => {
      if (res.granted) await locate();
      else if (mounted.current) setStatus(res.canAskAgain ? 'prompt' : 'blocked');
    },
    [locate],
  );

  useEffect(() => {
    mounted.current = true;
    // Solo consulta el estado: no muestra el diálogo del sistema.
    void Location.getForegroundPermissionsAsync().then(apply, () => {
      if (mounted.current) setStatus('prompt');
    });
    return () => {
      mounted.current = false;
    };
  }, [apply]);

  const request = useCallback(async () => {
    try {
      await apply(await Location.requestForegroundPermissionsAsync());
    } catch {
      if (mounted.current) setStatus('unavailable');
    }
  }, [apply]);

  const openSettings = useCallback(() => Linking.openSettings(), []);

  return { status, punto, request, openSettings };
}
