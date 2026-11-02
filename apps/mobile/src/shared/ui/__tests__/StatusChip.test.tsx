import type { EstadoServicioV1 } from '@transportate/contracts';
import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { STATUS, StatusChip } from '..';
import { renderThemed } from '../__fixtures__/renderThemed';

describe('StatusChip', () => {
  it.each([
    ['normal', 'Normal', 'success'],
    ['demorada', 'Con demoras', 'warning'],
    ['interrumpida', 'Interrumpida', 'danger'],
    ['sin_datos', 'Sin información', 'default'],
  ] as const)('%s → "%s" (%s)', async (estado: EstadoServicioV1, label, tone) => {
    expect(STATUS[estado]).toMatchObject({ label, tone });
    await renderThemed(<StatusChip estado={estado} />);
    // Texto visible + nombre accesible: nunca solo color.
    expect(screen.getByText(label)).toBeOnTheScreen();
    expect(screen.getByLabelText(`Estado: ${label}`)).toBeOnTheScreen();
    // El glifo es decorativo: está oculto al lector (el nombre accesible ya dice el estado).
    expect(
      screen.getByText(STATUS[estado].glyph, { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('cubre todos los estados del contrato', () => {
    const estados: EstadoServicioV1[] = ['normal', 'demorada', 'interrumpida', 'sin_datos'];
    expect(Object.keys(STATUS).sort()).toEqual([...estados].sort());
  });

  it('acepta un ícono propio en lugar del glifo', async () => {
    await renderThemed(<StatusChip estado="normal" icon={<Text>ícono</Text>} />);
    expect(screen.getByText('ícono', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText('✓', { includeHiddenElements: true })).toBeNull();
  });
});
