// Tests de los componentes de `shared/ui` que no tenían uno propio (tarea 3.11): Chip,
// SegmentedControl, ErrorState, EmptyState, LineBadge, OfflineBanner y Skeleton.
import { screen, userEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import {
  Chip,
  Skeleton,
  EmptyState,
  ErrorState,
  LineBadge,
  OFFLINE_MESSAGE,
  OfflineBanner,
  SegmentedControl,
  SkeletonGroup,
} from '..';
import { renderThemed } from '../__fixtures__/renderThemed';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

describe('Chip', () => {
  it('expone selected y dispara el háptico de selección al tocarlo', async () => {
    const onPress = jest.fn();
    await renderThemed(<Chip label="Con demoras" selected={false} onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'Con demoras' });
    expect(chip).not.toBeSelected();
    await userEvent.setup().press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('deshabilitado no responde', async () => {
    const onPress = jest.fn();
    await renderThemed(<Chip label="Todas" selected onPress={onPress} disabled />);
    const chip = screen.getByRole('button', { name: 'Todas' });
    expect(chip).toBeSelected();
    expect(chip).toBeDisabled();
    await userEvent.setup().press(chip);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('SegmentedControl', () => {
  it('marca el tab activo y avisa el cambio', async () => {
    const onChange = jest.fn();
    await renderThemed(
      <SegmentedControl
        accessibilityLabel="Tema"
        value="system"
        onChange={onChange}
        options={[
          { value: 'system', label: 'Sistema' },
          { value: 'light', label: 'Claro' },
          { value: 'dark', label: 'Oscuro' },
        ]}
      />,
      'dark',
    );
    expect(screen.getByRole('tab', { name: 'Sistema' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Oscuro' })).not.toBeSelected();
    await userEvent.setup().press(screen.getByRole('tab', { name: 'Oscuro' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});

describe('ErrorState y EmptyState', () => {
  it('ErrorState muestra causa y reintenta con "Volver a intentar"', async () => {
    const onRetry = jest.fn();
    await renderThemed(
      <ErrorState
        title="No pudimos cargar el subte"
        cause="El servicio no responde."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('El servicio no responde.')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ErrorState no reintentable es solo informativo', async () => {
    await renderThemed(
      <ErrorState
        title="Sin datos"
        cause="El GCBA no publica este dato."
        retryable={false}
        onRetry={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('EmptyState con acción', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <EmptyState
        title="Todavía no tenés favoritos"
        message="Tocá la estrella en una línea o parada para guardarla acá."
        action={{ label: 'Buscar una línea', onPress }}
      />,
    );
    expect(screen.getByText('Todavía no tenés favoritos')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Buscar una línea' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('LineBadge, OfflineBanner y Skeleton', () => {
  it('LineBadge se anuncia como "Línea X" (subte y colectivo)', async () => {
    await renderThemed(
      <>
        <LineBadge kind="subte" label="A" color="#18cccc" textColor="#000000" />
        <LineBadge kind="colectivo" label="60" />
      </>,
    );
    expect(screen.getByLabelText('Línea A')).toBeOnTheScreen();
    expect(screen.getByLabelText('Línea 60')).toBeOnTheScreen();
  });

  it('LineBadge de tren: siglas en un rectángulo con borde solo si el color no llega a 3:1', async () => {
    await renderThemed(
      <>
        {/* Roca (#FAB700) sobre el fondo claro: 1,60:1 → borde. */}
        <LineBadge
          kind="tren"
          label="R"
          color="#FAB700"
          textColor="#000000"
          surface="#edf4ff"
          accessibilityLabel="Línea Roca"
          testID="badge-roca"
        />
        {/* Tren de la Costa (#002D9A) sobre el fondo claro: 10,31:1 → sin borde. */}
        <LineBadge
          kind="tren"
          label="TC"
          color="#002D9A"
          textColor="#FFFFFF"
          surface="#edf4ff"
          accessibilityLabel="Tren de la Costa"
          testID="badge-costa"
        />
      </>,
    );
    const roca = screen.getByTestId('badge-roca');
    const costa = screen.getByLabelText('Tren de la Costa');
    expect(screen.getByText('TC')).toBeOnTheScreen();
    const estilo = (el: typeof roca) =>
      Object.assign({}, ...[el.props.style as object].flat(Infinity)) as Record<string, unknown>;
    expect(estilo(roca).borderWidth).toBeGreaterThan(0);
    expect(estilo(roca).backgroundColor).toBe('#FAB700');
    expect(estilo(costa).borderWidth).toBe(0);
    // Rectángulo redondeado (no círculo como el subte).
    expect(estilo(costa).borderRadius).not.toBe((estilo(costa).height as number) / 2);
  });

  it('OfflineBanner solo aparece con visible', async () => {
    const view = await renderThemed(<OfflineBanner visible={false} />);
    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
    await view.rerender(<OfflineBanner visible />);
    expect(screen.getByText(OFFLINE_MESSAGE)).toBeOnTheScreen();
  });

  it('SkeletonGroup es un progressbar ocupado con etiqueta "Cargando…"', async () => {
    await renderThemed(
      <SkeletonGroup>
        <Skeleton width={120} height={16} />
      </SkeletonGroup>,
    );
    expect(screen.getByLabelText('Cargando…')).toBeBusy();
  });
});
