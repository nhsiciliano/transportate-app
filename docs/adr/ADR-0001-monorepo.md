# ADR-0001 — Monorepo con pnpm

- **Estado:** Aceptada (2026-11-01)
- **Fase:** 1 (se implementa en Fase 2, tarea 2.2)
- **Origen:** `docs/00-plan.md`, decisión de arquitectura 1

## Contexto

Transportate tiene dos productos desplegables distintos —la app móvil (Expo) y el proxy (Cloudflare Worker con Hono)— más una herramienta offline de preprocesado de GTFS. Entre app y proxy hay **una sola dependencia real: el contrato JSON** que el proxy sirve y la app consume. Si cada pieza vive en su repo, el contrato se copia y se desincroniza ("drift"): el proxy cambia un campo y la app lo descubre en producción.

Además trabaja una sola persona (con agentes), por lo que la sobrecarga de coordinar varios repos no se justifica.

## Decisión

Un **monorepo con pnpm workspaces**:

```
apps/mobile        app Expo (consume el contrato)
apps/proxy         Worker + Hono (produce el contrato)
packages/contracts esquemas Zod v1 y tipos inferidos (los comparten los dos)
tools/gtfs         preprocesado offline de GTFS → JSON compacto → R2
docs/              documentación
```

`packages/contracts` es la única fuente de verdad del contrato: el proxy valida sus respuestas con esos esquemas y la app parsea con los mismos. Las configuraciones de TypeScript estricto, ESLint y Prettier se comparten desde la raíz.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **Repos separados** (app, proxy) con un paquete publicado de contratos | Agrega publicación y versionado de un paquete solo para compartir tipos; cada cambio de contrato exige dos PRs coordinados. |
| **npm workspaces / yarn workspaces** | Funcionan, pero pnpm resuelve mejor la estricta separación de dependencias entre apps y es más rápido; Expo y Metro soportan monorepos pnpm con configuración conocida. *(Compatibilidad de Metro con el layout de `node_modules` de pnpm: verificar con Context7 en la tarea 3.1.)* |
| **Nx / Turborepo** | Sobreingeniería con tres paquetes. Se puede sumar un orquestador de tareas más adelante sin mover código. |
| **Copiar los tipos a mano** | Es exactamente el drift que se quiere evitar. |

## Consecuencias

- (+) Un cambio de contrato es un solo commit que toca `packages/contracts`, el adaptador y la app; el typecheck rompe si falta alguno.
- (+) CI único (lint, typecheck, tests de ambas apps) y bitácora única.
- (−) Metro (bundler de React Native) necesita configuración para resolver paquetes del workspace; se verifica en Fase 3 (tarea 3.2).
- (−) Las builds de EAS parten de un monorepo: hay que declarar la raíz y los paquetes de los que depende la app (Fase 5, tarea 5.6).
- (−) El `.env` con credenciales de la API vive en la raíz y debe seguir en `.gitignore`; solo el proxy usa secrets (vía `wrangler secret`), la app nunca.
