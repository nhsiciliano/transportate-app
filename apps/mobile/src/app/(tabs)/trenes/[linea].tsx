// Ruta fina: la pantalla vive en `src/features/trenes`. `linea` es el slug (`roca`, `san-martin`…).
import { useLocalSearchParams } from 'expo-router';

import { LineaTrenScreen } from '@/features/trenes';

export default function LineaTrenRoute() {
  const { linea } = useLocalSearchParams<{ linea: string }>();
  return <LineaTrenScreen lineaParam={linea} />;
}
