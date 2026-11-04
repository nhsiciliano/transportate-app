import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text as RNText,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SIGN_BAND, SignBand, SkeletonGroup, signBandPalette } from '..';
import { createMemoryPreferenceStore, dark, light, ThemeProvider } from '../../theme';
import { renderThemed } from '../__fixtures__/renderThemed';

const base = {
  icon: 'parada' as const,
  message: 'Parada · Cabildo y Juramento',
  onPress: () => undefined,
  testID: 'banda',
};

/** El `rerender` reemplaza todo el árbol: hay que volver a envolver para no remontar la banda. */
function themed(ui: ReactElement) {
  return <ThemeProvider store={createMemoryPreferenceStore('light')}>{ui}</ThemeProvider>;
}

/** Deja que `useReduceMotion` reciba la respuesta (async) de `AccessibilityInfo`. */
async function flushReduceMotion() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('SignBand', () => {
  it('es un solo botón con la etiqueta compuesta y abre al tocar', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <SignBand
        {...base}
        variant="lead"
        label="Próximo"
        value="4 min"
        status={{ text: 'Con demoras', tone: 'warning' }}
        onPress={onPress}
        accessibilityLabel="Parada Cabildo y Juramento, próximo en 4 minutos, con demoras"
      />,
    );
    const band = screen.getByRole('button', {
      name: 'Parada Cabildo y Juramento, próximo en 4 minutos, con demoras',
    });
    await fireEvent.press(band);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sin onPress es una señal fija: no es botón y no lleva la flecha al borde', async () => {
    const fija = { icon: base.icon, testID: base.testID };
    await renderThemed(
      <SignBand {...fija} variant="lead" label="Próximo" value="4 min" message="Hacia Alem" />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('banda-flecha', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByLabelText('Hacia Alem, Próximo 4 min')).toBeTruthy();
  });

  it('el cuadrado del pictograma es decorativo: la banda es el único elemento accesible', async () => {
    await renderThemed(<SignBand {...base} variant="lead" value="4 min" />);
    const cuadrado = screen.getByTestId('signband-pictograma', { includeHiddenElements: true });
    expect(cuadrado.props.accessible).toBe(false);
    expect(cuadrado.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(cuadrado).toHaveStyle({ width: 40, height: 40, backgroundColor: light.text.primary });
    expect(screen.queryByTestId('signband-pictograma')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('sin etiqueta propia compone mensaje, rótulo, valor y estado', async () => {
    await renderThemed(
      <SignBand
        {...base}
        variant="next"
        value="3 min"
        status={{ text: 'Con demoras', tone: 'warning' }}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Parada · Cabildo y Juramento, 3 min, Con demoras' }),
    ).toBeOnTheScreen();
  });

  it.each([
    ['lead', 'claro', light, 'light'],
    ['next', 'claro', light, 'light'],
    ['lead', 'oscuro', dark, 'dark'],
    ['next', 'oscuro', dark, 'dark'],
  ] as const)(
    '%s en %s: fondo del rol, texto `on` y alto mínimo',
    async (variant, _, colors, pref) => {
      await renderThemed(<SignBand {...base} variant={variant} value="4 min" />, pref);
      const role = variant === 'lead' ? colors.role.secondary : colors.role.primary;
      expect(screen.getByTestId('banda')).toHaveStyle({
        backgroundColor: role.base,
        minHeight: SIGN_BAND.minHeight[variant],
        borderRadius: 6,
      });
      expect(screen.getByText('4 min')).toHaveStyle({ color: role.on });
      expect(screen.getByText('Parada · Cabildo y Juramento')).toHaveStyle({ color: role.on });
    },
  );

  it('paleta: secondary/primary de Obelisco; en oscuro los base claros con on oscuro', () => {
    expect(signBandPalette(light, 'light', 'lead').background).toBe('#035c80');
    expect(signBandPalette(light, 'light', 'next').background).toBe('#1d3343');
    expect(signBandPalette(light, 'light', 'lead').pictogram).toBe('#08202f');
    expect(signBandPalette(light, 'light', 'lead').pictogramIcon).toBe('#ffffff');
    expect(signBandPalette(dark, 'dark', 'lead').background).toBe('#67a5cd');
    expect(signBandPalette(dark, 'dark', 'next').background).toBe('#a4d9ff');
    expect(signBandPalette(dark, 'dark', 'next').foreground).toBe(dark.role.primary.on);
    expect(signBandPalette(dark, 'dark', 'lead').pictogram).toBe(dark.bg.base);
  });

  it('valor monumental en lead (56) y 24 en next; `text` baja el valor de lead a 28', async () => {
    const { rerender } = await renderThemed(<SignBand {...base} variant="lead" value="4 min" />);
    expect(screen.getByText('4 min')).toHaveStyle({ fontSize: 56 });
    expect(screen.getByText('4 min').props.maxFontSizeMultiplier).toBe(1.2);
    await rerender(<SignBand {...base} variant="lead" value="2 en servicio" valueStyle="text" />);
    expect(screen.getByText('2 en servicio')).toHaveStyle({ fontSize: 28 });
    await rerender(<SignBand {...base} variant="next" value="4 min" />);
    expect(screen.getByText('4 min')).toHaveStyle({ fontSize: 24 });
  });

  it('el mensaje trunca en una línea; el valor y el estado no', async () => {
    await renderThemed(
      <SignBand
        {...base}
        variant="next"
        value="Sin información"
        valueStyle="text"
        status={{ text: 'hace 6 min', tone: 'muted' }}
      />,
    );
    expect(screen.getByText('Parada · Cabildo y Juramento').props.numberOfLines).toBe(1);
    expect(screen.getByText('Sin información').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('hace 6 min').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Parada · Cabildo y Juramento').props.maxFontSizeMultiplier).toBe(1.3);
  });

  it('flecha clavada al borde: abajo a la derecha en lead, centrada en next', async () => {
    const { rerender } = await renderThemed(<SignBand {...base} variant="lead" value="4 min" />);
    const flecha = () =>
      StyleSheet.flatten(
        screen.getByTestId('banda-flecha', { includeHiddenElements: true }).props
          .style as StyleProp<ViewStyle>,
      );
    expect(flecha()).toMatchObject({ position: 'absolute', right: 12, bottom: 14 });
    await rerender(<SignBand {...base} variant="next" value="4 min" />);
    expect(flecha()).toMatchObject({
      position: 'absolute',
      right: 12,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    });
  });

  it('estado: cuadrado ámbar o rojo con borde del color del texto; muted sin cuadrado', async () => {
    const { rerender } = await renderThemed(
      <SignBand
        {...base}
        variant="next"
        value="3 min"
        status={{ text: 'Con demoras', tone: 'warning' }}
      />,
    );
    expect(
      screen.getByTestId('signband-estado-cuadrado', { includeHiddenElements: true }),
    ).toHaveStyle({
      width: 10,
      height: 10,
      backgroundColor: light.role.warning.base,
      borderColor: light.role.primary.on,
    });
    expect(screen.getByText('Con demoras')).toHaveStyle({ fontSize: 12 });
    await rerender(
      <SignBand
        {...base}
        variant="next"
        value="3 min"
        status={{ text: 'Interrumpida', tone: 'danger' }}
      />,
    );
    expect(
      screen.getByTestId('signband-estado-cuadrado', { includeHiddenElements: true }),
    ).toHaveStyle({ backgroundColor: light.role.danger.base });
    await rerender(
      <SignBand
        {...base}
        variant="next"
        value="3 min"
        status={{ text: 'hace 6 min', tone: 'muted' }}
      />,
    );
    expect(
      screen.queryByTestId('signband-estado-cuadrado', { includeHiddenElements: true }),
    ).toBeNull();
    expect(screen.getByText('hace 6 min')).toBeOnTheScreen();
  });

  it('valor null: skeleton en lugar del valor y "cargando" en la etiqueta', async () => {
    await renderThemed(<SignBand {...base} variant="lead" value={null} />);
    expect(
      screen.getByRole('button', { name: 'Parada · Cabildo y Juramento, cargando' }),
    ).toBeOnTheScreen();
  });

  it('Skeleton: misma silueta (alto y radio) para lead y next', async () => {
    await renderThemed(
      <SkeletonGroup>
        <SignBand.Skeleton variant="lead" testID="sk-lead" />
        <SignBand.Skeleton variant="next" testID="sk-next" />
      </SkeletonGroup>,
    );
    const lead = screen.getByTestId('sk-lead', { includeHiddenElements: true });
    const next = screen.getByTestId('sk-next', { includeHiddenElements: true });
    expect(lead.children[0]).toHaveStyle({ height: 148, borderRadius: 6 });
    expect(next.children[0]).toHaveStyle({ height: 72, borderRadius: 6 });
  });

  describe('slots de edición', () => {
    const manija = (
      <Pressable accessibilityRole="button" accessibilityLabel="Reordenar" testID="manija">
        <RNText>≡</RNText>
      </Pressable>
    );
    const quitar = (onPress: () => void) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quitar"
        onPress={onPress}
        testID="quitar"
      >
        <RNText>x</RNText>
      </Pressable>
    );

    it('con leading/trailing y sin onPress: cada control y el texto son elementos separados', async () => {
      const onQuitar = jest.fn();
      const onAlias = jest.fn();
      await renderThemed(
        <SignBand
          {...base}
          onPress={undefined}
          variant="next"
          value="4 min"
          leading={manija}
          trailing={quitar(onQuitar)}
          onPressContent={onAlias}
          contentAccessibilityHint="Cambiar nombre"
          messageIcon="editar"
          accessibilityLabel="Casa. Parada Cabildo y Juramento, 4 min"
        />,
      );
      expect(screen.getByTestId('banda').props.accessible).toBeFalsy();
      expect(screen.getByRole('button', { name: 'Reordenar' })).toBeOnTheScreen();
      const contenido = screen.getByRole('button', {
        name: 'Casa. Parada Cabildo y Juramento, 4 min',
      });
      expect(contenido.props.accessibilityHint).toBe('Cambiar nombre');
      await fireEvent.press(contenido);
      expect(onAlias).toHaveBeenCalledTimes(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Quitar' }));
      expect(onQuitar).toHaveBeenCalledTimes(1);
      // `trailing` reemplaza a la flecha; el ícono chico va junto al mensaje.
      expect(screen.queryByTestId('banda-flecha', { includeHiddenElements: true })).toBeNull();
      expect(
        screen.getByTestId('signband-icono-mensaje', { includeHiddenElements: true }),
      ).toBeOnTheScreen();
    });

    it('sin onPressContent, el texto es un elemento accesible que no es botón', async () => {
      await renderThemed(
        <SignBand
          {...base}
          onPress={undefined}
          variant="next"
          value="4 min"
          trailing={quitar(jest.fn())}
        />,
      );
      const contenido = screen.getByTestId('banda-contenido');
      expect(contenido.props.accessible).toBe(true);
      expect(contenido.props.accessibilityRole).toBeUndefined();
      expect(contenido.props.accessibilityLabel).toBe('Parada · Cabildo y Juramento, 4 min');
    });

    it('con onPress y trailing: la banda es el botón y el trailing reemplaza a la flecha', async () => {
      await renderThemed(
        <SignBand {...base} variant="next" value="4 min" trailing={<RNText>extra</RNText>} />,
      );
      expect(screen.getByTestId('banda').props.accessibilityRole).toBe('button');
      expect(screen.queryByTestId('banda-flecha', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByText('extra')).toBeOnTheScreen();
    });

    it('sin slots, la banda sigue siendo un solo elemento (fija o botón)', async () => {
      await renderThemed(<SignBand {...base} onPress={undefined} variant="lead" value="4 min" />);
      expect(screen.getByTestId('banda').props.accessible).toBe(true);
      expect(screen.queryByTestId('banda-contenido')).toBeNull();
    });
  });

  describe('movimiento firma', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('si cambia la clave, el contenido anterior se desvanece (200 ms) y después se va', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const { rerender } = await renderThemed(
        <SignBand {...base} variant="lead" value="4 min" transitionKey="a|4 min" />,
      );
      await flushReduceMotion();
      await rerender(
        themed(<SignBand {...base} variant="lead" value="3 min" transitionKey="a|3 min" />),
      );
      expect(
        screen.getByTestId('banda-saliente', { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      expect(screen.getByText('3 min')).toBeOnTheScreen();
      await act(() => {
        jest.advanceTimersByTime(SIGN_BAND.crossfadeMs);
      });
      expect(screen.queryByTestId('banda-saliente', { includeHiddenElements: true })).toBeNull();
    });

    it('misma clave (refresco sin cambio de valor): no anima', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const { rerender } = await renderThemed(
        <SignBand {...base} variant="lead" value="4 min" transitionKey="a|4 min" />,
      );
      await flushReduceMotion();
      await rerender(
        themed(
          <SignBand
            {...base}
            variant="lead"
            value="4 min"
            transitionKey="a|4 min"
            status={{ text: 'hace 6 min', tone: 'muted' }}
          />,
        ),
      );
      expect(screen.queryByTestId('banda-saliente', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByText('hace 6 min')).toBeOnTheScreen();
    });

    it('del skeleton al primer valor: sin fundido', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
      const { rerender } = await renderThemed(
        <SignBand {...base} variant="lead" value={null} transitionKey="a|" />,
      );
      await flushReduceMotion();
      await rerender(
        themed(<SignBand {...base} variant="lead" value="4 min" transitionKey="a|4 min" />),
      );
      expect(screen.queryByTestId('banda-saliente', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByText('4 min')).toBeOnTheScreen();
    });

    it('con Reducir movimiento: corte seco', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const { rerender } = await renderThemed(
        <SignBand {...base} variant="lead" value="4 min" transitionKey="a|4 min" />,
      );
      await flushReduceMotion();
      await rerender(
        themed(<SignBand {...base} variant="lead" value="3 min" transitionKey="a|3 min" />),
      );
      expect(screen.queryByTestId('banda-saliente', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByText('3 min')).toBeOnTheScreen();
    });
  });
});
