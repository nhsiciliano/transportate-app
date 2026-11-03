#!/usr/bin/env node
// Genera `src/features/ajustes/licencias.json` con las licencias de software de terceros que
// muestra la pantalla "Licencias" (Acerca de). Sin dependencias: solo Node.
//
// - Recorre las `dependencies` de `apps/mobile/package.json` (las que viajan en la app) y las
//   resuelve en `node_modules`. pnpm deja symlinks: `realpathSync` los sigue hasta el paquete real.
// - De cada paquete toma `name`, `version`, `license` y `repository`, y el texto de los archivos
//   `LICENSE*`, `LICENCE*`, `COPYING*` y `NOTICE*` si existen (los de fuentes llevan además
//   `LICENSE_FONT` con la OFL).
// - Se omiten los paquetes del propio workspace (`workspace:*`): es código de Transportate.
// - Si el JSON con textos pesa más de 300 KB, se vuelve a escribir solo con nombre, versión,
//   licencia y repositorio.
// - La salida es determinista (orden alfabético, sin fechas): correrlo dos veces no genera diff.
//
// Uso (desde `apps/mobile`): `pnpm licencias`, con las dependencias instaladas (`pnpm install`).
import { Buffer } from 'node:buffer';
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 300 * 1024;
const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-_.].*)?$/i;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'src/features/ajustes/licencias.json');

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** `license` puede ser string, `{ type }` (viejo) o `licenses: [{ type }]` (más viejo). */
function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return (
      pkg.licenses
        .map((l) => l.type)
        .filter(Boolean)
        .join(' OR ') || null
    );
  }
  return null;
}

/** Normaliza la URL del repositorio a `https://…` sin `git+` ni `.git`. */
function repositoryOf(pkg) {
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  if (typeof raw !== 'string') return null;
  const url = raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\.git$/, '');
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) return `https://github.com/${url}`;
  return url.startsWith('http') ? url : null;
}

function licenseText(dir) {
  const files = readdirSync(dir)
    .filter((name) => LICENSE_FILE.test(name) && statSync(join(dir, name)).isFile())
    .sort();
  if (files.length === 0) return null;
  const parts = files.map((name) => {
    const body = readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n').trim();
    return files.length > 1 ? `${name}\n\n${body}` : body;
  });
  return parts.join('\n\n---\n\n');
}

const manifest = readJson(join(root, 'package.json'));
const deps = Object.entries(manifest.dependencies ?? {})
  .filter(([, range]) => !String(range).startsWith('workspace:'))
  .map(([name]) => name)
  .sort((a, b) => a.localeCompare(b, 'en'));

const paquetes = deps.map((name) => {
  const link = join(root, 'node_modules', name);
  if (!existsSync(link)) {
    throw new Error(`Falta ${name} en node_modules: corré \`pnpm install\` antes de generar.`);
  }
  const dir = realpathSync(link);
  const pkg = readJson(join(dir, 'package.json'));
  const license = licenseOf(pkg);
  if (!license) throw new Error(`${name} no declara licencia en su package.json.`);
  return {
    name,
    version: String(pkg.version),
    license,
    repository: repositoryOf(pkg),
    text: licenseText(dir),
  };
});

const compact = (list) =>
  list.map(({ name, version, license, repository }) => ({ name, version, license, repository }));

const write = (list) => {
  const body = `${JSON.stringify({ paquetes: list }, null, 2)}\n`;
  writeFileSync(output, body);
  return Buffer.byteLength(body);
};

let size = write(paquetes);
let conTextos = true;
if (size > MAX_BYTES) {
  size = write(compact(paquetes));
  conTextos = false;
}

const sinTexto = paquetes.filter((p) => !p.text).map((p) => p.name);
stdout.write(
  `${paquetes.length} paquetes → ${output} (${(size / 1024).toFixed(1)} KB, ${conTextos ? 'con textos' : 'sin textos: pasó los 300 KB'}).\n`,
);
if (conTextos && sinTexto.length > 0) {
  stdout.write(
    `Sin archivo de licencia (se muestra solo el identificador): ${sinTexto.join(', ')}\n`,
  );
}
