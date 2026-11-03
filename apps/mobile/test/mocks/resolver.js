// Resolver de Jest: el de Reanimated 4 (que encadena el de Worklets) sobre el de React Native que
// trae `jest-expo`.
//
// - Reanimated y Worklets resuelven su implementación web en Jest (guía "Testing with Jest" de
//   cada librería: `resolver: 'react-native-reanimated/jest/resolver'`).
// - Reemplazar el resolver del preset a secas perdería su ajuste para las subrutas de
//   `react-native`, así que se componen: el del preset hace la resolución final.
// - pnpm: la carpeta real de Reanimated es
//   `node_modules/.pnpm/react-native-reanimated@4.7.1_react-native-worklets@0.13.0_…/node_modules/…`
//   y el resolver de Worklets decide con `basedir.includes('react-native-worklets')`, así que
//   trataría TODO Reanimated como Worklets (y buscaría `react-native-web`). Para la decisión se le
//   pasa el `basedir` sin el nombre de esa carpeta; la resolución real usa el `basedir` original.
/* eslint-disable @typescript-eslint/no-require-imports -- Jest carga el resolver como CommonJS. */
const { resolver: presetResolverPath } = require('jest-expo/jest-preset');
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

const presetResolver = require(presetResolverPath);
const PNPM_DIR = /node_modules\/\.pnpm\/[^/]+\//;

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) => {
  const { basedir, defaultResolver } = options;
  return reanimatedResolver(request, {
    ...options,
    basedir: basedir.replace(PNPM_DIR, 'node_modules/.pnpm/_/'),
    defaultResolver: (req, opts) => presetResolver(req, { ...opts, basedir, defaultResolver }),
  });
};
