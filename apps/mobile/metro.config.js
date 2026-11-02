// Metro con `react-native-svg-transformer` para importar `.svg` como componentes
// (https://github.com/kristerkari/react-native-svg-transformer, variante `/expo`).
// Lo usa `src/shared/icons` para los Material Symbols (ADR-0004): cada ícono se importa de forma
// explícita, así que Metro empaqueta solo los SVG que el mapa curado nombra.
// Metro lee este archivo como CommonJS: `require` es lo único posible acá.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};
config.resolver = {
  ...resolver,
  // `svg` deja de ser un asset (imagen) y pasa a ser código fuente que transforma SVGR.
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

module.exports = config;
