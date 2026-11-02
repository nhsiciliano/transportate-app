import { Link } from 'expo-router';
import { Text, View } from 'react-native';

// Placeholder: los componentes de UI llegan con la tarea 3.7.
export default function AjustesScreen() {
  return (
    <View>
      <Text accessibilityRole="header">Ajustes</Text>
      <Text>Acá vas a poder elegir el tema y el intervalo de actualización.</Text>
      <Link href="/inicio/acerca">Acerca de Transportate</Link>
    </View>
  );
}
