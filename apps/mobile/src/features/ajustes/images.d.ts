// Metro resuelve los `.png` importados a un `ImageSourcePropType`. Se declara acá (y no solo en
// `expo/types`, que viene del `expo-env.d.ts` generado e ignorado en git) para que `tsc` pase
// también en un checkout limpio.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
