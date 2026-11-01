import { describe, expect, it } from 'vitest';
import {
  cleanText,
  normalizeLinea,
  normalizeSentido,
  prettyStreet,
  repairMojibake,
} from '../src/lib/text.js';

describe('repairMojibake (UTF-8 leído como Windows-1252)', () => {
  it.each([
    // Casos reales de vehiclePositionsSimple.json y del CSV de paradas BA
    ['COMPAÃ‘IA ISLEÃ‘A S.R.L.', 'COMPAÑIA ISLEÑA S.R.L.'],
    ['MICRO OMNIBUS OÂ´HIGGINS S.A.T.', 'MICRO OMNIBUS O´HIGGINS S.A.T.'],
    ['TRANSPORTES 1Âº SEPTIEMBRE S.A.', 'TRANSPORTES 1º SEPTIEMBRE S.A.'],
    ['MagariÃ±o Cervantes 4145', 'Magariño Cervantes 4145'],
    ['RodrÃ­guez peÃ±a 42', 'Rodríguez peña 42'],
    // Byte 0x8D perdido ("?") después de Ã: se asume Í
    ['COMPAÃ‘Ã?A DE OMNIBUS 25 DE MAYO', 'COMPAÑÍA DE OMNIBUS 25 DE MAYO'],
  ])('%s → %s', (input, expected) => {
    expect(repairMojibake(input)).toBe(expected);
  });

  it('no toca texto sano (con tildes y eñes correctas)', () => {
    for (const s of [
      'PRES. LUIS SAENZ PEÑA',
      'Constitución',
      'Río de Janeiro',
      'DEFENSA 1524',
      '¿Qué?',
    ]) {
      expect(repairMojibake(s)).toBe(s);
    }
  });

  it('repara solo los tramos rotos en un string mixto', () => {
    expect(repairMojibake('Peña y CastaÃ±ares')).toBe('Peña y Castañares');
  });

  it('cleanText normaliza NBSP mal decodificado (Â + NBSP) y espacios', () => {
    expect(cleanText('EXPRESO VILLA GALICIAÂ\u00A0 SAN JOSE S.A.')).toBe(
      'EXPRESO VILLA GALICIA SAN JOSE S.A.',
    );
    expect(cleanText('  a\t b  ')).toBe('a b');
    expect(cleanText(null)).toBe('');
  });
});

describe('normalizeLinea', () => {
  it.each([
    ['10A', { linea: '10A', numero: 10, ramal: 'A' }],
    ['228B', { linea: '228B', numero: 228, ramal: 'B' }],
    ['247-5', { linea: '247-5', numero: 247, ramal: '5' }],
    ['1 B', { linea: '1 B', numero: 1, ramal: 'B' }],
    ['392R1', { linea: '392R1', numero: 392, ramal: 'R1' }],
    [' 60 ', { linea: '60', numero: 60, ramal: null }],
    ['85 A - P. Alsina', { linea: '85 A - P. ALSINA', numero: 85, ramal: 'A - P. ALSINA' }],
    ['eBUS', { linea: 'EBUS', numero: null, ramal: null }],
    [22, { linea: '22', numero: 22, ramal: null }],
  ])('%s', (input, expected) => {
    expect(normalizeLinea(input)).toEqual(expected);
  });

  it('vacío → null', () => {
    expect(normalizeLinea('')).toBeNull();
    expect(normalizeLinea(undefined)).toBeNull();
  });
});

describe('normalizeSentido', () => {
  it.each([
    ['I', 'ida'],
    ['i', 'ida'],
    ['V', 'vuelta'],
    ['v', 'vuelta'],
    ['A-B', null],
    ['', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizeSentido(input)).toBe(expected);
  });
});

describe('prettyStreet', () => {
  it.each([
    ['DEFENSA', 'Defensa'],
    ['REGIMIENTO DE PATRICIOS AV.', 'Av. Regimiento de Patricios'],
    ['PRES. LUIS SAENZ PEÑA', 'Pres. Luis Saenz Peña'],
    ["O'HIGGINS", "O'Higgins"],
    ['11 DE SEPTIEMBRE DE 1888', '11 de Septiembre de 1888'],
    ['DE LA TORRE LISANDRO', 'De la Torre Lisandro'],
  ])('%s → %s', (input, expected) => {
    expect(prettyStreet(input)).toBe(expected);
  });
});
