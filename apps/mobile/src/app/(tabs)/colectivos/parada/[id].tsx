import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

// Placeholder: los componentes de UI llegan con la tarea 3.7.
export default function ParadaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View>
      <Text accessibilityRole="header">Parada {id}</Text>
      <Text>Acá vas a ver qué líneas pasan por esta parada y cuándo llegan.</Text>
    </View>
  );
}
