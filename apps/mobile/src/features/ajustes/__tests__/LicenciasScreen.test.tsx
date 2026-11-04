import { screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { LicenciasScreen } from '@/features/ajustes';
import { fontFamily, light } from '@/shared/theme';

import { renderThemed } from '../../../shared/ui/__fixtures__/renderThemed';
import { licencias, LicenciaPaqueteSchema, type LicenciaPaquete } from '../licencias';

const paquetes: readonly LicenciaPaquete[] = [
  {
    name: 'paquete-a',
    version: '1.0.0',
    license: 'MIT',
    repository: 'https://github.com/ejemplo/paquete-a',
    text: 'Permission is hereby granted, free of charge…',
  },
  { name: 'paquete-b', version: '2.3.4', license: 'Apache-2.0', repository: null, text: null },
];

afterEach(() => {
  jest.restoreAllMocks();
});

describe('licencias.json', () => {
  it('está generado, es válido y trae la licencia de lo que viaja en la app', () => {
    expect(licencias.length).toBeGreaterThan(10);
    for (const paquete of licencias)
      expect(LicenciaPaqueteSchema.safeParse(paquete).success).toBe(true);
    const names = licencias.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(names).toEqual(expect.arrayContaining(['react-native', 'expo', 'zod']));
  });

  it('incluye Fira Sans (MIT y OFL-1.1) y ya no Nunito ni Open Sans', () => {
    const fira = licencias.find((p) => p.name === '@expo-google-fonts/fira-sans');
    expect(fira).toBeDefined();
    expect(fira?.license).toBe('MIT AND OFL-1.1');
    expect(fira?.text).toMatch(/SIL OPEN FONT LICENSE/i);
    const names = licencias.map((p) => p.name.toLowerCase());
    expect(names.some((n) => n.includes('nunito') || n.includes('open-sans'))).toBe(false);
  });
});

describe('LicenciasScreen · forma', () => {
  it('es una sola placa: nombre 17/600, «versión · licencia» 15 y hairline entre filas', async () => {
    await renderThemed(<LicenciasScreen paquetes={paquetes} />);
    expect(screen.getByText('paquete-a')).toHaveStyle({
      fontFamily: fontFamily.text[600],
      fontSize: 17,
      lineHeight: 22,
    });
    expect(screen.getByText('2.3.4 · Apache-2.0')).toHaveStyle({
      fontSize: 15,
      lineHeight: 20,
      color: light.text.secondary,
    });
    // Dos filas = un solo separador.
    expect(screen.getAllByTestId('fila-separador')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'paquete-a 1.0.0, licencia MIT' })).toHaveStyle({
      minHeight: 52,
    });
  });

  it('el texto de la licencia expandida va en 15/22 text.secondary', async () => {
    const user = userEvent.setup();
    await renderThemed(<LicenciasScreen paquetes={paquetes} />);
    await user.press(screen.getByRole('button', { name: 'paquete-a 1.0.0, licencia MIT' }));
    expect(screen.getByText(/Permission is hereby granted/)).toHaveStyle({
      fontSize: 15,
      lineHeight: 22,
      color: light.text.secondary,
    });
  });
});

describe('LicenciasScreen', () => {
  it('lista nombre · versión · licencia', async () => {
    await renderThemed(<LicenciasScreen paquetes={paquetes} />);
    expect(screen.getByRole('button', { name: 'paquete-a 1.0.0, licencia MIT' })).toBeOnTheScreen();
    expect(screen.getByText('2.3.4 · Apache-2.0')).toBeOnTheScreen();
  });

  it('expande y colapsa el texto de la licencia', async () => {
    const user = userEvent.setup();
    await renderThemed(<LicenciasScreen paquetes={paquetes} />);
    const row = screen.getByRole('button', { name: 'paquete-a 1.0.0, licencia MIT' });
    expect(row).toBeCollapsed();
    expect(screen.queryByText(/Permission is hereby granted/)).toBeNull();

    await user.press(row);
    expect(screen.getByText(/Permission is hereby granted/)).toBeOnTheScreen();
    expect(row).toBeExpanded();

    await user.press(row);
    expect(screen.queryByText(/Permission is hereby granted/)).toBeNull();
  });

  it('sin texto de licencia manda al repositorio, si lo hay', async () => {
    const user = userEvent.setup();
    await renderThemed(<LicenciasScreen paquetes={paquetes} />);
    await user.press(screen.getByRole('button', { name: 'paquete-b 2.3.4, licencia Apache-2.0' }));
    expect(screen.getByText(/no incluye el texto de la licencia/)).toBeOnTheScreen();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('el enlace al repositorio se abre en el navegador', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderThemed(<LicenciasScreen paquetes={paquetes} />);
    await user.press(screen.getByRole('button', { name: 'paquete-a 1.0.0, licencia MIT' }));
    await user.press(screen.getByRole('link', { name: 'Repositorio de paquete-a' }));
    expect(open).toHaveBeenCalledWith('https://github.com/ejemplo/paquete-a');
  });

  it('con el JSON real renderiza la primera tanda de paquetes', async () => {
    await renderThemed(<LicenciasScreen />);
    const first = licencias[0];
    expect(first).toBeDefined();
    expect(screen.getByText(first?.name ?? '')).toBeOnTheScreen();
  });
});
