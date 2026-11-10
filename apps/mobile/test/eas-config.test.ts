// Verifica `eas.json` sin tocar EAS: que los builds release apunten al proxy de producción por
// HTTPS (nunca localhost), que los de desarrollo lean `.env` y que el submit no lleve datos
// personales (`appleId`).
/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';

type Perfil = {
  extends?: string;
  env?: Record<string, string>;
  autoIncrement?: boolean;
};
type EasJson = {
  cli?: { version?: string; appVersionSource?: string };
  build: Record<string, Perfil>;
  submit?: { production?: { ios?: Record<string, unknown> } };
};

const eas = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../eas.json'), 'utf8')) as EasJson;

/** Resuelve `extends` como EAS: el `env` del hijo se mergea sobre el del padre. */
function resolver(nombre: string): Perfil {
  const perfil = eas.build[nombre];
  if (!perfil) throw new Error(`Falta el perfil ${nombre}`);
  if (perfil.extends === undefined) return perfil;
  const base = resolver(perfil.extends);
  return { ...base, ...perfil, env: { ...base.env, ...perfil.env } };
}

const API_URL = 'EXPO_PUBLIC_API_URL';

describe('eas.json: URL del proxy por perfil', () => {
  it.each(['preview', 'preview-simulator', 'production'])(
    '%s apunta al proxy por https, sin barra final ni localhost ni IP privada',
    (nombre) => {
      const url = resolver(nombre).env?.[API_URL];
      expect(url).toBeDefined();
      expect(url).toMatch(/^https:\/\//);
      expect(url).not.toMatch(/\/$/);
      expect(url).not.toMatch(
        /localhost|127\.0\.0\.1|0\.0\.0\.0|\b10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\./,
      );
    },
  );

  it.each(['development', 'development-simulator'])(
    '%s no define %s (Metro lee .env)',
    (nombre) => {
      expect(resolver(nombre).env?.[API_URL]).toBeUndefined();
    },
  );

  it('preview-simulator hereda el env de preview', () => {
    expect(eas.build['preview-simulator']?.extends).toBe('preview');
    expect(resolver('preview-simulator').env?.[API_URL]).toBe(resolver('preview').env?.[API_URL]);
  });
});

describe('eas.json: build y submit', () => {
  it('production autoincrementa el build y la versión de app es remota', () => {
    expect(eas.build.production?.autoIncrement).toBe(true);
    expect(eas.cli?.appVersionSource).toBe('remote');
  });

  it('submit.production.ios tiene el appleTeamId y no lleva appleId', () => {
    const ios = eas.submit?.production?.ios;
    expect(ios?.appleTeamId).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(ios).not.toHaveProperty('appleId');
    if (ios && 'ascAppId' in ios) expect(ios.ascAppId).toMatch(/^\d+$/);
  });
});
