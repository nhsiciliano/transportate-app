// Ruta fina: la pantalla vive en `src/features/subtes`. `linea` es A…H o PM (Premetro).
import { useLocalSearchParams } from 'expo-router';

import { LineaScreen } from '@/features/subtes';

export default function LineaSubteRoute() {
  const { linea } = useLocalSearchParams<{ linea: string }>();
  return <LineaScreen lineaParam={linea} />;
}
