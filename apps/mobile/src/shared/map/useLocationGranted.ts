// ¿La persona ya dio permiso de ubicación "mientras se usa"? Solo CONSULTA: el mapa nunca pide
// el permiso (el pedido en contexto lo hace `useUbicacion().request()` desde "Paradas cercanas" y "Centrar en mi ubicación", S32). Se vuelve a
// consultar al volver la app a primer plano, por si lo activó desde Configuración.
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useLocationGranted(): boolean {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => {
      Location.getForegroundPermissionsAsync()
        .then((response) => {
          if (alive) setGranted(response.granted);
        })
        .catch(() => {
          if (alive) setGranted(false);
        });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return granted;
}
