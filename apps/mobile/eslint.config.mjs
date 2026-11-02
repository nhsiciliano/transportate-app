// ESLint de apps/mobile: reutiliza el flat config de la raíz (typescript-eslint
// strict-type-checked, sin `any`) y suma las reglas de React.
//
// - `eslint-plugin-react-hooks` 7.1.1: soporta ESLint 10; preset `flat.recommended`, que incluye
//   las reglas del React Compiler (https://react.dev/learn/react-compiler/installation).
// - `eslint-plugin-react` 7.37.5 y `eslint-config-expo` 58.0.4 NO se usan: el primero declara
//   `peerDependencies.eslint` hasta ^9.7 y `eslint-config-expo` depende de él (y de
//   eslint-plugin-import). Las reglas de JSX que importan (keys, tipos de props) las cubre
//   TypeScript strict.
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import root from '../../eslint.config.js';

export default [
  ...root,
  { ignores: ['.expo/**', 'ios/**', 'android/**', 'expo-env.d.ts'] },
  reactHooks.configs.flat.recommended,
  {
    // Archivos de configuración en CommonJS que leen Jest/Metro/Babel con Node.
    files: ['**/*.js'],
    languageOptions: { globals: { ...globals.node }, sourceType: 'commonjs' },
  },
  {
    files: ['test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.jest } },
  },
];
