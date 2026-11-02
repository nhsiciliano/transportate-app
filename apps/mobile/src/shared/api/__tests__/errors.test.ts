import { QueryClient } from '@tanstack/react-query';

import { DEFAULT_API_URL, getApiBaseUrl, normalizeBaseUrl } from '../config';
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

  it('toApiError: lo que no es ApiError es un bug nuestro (contract, sin reintento)', () => {
    const error = toApiError(new RangeError('x'), R);
    expect(isApiError(error)).toBe(true);
    expect(error.kind).toBe('contract');
    const original = new NetworkError(R);
    expect(toApiError(original, R)).toBe(original);
  });
});

describe('getApiBaseUrl', () => {
  it('saca espacios y barras finales', () => {
    expect(normalizeBaseUrl(' https://proxy.test/// ')).toBe('https://proxy.test');
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl(undefined)).toBeNull();
    expect(getApiBaseUrl('https://proxy.test/')).toBe('https://proxy.test');
  });

  it('si falta, avisa una sola vez en desarrollo y usa localhost:8787', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(getApiBaseUrl('')).toBe(DEFAULT_API_URL);
    expect(getApiBaseUrl(undefined)).toBe('http://localhost:8787');
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toContain('EXPO_PUBLIC_API_URL');
    error.mockRestore();
  });
});

describe('queryKeys', () => {
  it('jerarquía [dominio, recurso, id]', () => {
    expect(queryKeys.subtes.estado()).toEqual(['subtes', 'estado']);
    expect(queryKeys.colectivos.posiciones('1234')).toEqual(['colectivos', 'posiciones', '1234']);
    expect(queryKeys.subtes.arribos('1001')).toEqual(['subtes', 'arribos', '1001']);
  });

  it('invalidateRealtime deja afuera líneas y manifiesto', async () => {
    const client = new QueryClient();
    for (const key of [
      queryKeys.subtes.estado(),
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
    expect(invalidated.sort()).toEqual(['colectivos/arribos/5678', 'subtes/estado']);
    client.clear();
  });
});
