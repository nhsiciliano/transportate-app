import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <View>
      <Text accessibilityRole="header">No encontramos esta pantalla</Text>
      <Text>El enlace que abriste no existe o ya no está disponible.</Text>
      <Link href="/inicio">Volvé a Inicio</Link>
    </View>
  );
}
