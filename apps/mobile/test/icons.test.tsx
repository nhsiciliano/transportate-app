import { render, screen } from '@testing-library/react-native';

import { Icon, iconMap, type IconName } from '@/shared/icons';
import { light } from '@/shared/theme';

const names = Object.keys(iconMap) as IconName[];

describe('Icon', () => {
  it('el mapa curado tiene los 46 usos de docs/08-design-system.md', () => {
    expect(names).toHaveLength(46);
  });

  it.each(names)('renderiza "%s" sin tirar', async (name) => {
    await render(<Icon name={name} testID="icono" />);
    expect(screen.getByTestId('icono', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('usa el archivo correcto del paquete para cada nombre', async () => {
    await render(<Icon name="subtes" />);
    expect(
      screen.getByTestId('svg:subway-fill', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('la estrella apagada es el glifo de contorno (FILL 0) y la encendida el lleno', async () => {
    await render(
      <>
        <Icon name="favoritoOn" />
        <Icon name="favoritoOff" />
      </>,
    );
    expect(screen.getByTestId('svg:star-fill', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('svg:star', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('tiene 24 px por default y respeta size y color', async () => {
    await render(<Icon name="buscar" />);
    const porDefault = screen.getByTestId('svg:search-fill', { includeHiddenElements: true });
    expect(porDefault).toHaveProp('width', 24);
    expect(porDefault).toHaveProp('height', 24);
    // Sin ThemeProvider, useTheme() devuelve el tema claro: text.primary.
    expect(porDefault).toHaveProp('fill', light.text.primary);
  });

  it.each([16, 20, 24, 32] as const)('respeta size=%s y color', async (size) => {
    await render(<Icon name="refrescar" size={size} color="#035c80" />);
    const svg = screen.getByTestId('svg:refresh-fill', { includeHiddenElements: true });
    expect(svg).toHaveProp('width', size);
    expect(svg).toHaveProp('height', size);
    expect(svg).toHaveProp('fill', '#035c80');
  });

  it('es decorativo por default: queda oculto a la accesibilidad', async () => {
    await render(<Icon name="alerta" testID="icono" />);
    expect(screen.queryByTestId('icono')).not.toBeOnTheScreen();
    const oculto = screen.getByTestId('icono', { includeHiddenElements: true });
    expect(oculto).toHaveProp('accessibilityElementsHidden', true);
    expect(oculto).toHaveProp('importantForAccessibility', 'no-hide-descendants');
    expect(oculto).not.toBeVisible();
  });

  it('con accessibilityLabel se expone como imagen con esa etiqueta', async () => {
    await render(<Icon name="alerta" accessibilityLabel="Hay demoras" testID="icono" />);
    const icono = screen.getByLabelText('Hay demoras');
    expect(icono).toBeVisible();
    expect(icono).toHaveProp('accessibilityRole', 'image');
    expect(icono).toHaveAccessibleName('Hay demoras');
  });
});
