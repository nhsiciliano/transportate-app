import { screen } from '@testing-library/react-native';

import { OFFLINE_MESSAGE, OfflineBanner } from '..';
import { renderThemed } from '../__fixtures__/renderThemed';

describe('OfflineBanner', () => {
  it('se expone como alerta con el texto fijo', async () => {
    await renderThemed(<OfflineBanner visible />);
    const banner = screen.getByRole('alert');
    expect(banner).toBeOnTheScreen();
    expect(banner).toHaveAccessibleName(OFFLINE_MESSAGE);
    expect(banner.props.accessibilityLiveRegion).toBe('polite');
  });

  it('oculto no renderiza nada', async () => {
    await renderThemed(<OfflineBanner visible={false} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
