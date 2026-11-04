// Modelo de Colectivos: índice, búsqueda con ranking, paradas cercanas con filtro por rectángulo.
import type { ParadaV1 } from '@transportate/contracts';

import { lineasArchivo, OBELISCO, paradasArchivo } from '../../../../test/colectivos/data';
import {
  buildIndice,
  buscar,
  describirLineas,
  formatDistancia,
  lineaParaNumero,
  normalizar,
  numeroDeLinea,
  textoDeLineas,
  numerosDeParada,
  paradasCercanas,
  paradasDeNumero,
} from '../model';
import { distanceMeters, isInsideCaba } from '../../ubicacion/geo';

const indice = buildIndice(lineasArchivo.lineas, paradasArchivo.paradas);

describe('índice', () => {
  it('ordena por número y agrupa los ramales', () => {
    expect(indice.lineas.map((l) => l.linea)).toEqual(['10', '60 A', '60 B', '152', '160', 'EBUS']);
    expect(indice.lineasPorNumero.get('60')?.map((l) => l.lineaId)).toEqual(['601', '602']);
    expect(indice.lineas[1]?.descripcion).toBe('Ramal A · a Constitución');
    expect(indice.paradaPorId.get('p-corrientes')?.calle).toBe('Av. Corrientes');
  });

  it('acepta las líneas del proxy (sin número ni enCaba)', () => {
    const vivo = buildIndice([{ lineaId: 'x', linea: '60 C', empresa: 'MOCBA' }], []);
    expect(vivo.lineas[0]).toMatchObject({
      numero: '60',
      ramal: 'C',
      enCaba: true,
      descripcion: 'Ramal C',
    });
    expect(numeroDeLinea('EBUS')).toBe('EBUS');
  });

  it('líneas de una parada y paradas de una línea', () => {
    const p = indice.paradaPorId.get('p-9dejulio');
    if (p === undefined) throw new Error('falta la parada');
    expect(numerosDeParada(p)).toEqual(['10', 'EBUS']);
    expect(describirLineas(['10', 'EBUS'])).toBe('Líneas 10, EBUS');
    expect(describirLineas(['60'])).toBe('Línea 60');
    expect(paradasDeNumero(indice.paradas, '152').map((x) => x.id)).toEqual([
      'p-corrientes',
      'p-plazaitalia',
    ]);
    expect(lineaParaNumero(indice, '60')?.lineaId).toBe('601');
    expect(lineaParaNumero(indice, '999')).toBeUndefined();
  });
});

describe('búsqueda', () => {
  it('número exacto primero, después los que empiezan igual', () => {
    expect(buscar(indice, '60').lineas.map((l) => l.lineaId)).toEqual(['601', '602']);
    expect(buscar(indice, '15').lineas.map((l) => l.lineaId)).toEqual(['1521']);
    expect(buscar(indice, '1').lineas.map((l) => l.linea)).toEqual(['10', '152', '160']);
    expect(buscar(indice, '60 b').lineas.map((l) => l.lineaId)).toEqual(['602']);
  });

  it('por cabecera o empresa, sin tildes ni mayúsculas', () => {
    expect(buscar(indice, 'CONSTITUCION').lineas.map((l) => l.lineaId)).toEqual(['601']);
    expect(buscar(indice, 'metrobus').lineas.map((l) => l.lineaId)).toEqual(['9001']);
  });

  it('paradas por calle desde 3 caracteres', () => {
    expect(buscar(indice, 'corrientes').paradas.map((p) => p.id)).toEqual(['p-corrientes']);
    expect(buscar(indice, 'av').paradas).toEqual([]);
    expect(buscar(indice, 'santa fe 3900').paradas.map((p) => p.id)).toEqual(['p-plazaitalia']);
    expect(buscar(indice, '608')).toEqual({ lineas: [], paradas: [] });
    expect(buscar(indice, '  ')).toEqual({ lineas: [], paradas: [] });
    expect(normalizar('Av. Córdoba')).toBe('av cordoba');
  });
});

describe('cercanía', () => {
  it('las más cercanas dentro de 1,5 km, ordenadas', () => {
    const r = paradasCercanas(indice.paradas, OBELISCO, 10);
    expect(r.map((x) => x.parada.id)).toEqual(['p-corrientes', 'p-9dejulio']);
    expect(r[0]?.metros).toBeGreaterThan(80);
    expect(r[0]?.metros).toBeLessThan(150);
    expect(paradasCercanas(indice.paradas, OBELISCO, 1)).toHaveLength(1);
  });

  it('CABA y distancias', () => {
    // Un solo rectángulo de CABA en la app: el de `features/ubicacion/geo.ts`.
    expect(isInsideCaba(OBELISCO.lat, OBELISCO.lon)).toBe(true);
    expect(isInsideCaba(-34.9205, -57.9536)).toBe(false);
    expect(Math.round(distanceMeters(OBELISCO, OBELISCO))).toBe(0);
    expect(formatDistancia(118)).toBe('a 120 m');
    expect(formatDistancia(3)).toBe('a 10 m');
    expect(formatDistancia(1234)).toBe('a 1,2 km');
  });

  it('con 7.027 paradas el filtro por rectángulo descarta casi todas sin haversine', () => {
    // Grilla sintética sobre CABA, del tamaño del dataset real.
    const paradas: ParadaV1[] = Array.from({ length: 7027 }, (_, i) => ({
      id: `g${String(i)}`,
      calle: 'Calle',
      altura: i,
      nombre: `Calle ${String(i)}`,
      lat: -34.7 + (Math.floor(i / 84) / 84) * 0.17,
      lon: -58.53 + ((i % 84) / 84) * 0.19,
      comuna: 1,
      barrio: null,
      lineas: [],
    }));
    const t0 = performance.now();
    for (let k = 0; k < 20; k++) paradasCercanas(paradas, OBELISCO, 30);
    const ms = (performance.now() - t0) / 20;
    const r = paradasCercanas(paradas, OBELISCO, 30);
    expect(r).toHaveLength(30);
    expect(r.every((x) => x.metros <= 1500)).toBe(true);
    // Medido: < 1 ms por búsqueda en Node sin carga. El umbral es holgado a propósito: los tests
    // corren en paralelo en una máquina compartida y solo tiene que atrapar un O(n²) o algo así.
    expect(ms).toBeLessThan(200);
  });
});

describe('textoDeLineas', () => {
  it('hasta 6 líneas las nombra todas, separadas por «·»', () => {
    expect(textoDeLineas(['60'])).toBe('60');
    expect(textoDeLineas(['60', '152', '168'])).toBe('60 · 152 · 168');
    expect(textoDeLineas(['1', '2', '3', '4', '5', '6'])).toBe('1 · 2 · 3 · 4 · 5 · 6');
  });

  it('con más de 6 nombra 3 y resume el resto', () => {
    expect(textoDeLineas(['60', '152', '168', '10', '5', '7', '9'])).toBe('60 · 152 · 168 y 4 más');
  });
});
