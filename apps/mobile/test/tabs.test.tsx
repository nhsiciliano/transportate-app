// Tabs nativas: 5 visibles en orden (Inicio, Colectivos, Subtes, Trenes, Favoritos) y Tránsito
// oculto. `NativeTabs` es nativo (UITabBarController): se reemplaza por componentes de prueba que
// dibujan lo que reciben, para verificar la configuración sin el módulo nativo.
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

jest.mock('expo-router/native-tabs', () => {
  const { Text: T, View: V } = jest.requireActual<typeof import('react-native')>('react-native');
  function NativeTabs({ children }: { children: ReactNode }) {
    return <V testID="tabs">{children}</V>;
  }
  function Trigger({
    name,
    hidden,
    children,
  }: {
    name: string;
    hidden?: boolean;
    children?: ReactNode;
  }) {
    return (
      <V testID={`tab-${name}`} accessibilityHint={hidden === true ? 'oculta' : 'visible'}>
        {children}
      </V>
    );
  }
  function Label({ children }: { children: ReactNode }) {
    return <T>{children}</T>;
  }
  function Icon({ sf, md }: { sf: { default: string; selected: string }; md: string }) {
    return <T testID="icono-de-tab">{`${sf.default}|${sf.selected}|${md}`}</T>;
  }
  Trigger.Label = Label;
  Trigger.Icon = Icon;
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

import TabsLayout from '@/app/(tabs)/_layout';

describe('Tabs', () => {
  it('cinco tabs visibles en orden, con Trenes entre Subtes y Favoritos; Tránsito oculta', async () => {
    await render(<TabsLayout />);
    const tabs = screen.getAllByTestId(/^tab-[a-z]+$/);
    expect(tabs.map((t) => t.props.testID as string)).toEqual([
      'tab-inicio',
      'tab-colectivos',
      'tab-subtes',
      'tab-trenes',
      'tab-favoritos',
      'tab-transito',
    ]);
    expect(tabs.filter((t) => t.props.accessibilityHint === 'visible')).toHaveLength(5);
    expect(screen.getByTestId('tab-transito').props.accessibilityHint).toBe('oculta');
    expect(screen.getByText('Trenes')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-trenes')).toHaveTextContent(
      'Trenestrain.side.front.car|train.side.front.car|train',
    );
  });
});
