// Tema elegido con el botón de la cabecera (src/scripts/tema.ts). Corre bloqueante en el <head>,
// antes de pintar, para que quien eligió el oscuro no vea un destello claro. Por defecto, claro.
// Lo único que se guarda es la palabra «oscuro», en este navegador; no sale de acá.
try {
  if (localStorage.getItem('transportate-tema') === 'oscuro') {
    document.documentElement.dataset.tema = 'oscuro';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#000b18');
  }
} catch (e) {
  // Sin acceso al almacenamiento (navegación privada estricta): queda en claro.
}
