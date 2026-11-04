import { screen } from '@testing-library/react-native';

import { Pictogram, pictogramPalette } from '..';
import { contrastRatio } from '../../theme/contrast';
import { dark, light } from '../../theme';
import { renderThemed } from '../__fixtures__/renderThemed';

describe('Pictogram', () => {
  it('banda: el cuadrado del piloto (text.primary en claro, bg.base en oscuro) y el ícono contrario', () => {
    expect(pictogramPalette(light, 'light', 'band')).toEqual({
      square: light.text.primary,
      icon: light.bg.base,
    });
    expect(pictogramPalette(dark, 'dark', 'band')).toEqual({
      square: dark.bg.base,
      icon: dark.text.primary,
    });
  });

  it.each([
    ['claro', light, 'light'],
    ['oscuro', dark, 'dark'],
  ] as const)(
    'placa en %s: primary.base con ícono on; ≥ 3:1 contra bg.card y el ícono ≥ 3:1',
    (_, c, s) => {
      const p = pictogramPalette(c, s, 'board');
      expect(p).toEqual({ square: c.role.primary.base, icon: c.role.primary.on });
      expect(contrastRatio(p.square, c.bg.card)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.icon, p.square)).toBeGreaterThanOrEqual(3);
    },
  );

  it('decorativo, tamaños 40 y 32, radio 4', async () => {
    const { rerender } = await renderThemed(<Pictogram icon="mapa" tone="board" testID="p" />);
    const p = screen.getByTestId('p', { includeHiddenElements: true });
    expect(p.props.accessible).toBe(false);
    expect(p).toHaveStyle({
      width: 40,
      height: 40,
      borderRadius: 4,
      backgroundColor: light.role.primary.base,
    });
    expect(screen.queryByTestId('p')).toBeNull();
    await rerender(<Pictogram icon="mapa" tone="board" size={32} testID="p" />);
    expect(screen.getByTestId('p', { includeHiddenElements: true })).toHaveStyle({
      width: 32,
      height: 32,
    });
  });
});
