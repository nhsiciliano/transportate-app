// Ruta fina: la pantalla vive en `src/features/trenes`. `id` es el id de ramal de SOFSE.
import { useLocalSearchParams } from 'expo-router';

import { RamalScreen } from '@/features/trenes';

export default function RamalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RamalScreen id={id} />;
}
