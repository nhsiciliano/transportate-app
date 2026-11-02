import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Los tests corren dentro de workerd con la misma configuración que `wrangler dev`.
export default defineConfig({
  // Los fixtures binarios reales (.pb) se importan con `?inline` (data URL base64): en workerd no
  // hay `fs` y Vite no deja importar binarios desconocidos sin declararlos como assets.
  assetsInclude: ['**/*.pb'],
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  test: {
    include: ['test/**/*.test.ts'],
  },
});
