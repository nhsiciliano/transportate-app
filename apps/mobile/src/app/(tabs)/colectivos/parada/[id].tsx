// Ruta fina: la pantalla vive en `src/features/colectivos`. `id` es el id de la parada BA.
import { useLocalSearchParams } from 'expo-router';

import { ParadaScreen } from '@/features/colectivos';

export default function ParadaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ParadaScreen id={id} />;
}
