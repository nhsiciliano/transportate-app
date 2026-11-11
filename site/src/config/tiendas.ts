// Enlaces a las tiendas. Con `null`, el botón dice «Próximamente en …» y abre un aviso; con una
// URL, el mismo componente (`BotonTienda.astro`) se vuelve un enlace a la ficha. Ver
// site/README.md, «Activar los enlaces de las tiendas».
export interface Tiendas {
  appStore: string | null;
  googlePlay: string | null;
}

export const tiendas: Tiendas = {
  appStore: null,
  googlePlay: null,
};
