import { QueryClient } from '@tanstack/react-query';

import {
  AbortedError,
  ContractError,
  HttpError,
  isApiError,
  NetworkError,
  TimeoutError,
  toApiError,
} from '../errors';
import { invalidateRealtime, queryKeys } from '../keys';

const R = '/v1/subtes/estado';

describe('userMessage (voseo, docs/briefs/README.md "ErrorState")', () => {
  it.each([
    ['503', new HttpError(R, 503, 'upstream_unavailable', null), 'Servicio no disponible', true],
    ['timeout', new TimeoutError(R, 8000), 'Servicio no disponible', true],
    ['429', new HttpError(R, 429, 'rate_limited', 60), 'Servicio no disponible', true],
    [
      '404',
      new HttpError(R, 404, 'not_found', null),
      'Esta información no está disponible por ahora.',
      false,
    ],
    ['400', new HttpError(R, 400, 'bad_request', null), 'Algo falló de nuestro lado.', false],
    ['500', new HttpError(R, 500, 'internal', null), 'Algo falló de nuestro lado.', true],
    ['contrato', new ContractError(R, ['data']), 'Algo falló de nuestro lado.', false],
    ['red', new NetworkError(R), 'No pudimos conectarnos', true],
    ['cancelada', new AbortedError(R), 'Se canceló la consulta.', false],
  ] as const)('%s', (_n, error, title, retryable) => {
    expect(error.userMessage().title).toBe(title);
    expect(error.retryable).toBe(retryable);
  });

  it('el 503 explica la causa sin culpar a la persona', () => {
    expect(new HttpError(R, 503, 'upstream_unavailable', null).userMessage().cause).toBe(
      'El servicio de la Ciudad no responde en este momento.',
    );
  });

  it('en trenes, timeout y 5xx nombran al servicio de trenes (la fuente no es de la Ciudad)', () => {
    const T = '/v1/trenes/estaciones/:estacionId/arribos';
    const trenes = 'El servicio de trenes no responde en este momento.';
    expect(new HttpError(T, 503, 'upstream_unavailable', null).userMessage()).toEqual({
      title: 'Servicio no disponible',
      cause: trenes,
    });
    expect(new HttpError('/v1/trenes/estado', 502, null, null).userMessage().cause).toBe(trenes);
    expect(new TimeoutError('/v1/trenes/alertas', 8000).userMessage().cause).toBe(trenes);
    // Lo que no es del upstream sigue igual.
    expect(new HttpError(T, 500, 'internal', null).userMessage().title).toBe(
      'Algo falló de nuestro lado.',
    );
    expect(new NetworkError(T).userMessage().title).toBe('No pudimos conectarnos');
  });

  it('toApiError: lo que no es ApiError es un bug nuestro (contract, sin reintento)', () => {
    const error = toApiError(new RangeError('x'), R);
    expect(isApiError(error)).toBe(true);
    expect(error.kind).toBe('contract');
    const original = new NetworkError(R);
    expect(toApiError(original, R)).toBe(original);
  });
});

describe('queryKeys', () => {
  it('jerarquía [dominio, recurso, id]', () => {
    expect(queryKeys.subtes.estado()).toEqual(['subtes', 'estado']);
    expect(queryKeys.colectivos.posiciones('1234')).toEqual(['colectivos', 'posiciones', '1234']);
    expect(queryKeys.subtes.arribos('1001')).toEqual(['subtes', 'arribos', '1001']);
    expect(queryKeys.trenes.arribos('50')).toEqual(['trenes', 'arribos', '50']);
    expect(queryKeys.trenes.estado()).toEqual(['trenes', 'estado']);
  });

  it('invalidateRealtime deja afuera líneas y manifiesto', async () => {
    const client = new QueryClient();
    for (const key of [
      queryKeys.subtes.estado(),
      queryKeys.trenes.arribos('50'),
      queryKeys.colectivos.arribos('5678'),
      queryKeys.colectivos.lineas(),
      queryKeys.static.manifest(),
    ]) {
      client.setQueryData(key, 1);
    }
    await invalidateRealtime(client);
    const invalidated = client
      .getQueryCache()
      .getAll()
      .filter((q) => q.state.isInvalidated)
      .map((q) => q.queryKey.join('/'));
    expect(invalidated.sort()).toEqual([
      'colectivos/arribos/5678',
      'subtes/estado',
      'trenes/arribos/50',
    ]);
    client.clear();
  });
});
