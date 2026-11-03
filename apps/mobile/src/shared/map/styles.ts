// Estilos base, atribución y extensión por defecto del mapa (ADR-0002, README.md).
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import type { SchemeName } from '../theme';

/**
 * Estilos de OpenFreeMap, verificados el 2026-11-03 (HTTP 200 y misma fuente `openmaptiles`):
 * `positron` (gris claro, de poco contraste, para que resalten las capas propias) y `dark`.
 * Los tiles no se recolorean: el día que se autoalojen (PMTiles en R2, ADR-0002) estas URLs pasan
 * a ser JSON de estilo propios servidos por el proxy.
 */
export const MAP_STYLE_URLS: Record<SchemeName, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

/** Familia de glifos que publican los dos estilos (para `text-font` de las capas propias). */
export const MAP_FONT = ['Noto Sans Regular'];

/** Atribución obligatoria del TileJSON de OpenFreeMap (OSM, OpenMapTiles y OpenFreeMap). */
export const MAP_ATTRIBUTION = '© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap';

/** Ciudad de Buenos Aires con un margen chico: `[oeste, sur, este, norte]`. */
export const CABA_BOUNDS: LngLatBounds = [-58.535, -34.71, -58.33, -34.525];

export function mapStyleFor(scheme: SchemeName): string {
  return MAP_STYLE_URLS[scheme];
}
