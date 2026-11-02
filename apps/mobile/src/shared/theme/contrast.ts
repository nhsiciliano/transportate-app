// Contraste WCAG 2.x (misma fórmula que tools/contraste/contraste.py, docs/02-obelisco-tokens.md §7).
// Se usa en tiempo de ejecución para colores que vienen de datos (route_color del GTFS de subte):
// si una insignia tiene menos de 3:1 contra la superficie, lleva borde (docs/02b-colores-subte.md §3).

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa de `#rrggbb` (o `#rgb`); `null` si el formato no es válido. */
export function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  const raw = m?.[1];
  if (!raw) return null;
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** Ratio de contraste entre dos colores (1–21); 1 si alguno no se puede leer. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 1;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
