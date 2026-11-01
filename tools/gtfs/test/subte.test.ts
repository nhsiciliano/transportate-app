import { describe, expect, it } from 'vitest';
import { SubteEstacionSchema, SubteLineaSchema } from '../src/schemas.js';
import { addTildes, buildSubte, mergeSequences, type SubteInput } from '../src/steps/subte.js';

describe('mergeSequences', () => {
  it('une los dos sentidos cuando cada uno saltea una estación distinta (caso Alberti/Pasco, línea A)', () => {
    const ida = ['1059', '1068', '1069', '1071']; // sin Pasco (1070)
    const vuelta = ['1071', '1070', '1068', '1059'].reverse(); // sin Alberti (1069)
    // Longitudes aproximadas sobre Rivadavia: Miserere -58,4065, Alberti -58,4007, Pasco -58,3984, Congreso -58,3926
    const lon: Record<string, number> = {
      '1059': -58.47,
      '1068': -58.4065,
      '1069': -58.4007,
      '1070': -58.3984,
      '1071': -58.3926,
    };
    const coord = (id: string) =>
      lon[id] === undefined ? undefined : { lat: -34.61, lon: lon[id] };
    expect(mergeSequences(ida, vuelta, coord)).toEqual(['1059', '1068', '1069', '1070', '1071']);
  });
  it('sin coordenadas inserta después del anterior conocido', () => {
    expect(mergeSequences(['a', 'c'], ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
  it('agrega al principio lo que no tiene anterior', () => {
    expect(mergeSequences(['b', 'c'], ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});

describe('addTildes', () => {
  it.each([
    ['San Jose de Flores', 'San José de Flores'],
    ['Constitucion', 'Constitución'],
    ['Jose Maria Moreno', 'José María Moreno'],
    ['Ntra. Sra. de Fatima', 'Ntra. Sra. de Fátima'],
    ['Plaza Miserere', 'Plaza Miserere'],
  ])('%s → %s', (input, expected) => {
    expect(addTildes(input)).toBe(expected);
  });
});

describe('buildSubte', () => {
  const input: SubteInput = {
    routes: [
      {
        route_id: 'LineaA',
        route_short_name: 'A',
        route_long_name: 'Plaza de Mayo - San Pedrito',
        route_type: '1',
        route_color: 'A5C8FF',
        route_text_color: '000000',
      },
    ],
    stops: [
      {
        stop_id: '1059',
        stop_name: 'San Pedrito',
        stop_lat: '-34.6309',
        stop_lon: '-58.4704',
        location_type: '1',
        parent_station: '',
        wheelchair_boarding: '1',
      },
      {
        stop_id: '1060',
        stop_name: 'San Jose de Flores',
        stop_lat: '-34.6290',
        stop_lon: '-58.4635',
        location_type: '1',
        parent_station: '',
        wheelchair_boarding: '',
      },
      {
        stop_id: '1061',
        stop_name: 'Carabobo',
        stop_lat: '-34.6265',
        stop_lon: '-58.4567',
        location_type: '1',
        parent_station: '',
        wheelchair_boarding: '2',
      },
      { stop_id: '1059N', location_type: '0', parent_station: '1059' },
      { stop_id: '1060N', location_type: '0', parent_station: '1060' },
      { stop_id: '1060S', location_type: '0', parent_station: '1060' },
      { stop_id: '1061S', location_type: '0', parent_station: '1061' },
      { stop_id: '10611', location_type: '2', parent_station: '1061' },
    ],
    trips: [
      {
        route_id: 'LineaA',
        trip_id: 'A1',
        direction_id: '0',
        trip_headsign: 'San Pedrito',
        shape_id: 'A0',
      },
      {
        route_id: 'LineaA',
        trip_id: 'A2',
        direction_id: '1',
        trip_headsign: 'Plaza de Mayo',
        shape_id: 'A1',
      },
    ],
    stopTimes: [
      { trip_id: 'A1', stop_id: '1061S', stop_sequence: '1' },
      { trip_id: 'A1', stop_id: '1060S', stop_sequence: '2' },
      { trip_id: 'A2', stop_id: '1059N', stop_sequence: '1' },
      { trip_id: 'A2', stop_id: '1060N', stop_sequence: '2' },
    ],
    shapes: [
      {
        shape_id: 'A0',
        shape_pt_lat: '-34.6265',
        shape_pt_lon: '-58.4567',
        shape_pt_sequence: '2',
      },
      {
        shape_id: 'A0',
        shape_pt_lat: '-34.6309',
        shape_pt_lon: '-58.4704',
        shape_pt_sequence: '1',
      },
    ],
    feedInfo: [{ feed_end_date: '20261231' }],
  };

  it('arma líneas con colores de docs/02b, orden por sentido y estaciones con tildes', () => {
    const { lineas, estaciones, red, stats } = buildSubte(input);
    const a = lineas[0];
    expect(a && SubteLineaSchema.parse(a)).toEqual(a);
    expect(a).toMatchObject({ id: 'A', tipo: 'subte', color: '#A5C8FF', colorTexto: '#000000' });
    expect(a?.sentidos.map((s) => s.estaciones)).toEqual([
      ['1061', '1060'],
      ['1059', '1060'],
    ]);
    expect(a?.estaciones).toEqual(['1061', '1060', '1059']);
    expect(estaciones.map((e) => SubteEstacionSchema.parse(e).nombre)).toEqual([
      'San Pedrito',
      'San José de Flores',
      'Carabobo',
    ]);
    expect(estaciones.find((e) => e.id === '1060')).toMatchObject({
      andenes: ['1060N', '1060S'],
      accesible: null,
    });
    expect(estaciones.find((e) => e.id === '1061')?.andenes).toEqual(['1061S']); // sin accesos (location_type 2)
    expect(red.features[0]?.geometry.coordinates[0]).toEqual([-58.4704, -34.6309]); // ordenado por secuencia
    expect(stats.coloresDistintosDelGtfs).toEqual([]);
    expect(stats.feedEndDate).toBe('20261231');
  });

  it('avisa si el GTFS cambia un color respecto de la tabla oficial', () => {
    const changed = { ...input, routes: [{ ...input.routes[0], route_color: '00FFFF' }] };
    expect(buildSubte(changed).stats.coloresDistintosDelGtfs).toHaveLength(1);
  });
});
