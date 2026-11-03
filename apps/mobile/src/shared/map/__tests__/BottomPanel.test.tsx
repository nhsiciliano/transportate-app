// BottomPanel: alturas, elección del nivel al soltar y el botón accesible de la manija.
import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text } from 'react-native';

import { renderMap } from '../../../../test/map/harness';
import {
  BottomPanel,
  nearestIndex,
  PANEL_HANDLE_HEIGHT,
  PANEL_LABELS,
  panelHeights,
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
