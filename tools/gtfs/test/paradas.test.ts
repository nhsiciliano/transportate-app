import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildParadas, normalizeBarrio, paradaId } from '../src/steps/paradas.js';
import { ParadaSchema } from '../src/schemas.js';

const HEADER =
  'CALLE,ALT PLANO,DIRECCION,coord_X,coord_Y,COMUNA,BARRIO,L1,l1_sen,L2,l2_sen,L3,l3_sen,L4,l4_sen,L5,l5_sen,L6,l6_sen';
const CSV = [
  HEADER,
  'DEFENSA,"1524",1524 DEFENSA,-58.371000729999999,-34.625676259999999,1,SAN TELMO,"22",V,"53",I,,,,,,,,',
  // Misma parada repetida con otra línea: se fusiona
  'DEFENSA,"1524",1524 DEFENSA,-58.371000729999999,-34.625676259999999,1,SAN TELMO,"29",I,"22",V,,,,,,,,',
  'REGIMIENTO DE PATRICIOS AV.,"51",65 REGIMIENTO DE PATRICIOS AV.,-58.3706814,-34.63019554,4,BARRACAS,"93",I,"70",v,74,A-B,,,,,,',
  // Comuna inválida (dato real del CSV: "76" en Saavedra) → se infiere del barrio
  'DR. RICARDO BALBIN AV.,"4500",x,-58.4890,-34.5520,76,SAAVEDRA,"41",I,,,,,,,,,,',
  'GARCIA DEL RIO,"2900",x,-58.4850,-34.5530,12,SAAVEDRA,"10A",I,eBUS,V,,,,,,,,',
  'SIN COORD,"1",x,,,1,SAN TELMO,"22",I,,,,,,,,,,',
].join('\n');

async function build() {
  return buildParadas(Readable.from([CSV]));
}

describe('paradaId', () => {
  it('es determinista y estable ante cambios de formato del nombre', () => {
    const a = paradaId('DEFENSA', '1524', -34.62567626, -58.37100073);
    expect(a).toBe(paradaId(' defensa ', '1524', -34.625676261, -58.371000731));
    expect(a).toMatch(/^p[0-9a-f]{10}$/);
    expect(a).not.toBe(paradaId('DEFENSA', '1528', -34.62567626, -58.37100073));
    // Valor fijo: si cambia, cambian los ids publicados y los favoritos guardados por id.
    expect(a).toMatchInlineSnapshot(`"pabb406ba9f"`);
  });
});

describe('buildParadas', () => {
  it('fusiona duplicados, normaliza líneas/sentidos y valida contra el esquema', async () => {
    const { paradas, stats } = await build();
    expect(stats.filas).toBe(6);
    expect(stats.duplicadasFusionadas).toBe(1);
    expect(stats.sinCoordenadas).toBe(1);
    expect(paradas).toHaveLength(4);
    for (const p of paradas) expect(ParadaSchema.parse(p)).toEqual(p);

    const defensa = paradas.find((p) => p.calle === 'Defensa');
    expect(defensa).toMatchObject({
      altura: 1524,
      nombre: 'Defensa 1524',
      comuna: 1,
      barrio: 'San Telmo',
    });
    expect(defensa?.lat).toBe(-34.625676);
    expect(defensa?.lineas).toEqual([
      { linea: '22', numero: 22, sentido: 'vuelta' },
      { linea: '29', numero: 29, sentido: 'ida' },
      { linea: '53', numero: 53, sentido: 'ida' },
    ]);

    const patricios = paradas.find((p) => p.calle === 'Av. Regimiento de Patricios');
    expect(patricios?.lineas.map((l) => [l.linea, l.sentido])).toEqual([
      ['70', 'vuelta'],
      ['74', null],
      ['93', 'ida'],
    ]);
    expect(stats.sentidosDesconocidos).toBe(1);
  });

  it('infiere la comuna inválida desde el barrio y normaliza ramales', async () => {
    const { paradas, stats } = await build();
    const balbin = paradas.find((p) => p.calle.includes('Balbin'));
    expect(balbin?.comuna).toBe(12);
    expect(stats.comunasCorregidas).toBe(1);
    const garcia = paradas.find((p) => p.calle === 'Garcia del Rio');
    expect(garcia?.lineas).toEqual([
      { linea: '10A', numero: 10, sentido: 'ida' },
      { linea: 'EBUS', numero: null, sentido: 'vuelta' },
    ]);
  });

  it('los ids no dependen del orden de las filas', async () => {
    const reversed = [HEADER, ...CSV.split('\n').slice(1).reverse()].join('\n');
    const a = (await build()).paradas.map((p) => p.id).sort();
    const b = (await buildParadas(Readable.from([reversed]))).paradas.map((p) => p.id).sort();
    expect(b).toEqual(a);
  });
});

describe('normalizeBarrio', () => {
  it.each([
    ['VILLA ORTUZA', 'Villa Ortúzar'],
    ['VILLA GRAL. MITRE', 'Villa General Mitre'],
    ['VELEZ SARFIELD', 'Vélez Sarsfield'],
    ['NUÑEZ', 'Núñez'],
    ['PATERNAL', 'La Paternal'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBarrio(input)).toEqual({ barrio: expected, conocido: true });
  });

  it('vacío → null; desconocido → Title Case marcado', () => {
    expect(normalizeBarrio('')).toEqual({ barrio: null, conocido: true });
    expect(normalizeBarrio('BARRIO NUEVO')).toEqual({ barrio: 'Barrio Nuevo', conocido: false });
  });
});
