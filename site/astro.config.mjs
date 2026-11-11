// Sitio público de Transportate: estático, sin adaptador. Ver site/README.md.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://transportate.ar',
  // `file` genera privacidad.html y soporte.html (no privacidad/index.html): Workers static
  // assets sirve /privacidad sin redirigir, igual que con el sitio a mano.
  build: { format: 'file', inlineStylesheets: 'never' },
  trailingSlash: 'never',
  // Astro 7 usa `'jsx'` por defecto, que come el espacio entre un texto y un enlace. `true`
  // comprime sin perder espacios significativos (reglas de HTML).
  compressHTML: true,
  // Sin barra de herramientas en `astro dev` (inyecta scripts propios).
  devToolbar: { enabled: false },
  vite: {
    // 0: ninguna hoja, script, fuente ni imagen se inyecta en línea (la CSP no admite
    // `unsafe-inline` ni `data:`).
    build: { assetsInlineLimit: 0 },
  },
});
