// Ruta fina: la pantalla vive en `src/features/trenes`. `id` es el id de estación de SOFSE.
import { useLocalSearchParams } from 'expo-router';

import { EstacionTrenScreen } from '@/features/trenes';

export default function EstacionTrenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EstacionTrenScreen id={id} />;
}
