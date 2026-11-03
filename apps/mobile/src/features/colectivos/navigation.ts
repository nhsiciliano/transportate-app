// Abrir el detalle de línea (tarea 4.6, de otra tarea) desde esta feature: guarda la línea en
// recientes (F4-colectivos-5) y navega a `/colectivos/[linea]`, con `parada` si se abre desde una
// parada para que el mapa centre la cámara ahí (F4-colectivos-6).
import { useRouter } from 'expo-router';

import { useRecientes, type Reciente } from './recientes';

/** Nombre del query param que recibe el detalle de línea para centrar en una parada. */
export const PARAM_PARADA = 'parada';

export function useAbrirLinea() {
  const router = useRouter();
  const { add } = useRecientes();
  return (linea: Reciente, paradaId?: string) => {
    add({
      lineaId: linea.lineaId,
      linea: linea.linea,
      numero: linea.numero,
      descripcion: linea.descripcion,
    });
    router.push({
      pathname: '/colectivos/[linea]',
      params:
        paradaId === undefined
          ? { linea: linea.lineaId }
          : { linea: linea.lineaId, [PARAM_PARADA]: paradaId },
    });
  };
}
