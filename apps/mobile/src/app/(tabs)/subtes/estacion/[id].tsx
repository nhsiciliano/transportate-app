import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

// Placeholder: los componentes de UI llegan con la tarea 3.7.
export default function EstacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View>
      <Text accessibilityRole="header">Estación {id}</Text>
      <Text>Acá vas a ver los próximos trenes por andén.</Text>
    </View>
  );
}
