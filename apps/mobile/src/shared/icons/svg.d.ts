// Los `.svg` se importan como componentes de `react-native-svg` gracias a
// `react-native-svg-transformer` (ver `metro.config.js`). En Jest los reemplaza
// `test/mocks/svg-transformer.js`.
declare module '*.svg' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: FC<SvgProps>;
  export default content;
}
