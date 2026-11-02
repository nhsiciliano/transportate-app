# @transportate/contracts

Contratos JSON v1 de Transportate: esquemas Zod 4 y sus tipos, compartidos por el proxy (`apps/proxy`), `tools/gtfs` y la app (`apps/mobile`). Se compila a `dist/` (`pnpm --filter @transportate/contracts build`) y los consumidores importan siempre `dist`.

## `exports`

Cada entrada (`.` y `./upstream`) declara `types`, `import` y `default`, las tres apuntando al mismo ESM de `dist/`:

- `import` es la que usan el proxy (Vite/workerd), `tools/gtfs` y Metro.
- `default` existe **para Jest**: `jest-expo` resuelve con las condiciones `require`/`default`, y sin ella falla con "Cannot find module '@transportate/contracts'". Jest recibe el ESM igual y lo transforma Babel, porque el paquete llega por el symlink del workspace (su ruta real está fuera de `node_modules`).
