// Fixtures binarios (.pb) importados con `?inline`: Vite los entrega como data URL base64
// (ver `assetsInclude` en vitest.config.ts). `fixtureBytes` los convierte a bytes.
declare module '*.pb?inline' {
  const dataUrl: string;
  export default dataUrl;
}

// `import.meta.glob` de Vite (solo tests): el proxy no depende de `vite/client` directamente.
interface ImportMeta {
  glob<T>(
    pattern: string,
    options: { query?: string; import?: string; eager: true },
  ): Record<string, T>;
}
