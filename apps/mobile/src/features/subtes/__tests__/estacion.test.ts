import { despues } from '../EstacionScreen';

describe('despues', () => {
  it('une los siguientes arribos en una frase corta', () => {
    expect(despues([])).toBe('Único informado');
    expect(despues([{ short: '7 min' }])).toBe('Después 7 min');
    expect(despues([{ short: '7 min' }, { short: '12 min' }])).toBe('Después 7 y 12 min');
    expect(despues([{ short: 'Llegando' }, { short: '7 min' }])).toBe('Después Llegando y 7 min');
  });
});
