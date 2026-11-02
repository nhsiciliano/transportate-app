import { act, screen } from '@testing-library/react-native';
import { FreshnessLabel, formatAge, freshnessLevel } from '..';
import { renderThemed } from '../__fixtures__/renderThemed';

const T0 = Date.parse('2026-11-02T12:00:00Z');

describe('freshnessLevel (S6, R = 20 s)', () => {
  it.each([
    [0, 'fresh'],
    [60, 'fresh'], // 3·R
    [61, 'stale'],
    [600, 'stale'], // 10 min
    [601, 'veryStale'],
  ] as const)('%i s → %s', (age, level) => {
    expect(freshnessLevel(age, 20)).toBe(level);
  });

  it('respeta el intervalo configurado (R = 60 → fresco hasta 3 min)', () => {
    expect(freshnessLevel(180, 60)).toBe('fresh');
    expect(freshnessLevel(181, 60)).toBe('stale');
  });

  it('sin timestamp → unknown', () => {
    expect(freshnessLevel(null, 20)).toBe('unknown');
  });
});

describe('formatAge', () => {
  it.each([
    [12, '12 s', '12 segundos'],
    [1, '1 s', '1 segundo'],
    [240, '4 min', '4 minutos'],
    [7200, '2 h', '2 horas'],
    [3 * 86400, '3 días', '3 días'],
  ] as const)('%i s', (age, short, spoken) => {
    expect(formatAge(age)).toEqual({ short, spoken });
  });
});

describe('FreshnessLabel', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: T0 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('pasa de fresco a viejo y a muy viejo con el reloj, re-renderizando cada segundo', async () => {
    const ts = new Date(T0 - 12_000).toISOString();
    await renderThemed(<FreshnessLabel sourceTimestamp={ts} />);
    expect(screen.getByText('Actualizado hace 12 s')).toBeOnTheScreen();
    expect(screen.getByLabelText('Actualizado hace 12 segundos')).toBeOnTheScreen();

    await act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Actualizado hace 13 s')).toBeOnTheScreen();

    // 12 s + 49 s = 61 s > 3·R
    await act(() => {
      jest.advanceTimersByTime(48_000);
    });
    expect(screen.getByText('⚠ Dato de hace 1 min')).toBeOnTheScreen();
    expect(screen.queryByText(/puede no reflejar/)).toBeNull();

    // > 10 min
    await act(() => {
      jest.advanceTimersByTime(10 * 60_000);
    });
    expect(screen.getByText(/Dato de hace 11 min/)).toBeOnTheScreen();
    expect(screen.getByText('Este dato puede no reflejar la situación actual.')).toBeOnTheScreen();
  });

  it('no se re-anuncia: la etiqueta no es una live region', async () => {
    await renderThemed(<FreshnessLabel sourceTimestamp={new Date(T0 - 5_000).toISOString()} />);
    expect(screen.getByText('Actualizado hace 5 s').props.accessibilityLiveRegion).toBe('none');
  });

  it('deja de tiquear al desmontarse', async () => {
    const spy = jest.spyOn(globalThis, 'clearInterval');
    const { unmount } = await renderThemed(
      <FreshnessLabel sourceTimestamp={new Date(T0).toISOString()} />,
    );
    await unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sin sourceTimestamp muestra "Sin dato de actualización"', async () => {
    await renderThemed(<FreshnessLabel sourceTimestamp={null} />);
    expect(screen.getByText('Sin dato de actualización')).toBeOnTheScreen();
  });
});
