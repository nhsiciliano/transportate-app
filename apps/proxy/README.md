# transportate-proxy

Proxy/BFF de Transportate sobre Cloudflare Workers con Hono 4. Arquitectura: `docs/03-arquitectura.md`; contrato JSON: `packages/contracts`.

```sh
cp ../../.dev.vars.example .dev.vars   # completar con las credenciales (nunca se commitea)
pnpm --filter transportate-proxy dev    # wrangler dev → http://localhost:8787/v1/health
pnpm --filter transportate-proxy test   # Vitest dentro de workerd (@cloudflare/vitest-plugin)
pnpm --filter transportate-proxy types  # regenera worker-configuration.d.ts tras tocar wrangler.jsonc
```

| Carpeta | Qué va |
|---|---|
| `src/routes/` | Una ruta por servicio (`/v1/<servicio>`). Valida parámetros y fija headers de caché |
| `src/adapters/` | Traducción upstream → contrato v1 (`types.ts` define las interfaces) |
| `src/sources/` | Acceso al upstream con caché (`FeedSource`) |
| `src/cache/` | Utilidades de Cache API, claves y coalescing |
| `src/middleware/` | Middlewares propios (errores, rate limit) |
| `src/lib/` | Utilidades sin dependencias de Hono |

Privacidad: el Worker no loguea requests ni URLs upstream (llevan el secret en la query) y no persiste IPs (`docs/05-privacidad.md`).
