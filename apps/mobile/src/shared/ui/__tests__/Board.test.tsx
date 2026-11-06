import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Board, boardStatusPalette } from '..';
import { contrastRatio } from '../../theme/contrast';
import { dark, light } from '../../theme';
import { renderThemed } from '../__fixtures__/renderThemed';

describe('Board', () => {
  it('placa bg.card con outline 1 px border.subtle y radio 6; etiqueta como encabezado', async () => {
    await renderThemed(
      <Board label="Líneas" testID="placa">
        <Board.Row title="Línea A" />
      </Board>,
    );
    expect(screen.getByTestId('placa')).toHaveStyle({
      backgroundColor: light.bg.card,
      borderColor: light.border.subtle,
      borderWidth: 1,
      borderRadius: 6,
    });
    expect(screen.getByRole('header', { name: 'Líneas' })).toBeOnTheScreen();
  });

  it('separadores solo entre filas (nunca después de la última) y con sangría opcional', async () => {
    await renderThemed(
      <Board separatorInset={56}>
        <Board.Row title="Uno" />
        <Board.Row title="Dos" />
        <Board.Row title="Tres" />
        {null}
      </Board>,
    );
    const separadores = screen.getAllByTestId('board-separador');
    expect(separadores).toHaveLength(2);
    expect(separadores[0]).toHaveStyle({ marginLeft: 56, backgroundColor: light.border.subtle });
  });

  it('fila con onPress: botón con etiqueta compuesta, flecha y presión', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <Board>
        <Board.Row
          testID="fila"
          title="Línea B"
          subtitle="Leandro N. Alem – Juan Manuel de Rosas"
          note={{ text: 'Obras entre Medrano y Alem', tone: 'warning' }}
          onPress={onPress}
        />
      </Board>,
    );
    const fila = screen.getByRole('button', {
      name: 'Línea B, Leandro N. Alem – Juan Manuel de Rosas, Obras entre Medrano y Alem',
    });
    expect(fila).toHaveStyle({ minHeight: 56, paddingHorizontal: 12 });
    expect(screen.getByTestId('fila-flecha', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Obras entre Medrano y Alem')).toHaveStyle({
      color: light.role.warning.text,
      fontSize: 13,
    });
    expect(screen.getByText('Línea B')).toHaveStyle({
      fontSize: 17,
      fontFamily: 'FiraSans_600SemiBold',
    });
    expect(screen.getByText('Línea B').props.numberOfLines).toBe(2);
    await fireEvent.press(fila);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('arrow={false}: sigue siendo botón pero sin flecha ni reserva a la derecha', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <Board>
        <Board.Row testID="fila" title="Interno 1404" arrow={false} onPress={onPress} />
      </Board>,
    );
    const fila = screen.getByRole('button', { name: 'Interno 1404' });
    expect(screen.queryByTestId('fila-flecha', { includeHiddenElements: true })).toBeNull();
    expect(fila).toHaveStyle({ paddingHorizontal: 12 });
    await fireEvent.press(fila);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('trailing de dos líneas grandes: la flecha sigue en la fila y el trailing no la pisa', async () => {
    await renderThemed(
      <Board>
        <Board.Row
          testID="fila"
          title="Línea 15A"
          subtitle="Ramal A"
          onPress={jest.fn()}
          trailing={
            <View testID="tiempos">
              <Text style={{ fontSize: 24, lineHeight: 28 }}>3 min</Text>
              <Text style={{ fontSize: 13, lineHeight: 16 }}>21 min · 34 min</Text>
            </View>
          }
        />
      </Board>,
    );
    const flecha = screen.getByTestId('fila-flecha', { includeHiddenElements: true });
    // La flecha es un elemento de la fila (no `absolute`) que no se encoge: nada la tapa.
    expect(flecha).toHaveStyle({ width: 20, flexShrink: 0 });
    expect(flecha).not.toHaveStyle({ position: 'absolute' });
    // El trailing está antes que la flecha y tiene tope de ancho y puede encogerse.
    const trailing = screen.getByTestId('tiempos').parent;
    expect(trailing).toHaveStyle({ maxWidth: '50%', flexShrink: 1, minWidth: 0 });
    const hijos = screen.getByTestId('fila').children as unknown[];
    expect(hijos.indexOf(flecha)).toBeGreaterThan(hijos.indexOf(trailing));
  });

  it('fila sin onPress: un solo elemento accesible, sin botón ni flecha', async () => {
    await renderThemed(
      <Board>
        <Board.Row
          testID="fila"
          title="Plaza de Mayo"
          accessibilityLabel="Estación Plaza de Mayo"
        />
      </Board>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Estación Plaza de Mayo').props.accessible).toBe(true);
    expect(screen.queryByTestId('fila-flecha', { includeHiddenElements: true })).toBeNull();
  });

  it('leading y trailing se dibujan a los costados', async () => {
    await renderThemed(
      <Board>
        <Board.Row
          title="Línea C"
          leading={<Text>disco</Text>}
          trailing={<Board.Status text="Normal" tone="ok" />}
        />
      </Board>,
    );
    expect(screen.getByText('disco')).toBeOnTheScreen();
    expect(screen.getByText('Normal')).toBeOnTheScreen();
  });

  describe('Board.Status', () => {
    it.each([
      ['warning', 'Con demoras'],
      ['danger', 'Interrumpida'],
    ] as const)(
      '%s: cuadrado del rol con borde text.primary y texto del rol',
      async (tone, text) => {
        await renderThemed(<Board.Status text={text} tone={tone} />);
        expect(screen.getByTestId('board-estado-cuadrado')).toHaveStyle({
          width: 10,
          height: 10,
          backgroundColor: light.role[tone].base,
          borderColor: light.text.primary,
          borderWidth: 1,
        });
        expect(screen.getByText(text)).toHaveStyle({
          color: light.role[tone].text,
          fontSize: 15,
          fontFamily: 'FiraSans_600SemiBold',
        });
        expect(screen.getByLabelText(`Estado: ${text}`)).toBeOnTheScreen();
      },
    );

    it.each(['ok', 'muted'] as const)('%s: sin cuadrado, texto secundario', async (tone) => {
      await renderThemed(<Board.Status text="Normal" tone={tone} />);
      expect(screen.queryByTestId('board-estado-cuadrado')).toBeNull();
      expect(screen.getByText('Normal')).toHaveStyle({ color: light.text.secondary });
    });

    it.each([
      ['claro', light],
      ['oscuro', dark],
    ] as const)(
      'contraste en %s: texto ≥ 4,5:1 y borde del cuadrado ≥ 3:1 contra la placa',
      (_, c) => {
        for (const tone of ['ok', 'warning', 'danger', 'muted'] as const) {
          const p = boardStatusPalette(c, tone);
          expect(contrastRatio(p.text, c.bg.card)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(p.squareBorder, c.bg.card)).toBeGreaterThanOrEqual(3);
        }
      },
    );
  });

  it('Board.Skeleton: la silueta con N filas, anunciada como carga', async () => {
    await renderThemed(
      <Board.Skeleton rows={3} testID="sk" accessibilityLabel="Cargando líneas…" />,
    );
    expect(screen.getByRole('progressbar', { name: 'Cargando líneas…' })).toBeOnTheScreen();
    expect(screen.getByTestId('sk')).toHaveStyle({
      backgroundColor: light.bg.card,
      borderRadius: 6,
    });
  });

  describe('layout="cards"', () => {
    it('una placa del mismo material por fila, a 8 pt, sin separadores; la etiqueta sigue afuera', async () => {
      await renderThemed(
        <Board label="Líneas" layout="cards" testID="tablero">
          <Board.Row title="Uno" onPress={() => undefined} />
          <Board.Row title="Dos" />
          <Board.Row title="Tres" />
          {null}
        </Board>,
      );
      expect(screen.queryByTestId('board-separador')).toBeNull();
      expect(screen.getAllByTestId(/^tablero-placa-\d+$/)).toHaveLength(3);
      expect(screen.getByTestId('tablero')).toHaveStyle({ gap: 8 });
      for (const i of [0, 1, 2]) {
        expect(screen.getByTestId(`tablero-placa-${i}`)).toHaveStyle({
          backgroundColor: light.bg.card,
          borderColor: light.border.subtle,
          borderWidth: 1,
          borderRadius: 6,
        });
        // Sin sombra: el mismo material que la placa única.
        const estilo = StyleSheet.flatten(
          screen.getByTestId(`tablero-placa-${i}`).props.style as StyleProp<ViewStyle>,
        );
        expect(estilo?.shadowOpacity).toBeUndefined();
        expect(estilo?.elevation).toBeUndefined();
      }
      expect(screen.getByRole('header', { name: 'Líneas' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Uno' })).toBeOnTheScreen();
    });

    it('Board.Skeleton con cards: una placa por fila', async () => {
      await renderThemed(
        <Board.Skeleton rows={4} layout="cards" testID="sk" accessibilityLabel="Cargando…" />,
      );
      expect(screen.getByRole('progressbar', { name: 'Cargando…' })).toBeOnTheScreen();
      expect(screen.getAllByTestId(/^sk-placa-\d+$/)).toHaveLength(4);
      expect(screen.getByTestId('sk-placa-0')).toHaveStyle({
        backgroundColor: light.bg.card,
        borderRadius: 6,
      });
      expect(screen.getByTestId('sk')).not.toHaveStyle({ backgroundColor: light.bg.card });
    });
  });
});
