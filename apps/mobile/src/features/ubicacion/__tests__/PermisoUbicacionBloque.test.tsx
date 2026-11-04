import { screen, userEvent } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { renderThemed } from '@/shared/ui/__fixtures__/renderThemed';

import { PERMISO_DETAIL, PERMISO_TITLE, PermisoUbicacionBloque } from '../PermisoUbicacionBloque';
import type { PermisoUbicacion } from '../useUbicacion';

function setup(permission: PermisoUbicacion) {
  const handlers = { onRequest: jest.fn(), onOpenSettings: jest.fn(), onManual: jest.fn() };
  return {
    handlers,
    render: () => renderThemed(<PermisoUbicacionBloque permission={permission} {...handlers} />),
  };
}

describe('PermisoUbicacionBloque', () => {
  it.each<PermisoUbicacion>(['undetermined', 'denied'])(
    'con permiso %s ofrece Activar y Buscar a mano',
    async (permission) => {
      const user = userEvent.setup();
      const { handlers, render } = setup(permission);
      await render();

      expect(screen.getByText(PERMISO_TITLE)).toBeOnTheScreen();
      expect(screen.getByText(PERMISO_DETAIL)).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Abrir configuración' })).toBeNull();
      await user.press(screen.getByRole('button', { name: 'Activar' }));
      expect(handlers.onRequest).toHaveBeenCalledTimes(1);
      await user.press(screen.getByRole('button', { name: 'Buscar a mano' }));
      expect(handlers.onManual).toHaveBeenCalledTimes(1);
      expect(handlers.onOpenSettings).not.toHaveBeenCalled();
    },
  );

  it('bloqueado ofrece Abrir configuración en lugar de Activar', async () => {
    const user = userEvent.setup();
    const { handlers, render } = setup('blocked');
    await render();

    expect(screen.getByText(PERMISO_TITLE)).toBeOnTheScreen();
    expect(screen.getByText(PERMISO_DETAIL)).toBeOnTheScreen();
    expect(screen.getByText('La ubicación está desactivada para Transportate.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Activar' })).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Abrir configuración' }));
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(handlers.onRequest).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Buscar a mano' }));
    expect(handlers.onManual).toHaveBeenCalledTimes(1);
  });

  it('el título es un encabezado y el copy es el de S32', async () => {
    await setup('undetermined').render();
    expect(
      screen.getByRole('header', { name: 'Activá la ubicación para ver paradas cerca tuyo' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Solo se usa mientras la app está abierta y no sale de tu teléfono.'),
    ).toBeOnTheScreen();
  });

  const handlers = { onRequest: jest.fn(), onOpenSettings: jest.fn(), onManual: jest.fn() };
  const estiloDe = (testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style as StyleProp<ViewStyle>) ?? {};

  it('suelto va en una tarjeta con fondo propio', async () => {
    await renderThemed(
      <PermisoUbicacionBloque permission="undetermined" {...handlers} testID="suelto" />,
    );
    expect(estiloDe('suelto').backgroundColor).toBeDefined();
  });

  it('con `inset` (dentro de una placa) no tiene fondo ni borde propios', async () => {
    await renderThemed(
      <PermisoUbicacionBloque permission="undetermined" {...handlers} inset testID="inset" />,
    );
    const inset = estiloDe('inset');
    expect(inset.backgroundColor).toBeUndefined();
    expect(inset.borderWidth).toBeUndefined();
    expect(inset.padding).toBe(12);
  });
});
