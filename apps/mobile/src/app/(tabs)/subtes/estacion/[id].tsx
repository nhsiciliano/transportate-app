// Ruta fina: la pantalla vive en `src/features/subtes`. `id` es el `stop_id` de 4 dígitos.
import { useLocalSearchParams } from 'expo-router';

import { EstacionScreen } from '@/features/subtes';

export default function EstacionSubteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EstacionScreen id={id} />;
}
