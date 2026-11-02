import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

// Placeholder: los componentes de UI llegan con la tarea 3.7.
export default function LineaSubteScreen() {
  const { linea } = useLocalSearchParams<{ linea: string }>();
  return (
    <View>
      <Text accessibilityRole="header">Línea {linea}</Text>
      <Text>Acá vas a ver el estado de la línea, sus alertas y sus estaciones.</Text>
    </View>
  );
}
