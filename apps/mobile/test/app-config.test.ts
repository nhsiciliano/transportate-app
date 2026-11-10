// Verifica `app.config.ts` sin levantar Expo: ejecuta la función con un `ConfigContext` mínimo y
// comprueba que cada imagen que referencia (ícono, adaptativo, splash) existe en disco, que el
// ícono de iOS es un PNG de 1024×1024 sin canal alfa y que el fondo del adaptativo coincide con
// el de la marca (`design/brand/adaptive-background.txt`).
/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

import type { ConfigContext } from 'expo/config';

import buildConfig, { assertReleaseApiUrl } from '../app.config';

const appRoot = path.resolve(__dirname, '..');
const brandDir = path.resolve(appRoot, '../../design/brand');

const context: ConfigContext = {
  projectRoot: appRoot,
  staticConfigPath: null,
  packageJsonPath: null,
  config: {},
};
const config = buildConfig(context);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Opciones del plugin `expo-splash-screen`, si está declarado con opciones. */
function splashOptions(): Record<string, unknown> {
  for (const plugin of config.plugins ?? []) {
    if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') {
      const options: unknown = plugin[1];
      if (isRecord(options)) return options;
    }
  }
  throw new Error('Falta el plugin expo-splash-screen con opciones');
}

function stringAt(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string') throw new Error(`Falta la ruta de imagen "${key}"`);
  return value;
}

function darkSplash(): Record<string, unknown> {
  const dark = splashOptions().dark;
  if (!isRecord(dark)) throw new Error('Falta splash.dark');
  return dark;
}

/** Todas las rutas de imagen que declara la config. */
function imagePaths(): string[] {
  const adaptive = config.android?.adaptiveIcon;
  return [
    config.icon,
    adaptive?.foregroundImage,
    adaptive?.monochromeImage,
    stringAt(splashOptions(), 'image'),
    stringAt(darkSplash(), 'image'),
  ].filter((ruta): ruta is string => typeof ruta === 'string');
}

describe('app.config.ts: assets de marca', () => {
  it('declara ícono, adaptativo (con monocromo) y las dos imágenes del splash', () => {
    expect(imagePaths()).toHaveLength(5);
  });

  it.each(imagePaths())('la imagen %s existe en disco y es un PNG', (ruta) => {
    const absoluta = path.resolve(appRoot, ruta);
    expect(fs.existsSync(absoluta)).toBe(true);
    // Firma PNG: 89 50 4E 47 0D 0A 1A 0A.
    const firma = fs.readFileSync(absoluta).subarray(0, 8);
    expect([...firma]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('el ícono es de 1024×1024 y sin canal alfa (lo exige iOS)', () => {
    const icon = fs.readFileSync(path.resolve(appRoot, config.icon ?? ''));
    // IHDR: ancho (bytes 16-19), alto (20-23), tipo de color (25): 2 = RGB, 6 = RGBA.
    expect(icon.readUInt32BE(16)).toBe(1024);
    expect(icon.readUInt32BE(20)).toBe(1024);
    expect(icon[25]).toBe(2);
  });

  it('el fondo del adaptativo coincide con design/brand/adaptive-background.txt', () => {
    const marca = fs.readFileSync(path.join(brandDir, 'adaptive-background.txt'), 'utf8').trim();
    expect(config.android?.adaptiveIcon?.backgroundColor).toBe(marca);
  });

  it('el splash usa 200 px, contain y el fondo claro/oscuro de Obelisco', () => {
    const splash = splashOptions();
    expect(splash.imageWidth).toBe(200);
    expect(splash.resizeMode).toBe('contain');
    expect(splash.backgroundColor).toBe('#ffffff');
    expect(darkSplash().backgroundColor).toBe('#1d3343');
  });

  it('no declara ios.icon: iOS toma el ícono de nivel superior', () => {
    expect(config.ios?.icon).toBeUndefined();
  });
});

describe('app.config.ts: publicación en iPhone (Fase 7)', () => {
  const pkg: unknown = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const pkgVersion = isRecord(pkg) ? pkg.version : undefined;

  it('la versión es 1.0.0 y coincide con package.json', () => {
    expect(config.version).toBe('1.0.0');
    expect(pkgVersion).toBe(config.version);
  });

  it('es solo iPhone', () => {
    expect(config.ios?.supportsTablet).toBe(false);
  });

  it('declara que no usa cifrado no exento', () => {
    expect(config.ios?.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it('no incluye expo-updates', () => {
    const nombres = (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin,
    );
    expect(nombres).not.toContain('expo-updates');
  });
});

describe('assertReleaseApiUrl', () => {
  it('lanza en un perfil release sin URL o con una URL que no es https', () => {
    expect(() => {
      assertReleaseApiUrl('production', undefined);
    }).toThrow(/production.*EXPO_PUBLIC_API_URL.*eas\.json/s);
    expect(() => {
      assertReleaseApiUrl('production', '  ');
    }).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() => {
      assertReleaseApiUrl('preview-simulator', 'http://localhost:8787');
    }).toThrow(/preview-simulator/);
    expect(() => {
      assertReleaseApiUrl('preview', 'http://proxy.test');
    }).toThrow(/https:\/\//);
  });

  it('no hace nada con https, con perfiles de desarrollo ni sin perfil', () => {
    expect(() => {
      assertReleaseApiUrl('production', 'https://x.test');
    }).not.toThrow();
    expect(() => {
      assertReleaseApiUrl('development', undefined);
    }).not.toThrow();
    expect(() => {
      assertReleaseApiUrl('development-simulator', 'http://localhost:8787');
    }).not.toThrow();
    expect(() => {
      assertReleaseApiUrl(undefined, undefined);
    }).not.toThrow();
  });
});
