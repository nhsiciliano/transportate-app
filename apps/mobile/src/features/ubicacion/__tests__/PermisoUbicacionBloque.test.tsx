import { screen, userEvent } from '@testing-library/react-native';

import { renderThemed } from '@/shared/ui/__fixtures__/renderThemed';

import { PERMISO_MESSAGE, PermisoUbicacionBloque } from '../PermisoUbicacionBloque';
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

      expect(screen.getByText(PERMISO_MESSAGE)).toBeOnTheScreen();
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

    expect(screen.getByText(PERMISO_MESSAGE)).toBeOnTheScreen();
    expect(screen.getByText('La ubicación está desactivada para Transportate.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Activar' })).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Abrir configuración' }));
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(handlers.onRequest).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Buscar a mano' }));
    expect(handlers.onManual).toHaveBeenCalledTimes(1);
  });

  it('el título es un encabezado', async () => {
    await setup('undetermined').render();
    expect(screen.getByRole('header', { name: 'Ubicación' })).toBeOnTheScreen();
  });
});
