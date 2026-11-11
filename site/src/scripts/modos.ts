// Selector de modos de la landing: el único JavaScript del sitio.
//
// Sin JavaScript, los cuatro paneles se ven uno debajo del otro y las pestañas no existen. Con
// JavaScript, se muestran las pestañas (patrón ARIA de pestañas: flechas, Inicio/Fin, foco
// gestionado y activación automática) y queda un solo panel visible. Si el navegador tiene
// `document.startViewTransition` y la persona no pidió menos movimiento, el cambio de panel va
// envuelto en una view transition (los nombres los pone el CSS por clase, con
// `.modos[data-mejorado]`); si no, el panel cambia al instante.

function iniciar(raiz: HTMLElement): void {
  const lista = raiz.querySelector<HTMLElement>('[data-pestanas]');
  const pestanas = Array.from(raiz.querySelectorAll<HTMLButtonElement>('[data-pestana]'));
  const paneles = Array.from(raiz.querySelectorAll<HTMLElement>('[data-panel]'));
  if (!lista || pestanas.length === 0 || pestanas.length !== paneles.length) return;

  const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  let actual = Math.max(
    0,
    pestanas.findIndex((p) => p.getAttribute('aria-selected') === 'true'),
  );

  lista.setAttribute('role', 'tablist');
  lista.setAttribute('aria-label', 'Pantallas de la app');
  pestanas.forEach((pestana, i) => {
    const panel = paneles[i];
    if (!panel) return;
    pestana.setAttribute('role', 'tab');
    pestana.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', pestana.id);
    panel.tabIndex = 0;
  });

  function pintar(indice: number): void {
    pestanas.forEach((pestana, i) => {
      const elegida = i === indice;
      pestana.setAttribute('aria-selected', String(elegida));
      pestana.tabIndex = elegida ? 0 : -1;
      const panel = paneles[i];
      if (panel) panel.hidden = !elegida;
    });
    actual = indice;
  }

  function elegir(indice: number, enfocar: boolean): void {
    if (indice !== actual) {
      if (typeof document.startViewTransition === 'function' && !menosMovimiento.matches) {
        document.startViewTransition(() => {
          pintar(indice);
        });
      } else {
        pintar(indice);
      }
    }
    if (enfocar) pestanas[indice]?.focus();
  }

  pestanas.forEach((pestana, i) => {
    pestana.addEventListener('click', () => {
      elegir(i, false);
    });
  });

  lista.addEventListener('keydown', (evento) => {
    const ultimo = pestanas.length - 1;
    const destino: Partial<Record<string, number>> = {
      ArrowRight: actual === ultimo ? 0 : actual + 1,
      ArrowLeft: actual === 0 ? ultimo : actual - 1,
      Home: 0,
      End: ultimo,
    };
    const indice = destino[evento.key];
    if (indice === undefined) return;
    evento.preventDefault();
    elegir(indice, true);
  });

  pintar(actual);
  lista.hidden = false;
  raiz.dataset['mejorado'] = '';
}

document.querySelectorAll<HTMLElement>('[data-modos]').forEach(iniciar);
