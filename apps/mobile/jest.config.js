// Jest con el preset de Expo (https://docs.expo.dev/develop/unit-testing/).
// Con pnpm, `.pnpm` tiene que estar en la excepción de transformIgnorePatterns para que Babel
// transforme los paquetes de React Native/Expo que viven dentro de node_modules/.pnpm.
// `standard-navigation` (dependencia de expo-router 58) se publica solo como ESM.
// `@material-symbols/*` también entra en la excepción para que el transformer de `.svg` se aplique
// a los archivos que viven en node_modules. Con pnpm la ruta real es
// `node_modules/.pnpm/<pkg>/node_modules/<pkg>`, así que cada paquete nativo que no empiece con
// `react-native`/`expo` (como `@maplibre/*`) tiene que figurar también acá.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|@material-symbols/.*|standard-navigation|@maplibre/.*))',
  ],
  // Los `.svg` (Material Symbols) se reemplazan por un componente de prueba que renderiza un `View`
  // con `testID` (ver test/mocks/svg-transformer.js).
  transform: {
    '\\.svg$': '<rootDir>/test/mocks/svg-transformer.js',
  },
  // Reanimated/Worklets + el resolver de React Native del preset (ver test/mocks/resolver.js).
  resolver: '<rootDir>/test/mocks/resolver.js',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  // Limpia el estado de los mocks de ubicación y mapa antes de cada test.
  setupFilesAfterEnv: ['<rootDir>/test/mocks/setup-after-env.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
