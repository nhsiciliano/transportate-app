// Verificación del build (`pnpm test`): corre después de `astro build`, sin dependencias.
//
// Falla con un mensaje claro si en dist/:
// - falta alguna de las páginas que tienen URL pública;
// - algún HTML tiene <script> sin `src`, <style> o un atributo `style=` (la CSP no admite nada en
//   línea);
// - algún HTML o CSS carga un recurso de otro origen (los enlaces <a> externos sí se permiten);
// - aparece una dirección de mail fuera de privacidad.html y soporte.html;
// - el texto visible de privacidad, soporte o 404 difiere del guardado en scripts/fixtures/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PATRON_MAIL, textoPrincipal } from './texto.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const dist = join(aqui, '..', 'dist');
const fixtures = join(aqui, 'fixtures');

const PAGINAS = ['index.html', 'privacidad.html', 'soporte.html', '404.html'];
const CON_MAIL = new Set(['privacidad.html', 'soporte.html']);
const CON_FIXTURE = ['privacidad.html', 'soporte.html', '404.html'];

const errores = [];
const fallo = (archivo, mensaje) => errores.push(`${archivo}: ${mensaje}`);

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

/** Una URL es externa si declara esquema u origen propio (`https:`, `//host`, `data:`…). */
function esExterna(url) {
  const limpia = url.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(limpia) || limpia.startsWith('//');
}

function revisarHtml(nombre, html) {
  for (const [, atributos] of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (!/\bsrc\s*=/i.test(atributos)) fallo(nombre, '<script> en línea (sin src)');
  }
  if (/<style\b/i.test(html)) fallo(nombre, '<style> en línea');
  if (/\sstyle\s*=/i.test(html)) fallo(nombre, 'atributo style=');

  for (const [etiqueta] of html.matchAll(/<[a-z][^>]*>/gi)) {
    const tipo = /^<([a-z0-9-]+)/i.exec(etiqueta)?.[1]?.toLowerCase();
    for (const [, atributo, valor] of etiqueta.matchAll(
      /\s(src|srcset|href|poster|data)\s*=\s*"([^"]*)"/gi,
    )) {
      const nombreAtributo = atributo.toLowerCase();
      // Los enlaces de navegación (<a href>, canonical, og:url) no cargan nada.
      if (nombreAtributo === 'href' && tipo === 'a') continue;
      if (nombreAtributo === 'href' && tipo === 'link' && /\brel="canonical"/i.test(etiqueta)) {
        continue;
      }
      const urls =
        nombreAtributo === 'srcset'
          ? valor.split(',').map((c) => c.trim().split(/\s+/)[0])
          : [valor];
      for (const url of urls) {
        if (url && esExterna(url))
          fallo(nombre, `recurso de otro origen en <${tipo} ${atributo}>: ${url}`);
      }
    }
  }
  if (/<base\b/i.test(html)) fallo(nombre, '<base> no permitido');

  if (!CON_MAIL.has(nombre) && PATRON_MAIL.test(html)) {
    fallo(nombre, 'tiene una dirección de mail (solo puede estar en privacidad y soporte)');
  }
  PATRON_MAIL.lastIndex = 0;
}

function revisarCss(nombre, css) {
  for (const [, url] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    if (esExterna(url)) fallo(nombre, `url() de otro origen: ${url}`);
  }
  for (const [, url] of css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'");\s]+)/gi)) {
    if (esExterna(url)) fallo(nombre, `@import de otro origen: ${url}`);
  }
}

function diferencia(esperado, actual) {
  const a = esperado.split('\n');
  const b = actual.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) {
      return `primera diferencia en la línea ${i + 1}:\n    esperado: ${a[i] ?? '(nada)'}\n    actual:   ${b[i] ?? '(nada)'}`;
    }
  }
  return '';
}

try {
  statSync(dist);
} catch {
  console.error('No existe dist/: corré `astro build` primero.');
  process.exit(1);
}

for (const pagina of PAGINAS) {
  try {
    statSync(join(dist, pagina));
  } catch {
    fallo(pagina, 'falta en dist/');
  }
}

for (const ruta of archivos(dist)) {
  const nombre = relative(dist, ruta);
  if (nombre.endsWith('.html')) revisarHtml(nombre, readFileSync(ruta, 'utf8'));
  else if (nombre.endsWith('.css')) revisarCss(nombre, readFileSync(ruta, 'utf8'));
}

for (const pagina of CON_FIXTURE) {
  let html;
  try {
    html = readFileSync(join(dist, pagina), 'utf8');
  } catch {
    continue; // ya se informó que falta
  }
  const esperado = readFileSync(join(fixtures, pagina.replace(/\.html$/, '.txt')), 'utf8');
  const actual = textoPrincipal(html);
  if (actual !== esperado) {
    fallo(
      pagina,
      `el texto visible cambió respecto de scripts/fixtures/. ${diferencia(esperado, actual)}`,
    );
  }
}

if (errores.length > 0) {
  console.error(`verificar-dist: ${errores.length} problema(s) en dist/\n`);
  for (const error of errores) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `verificar-dist: dist/ en orden (${PAGINAS.length} páginas, sin nada en línea ni de otro origen, mail solo en privacidad y soporte, textos iguales a los fixtures).`,
);
