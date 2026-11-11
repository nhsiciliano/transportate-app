// Botón de tema de la cabecera: claro (por defecto) u oscuro.
//
// El tema es `data-tema="oscuro"` en <html> (sin el atributo, claro); el CSS de global.css cambia
// los tokens con eso. La elección se guarda en `localStorage` de este navegador y nunca sale de
// él; public/tema.js la vuelve a aplicar antes de pintar cada página. Sin JavaScript, el botón
// no aparece y el sitio queda en claro.

const CLAVE = 'transportate-tema';
const COLOR_BARRA = { claro: '#ffffff', oscuro: '#000b18' } as const;

type Tema = keyof typeof COLOR_BARRA;

function temaActual(): Tema {
  return document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro';
}

function aplicar(tema: Tema, boton: HTMLButtonElement): void {
  const raiz = document.documentElement;
  if (tema === 'oscuro') raiz.dataset.tema = 'oscuro';
  else delete raiz.dataset.tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[tema]);
  boton.setAttribute('aria-pressed', tema === 'oscuro' ? 'true' : 'false');
}

function guardar(tema: Tema): void {
  try {
    if (tema === 'oscuro') localStorage.setItem(CLAVE, 'oscuro');
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: el cambio vale para esta página.
  }
}

const boton = document.querySelector<HTMLButtonElement>('[data-tema-boton]');
if (boton) {
  aplicar(temaActual(), boton);
  boton.hidden = false;
  boton.addEventListener('click', () => {
    const tema: Tema = temaActual() === 'oscuro' ? 'claro' : 'oscuro';
    aplicar(tema, boton);
    guardar(tema);
  });
}
