// El paquete estático lo consume la app con los contratos v1 (@transportate/contracts):
// estos tests impiden que tools/gtfs y packages/contracts vuelvan a divergir.
import { Readable } from 'node:stream';
import {
  EquivalenciasArchivoV1,
  IndiceColectivosArchivoV1,
  LineasColectivoArchivoV1,
  ParadasArchivoV1,
} from '@transportate/contracts';
import { describe, expect, it } from 'vitest';
import { buildLineas } from '../src/steps/lineas.js';
import { buildParadas } from '../src/steps/paradas.js';
import { toPublished } from '../src/steps/equivalencias.js';
import { buildIndice } from '../src/steps/indice.js';

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

// El out/ real no se valida acá: depende del último build local (puede ser de otra versión).
// Lo valida el propio build contra los mismos contratos antes de escribir cada archivo.

describe('indice-colectivos.json', () => {
  it('paradaId → [stopIds, números]; número → lineaIds de CABA; valida el contrato', () => {
    const parada = (id: string, numeros: (number | null)[]) => ({
      id,
      calle: 'Defensa',
      altura: 1524,
      nombre: 'Defensa 1524',
      lat: -34.6,
      lon: -58.4,
      comuna: 1,
      barrio: 'San Telmo',
      lineas: numeros.map((n) => ({ linea: String(n ?? 'EBUS'), numero: n, sentido: null })),
    });
    const lineas = [
      { lineaId: '835', linea: '152', empresa: 'X', numero: 152, agencyId: null, enCaba: true },
      { lineaId: '834', linea: '152', empresa: 'X', numero: 152, agencyId: null, enCaba: true },
      { lineaId: '9', linea: '152', empresa: 'Y', numero: 152, agencyId: null, enCaba: false },
    ];
    const eq = [
      {
        stopId: 'S2',
        paradaId: 'pa',
        origen: 'aprendida' as const,
        confianza: 0.7,
        observaciones: 3,
      },
      {
        stopId: 'S1',
        paradaId: 'pa',
        origen: 'ajustada-ba' as const,
        confianza: 0.9,
        observaciones: 1,
      },
    ];
    const { indice, stats } = buildIndice(
      [parada('pa', [152, null]), parada('pb', [99])],
      lineas,
      eq,
    );
    expect(indice).toEqual({
      version: 1,
      lineasPorNumero: { '152': ['834', '835'] },
      paradas: { pa: [['S1', 'S2'], [152]], pb: [[], [99]] },
    });
    expect(stats).toMatchObject({ paradas: 2, paradasConStopIds: 1, stopIds: 2, numeros: 1 });
    expect(IndiceColectivosArchivoV1.safeParse(indice).success).toBe(true);
  });
});
