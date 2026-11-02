#!/usr/bin/env node
// Verifica, antes de `npm test` / `npm run build`, que @transportate/contracts esté compilado y al
// día. tools/gtfs valida su salida contra packages/contracts/dist (única fuente de verdad), y un
// dist ausente o viejo da errores confusos (exports faltantes o esquemas desactualizados).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACTS = resolve(HERE, '..', '..', '..', 'packages', 'contracts');
const FIX =
  'Compilá los contratos desde la raíz del repo:\n' +
  '  pnpm install            (instala el workspace y compila packages/contracts vía "prepare")\n' +
  '  pnpm --filter @transportate/contracts build   (si cambiaste packages/contracts/src)';

function newest(dir, ext) {
  let max = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) max = Math.max(max, newest(p, ext));
    else if (e.name.endsWith(ext)) max = Math.max(max, statSync(p).mtimeMs);
  }
  return max;
}

function fail(msg) {
  console.error(`\n✖ tools/gtfs: ${msg}\n\n${FIX}\n`);
  process.exit(1);
}

if (!existsSync(join(CONTRACTS, 'src'))) fail(`no encuentro ${CONTRACTS}/src`);
if (!existsSync(join(CONTRACTS, 'node_modules', 'zod'))) {
  fail('packages/contracts no tiene dependencias instaladas (falta pnpm install en la raíz).');
}
if (!existsSync(join(CONTRACTS, 'dist', 'index.js'))) fail('falta packages/contracts/dist.');
if (newest(join(CONTRACTS, 'src'), '.ts') > newest(join(CONTRACTS, 'dist'), '.js')) {
  fail('packages/contracts/dist está desactualizado respecto de src/.');
}
