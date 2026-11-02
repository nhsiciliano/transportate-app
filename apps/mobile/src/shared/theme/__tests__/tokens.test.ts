import { contrastRatio } from '../contrast';
import { dark, light, maxFontSizeMultiplier, type ColorScheme, type RoleName } from '../tokens';

const ROLES: RoleName[] = [
  'primary',
  'secondary',
  'tertiary',
  'danger',
  'success',
  'warning',
  'info',
];
const STATUS: RoleName[] = ['danger', 'success', 'warning', 'info'];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('contraste %s (WCAG AA, docs/02-obelisco-tokens.md §7)', (_name, c: ColorScheme) => {
  it('texto de cuerpo, secundario y terciario ≥ 4.5:1 sobre bg.base y bg.card', () => {
    for (const bg of [c.bg.base, c.bg.card]) {
      for (const fg of [
        c.text.primary,
        c.text.secondary,
        c.text.tertiary,
        c.text.placeholder,
        c.text.link,
      ]) {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(ROLES)('%s: on/base ≥ 4.5:1 y role.text ≥ 4.5:1 sobre bg.base', (role) => {
    const r = c.role[role];
    expect(contrastRatio(r.on, r.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(r.text, c.bg.base)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(STATUS)('%s: texto del contenedor ≥ 4.5:1 y borde (role.text) ≥ 3:1', (role) => {
    const r = c.role[role];
    expect(contrastRatio(r.onContainer, r.container)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.text.primary, r.container)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(r.text, r.container)).toBeGreaterThanOrEqual(3);
  });

  it('bordes de control y foco ≥ 3:1 (WCAG 1.4.11); border.subtle es solo decorativo', () => {
    expect(contrastRatio(c.border.strong, c.bg.base)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c.focusRing.color, c.bg.base)).toBeGreaterThanOrEqual(3);
  });
});

describe('valores fijados por DESIGN.md', () => {
  it('§2.1 superficies y texto', () => {
    expect(light.text.primary).toBe('#08202f');
    expect(light.border.strong).toBe('#08202f');
    expect(light.focusRing.color).toBe('#003832');
    expect(dark.bg.base).toBe('#000b18');
    expect(dark.text.inverse).toBe('#08202f');
    expect(dark.border.strong).toBe('#7a8697');
  });

  it('§2.2 warning y tertiary', () => {
    expect(light.role.warning.text).toBe('#a25c00');
    expect(light.role.warning.on).toBe('#1d3343');
    expect(light.role.tertiary.on).toBe('#08202f');
    expect(light.role.primary.base).toBe('#1d3343');
    expect(light.role.secondary.base).toBe('#035c80');
    expect(light.role.tertiary.base).toBe('#009688');
  });

  it('§3.2 topes de escala de fuente', () => {
    expect(maxFontSizeMultiplier).toEqual({ heading: 1.2, text: 1.3 });
  });
});
