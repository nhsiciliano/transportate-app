// El paquete estático lo consume la app con los contratos v1 (@transportate/contracts):
// estos tests impiden que tools/gtfs y packages/contracts vuelvan a divergir.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  ARCHIVOS_ESTATICOS_V1,
  EquivalenciasArchivoV1,
  LineasColectivoArchivoV1,
  ManifestV1,
  ParadasArchivoV1,
} from '@transportate/contracts';
import { describe, expect, it } from 'vitest';
import { OUT_DIR } from '../src/config.js';
import { buildLineas } from '../src/steps/lineas.js';
import { buildParadas } from '../src/steps/paradas.js';
import { toPublished } from '../src/steps/equivalencias.js';

describe('salidas de los pasos contra los contratos v1', () => {
  it('paradas.json', async () => {
    const csv =
      'CALLE,ALT PLANO,DIRECCION,coord_X,coord_Y,COMUNA,BARRIO,L1,l1_sen,L2,l2_sen,L3,l3_sen,L4,l4_sen,L5,l5_sen,L6,l6_sen\n' +
      'DEFENSA,"1524",x,-58.371,-34.6257,1,SAN TELMO,"22",V,eBUS,,,,,,,,,\n' +
      'SIN BARRIO,"0",x,-58.40,-34.60,,,"10A",i,,,,,,,,,,\n';
    const { paradas } = await buildParadas(Readable.from([csv]));
    const r = ParadasArchivoV1.safeParse({ version: 1, fuente: 'x', paradas });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it('lineas-colectivos.json (sin ramal → campo ausente, no null)', () => {
    const { lineas } = buildLineas(
      [
        {
          route_id: '1858',
          route_short_name: '10',
          agency_name: 'LINEA 10 S.A.',
          agency_id: 17,
          trip_headsign: 'a Monte Grande',
          latitude: -34.6,
          longitude: -58.38,
        },
        {
          route_id: '1553',
          route_short_name: '228B',
          agency_name: 'COMPAÃ‘IA X',
          agency_id: 1,
          trip_headsign: null,
          latitude: -34.4,
          longitude: -58.6,
        },
      ],
      () => true,
    );
    expect(lineas.find((l) => l.lineaId === '1858')).not.toHaveProperty('ramal');
    const r = LineasColectivoArchivoV1.safeParse({
      version: 1,
      fuente: 'x',
      nota: 'n',
      capturadoEn: 'h',
      lineas,
    });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it('equivalencias-paradas.json solo publica filas con parada', () => {
    const base = {
      origen: 'ajustada-ba' as const,
      confianza: 0.9,
      lat: -34.6,
      lon: -58.4,
      distanciaM: 5,
      observaciones: 3,
      notas: '',
    };
    const publicadas = toPublished([
      { ...base, stopId: '1', paradaId: 'pabb406ba9f' },
      { ...base, stopId: '2', paradaId: null, origen: 'gtfs2021' },
    ]);
    expect(publicadas.map((e) => e.stopId)).toEqual(['1']);
    expect(
      EquivalenciasArchivoV1.safeParse({ version: 1, metodo: 'm', equivalencias: publicadas })
        .success,
    ).toBe(true);
  });
});

// Si hay un build en out/ (npm run build), se valida archivo por archivo, igual que la app.
const built = existsSync(join(OUT_DIR, 'manifest.json'));
describe.skipIf(!built)('out/ (último build) contra los contratos v1', () => {
  const read = (f: string): unknown => JSON.parse(readFileSync(join(OUT_DIR, f), 'utf8'));
  const manifest = built ? ManifestV1.parse(read('manifest.json')) : null;

  it('manifest.json: urls <version>/<archivo> y sha256 coinciden con los archivos', () => {
    expect(manifest).not.toBeNull();
    for (const [f, a] of Object.entries(manifest?.archivos ?? {})) {
      expect(a.url).toBe(`${manifest?.version}/${f}`);
      const buf = readFileSync(join(OUT_DIR, f));
      expect(buf.length).toBe(a.bytes);
      expect(createHash('sha256').update(buf).digest('hex')).toBe(a.sha256);
    }
  });

  it.each(Object.entries(ARCHIVOS_ESTATICOS_V1))('%s', (file, schema) => {
    if (!existsSync(join(OUT_DIR, file))) return;
    const r = schema.safeParse(read(file));
    expect(r.success, JSON.stringify(r.error?.issues.slice(0, 3))).toBe(true);
  });
});
