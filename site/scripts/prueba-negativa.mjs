// Prueba negativa de verificar-dist.mjs (corre en `pnpm test`, después del build).
//
// Copia dist/ a una carpeta temporal, le mete a propósito una falla de cada tipo y comprueba que
// verificar-dist las encuentra todas. Si una regla deja de detectar su caso, esta prueba falla.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const dist = join(aqui, '..', 'dist');
const copia = mkdtempSync(join(tmpdir(), 'transportate-dist-'));

const CREDITO =
  'Apple y el logotipo de Apple son marcas comerciales de Apple Inc., registradas en EE. UU. y en otros países y regiones. App Store es una marca de servicio de Apple Inc.';

/** Cada caso: qué se rompe y el mensaje que verificar-dist tiene que dar. */
const casos = [
  {
    archivo: 'index.html',
    cambio: (html) => html.replace('<main', '<main style="color: red"'),
    espera: 'index.html: atributo style=',
  },
  {
    archivo: 'index.html',
    cambio: (html) => html.replace('</main>', '<script>alert(1)</script></main>'),
    espera: 'index.html: <script> en línea',
  },
  {
    archivo: 'index.html',
    cambio: (html) =>
      html.replace('</main>', '<img src="https://ejemplo.com/a.png" alt=""></main>'),
    espera: 'index.html: recurso de otro origen en <img src>',
  },
  {
    // Insignia suelta, sin enlace a la ficha y sin el crédito (en 404, que nunca tiene crédito:
    // así el caso vale con la app publicada o no).
    archivo: '404.html',
    cambio: (html) =>
      html.replace(
        '</main>',
        '<img src="/_astro/app-store-es-mx.prueba.svg" alt="Descárgalo en el App Store"></main>',
      ),
    espera: [
      '404.html: insignia de App Store fuera de un enlace a https://apps.apple.com/',
      '404.html: insignia de App Store sin el crédito de Apple',
    ],
  },
  {
    // Crédito de Apple en una página sin insignia (y texto de privacidad cambiado).
    archivo: 'privacidad.html',
    cambio: (html) =>
      html
        .replace('Política de privacidad</h1>', 'Política de privacidad (cambiada)</h1>')
        .replace('</footer>', `<p>${CREDITO}</p></footer>`),
    espera: [
      'privacidad.html: crédito de Apple sin la insignia de App Store',
      'privacidad.html: el texto visible cambió',
    ],
  },
];

try {
  cpSync(dist, copia, { recursive: true });

  for (const caso of casos) {
    const ruta = join(copia, caso.archivo);
    const antes = readFileSync(ruta, 'utf8');
    const despues = caso.cambio(antes);
    if (despues === antes) throw new Error(`el caso para ${caso.archivo} no cambió nada`);
    writeFileSync(ruta, despues);
  }

  // Un CSS con @import externo y un SVG con estilo en línea.
  const astro = join(copia, '_astro');
  const css = readdirSync(astro).find((n) => n.endsWith('.css'));
  writeFileSync(
    join(astro, css),
    `@import url("https://ejemplo.com/a.css");\n${readFileSync(join(astro, css), 'utf8')}`,
  );
  writeFileSync(join(astro, 'prueba.svg'), '<svg><path style="fill: #fff" d="M0 0"/></svg>');

  let salida = '';
  let codigo = 0;
  try {
    execFileSync(process.execPath, [join(aqui, 'verificar-dist.mjs'), copia], { stdio: 'pipe' });
  } catch (error) {
    codigo = error.status;
    salida = `${error.stdout}${error.stderr}`;
  }

  const esperados = [
    ...casos.flatMap((c) => c.espera),
    `_astro/${css}: @import de otro origen`,
    '_astro/prueba.svg: atributo style= en un SVG',
  ];
  const faltan = esperados.filter((e) => !salida.includes(e));
  if (codigo === 0 || faltan.length > 0) {
    console.error('prueba-negativa: verificar-dist no detectó todo lo que tenía que detectar.');
    for (const f of faltan) console.error(`  - falta: ${f}`);
    if (codigo === 0) console.error('  - verificar-dist terminó sin error');
    process.exit(1);
  }
  console.log(`prueba-negativa: verificar-dist detectó las ${esperados.length} fallas sembradas.`);
} finally {
  rmSync(copia, { recursive: true, force: true });
}
