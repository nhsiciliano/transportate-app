import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TrenesEstacionesArchivoV1, TrenesLineasArchivoV1 } from '@transportate/contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { COLORES_TRENES } from '../src/config.js';
import {
  armarTrenes,
  buildTrenes,
  readTrenesInput,
  visibleEnApp,
  type TrenesInput,
} from '../src/steps/trenes.js';

// Muestra chica con la forma de los volcados de tools/sofse-probe: texto en ids y coordenadas,
// `visibilidad` como objeto o como texto JSON.
const cab = (id: number, nombre: string) => ({
  id,
  nombre,
  siglas: 'X',
  nombre_corto: nombre,
  visibilidad: '{"totem": "1", "app_mobile": "1"}',
});
const ramal = (
  id: number,
  idGerencia: number,
  nombre: string,
  inicial: [number, string],
  final: [number, string],
  extra: Record<string, unknown> = {},
) => ({
  id,
  id_gerencia: idGerencia,
  nombre,
  siglas: 'AK',
  publico: true,
  orden_ramal: 1,
  es_electrico: 1,
  cabecera_inicial: cab(...inicial),
  cabecera_final: cab(...final),
  alerta: null,
  ...extra,
});
const est = (
  id: number,
  nombre: string,
  latitud: string,
  longitud: string,
  extra: Record<string, unknown> = {},
) => ({
  nombre,
  id_estacion: String(id),
  id_tramo: '17',
  orden: '1',
  latitud,
  longitud,
  visibilidad: { totem: 1, app_mobile: 1 },
  ...extra,
});

function muestra(): TrenesInput {
  // `armarTrenes` recibe los datos ya leídos: se arma con el mismo `readTrenesInput` que el build
  // (ver el test de más abajo), así los esquemas de entrada también quedan cubiertos.
  const dir = mkdtempSync(join(tmpdir(), 'trenes-muestra-'));
  cleanup.push(dir);
  const w = (f: string, data: unknown) => {
    writeFileSync(join(dir, f), JSON.stringify(data));
  };
  w('capturado.json', {
    capturadoEn: '2026-11-05T11:56:14.337Z',
    base: 'https://ariedro.dev/api-trenes',
  });
  w('gerencias.json', [
    { id: 11, nombre: 'Roca', alerta: [] },
    { id: 1, nombre: 'Sarmiento', alerta: [] },
    { id: 501, nombre: 'Regionales', alerta: [] },
  ]);
  w('ramales-11.json', [
    // `orden_ramal` igual: desempata el nombre. «Constitución-Bosques» va antes que «Constitución-Korn».
    ramal(17, 11, 'Constitución-Korn', [93, 'Constitución'], [13, 'Alejandro Korn']),
    ramal(13, 11, 'Constitución-Bosques', [93, 'Constitución'], [43, 'Bosques']),
    ramal(99, 11, 'Interno', [93, 'Constitución'], [43, 'Bosques'], { publico: false }),
  ]);
  w('ramales-1.json', [
    ramal(1, 1, 'Once-Moreno', [293, 'Once'], [278, 'Moreno'], { siglas: '', es_electrico: 0 }),
  ]);
  w('estaciones-17.json', [
    // `orden` se reinicia por tramo: el orden de recorrido es el del arreglo, no el de `orden`.
    est(93, 'Constitución', '-34.6303512', '-58.3805802', { orden: '1' }),
    est(172, 'Hipólito Yrigoyen', '-34.6536', '-58.3788', { orden: '2' }),
    // Sin `app_mobile`: no se publica.
    est(500, 'Cochera', '-34.65', '-58.38', { visibilidad: { totem: 1, app_mobile: 0 } }),
    est(8, 'Adrogué', '-34.7978', '-58.3942', { id_tramo: '31', orden: '1' }),
    est(13, 'Alejandro Korn', '-34.9807', '-58.3737', { id_tramo: '31', orden: '6' }),
  ]);
  w('estaciones-13.json', [
    est(93, 'Constitución', '-34.6303512', '-58.3805802'),
    // Coordenada inválida: se descarta con aviso.
    est(600, 'Sin posición', '', 'abc'),
    // `visibilidad` como texto JSON, como en `cabecera_*` de ramales.
    est(43, 'Bosques', '-34.7738', '-58.2005', {
      visibilidad: '{"totem": "1", "app_mobile": "1"}',
    }),
  ]);
  w('estaciones-1.json', [
    est(293, 'Once', '-34.6089', '-58.4064'),
    // Estación compartida con otra línea: acumula `lineas` en el orden fijo.
    est(93, 'Constitución', '-34.6303512', '-58.3805802'),
    est(278, 'Moreno', '-34.6529', '-58.7918'),
  ]);
  return readTrenesInput(dir, { completo: false });
}

const cleanup: string[] = [];
afterAll(() => {
  for (const d of cleanup) rmSync(d, { recursive: true, force: true });
});

describe('visibleEnApp', () => {
  it.each([
    [{ totem: 1, app_mobile: 1 }, true],
    [{ totem: 1, app_mobile: '1' }, true],
    ['{"totem": "1", "app_mobile": "1"}', true],
    [{ app_mobile: 0 }, false],
    [{ app_mobile: '0' }, false],
    ['{"app_mobile": "0"}', false],
    ['no es json', false],
    [null, false],
    [undefined, false],
    [{}, false],
  ])('%j → %s', (v, esperado) => {
    expect(visibleEnApp(v)).toBe(esperado);
  });
});

describe('armarTrenes (muestra: 2 líneas, 3 ramales públicos)', () => {
  const r = armarTrenes(muestra(), { completo: false });

  it('arma las líneas en el orden fijo, con slug, idGerencia como texto y nombre de la fuente', () => {
    expect(r.lineas.lineas.map((l) => [l.id, l.idGerencia, l.nombre])).toEqual([
      ['roca', '11', 'Roca'],
      ['sarmiento', '1', 'Sarmiento'],
    ]);
    // Regionales (501) se ignora aunque esté en gerencias.json.
    expect(r.lineas.lineas).toHaveLength(2);
  });

  it('los colores salen de COLORES_TRENES', () => {
    for (const l of r.lineas.lineas) {
      expect(l.color).toBe(COLORES_TRENES[l.id]?.color);
      expect(l.colorTexto).toBe(COLORES_TRENES[l.id]?.texto);
    }
    expect(r.lineas.lineas[0]).toMatchObject({ color: '#F07D2B', colorTexto: '#000000' });
  });

  it('descarta ramales no públicos y ordena por orden_ramal y nombre', () => {
    const roca = r.lineas.lineas[0];
    expect(roca?.ramales.map((x) => x.id)).toEqual(['13', '17']);
    expect(r.stats.ramales).toBe(3);
  });

  it('ramal: ids como texto, cabeceras, eléctrico y siglas solo si hay', () => {
    const korn = r.lineas.lineas[0]?.ramales.find((x) => x.id === '17');
    expect(korn).toMatchObject({
      linea: 'roca',
      nombre: 'Constitución-Korn',
      siglas: 'AK',
      cabeceraInicial: { id: '93', nombre: 'Constitución' },
      cabeceraFinal: { id: '13', nombre: 'Alejandro Korn' },
      electrico: true,
    });
    const moreno = r.lineas.lineas[1]?.ramales[0];
    expect(moreno?.electrico).toBe(false);
    expect(moreno && 'siglas' in moreno).toBe(false);
  });

  it('estacionIds conserva el orden de recorrido del upstream (no se reordena por `orden`) y sin las no publicadas', () => {
    const korn = r.lineas.lineas[0]?.ramales.find((x) => x.id === '17');
    // 500 (sin app_mobile) se saca; el resto queda como vino aunque `orden` diga otra cosa.
    expect(korn?.estacionIds).toEqual(['93', '172', '8', '13']);
    expect(r.stats.estacionesDeRamalNoPublicadas).toBe(2);
    expect(r.stats.cabecerasNoCoinciden).toEqual([]);
  });

  it('avisa los ramales cuya lista no empieza o termina en sus cabeceras', () => {
    const input = muestra();
    input.estacionesPorRamal.set('13', [
      {
        id_estacion: '43',
        nombre: 'Bosques',
        latitud: '-34.77',
        longitud: '-58.2',
        visibilidad: { app_mobile: 1 },
      },
      {
        id_estacion: '93',
        nombre: 'Constitución',
        latitud: '-34.63',
        longitud: '-58.38',
        visibilidad: { app_mobile: 1 },
      },
    ]);
    const out = armarTrenes(input, { completo: false });
    expect(out.stats.cabecerasNoCoinciden).toEqual([
      {
        ramalId: '13',
        nombre: 'Constitución-Bosques',
        inicial: { esperada: '93', primera: '43' },
        final: { esperada: '43', ultima: '93' },
      },
    ]);
  });

  it('estaciones: deduplica por id, acumula líneas (orden fijo) y ramalIds', () => {
    const constitucion = r.estaciones.estaciones.find((e) => e.id === '93');
    expect(constitucion).toMatchObject({
      nombre: 'Constitución',
      lineas: ['roca', 'sarmiento'],
      ramalIds: ['13', '17', '1'],
    });
    expect(new Set(r.estaciones.estaciones.map((e) => e.id)).size).toBe(
      r.estaciones.estaciones.length,
    );
  });

  it('filtra las que no tienen app_mobile y descarta las de coordenada inválida, con aviso', () => {
    const ids = r.estaciones.estaciones.map((e) => e.id);
    expect(ids).not.toContain('500');
    expect(ids).not.toContain('600');
    expect(r.stats.sinAppMobile).toEqual([{ id: '500', nombre: 'Cochera' }]);
    expect(r.stats.descartadas).toEqual([
      { id: '600', nombre: 'Sin posición', latitud: '', longitud: 'abc' },
    ]);
    expect(r.stats.filasDeEstacion).toBe(11);
  });

  it('lat/lon son números redondeados a 6 decimales y el nombre queda con sus tildes', () => {
    const c = r.estaciones.estaciones.find((e) => e.id === '93');
    expect(c).toMatchObject({ lat: -34.630351, lon: -58.38058 });
    expect(r.estaciones.estaciones.find((e) => e.id === '172')?.nombre).toBe('Hipólito Yrigoyen');
  });

  it('ordena las estaciones por nombre (localeCompare es)', () => {
    const nombres = r.estaciones.estaciones.map((e) => e.nombre);
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
    expect(nombres[0]).toBe('Adrogué');
  });

  it('fuente y capturadoEn salen de capturado.json', () => {
    for (const a of [r.lineas, r.estaciones]) {
      expect(a.fuente).toBe('https://ariedro.dev/api-trenes');
      expect(a.capturadoEn).toBe('2026-11-05T11:56:14.337Z');
      expect(a.version).toBe(1);
    }
  });

  it('las dos salidas validan contra los contratos de @transportate/contracts', () => {
    const l = TrenesLineasArchivoV1.safeParse(r.lineas);
    const e = TrenesEstacionesArchivoV1.safeParse(r.estaciones);
    expect(l.success, JSON.stringify(l.error?.issues)).toBe(true);
    expect(e.success, JSON.stringify(e.error?.issues)).toBe(true);
  });

  it('todo estacionId de un ramal existe en el archivo de estaciones', () => {
    const ids = new Set(r.estaciones.estaciones.map((e) => e.id));
    for (const l of r.lineas.lineas)
      for (const ramal of l.ramales)
        for (const id of ramal.estacionIds) expect(ids.has(id)).toBe(true);
  });
});

describe('armarTrenes completo', () => {
  it('exige las seis líneas: con una muestra de dos, falla', () => {
    // Sin `completo: false`, el paso pide las seis gerencias.
    expect(() => armarTrenes(muestra())).toThrow(/no trae la línea|faltan/);
  });
});

describe('readTrenesInput', () => {
  it('falla con un mensaje claro si falta un volcado', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trenes-vacio-'));
    cleanup.push(dir);
    mkdirSync(dir, { recursive: true });
    expect(() => buildTrenes(dir)).toThrow(/Falta .*capturado\.json.*sofse-probe/);
  });
});
