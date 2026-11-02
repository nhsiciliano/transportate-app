// Fixtures binarios (.pb) importados con `?inline`: Vite los entrega como data URL base64
// (ver `assetsInclude` en vitest.config.ts). `fixtureBytes` los convierte a bytes.
declare module '*.pb?inline' {
  const dataUrl: string;
  export default dataUrl;
}
