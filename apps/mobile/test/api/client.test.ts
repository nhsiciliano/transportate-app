// Cliente del proxy con `fetch` mockeado: nunca sale una request real.
import {
  AbortedError,
  ContractError,
  createApiClient,
  HttpError,
  NetworkError,
  TimeoutError,
  type ApiError,
} from '@/shared/api';

import * as fx from './fixtures';

const BASE = 'https://proxy.test';

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit]>;

function setup(
  responder: (url: string, init: RequestInit) => Promise<Response> | Response,
  options: { timeoutMs?: number; etagCacheSize?: number } = {},
) {
  const fetchMock: FetchMock = jest.fn((url: string, init: RequestInit) =>
    Promise.resolve(responder(url, init)),
  );
  const client = createApiClient({
    baseUrl: `${BASE}/`,
    fetch: fetchMock as unknown as typeof fetch,
    now: () => fx.NOW,
    ...options,
  });
  return { client, fetchMock };
}

/** Headers que mandó el cliente en la llamada `n`. */
function sentHeaders(fetchMock: FetchMock, n = 0): Record<string, string> {
  const init = fetchMock.mock.calls[n]?.[1];
  return (init?.headers ?? {}) as Record<string, string>;
}

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('se esperaba un error');
}

describe('createApiClient: rutas y contrato', () => {
  it.each([
    ['estadoSubtes', '/v1/subtes/estado', fx.estado],
    ['alertasSubtes', '/v1/subtes/alertas', fx.alertas],
    ['lineasColectivo', '/v1/colectivos/lineas', fx.lineasColectivo],
  ] as const)('%s → GET %s validado', async (method, path, body) => {
    const { client, fetchMock } = setup(() => fx.jsonResponse(body));
    const result = await client[method]();
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}${path}`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data).toEqual(body.data);
    expect(result.meta).toEqual(body.meta);
    expect(result.fromCache).toBe(false);
  });

  it.each([
    ['arribosEstacion', '1001', '/v1/subtes/estaciones/1001/arribos', fx.arribosEstacion],
    ['posicionesLinea', '1234', '/v1/colectivos/lineas/1234/posiciones', fx.posiciones],
    ['arribosParada', '5678', '/v1/colectivos/paradas/5678/arribos', fx.arribosParada],
  ] as const)('%s(%s) → GET %s', async (method, id, path, body) => {
    const { client, fetchMock } = setup(() => fx.jsonResponse(body));
    const result = await client[method](id);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}${path}`);
    expect(result.data).toEqual(body.data);
  });

  it('codifica los ids en la URL', async () => {
    const { client, fetchMock } = setup(() => fx.jsonResponse(fx.arribosParada));
    await client.arribosParada('a/b c');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/v1/colectivos/paradas/a%2Fb%20c/arribos`);
  });

  it('manifiesto, health y archivo estático validados con su esquema', async () => {
    const { client, fetchMock } = setup((url) => {
      if (url.endsWith('/manifest')) return fx.jsonResponse(fx.manifest);
      if (url.endsWith('/health')) return fx.jsonResponse(fx.health);
      return fx.jsonResponse(fx.subteEstaciones);
    });
    expect((await client.manifest()).data.version).toBe('abc123');
    expect((await client.health()).data.ok).toBe(true);
    const archivo = await client.staticFile('abc123', 'subte-estaciones.json');
    expect(archivo.data.estaciones[0]?.nombre).toBe('Plaza de Mayo');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`${BASE}/v1/static/abc123/subte-estaciones.json`);
  });

  it('frescura lista para FreshnessLabel: sourceTimestamp y edad al recibir', async () => {
    const { client } = setup(() => fx.jsonResponse(fx.estado));
    const result = await client.estadoSubtes();
    expect(result.sourceTimestamp).toBe(fx.SOURCE_TS);
    expect(result.ageSeconds).toBe(12); // NOW − SOURCE_TS, no meta.ageSeconds (10)
    expect(result.receivedAt).toBe(fx.NOW);
  });

  it('sin sourceTimestamp usa meta.ageSeconds', async () => {
    const { client } = setup(() => fx.jsonResponse(fx.lineasColectivo));
    const result = await client.lineasColectivo();
    expect(result.sourceTimestamp).toBeNull();
    expect(result.ageSeconds).toBeNull();
  });
});

describe('privacidad', () => {
  it('solo manda Accept: sin User-Agent ni headers identificatorios', async () => {
    const { client, fetchMock } = setup(() => fx.jsonResponse(fx.estado));
    await client.estadoSubtes();
    expect(sentHeaders(fetchMock)).toEqual({ Accept: 'application/json' });
  });

  it('los mensajes de error no llevan host, ids ni cuerpo crudo', async () => {
    const { client } = setup(() => fx.jsonResponse({ secreto: 'cuerpo crudo' }, { status: 500 }));
    const error = await caught(client.arribosParada('5678'));
    expect(error.message).not.toContain('proxy.test');
    expect(error.message).not.toContain('5678');
    expect(error.message).not.toContain('cuerpo crudo');
    expect(error.route).toBe('/v1/colectivos/paradas/:paradaId/arribos');
  });
});

describe('ETag / 304', () => {
  it('manda If-None-Match y con 304 devuelve el cuerpo guardado (fromCache)', async () => {
    const etag = 'W/"abc"';
    let n = 0;
    const { client, fetchMock } = setup(() =>
      n++ === 0 ? fx.jsonResponse(fx.estado, { headers: { ETag: etag } }) : fx.notModified(etag),
    );
    const first = await client.estadoSubtes();
    expect(first.fromCache).toBe(false);
    expect(sentHeaders(fetchMock, 0)['If-None-Match']).toBeUndefined();

    const second = await client.estadoSubtes();
    expect(sentHeaders(fetchMock, 1)['If-None-Match']).toBe(etag);
    expect(second.fromCache).toBe(true);
    expect(second.data).toEqual(first.data);
  });

  it('la caché de ETags está acotada (LRU)', async () => {
    const { client, fetchMock } = setup(
      (url) =>
        fx.jsonResponse(url.includes('alertas') ? fx.alertas : fx.estado, {
          headers: { ETag: `W/"${url}"` },
        }),
      { etagCacheSize: 1 },
    );
    await client.estadoSubtes();
    await client.alertasSubtes(); // desaloja estado
    await client.estadoSubtes();
    expect(sentHeaders(fetchMock, 2)['If-None-Match']).toBeUndefined();
  });

  it('sin ETag no guarda nada', async () => {
    const { client, fetchMock } = setup(() => fx.jsonResponse(fx.estado));
    await client.estadoSubtes();
    await client.estadoSubtes();
    expect(sentHeaders(fetchMock, 1)['If-None-Match']).toBeUndefined();
  });
});

describe('stale', () => {
  it('X-Transportate-Stale: 1 marca el resultado', async () => {
    const { client } = setup(() =>
      fx.jsonResponse(fx.estado, { headers: { 'X-Transportate-Stale': '1' } }),
    );
    expect((await client.estadoSubtes()).stale).toBe(true);
  });

  it('meta.stale también', async () => {
    const { client } = setup(() => fx.jsonResponse(fx.arribosEstacion));
    expect((await client.arribosEstacion('1001')).stale).toBe(true);
  });

  it('sin ninguno de los dos, no es stale', async () => {
    const { client } = setup(() => fx.jsonResponse(fx.estado));
    expect((await client.estadoSubtes()).stale).toBe(false);
  });
});

describe('errores', () => {
  it('503 con Retry-After: HttpError retryable con code y retryAfterSeconds', async () => {
    const { client } = setup(() =>
      fx.jsonResponse(fx.errorBody('upstream_unavailable'), {
        status: 503,
        headers: { 'Retry-After': '30' },
      }),
    );
    const error = await caught(client.estadoSubtes());
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      kind: 'http',
      status: 503,
      code: 'upstream_unavailable',
      retryAfterSeconds: 30,
      retryable: true,
    });
    expect(error.userMessage().title).toBe('Servicio no disponible');
  });

  it('retryAfterSeconds del cuerpo ErrorV1 gana sobre el header', async () => {
    const { client } = setup(() =>
      fx.jsonResponse(fx.errorBody('rate_limited', 60), {
        status: 429,
        headers: { 'Retry-After': '5' },
      }),
    );
    expect(await caught(client.estadoSubtes())).toMatchObject({
      status: 429,
      code: 'rate_limited',
      retryAfterSeconds: 60,
      retryable: true,
    });
  });

  it.each([
    [400, 'bad_request', 'Algo falló de nuestro lado.'],
    [404, 'not_found', 'Esta información no está disponible por ahora.'],
  ] as const)('%i no se reintenta', async (status, code, title) => {
    const { client } = setup(() => fx.jsonResponse(fx.errorBody(code), { status }));
    const error = await caught(client.arribosParada('5678'));
    expect(error).toMatchObject({ kind: 'http', status, code, retryable: false });
    expect(error.userMessage().title).toBe(title);
  });

  it('cuerpo de error que no es ErrorV1: code null', async () => {
    const { client } = setup(() => new Response('<html>', { status: 502 }));
    expect(await caught(client.estadoSubtes())).toMatchObject({
      status: 502,
      code: null,
      retryable: true,
    });
  });

  it('JSON inválido → ContractError (no se reintenta)', async () => {
    const { client } = setup(() => new Response('{no es json', { status: 200 }));
    const error = await caught(client.estadoSubtes());
    expect(error).toBeInstanceOf(ContractError);
    expect(error).toMatchObject({ kind: 'contract', retryable: false });
    expect(error.userMessage().title).toBe('Algo falló de nuestro lado.');
  });

  it('JSON que no cumple el esquema → ContractError con las rutas de los campos', async () => {
    const roto = { ...fx.estado, data: { lineas: [{ linea: 'Z' }] } };
    const { client } = setup(() => fx.jsonResponse(roto));
    const error = await caught(client.estadoSubtes());
    expect(error).toBeInstanceOf(ContractError);
    if (error instanceof ContractError) {
      expect(error.issues).toContain('data.lineas.0.linea');
    }
  });

  it('error de red → NetworkError retryable', async () => {
    const { client } = setup(() => Promise.reject(new TypeError('Network request failed')));
    const error = await caught(client.estadoSubtes());
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.retryable).toBe(true);
  });

  describe('timeout y cancelación', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    /** fetch que nunca responde y rechaza al abortarse, como el real. */
    const hanging = (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

    it('a los 8 s por defecto → TimeoutError retryable', async () => {
      const { client } = setup(hanging);
      const pending = caught(client.estadoSubtes());
      jest.advanceTimersByTime(7999);
      await Promise.resolve();
      jest.advanceTimersByTime(1);
      const error = await pending;
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error).toMatchObject({ kind: 'timeout', retryable: true, timeoutMs: 8000 });
      expect(error.userMessage().title).toBe('Servicio no disponible');
    });

    it('el timeout es configurable', async () => {
      const { client } = setup(hanging, { timeoutMs: 1000 });
      const pending = caught(client.estadoSubtes());
      jest.advanceTimersByTime(1000);
      expect(await pending).toMatchObject({ kind: 'timeout', timeoutMs: 1000 });
    });

    it('cancelada desde afuera → AbortedError (no se reintenta)', async () => {
      const { client } = setup(hanging);
      const controller = new AbortController();
      const pending = caught(client.estadoSubtes({ signal: controller.signal }));
      controller.abort();
      const error = await pending;
      expect(error).toBeInstanceOf(AbortedError);
      expect(error.retryable).toBe(false);
    });
  });
});
