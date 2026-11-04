// BottomPanel: alturas, elección del nivel al soltar y el botón accesible de la manija.
import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { renderMap } from '../../../../test/map/harness';
import {
  BottomPanel,
  nearestIndex,
  PANEL_HANDLE_HEIGHT,
  PANEL_LABELS,
  panelHeights,
  usePanelBottomInset,
  type PanelIndex,
} from '..';

describe('panelHeights', () => {
  it('colapsado = manija + encabezado; medio = 50 %; expandido = 90 %', () => {
    expect(panelHeights(800, 100)).toEqual([PANEL_HANDLE_HEIGHT + 100, 400, 720]);
  });

  it('con un encabezado alto, el medio queda por encima del colapsado', () => {
    const [collapsed, medium, expanded] = panelHeights(600, 300);
    expect(medium).toBeGreaterThan(collapsed);
    expect(expanded).toBeGreaterThanOrEqual(medium);
  });
});

describe('panelHeights con lugar para la tab bar', () => {
  it('el colapsado suma el inset de abajo: el encabezado entero queda sobre la tab bar', () => {
    const [collapsed] = panelHeights(800, 100, 83);
    expect(collapsed).toBe(PANEL_HANDLE_HEIGHT + 100 + 83);
    expect(collapsed).toBeGreaterThan(panelHeights(800, 100)[0]);
  });

  it('medio y expandido siguen siendo 50 % y 90 % del alto disponible', () => {
    const [, medium, expanded] = panelHeights(800, 100, 83);
    expect([medium, expanded]).toEqual([400, 720]);
  });

  it('sin inset da lo de siempre', () => {
    expect(panelHeights(800, 100, 0)).toEqual(panelHeights(800, 100));
  });
});

describe('nearestIndex', () => {
  const heights = [128, 400, 720] as const;
  it('elige el nivel más cercano a donde se soltó', () => {
    expect(nearestIndex(heights, 150, 0)).toBe(0);
    expect(nearestIndex(heights, 380, 0)).toBe(1);
    expect(nearestIndex(heights, 700, 0)).toBe(2);
  });

  it('un tirón rápido hacia arriba proyecta al nivel siguiente', () => {
    expect(nearestIndex(heights, 200, -2000)).toBe(1);
  });
});

function Harness() {
  const [index, setIndex] = useState<PanelIndex>(0);
  return (
    <GestureHandlerRootView>
      <BottomPanel
        index={index}
        onIndexChange={setIndex}
        availableHeight={800}
        headerHeight={100}
        header={<Text>Encabezado</Text>}
      >
        <Text>Cuerpo</Text>
      </BottomPanel>
    </GestureHandlerRootView>
  );
}

describe('BottomPanel', () => {
  it('la manija es un botón que recorre los tres niveles', async () => {
    await renderMap(<Harness />);
    expect(screen.getByText('Encabezado')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: PANEL_LABELS[0] }));
    await fireEvent.press(screen.getByRole('button', { name: PANEL_LABELS[1] }));
    expect(screen.getByRole('button', { name: PANEL_LABELS[2], expanded: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: PANEL_LABELS[2] }));
    expect(screen.getByRole('button', { name: PANEL_LABELS[0] })).toBeOnTheScreen();
  });

  it('el cuerpo solo scrollea con el panel arriba', async () => {
    await renderMap(<Harness />);
    expect(screen.getByTestId('bottom-panel-body')).toHaveProp('scrollEnabled', false);
    await fireEvent.press(screen.getByRole('button', { name: PANEL_LABELS[0] }));
    expect(screen.getByTestId('bottom-panel-body')).toHaveProp('scrollEnabled', true);
  });
});

function PanelConInset({ bottomInset }: { bottomInset: number }) {
  return (
    <GestureHandlerRootView>
      <BottomPanel
        index={0}
        onIndexChange={() => undefined}
        availableHeight={800}
        headerHeight={100}
        bottomInset={bottomInset}
        header={<Text>Encabezado</Text>}
      >
        <Text>Cuerpo</Text>
      </BottomPanel>
    </GestureHandlerRootView>
  );
}

describe('BottomPanel con `bottomInset`', () => {
  const style = (testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style as StyleProp<ViewStyle>) ?? {};

  it('colapsado mide manija + encabezado + inset (la fila de acciones no queda bajo la tab bar)', async () => {
    await renderMap(<PanelConInset bottomInset={83} />);
    expect(style('bottom-panel').height).toBe(PANEL_HANDLE_HEIGHT + 100 + 83);
  });

  it('sin inset, la altura es la de siempre', async () => {
    await renderMap(<PanelConInset bottomInset={0} />);
    expect(style('bottom-panel').height).toBe(PANEL_HANDLE_HEIGHT + 100);
  });

  it('el cuerpo scrollea con el inset de abajo para que el último ítem salga de la tab bar', async () => {
    await renderMap(<PanelConInset bottomInset={83} />);
    const contenido =
      StyleSheet.flatten(
        screen.getByTestId('bottom-panel-body').props.contentContainerStyle as StyleProp<ViewStyle>,
      ) ?? {};
    expect(contenido.paddingBottom).toBeGreaterThanOrEqual(83);
  });
});

describe('usePanelBottomInset', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  function Valor() {
    return <Text testID="inset">{String(usePanelBottomInset())}</Text>;
  }

  it('en iOS es el inset de abajo del safe area (incluye la tab bar nativa)', async () => {
    Platform.OS = 'ios';
    await renderMap(<Valor />);
    expect(screen.getByTestId('inset')).toHaveTextContent('34');
  });

  it('en Android es 0: NativeTabs ya deja el contenido sobre la tab bar', async () => {
    Platform.OS = 'android';
    await renderMap(<Valor />);
    expect(screen.getByTestId('inset')).toHaveTextContent('0');
  });
});
