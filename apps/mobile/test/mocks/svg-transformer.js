// Transformer de Jest para los `.svg`: en lugar del SVG real exporta un componente que renderiza
// un `View` con `testID` = `svg:<nombre-del-archivo>` y las mismas props que recibiría `Svg`
// (`width`, `height`, `fill`, …). Así los tests verifican qué ícono se importó, su tamaño y su
// color sin parsear XML (Jest no puede cargar un `.svg` como módulo).
// Mock recomendado en https://github.com/kristerkari/react-native-svg-transformer (sección Jest).
// Jest carga los transformers como CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path');

module.exports = {
  process(_sourceText, sourcePath) {
    const name = path.basename(sourcePath, '.svg');
    const code = `
      const React = require('react');
      const { View } = require('react-native');
      function SvgMock(props) {
        return React.createElement(View, { testID: ${JSON.stringify(`svg:${name}`)}, ...props });
      }
      SvgMock.displayName = ${JSON.stringify(`Svg(${name})`)};
      module.exports = { __esModule: true, default: SvgMock };
    `;
    return { code };
  },
};
