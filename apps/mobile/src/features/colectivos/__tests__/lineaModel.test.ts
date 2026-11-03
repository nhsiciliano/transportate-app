import type { VehiculoV1 } from '@transportate/contracts';

import {
  edadVehiculo,
  enServicio,
  formatDistancia,
  ordenarVehiculos,
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

  it('ordena por más reciente y después por interno', () => {
    const vistas = [
      vistaVehiculo(vehiculo('b', 30), { now: NOW, posicion: null }),
      vistaVehiculo(vehiculo('a', 30), { now: NOW, posicion: null }),
      vistaVehiculo(vehiculo('c', 5), { now: NOW, posicion: null }),
    ];
    expect(ordenarVehiculos(vistas).map((v) => v.id)).toEqual(['c', 'a', 'b']);
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
});
