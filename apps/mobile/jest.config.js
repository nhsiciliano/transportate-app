// Jest con el preset de Expo (https://docs.expo.dev/develop/unit-testing/).
// Con pnpm, `.pnpm` tiene que estar en la excepción de transformIgnorePatterns para que Babel
// transforme los paquetes de React Native/Expo que viven dentro de node_modules/.pnpm.
// `standard-navigation` (dependencia de expo-router 58) se publica solo como ESM.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|standard-navigation))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
