// Enlaces a las tiendas. Con `null`, `BotonTienda.astro` muestra la placa «Próximamente» y su
// aviso. Con la URL de la ficha: en App Store, la insignia oficial de Apple (y su crédito en el
// pie); en Google Play, un enlace propio «Descargala». Cargá `appStore` solo cuando la app esté
// aprobada y disponible: la licencia de Apple cubre la insignia solo para apps publicadas. Ver
// site/README.md, «Accesos a las tiendas».
export interface Tiendas {
  appStore: string | null;
  googlePlay: string | null;
}

export const tiendas: Tiendas = {
  appStore: 'https://apps.apple.com/ar/app/transportate/id6833240838',
  googlePlay: null,
};
