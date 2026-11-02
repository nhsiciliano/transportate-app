// `/` no es una pantalla propia: la app abre en el tab Inicio.
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/inicio" />;
}
