// Texto visible de un HTML, normalizado para comparar páginas entre versiones del sitio.
//
// Se queda con el contenido de <main> (la cabecera y el pie cambian con el diseño; el texto de la
// política y de soporte, no). Cada bloque (párrafo, ítem, título) va en su propia línea; las
// etiquetas en línea (<a>, <strong>…) se quitan sin agregar espacios, así que si el HTML pierde un
// espacio entre un texto y un enlace, la comparación lo detecta. Las direcciones de mail se
// reemplazan por un marcador para que no queden copiadas en los fixtures.

const BLOQUES =
  /<\/?(?:address|article|aside|blockquote|br|dd|details|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|section|summary|table|td|th|tr|ul)\b[^>]*>/gi;

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export const MARCADOR_MAIL = '[mail de contacto]';
export const PATRON_MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function decodificar(texto) {
  return texto.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entidad, cuerpo) => {
    if (cuerpo[0] === '#') {
      const hex = cuerpo[1] === 'x' || cuerpo[1] === 'X';
      return String.fromCodePoint(parseInt(cuerpo.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return ENTIDADES[cuerpo.toLowerCase()] ?? entidad;
  });
}

/** Texto visible de <main>, una línea por bloque, con el mail reemplazado por un marcador. */
export function textoPrincipal(html) {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (!main) throw new Error('El HTML no tiene <main>.');
  const plano = main[1]
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/\s+/g, ' ')
    .replace(BLOQUES, '\n')
    .replace(/<[^>]+>/g, '');
  return decodificar(plano)
    .replace(PATRON_MAIL, MARCADOR_MAIL)
    .split('\n')
    .map((linea) => linea.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .concat('\n');
}
