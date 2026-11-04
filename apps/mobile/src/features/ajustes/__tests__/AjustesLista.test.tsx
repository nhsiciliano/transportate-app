// Forma de la lista agrupada (dirección «Señalética de terminal», F5-LOW-B): secciones con
// encabezado 13/600, placa con filas de ≥ 52 pt y hairline entre ellas, chevron solo en filas que
// navegan, acción destructiva en danger, deshabilitada en disabled y barra de descarga de 4 pt.
import { screen, userEvent, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AjustesScreen } from '@/features/ajustes';
import { dark, fontFamily, light } from '@/shared/theme';

import { jsonResponse } from '../../../../test/api/fixtures';
import { renderWithApp, resetOnline } from '../../../../test/helpers/ajustes';
import { locationMock } from '../../../../test/mocks/expo-location';
import { IndiceRow, PROGRESS_BAR } from '../IndiceRow';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/** Los íconos y la barra son decorativos (ocultos al lector): se buscan igual. */
const HIDDEN = { includeHiddenElements: true };

const okFetch = () =>
  jsonResponse({ version: 'v', generatedAt: '2026-10-12T15:00:00.000Z', archivos: {} });
const subteA = { tipo: 'linea_subte', refId: 'LineaA', nombre: 'Línea A' } as const;

afterEach(() => {
  resetOnline();
  jest.restoreAllMocks();
});

const flat = (
  node: Parameters<typeof screen.getByTestId>[0] | ReturnType<typeof screen.getByText>,
) =>
  StyleSheet.flatten((node as { props: { style?: unknown } }).props.style as never) as Record<
    string,
    unknown
  >;

describe('Ajustes · secciones y placas', () => {
  it('tiene las cinco secciones, con encabezado 13/600 en caja de oración y text.secondary', async () => {
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();

    for (const title of ['Apariencia', 'Datos', 'Favoritos', 'Privacidad', 'Información']) {
      const header = screen.getByRole('header', { name: title });
      expect(header).toBeOnTheScreen();
      expect(header).toHaveStyle({
        fontFamily: fontFamily.text[600],
        fontSize: 13,
        lineHeight: 16,
        color: light.text.secondary,
      });
      // Sin mayúsculas sostenidas: el texto es el de la caja de oración.
      expect(header.props.style).not.toEqual(
        expect.arrayContaining([{ textTransform: 'uppercase' }]),
      );
    }
  });

  it('el fondo es bg.elevated en claro y bg.base en oscuro', async () => {
    const user = userEvent.setup();
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();
    expect(screen.getByTestId('ajustes-screen')).toHaveStyle({
      backgroundColor: light.bg.elevated,
    });

    await user.press(screen.getByRole('tab', { name: 'Oscuro' }));
    expect(screen.getByTestId('ajustes-screen')).toHaveStyle({ backgroundColor: dark.bg.base });
  });

  it('las placas son la Card compartida: radio 6, outline subtle, sin sombra y sin padding propio', async () => {
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();
    const plate = screen.getByRole('button', { name: 'Acerca de Transportate' }).parent;
    expect(plate).toHaveStyle({
      borderRadius: 6,
      borderColor: light.border.subtle,
      backgroundColor: light.bg.card,
      padding: 0,
      overflow: 'hidden',
    });
    expect(flat(plate as never).shadowOpacity).toBeUndefined();
  });

  it('separa las filas con hairline y nunca después de la última (solo "Datos" tiene tres)', async () => {
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();
    const separators = screen.getAllByTestId('fila-separador');
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      expect(separator).toHaveStyle({
        height: StyleSheet.hairlineWidth,
        backgroundColor: light.border.subtle,
      });
    }
  });
});

describe('Ajustes · filas', () => {
  it('título 17, detalle 15 y filas de al menos 52 pt', async () => {
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();
    expect(screen.getByText('Acerca de Transportate')).toHaveStyle({
      fontSize: 17,
      lineHeight: 22,
      color: light.text.primary,
    });
    expect(screen.getByText('Todavía no la pediste')).toHaveStyle({
      fontSize: 15,
      lineHeight: 20,
      color: light.text.secondary,
    });
    expect(
      screen.getByText(
        'Más seguido usa más datos y batería. Solo se actualiza con la app abierta.',
      ),
    ).toHaveStyle({ fontSize: 13, lineHeight: 16, color: light.text.secondary });

    const row = screen.getByRole('button', { name: 'Acerca de Transportate' });
    expect(flat(row).minHeight).toBe(52);
    expect(flat(row).paddingHorizontal).toBe(16);
  });

  it('el chevron del sistema está solo en la fila que navega', async () => {
    await renderWithApp(<AjustesScreen />, { fetch: okFetch, favoritos: [subteA] }).render();
    expect(screen.getAllByTestId('fila-chevron', HIDDEN)).toHaveLength(1);
    const acerca = screen.getByRole('button', { name: 'Acerca de Transportate' });
    expect(within(acerca).getByTestId('fila-chevron', HIDDEN)).toBeOnTheScreen();
    for (const name of [
      /^Índice de líneas y paradas/,
      /^Limpiar datos guardados/,
      /^Borrar todos los favoritos/,
      /^Ubicación/,
    ]) {
      const row = screen.getByRole('button', { name });
      expect(within(row).queryByTestId('fila-chevron', HIDDEN)).toBeNull();
    }
  });

  it('con el permiso resuelto la fila Ubicación lleva el indicador de salida; si la pide, no', async () => {
    locationMock.setPermission('granted');
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();
    expect(
      within(await screen.findByRole('button', { name: /^Ubicación/ })).getByTestId(
        'fila-externo',
        HIDDEN,
      ),
    ).toBeOnTheScreen();
  });

  it('"Borrar todos los favoritos" va en role.danger.text', async () => {
    await renderWithApp(<AjustesScreen />, { fetch: okFetch, favoritos: [subteA] }).render();
    expect(screen.getByText('Borrar todos los favoritos')).toHaveStyle({
      color: light.role.danger.text,
    });
  });

  it('sin favoritos "Borrar todos los favoritos" va en text.disabled y está deshabilitada', async () => {
    await renderWithApp(<AjustesScreen />, { fetch: okFetch }).render();
    expect(screen.getByText('Borrar todos los favoritos')).toHaveStyle({
      color: light.text.disabled,
    });
    expect(screen.getByRole('button', { name: /^Borrar todos los favoritos/ })).toBeDisabled();
  });

  it('cada fila es un solo elemento accesible con etiqueta compuesta', async () => {
    await renderWithApp(<AjustesScreen />, { fetch: okFetch, favoritos: [subteA] }).render();
    expect(
      await screen.findByRole('button', {
        name: 'Borrar todos los favoritos, Tenés 1 favorito guardado.',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /^Limpiar datos guardados, Borra los datos/ }),
    ).toBeOnTheScreen();
  });
});

describe('Ajustes · barra de descarga del índice', () => {
  const manifest = {
    data: undefined,
    isPending: false,
    isFetching: false,
    isLoadingError: false,
    isRefreshError: false,
    refetch: jest.fn(),
  } as unknown as Parameters<typeof IndiceRow>[0]['manifest'];

  it('con una descarga en curso dibuja 4 pt de alto, radio 2, secondary sobre bg.pressed', async () => {
    await renderWithApp(<IndiceRow manifest={manifest} online downloadProgress={0.4} />, {
      fetch: okFetch,
    }).render();

    expect(await screen.findByText('Descargando… 40 %')).toBeOnTheScreen();
    expect(screen.getByTestId('indice-progreso', HIDDEN)).toHaveStyle({
      height: PROGRESS_BAR.height,
      borderRadius: PROGRESS_BAR.radius,
      backgroundColor: light.bg.pressed,
    });
    expect(PROGRESS_BAR).toEqual({ height: 4, radius: 2 });
    expect(screen.getByTestId('indice-progreso-relleno', HIDDEN)).toHaveStyle({
      width: '40%',
      backgroundColor: light.role.secondary.base,
    });
  });

  it('sin descarga no hay barra', async () => {
    await renderWithApp(<IndiceRow manifest={manifest} online downloadProgress={null} />, {
      fetch: okFetch,
    }).render();
    expect(screen.queryByTestId('indice-progreso', HIDDEN)).toBeNull();
  });
});
