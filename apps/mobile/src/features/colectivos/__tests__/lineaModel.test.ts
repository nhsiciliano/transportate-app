import type { VehiculoV1 } from '@transportate/contracts';

import {
  bandaDelPanel,
  edadVehiculo,
  enServicio,
  formatDistancia,
  mensajeDeLinea,
  ordenarVehiculos,
  POSICIONES_VIEJAS,
  recorridoDe,
  vehiculosCollection,
  vistaVehiculo,
} from '../lineaModel';

const NOW = Date.parse('2026-11-03T12:00:00.000Z');

const vehiculo = (id: string, edad: number, extra: Partial<VehiculoV1> = {}): VehiculoV1 => ({
  id,
  lineaId: '601',
  linea: '60 A',
  empresa: 'MOCBA',
  lat: -34.6,
  lon: -58.39,
  rumbo: null,
  ts: new Date(NOW - edad * 1000).toISOString(),
  edadSegundos: edad,
  ...extra,
});

describe('lineaModel', () => {
  it('enServicio con singular y plural', () => {
    expect(enServicio(1)).toBe('1 colectivo en servicio');
    expect(enServicio(18)).toBe('18 colectivos en servicio');
  });

  it('formatDistancia en metros redondeados o km con coma', () => {
    expect(formatDistancia(604)).toEqual({
      short: 'a 600 m de vos',
      spoken: 'a 600 metros de vos',
    });
    expect(formatDistancia(1240).short).toBe('a 1,2 km de vos');
  });

  it('la edad se cuenta con el reloj actual desde el reporte', () => {
    expect(edadVehiculo(vehiculo('1', 25), NOW + 10_000)).toBe(35);
  });

  it('vista de un vehículo: texto, versión hablada, viejo y distancia solo con posición', () => {
    const sin = vistaVehiculo(vehiculo('1404', 25), { now: NOW, posicion: null });
    expect(sin.texto).toBe('Interno 1404 · actualizado hace 25 s');
    expect(sin.hablado).toBe('Interno 1404, actualizado hace 25 segundos');
    expect(sin.viejo).toBe(false);
    const con = vistaVehiculo(vehiculo('1404', 400), {
      now: NOW,
      posicion: { lat: -34.6054, lon: -58.39 },
    });
    expect(con.viejo).toBe(true);
    expect(con.texto).toBe('Interno 1404 · actualizado hace 6 min · a 600 m de vos');
  });

  it('puntos para el mapa: atenuado por vehículo o por feed, seleccionado y rumbo', () => {
    const vistas = [
      vistaVehiculo(vehiculo('1', 20, { rumbo: 90 }), { now: NOW, posicion: null }),
      vistaVehiculo(vehiculo('2', 400), { now: NOW, posicion: null }),
    ];
    const fc = vehiculosCollection(vistas, {
      etiqueta: '60',
      todosAtenuados: false,
      seleccionadoId: '1',
    });
    expect(fc.features.map((f) => f.properties)).toEqual([
      { id: '1', etiqueta: '60', atenuado: false, seleccionado: true, rumbo: 90 },
      { id: '2', etiqueta: '60', atenuado: true, seleccionado: false, rumbo: null },
    ]);
    const todos = vehiculosCollection(vistas, {
      etiqueta: '60',
      todosAtenuados: true,
      seleccionadoId: null,
    });
    expect(todos.features.every((f) => f.properties.atenuado)).toBe(true);
  });

  it('sin ubicación ordena por más reciente y después por interno', () => {
    const vistas = [
      vistaVehiculo(vehiculo('b', 30), { now: NOW, posicion: null }),
      vistaVehiculo(vehiculo('a', 30), { now: NOW, posicion: null }),
      vistaVehiculo(vehiculo('c', 5), { now: NOW, posicion: null }),
    ];
    expect(vistas.every((v) => v.metros === null)).toBe(true);
    expect(ordenarVehiculos(vistas).map((v) => v.id)).toEqual(['c', 'a', 'b']);
  });

  it('con ubicación ordena por cercanía y desempata por más reciente', () => {
    const posicion = { lat: -34.6, lon: -58.39 };
    const vistas = [
      vistaVehiculo(vehiculo('lejos', 5, { lat: -34.61 }), { now: NOW, posicion }),
      vistaVehiculo(vehiculo('cerca-viejo', 50, { lat: -34.601 }), { now: NOW, posicion }),
      vistaVehiculo(vehiculo('cerca-nuevo', 10, { lat: -34.601 }), { now: NOW, posicion }),
      vistaVehiculo(vehiculo('encima', 40), { now: NOW, posicion }),
    ];
    expect(vistas[0]?.metros).toBeCloseTo(1112, -1);
    expect(ordenarVehiculos(vistas).map((v) => v.id)).toEqual([
      'encima',
      'cerca-nuevo',
      'cerca-viejo',
      'lejos',
    ]);
  });

  it('recorridoDe filtra por número de línea', () => {
    const recorridos = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [-58.4, -34.6],
              [-58.41, -34.61],
            ],
          },
          properties: { numero: 60 },
        },
      ],
    };
    expect(recorridoDe(recorridos, '60')?.features).toHaveLength(1);
    expect(recorridoDe(recorridos, '152')).toBeNull();
    expect(recorridoDe(undefined, '60')).toBeNull();
  });

  it('mensaje de la banda: ramal o, sin ramal, la cabecera', () => {
    expect(mensajeDeLinea({ numero: '152', ramal: 'A' })).toBe('Línea 152 · Ramal A');
    expect(mensajeDeLinea({ numero: '152', cabecera: 'Constitución – Retiro' })).toBe(
      'Línea 152 · Constitución – Retiro',
    );
    expect(mensajeDeLinea({ numero: '152', ramal: '', cabecera: '' })).toBe('Línea 152');
  });
});

describe('bandaDelPanel', () => {
  const mensaje = 'Línea 152 · Ramal A';
  const base = {
    mensaje,
    estado: 'datos' as const,
    cantidad: 18,
    edadMasVieja: 25,
    feedViejo: false,
    seleccionado: null,
  };

  it('con vehículos: conteo monumental y antigüedad del dato más viejo, sin re-anunciar', () => {
    const b = bandaDelPanel(base);
    expect(b).toMatchObject({
      message: mensaje,
      label: 'En servicio',
      value: '18',
      valueStyle: 'display',
      status: { text: 'hace 25 s', tone: 'muted' },
      transitionKey: 'conteo-18',
    });
    expect(b.accessibilityLabel).toBe(
      'Línea 152 · Ramal A, 18 colectivos en servicio, dato más viejo de hace 25 segundos',
    );
  });

  it('sin colectivos: el valor es la frase y va en texto', () => {
    const b = bandaDelPanel({ ...base, estado: 'vacio', cantidad: 0, edadMasVieja: null });
    expect(b).toMatchObject({
      value: 'Sin colectivos con GPS ahora',
      valueStyle: 'text',
      status: undefined,
      transitionKey: 'conteo-0',
    });
    expect(b.accessibilityLabel).toContain('No hay colectivos de esta línea con GPS activo ahora.');
  });

  it('cargando: valor nulo (skeleton); error: «Sin datos» sin estado', () => {
    expect(bandaDelPanel({ ...base, estado: 'cargando' })).toMatchObject({
      value: null,
      transitionKey: 'cargando',
    });
    expect(bandaDelPanel({ ...base, estado: 'error' })).toMatchObject({
      value: 'Sin datos',
      valueStyle: 'text',
      status: undefined,
    });
  });

  it('feed viejo: el aviso (warning) reemplaza a la antigüedad', () => {
    const b = bandaDelPanel({ ...base, feedViejo: true, edadMasVieja: 700 });
    expect(b.status).toEqual({ text: POSICIONES_VIEJAS, tone: 'warning' });
    expect(b.accessibilityLabel).toContain(POSICIONES_VIEJAS);
  });

  it('vehículo elegido: la banda se vuelve a señalizar con su interno, edad y distancia', () => {
    const v = vistaVehiculo(vehiculo('1404', 25), {
      now: NOW,
      posicion: { lat: -34.603, lon: -58.39 },
    });
    const b = bandaDelPanel({ ...base, seleccionado: v });
    expect(b).toMatchObject({
      message: 'Interno 1404',
      label: 'Actualizado',
      value: 'hace 25 s',
      valueStyle: 'text',
      transitionKey: 'interno-1404',
    });
    expect(b.status).toEqual({ text: 'a 330 m de vos', tone: 'muted' });
    expect(b.accessibilityLabel).toBe(v.hablado);
  });

  it('vehículo elegido sin ubicación: sin estado; con feed viejo, el aviso', () => {
    const v = vistaVehiculo(vehiculo('1404', 25), { now: NOW, posicion: null });
    expect(bandaDelPanel({ ...base, seleccionado: v }).status).toBeUndefined();
    expect(bandaDelPanel({ ...base, seleccionado: v, feedViejo: true }).status?.tone).toBe(
      'warning',
    );
  });
});
