import {
  AlertasTrenResponseV1,
  ArribosEstacionTrenResponseV1,
  EstadoLineasTrenResponseV1,
} from '@transportate/contracts';
import { describe, expect, it } from 'vitest';
import gerenciasFixture from '../fixtures/sofse/gerencias.json';
import ramales11 from '../fixtures/sofse/ramales.11.json';
import ramales1 from '../fixtures/sofse/ramales.1.json';
import ramales5 from '../fixtures/sofse/ramales.5.json';
import ramales31 from '../fixtures/sofse/ramales.31.json';
import ramales21 from '../fixtures/sofse/ramales.21.json';
import ramales41 from '../fixtures/sofse/ramales.41.json';
import arribos332 from '../fixtures/sofse/arribos.332.json';
import arribos50 from '../fixtures/sofse/arribos.50.json';
import arribosInexistente from '../fixtures/sofse/arribos.inexistente.json';
import { createTrenesAdapter, MENSAJE_APAGADO, settledConLimite } from '../../src/adapters/trenes';
import { lineaDeGerencia, LINEAS_TREN } from '../../src/adapters/trenes/lineas';
import {
  alertaVigente,
  nombreEfecto,
  severidadAlerta,
  severidadEstadoSofse,
  tituloDe,
} from '../../src/adapters/trenes/reglas';
import { parseFechaSofse, parseIsoArribo, urls } from '../../src/adapters/trenes/sofse';
import { ApiError } from '../../src/adapters/types';
import type { DeadlineFeedSource, FetchOptions } from '../../src/sources/edge-cached';
import type { FeedRequest, FeedResult } from '../../src/sources/types';
import { upstreamUrl } from '../../src/sources/upstream';

const BASE = 'https://ariedro.dev/api-trenes';
/** Hora de la captura de gerencias y ramales (2026-11-05 08:56 de Buenos Aires). */
const CAPTURA_MS = Date.parse('2026-11-05T11:56:30Z');

function encode(v: unknown): ArrayBuffer {
  const bytes = new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v));
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

const clone = <T>(v: T): T => structuredClone(v);

/** Fuente falsa por `req.key`: `undefined` en el mapa = la fuente está caída para esa clave. */
function fakeSource(
  bodies: Record<string, unknown>,
  opts: { stale?: boolean } = {},
): DeadlineFeedSource & { calls: FeedRequest[]; opts: (FetchOptions | undefined)[] } {
  const calls: FeedRequest[] = [];
  const optsLlamadas: (FetchOptions | undefined)[] = [];
  return {
    calls,
    opts: optsLlamadas,
    fetch(req: FeedRequest, o?: FetchOptions): Promise<FeedResult> {
      calls.push(req);
      optsLlamadas.push(o);
      const body = bodies[req.key];
      if (body === undefined) {
        return Promise.reject(
          new ApiError('upstream_unavailable', 'Servicio de trenes no disponible', 503, 60),
        );
      }
      return Promise.resolve({
        body: encode(body),
        fetchedAt: CAPTURA_MS - 10_000,
        fromCache: false,
        stale: opts.stale ?? false,
        upstreamStatus: 200,
      });
    },
  };
}

const red = (): Record<string, unknown> => ({
  'trenes:gerencias': gerenciasFixture,
  'trenes:ramales:11': ramales11,
  'trenes:ramales:1': ramales1,
  'trenes:ramales:5': ramales5,
  'trenes:ramales:31': ramales31,
  'trenes:ramales:21': ramales21,
  'trenes:ramales:41': ramales41,
  'trenes:arribos:332': arribos332,
  'trenes:arribos:50': arribos50,
  'trenes:arribos:999999': arribosInexistente,
});

function adapter(
  nowMs: number,
  bodies: Record<string, unknown> = red(),
  extra: { enabled?: boolean; stale?: boolean } = {},
) {
  const source = fakeSource(bodies, { stale: extra.stale ?? false });
  const trenes = createTrenesAdapter({
    source,
    baseUrl: BASE,
    enabled: extra.enabled ?? true,
    ttlSeconds: 30,
    ttlEstadoSeconds: 60,
    now: () => nowMs,
  });
  return { source, trenes };
}

const ORDEN = ['roca', 'sarmiento', 'mitre', 'san-martin', 'belgrano-sur', 'tren-de-la-costa'];

describe('TrenesAdapter.estadoLineas (fixture real 2026-11-05 08:56)', () => {
  it('las 6 líneas en orden fijo, con el estado de sus alertas y ramales', async () => {
    const { trenes } = adapter(CAPTURA_MS);
    const res = await trenes.estadoLineas();
    expect(EstadoLineasTrenResponseV1.parse(res)).toEqual(res);
    expect(res.data.lineas.map((l) => l.linea)).toEqual(ORDEN);
    expect(Object.fromEntries(res.data.lineas.map((l) => [l.linea, l.estado]))).toEqual({
      roca: 'interrumpida', // ramal Cañuelas-Lobos «interrumpido por obras»
      sarmiento: 'demorada', // Moreno-Mercedes con SIGNIFICANT_DELAYS
      mitre: 'normal',
      'san-martin': 'normal',
      'belgrano-sur': 'demorada', // «recorrido limitado» en M.C.G. Belgrano
      'tren-de-la-costa': 'normal',
    });
    expect(res.meta).toMatchObject({ stale: false, ttlSeconds: 60 });
    expect(res.meta.sourceTimestamp).toBe(new Date(CAPTURA_MS - 10_000).toISOString());
  });

  it('Sarmiento: resumen y orden de alertas por severidad y criticidad; ramales públicos', async () => {
    const { trenes } = adapter(CAPTURA_MS);
    const res = await trenes.estadoLineas();
    const sarmiento = res.data.lineas.find((l) => l.linea === 'sarmiento');
    // 99285 (criticidad 2) antes que 99284 (criticidad 3): ambas demoras.
    expect(sarmiento?.alertaIds.slice(0, 2)).toEqual(['99285', '99284']);
    expect(sarmiento?.resumen).toBe(
      'El tren de las 08:42 hs. partiendo desde Moreno hacia Luján ha sido cancelado por problemas técnicos en Moreno.',
    );
    expect(sarmiento?.ramales.map((r) => [r.ramalId, r.nombre, r.estado])).toEqual([
      ['1', 'Once-Moreno', 'normal'],
      ['51', 'Moreno-Mercedes', 'demorada'],
      ['53', 'Merlo-Lobos', 'normal'],
      ['111', 'Once-Bragado', 'normal'],
    ]);
    const mercedes = sarmiento?.ramales.find((r) => r.ramalId === '51');
    // Las del ramal primero; después la de la línea (CUD), que pesa sobre todos.
    expect(mercedes?.alertaIds).toEqual(['99285', '99284', '98462']);
  });

  it('Roca: 12 ramales públicos y solo Cañuelas-Lobos interrumpido', async () => {
    const { trenes } = adapter(CAPTURA_MS);
    const roca = (await trenes.estadoLineas()).data.lineas[0];
    expect(roca?.ramales).toHaveLength(12);
    expect(roca?.resumen).toBe(
      'El servicio Cañuelas - Lobos se encuentra interrumpido por obras de renovación de vías.',
    );
    const noNormales = roca?.ramales.filter((r) => r.estado !== 'normal').map((r) => r.ramalId);
    expect(noNormales).toEqual(['55']);
  });

  it('sin alertas que cambien el estado, la línea es normal y el resumen es la informativa', async () => {
    const { trenes } = adapter(CAPTURA_MS);
    const mitre = (await trenes.estadoLineas()).data.lineas.find((l) => l.linea === 'mitre');
    expect(mitre).toMatchObject({ estado: 'normal', alertaIds: ['98355'] });
    expect(mitre?.resumen).toBe('Las personas con CUD pueden viajar en tren sin costo con SUBE.');
  });

  it('un ramal con alerta de demora pone la línea en demorada', async () => {
    const bodies = red();
    const mitre = clone(ramales5);
    const tigre = mitre.find((r) => r.id === 5);
    if (!tigre) throw new Error('falta Retiro-Tigre');
    (tigre as unknown as { alerta: unknown[] }).alerta = [
      {
        id: 1,
        linea_id: 5,
        ramal_id: 5,
        estacion_id: null,
        sentido: null,
        causa_gtfs: 'TECHNICAL_PROBLEM',
        efecto_gtfs: 'REDUCED_SERVICE',
        contenido: 'Servicio con frecuencia reducida entre Retiro y Tigre.',
        habilitado: 1,
        vigencia_desde: '2026-11-05 08:00:00',
        vigencia_hasta: null,
        criticidad_orden: 3,
      },
    ];
    bodies['trenes:ramales:5'] = mitre;
    const { trenes } = adapter(CAPTURA_MS, bodies);
    const res = (await trenes.estadoLineas()).data.lineas.find((l) => l.linea === 'mitre');
    expect(res?.estado).toBe('demorada');
    expect(res?.resumen).toBe('Servicio con frecuencia reducida entre Retiro y Tigre.');
    expect(res?.ramales.find((r) => r.ramalId === '5')?.estado).toBe('demorada');
    expect(res?.ramales.find((r) => r.ramalId === '9')?.estado).toBe('normal');
  });

  it('estado.mensaje no genérico de la gerencia cuenta y va de resumen', async () => {
    const bodies = red();
    const g = clone(gerenciasFixture);
    const costa = g.find((x) => x.id === 41);
    if (!costa) throw new Error('falta la Costa');
    costa.estado.mensaje = 'Servicio interrumpido por manifestación';
    bodies['trenes:gerencias'] = g;
    const { trenes } = adapter(CAPTURA_MS, bodies);
    const res = (await trenes.estadoLineas()).data.lineas.find(
      (l) => l.linea === 'tren-de-la-costa',
    );
    expect(res).toMatchObject({
      estado: 'interrumpida',
      resumen: 'Servicio interrumpido por manifestación',
    });
  });

  it('gerencias caída sin último dato bueno → 6 líneas sin_datos, ramales vacíos y stale', async () => {
    const bodies = red();
    delete bodies['trenes:gerencias'];
    const { trenes } = adapter(CAPTURA_MS, bodies);
    const res = await trenes.estadoLineas();
    expect(EstadoLineasTrenResponseV1.parse(res)).toEqual(res);
    expect(res.data.lineas.map((l) => l.linea)).toEqual(ORDEN);
    expect(res.data.lineas.every((l) => l.estado === 'sin_datos' && l.ramales.length === 0)).toBe(
      true,
    );
    expect(res.data.lineas[0]).toMatchObject({ color: LINEAS_TREN[0]?.color, alertaIds: [] });
    expect(res.meta).toMatchObject({ stale: true, sourceTimestamp: null, ageSeconds: null });
  });

  it('gerencias con cuerpo que no es de la fuente → sin_datos (no 500)', async () => {
    const bodies = red();
    bodies['trenes:gerencias'] = 'Not Found';
    const { trenes } = adapter(CAPTURA_MS, bodies);
    const res = await trenes.estadoLineas();
    expect(new Set(res.data.lineas.map((l) => l.estado))).toEqual(new Set(['sin_datos']));
  });

  it('un ramales caído → esa línea sin ramales, estado solo por sus alertas de línea, stale', async () => {
    const bodies = red();
    delete bodies['trenes:ramales:1'];
    const { trenes } = adapter(CAPTURA_MS, bodies);
    const res = await trenes.estadoLineas();
    const sarmiento = res.data.lineas.find((l) => l.linea === 'sarmiento');
    expect(sarmiento).toMatchObject({ estado: 'normal', ramales: [], alertaIds: ['98462'] });
    expect(res.data.lineas.find((l) => l.linea === 'roca')?.ramales).toHaveLength(12);
    expect(res.meta.stale).toBe(true);
  });

  it('dato servido como último bueno (stale de la fuente) → meta.stale', async () => {
    const { trenes } = adapter(CAPTURA_MS, red(), { stale: true });
    expect((await trenes.estadoLineas()).meta.stale).toBe(true);
  });

  it('fan-out: gerencias + 6 ramales con plazo, sin reintento, claves trenes: y TTL de estado', async () => {
    const { trenes, source } = adapter(CAPTURA_MS);
    await trenes.estadoLineas();
    expect(source.calls.map((c) => c.key)).toEqual([
      'trenes:gerencias',
      'trenes:ramales:11',
      'trenes:ramales:1',
      'trenes:ramales:5',
      'trenes:ramales:31',
      'trenes:ramales:21',
      'trenes:ramales:41',
    ]);
    expect(source.calls.every((c) => c.ttlSeconds === 60)).toBe(true);
    expect(source.opts.every((o) => o?.retry === false && o.signal instanceof AbortSignal)).toBe(
      true,
    );
    expect(source.calls[0]?.url.href).toBe(`${BASE}/infraestructura/gerencias?idEmpresa=1`);
    expect(source.calls[2]?.url.href).toBe(`${BASE}/infraestructura/ramales?idGerencia=1`);
  });

  it('kill-switch: enabled false → sin_datos + stale sin llamar a la fuente', async () => {
    const { trenes, source } = adapter(CAPTURA_MS, red(), { enabled: false });
    const res = await trenes.estadoLineas();
    expect(res.data.lineas.map((l) => [l.linea, l.estado, l.ramales.length])).toEqual(
      ORDEN.map((l) => [l, 'sin_datos', 0]),
    );
    expect(res.meta.stale).toBe(true);
    await expect(trenes.alertas()).rejects.toMatchObject({
      code: 'upstream_unavailable',
      status: 503,
      message: MENSAJE_APAGADO,
    });
    await expect(trenes.arribos('50')).rejects.toMatchObject({ status: 503 });
    expect(source.calls).toHaveLength(0);
  });
});

describe('TrenesAdapter.alertas', () => {
  it('unión de alertas de líneas y ramales, vigentes, deduplicadas y traducidas', async () => {
    const bodies = red();
    // La misma alerta repetida en la gerencia: no se duplica.
    const g = clone(gerenciasFixture);
    const sarmiento = g.find((x) => x.id === 1);
    const delRamal = ramales1.find((r) => r.id === 51)?.alerta?.[0];
    if (!sarmiento || !delRamal) throw new Error('fixture inesperada');
    (sarmiento.alerta as unknown[]).push(delRamal);
    bodies['trenes:gerencias'] = g;
    const { trenes } = adapter(CAPTURA_MS, bodies);
    const res = await trenes.alertas();
    expect(AlertasTrenResponseV1.parse(res)).toEqual(res);
    const ids = res.data.alertas.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(17);
    expect(res.data.alertas[0]?.linea).toBe('roca');
    const demora = res.data.alertas.find((a) => a.id === '99284');
    expect(demora).toEqual({
      id: '99284',
      linea: 'sarmiento',
      ramalId: '51',
      sentido: '2',
      titulo:
        'El tren de las 08:11hs. de Fco. Álvarez hacia Moreno se encuentra demorado por problemas técnicos en Fco. Álvarez.',
      descripcion:
        'El tren de las 08:11hs. de Fco. Álvarez hacia Moreno se encuentra demorado por problemas técnicos en Fco. Álvarez. Disculpá las molestias ocasionadas.',
      causa: 'TECHNICAL_PROBLEM',
      efecto: 'SIGNIFICANT_DELAYS',
      desde: '2026-11-05T11:32:00.000Z', // 08:32 de Buenos Aires
    });
    expect(res.data.alertas.find((a) => a.id === '99285')?.hasta).toBe('2026-11-05T12:36:00.000Z');
  });

  it('con now inyectado: las vencidas y las futuras no cuentan', async () => {
    // 2026-11-05 10:00 de Buenos Aires: 99285 venció a las 09:36.
    const despues = Date.parse('2026-11-05T13:00:00Z');
    const { trenes } = adapter(despues);
    const ids = (await trenes.alertas()).data.alertas.map((a) => a.id);
    expect(ids).not.toContain('99285');
    expect(ids).toContain('99284');
    // 2026-11-05 08:00 de Buenos Aires: 99284 (desde 08:32) todavía no empezó.
    const antes = Date.parse('2026-11-05T11:00:00Z');
    const temprano = (await adapter(antes).trenes.alertas()).data.alertas.map((a) => a.id);
    expect(temprano).not.toContain('99284');
    expect(temprano).not.toContain('99285');
    // Y entonces el Sarmiento queda normal.
    const estado = await adapter(antes).trenes.estadoLineas();
    expect(estado.data.lineas.find((l) => l.linea === 'sarmiento')?.estado).toBe('normal');
  });

  it('descarta las alertas de gerencias que no mapean (Regionales)', async () => {
    const bodies = red();
    const g = clone(gerenciasFixture);
    const regionales = g.find((x) => x.id === 501);
    if (!regionales) throw new Error('falta Regionales');
    (regionales as { alerta: unknown[] }).alerta = [
      { id: 7, linea_id: 501, contenido: 'Servicio suspendido', habilitado: 1 },
    ];
    bodies['trenes:gerencias'] = g;
    const ids = (await adapter(CAPTURA_MS, bodies).trenes.alertas()).data.alertas.map((a) => a.id);
    expect(ids).not.toContain('7');
  });

  it('gerencias caída → 503 upstream_unavailable', async () => {
    const bodies = red();
    delete bodies['trenes:gerencias'];
    await expect(adapter(CAPTURA_MS, bodies).trenes.alertas()).rejects.toMatchObject({
      code: 'upstream_unavailable',
      status: 503,
    });
  });

  it('un ramales caído → las alertas de los demás y stale', async () => {
    const bodies = red();
    delete bodies['trenes:ramales:1'];
    const res = await adapter(CAPTURA_MS, bodies).trenes.alertas();
    expect(res.meta.stale).toBe(true);
    expect(res.data.alertas.map((a) => a.id)).not.toContain('99284');
    expect(res.data.alertas.map((a) => a.id)).toContain('97636');
  });
});

describe('TrenesAdapter.arribos', () => {
  const TS_50 = arribos50.timestamp * 1000;
  const TS_332 = arribos332.timestamp * 1000;

  it('Caballito: ordenados, destino por sentido, andén, estimada y programada', async () => {
    const { trenes, source } = adapter(TS_50);
    const res = await trenes.arribos('50');
    expect(ArribosEstacionTrenResponseV1.parse(res)).toEqual(res);
    expect(source.calls[0]).toMatchObject({ key: 'trenes:arribos:50', ttlSeconds: 30 });
    expect(source.calls[0]?.url.href).toBe(`${BASE}/arribos/estacion/50?cantidad=8`);
    const { arribos } = res.data;
    expect(arribos).toHaveLength(8);
    const enS = arribos.map((a) => a.enSegundos);
    expect(enS).toEqual([...enS].sort((a, b) => a - b));
    expect(arribos[0]).toEqual({
      estacionId: '50',
      linea: 'sarmiento',
      ramalId: '1',
      ramal: 'Once-Moreno',
      destino: 'Once', // sentido 2 → cabecera inicial
      sentido: '2',
      enSegundos: 240, // = arribo.segundos de la fuente
      horaProgramada: '2026-11-05T12:00:15.000Z',
      horaEstimada: '2026-11-05T12:01:12.000Z',
      anden: '2',
      cancelado: false,
      servicioId: '41167f5a-f7fd-4e06-ab9e-7ff18cb1f835',
    });
    expect(arribos[1]).toMatchObject({ sentido: '1', destino: 'Moreno', anden: '1' });
    // Sin estimada: cuenta la programada y no hay horaEstimada.
    const soloProgramada = arribos.find(
      (a) => a.servicioId === 'a52d8352-d9d5-480e-8bd0-45e61638d095',
    );
    expect(soloProgramada).toMatchObject({ enSegundos: 963 });
    expect(soloProgramada?.horaEstimada).toBeUndefined();
    expect(res.meta).toMatchObject({
      sourceTimestamp: new Date(TS_50).toISOString(),
      stale: false,
    });
  });

  it('Retiro (terminal): usa la salida programada y omite el andén si falta', async () => {
    const res = await adapter(TS_332).trenes.arribos('332');
    const { arribos } = res.data;
    expect(arribos[0]).toMatchObject({
      linea: 'mitre',
      ramal: 'Retiro-Tigre',
      destino: 'Tigre',
      enSegundos: 770,
      horaProgramada: '2026-11-05T12:10:00.000Z',
      anden: '2',
    });
    expect(arribos.filter((a) => a.anden === undefined)).toHaveLength(2);
    // Lo que sale hacia la app pesa mucho menos que la fuente (65 KB).
    expect(JSON.stringify(res).length).toBeLessThan(3_000);
  });

  it('cancelados, pasados (< −30 s) y gerencias que no mapean', async () => {
    const bodies = red();
    const a = clone(arribos50);
    const [r0, r1, r2] = a.results;
    if (!r0 || !r1 || !r2) throw new Error('fixture inesperada');
    (r0.servicio as { cancelacion: unknown }).cancelacion = { motivo: 'x' };
    r1.servicio.gerencia.id = 501;
    bodies['trenes:arribos:50'] = a;
    // 1 min después de la captura: el cancelado (240 s) queda a 180 s y se informa.
    const res = await adapter(TS_50 + 60_000, bodies).trenes.arribos('50');
    const ids = res.data.arribos.map((x) => x.servicioId);
    expect(ids).not.toContain(r1.servicio.id);
    expect(res.data.arribos.find((x) => x.servicioId === r0.servicio.id)).toMatchObject({
      cancelado: true,
      enSegundos: 180,
    });
    expect(res.data.arribos.filter((x) => x.cancelado)).toHaveLength(1);
    // 5 min después: el de 240 s está a −60 s y se descarta; el siguiente válido es el de 792 s.
    const tarde = await adapter(TS_50 + 300_000, bodies).trenes.arribos('50');
    const tardeIds = tarde.data.arribos.map((x) => x.servicioId);
    expect(tardeIds).not.toContain(r0.servicio.id);
    expect(tarde.data.arribos.every((x) => x.enSegundos >= -30)).toBe(true);
    expect(tarde.data.arribos[0]).toMatchObject({ servicioId: r2.servicio.id, enSegundos: 492 });
  });

  it('estación inexistente o sin trenes → arribos vacíos con 200', async () => {
    const res = await adapter(CAPTURA_MS).trenes.arribos('999999');
    expect(res.data).toEqual({ estacionId: '999999', arribos: [] });
  });

  it('fuente caída sin dato → 503; cuerpo inválido → 503 «Respuesta inválida»', async () => {
    await expect(adapter(CAPTURA_MS).trenes.arribos('1')).rejects.toMatchObject({ status: 503 });
    const bodies = red();
    bodies['trenes:arribos:50'] = { timestamp: 'ayer' };
    await expect(adapter(CAPTURA_MS, bodies).trenes.arribos('50')).rejects.toMatchObject({
      status: 503,
      message: 'Respuesta inválida de la fuente de trenes',
    });
  });
});

describe('fuente SOFSE: URLs, fechas y reglas', () => {
  it('las URLs se arman sobre baseUrl (con path) y no salen a otro host', () => {
    const u = urls(BASE);
    expect(u.gerencias().href).toBe(`${BASE}/infraestructura/gerencias?idEmpresa=1`);
    expect(u.ramales(21).href).toBe(`${BASE}/infraestructura/ramales?idGerencia=21`);
    expect(u.arribos('332', 8).href).toBe(`${BASE}/arribos/estacion/332?cantidad=8`);
    expect(urls('https://otra.fuente/x/').gerencias().href).toBe(
      'https://otra.fuente/x/infraestructura/gerencias?idEmpresa=1',
    );
    // Sin path en la base (GCBA) sigue igual que antes.
    expect(upstreamUrl('/subtes/serviceAlerts', { json: '1' }).href).toBe(
      'https://apitransporte.buenosaires.gob.ar/subtes/serviceAlerts?json=1',
    );
  });

  it('parseFechaSofse interpreta hora de Buenos Aires (−03:00)', () => {
    expect(parseFechaSofse('2026-10-24 12:01:00')).toBe(Date.parse('2026-10-24T15:01:00Z'));
    expect(parseFechaSofse('2026-10-24 12:01')).toBe(Date.parse('2026-10-24T15:01:00Z'));
    expect(parseFechaSofse(null)).toBeNull();
    expect(parseFechaSofse('24/10/2026')).toBeNull();
  });

  it('parseIsoArribo respeta la Z y toma Buenos Aires si no hay offset', () => {
    expect(parseIsoArribo('2026-11-05T12:10:00.000Z')).toBe(Date.parse('2026-11-05T12:10:00Z'));
    expect(parseIsoArribo('2026-11-05T09:10:00')).toBe(Date.parse('2026-11-05T12:10:00Z'));
    expect(parseIsoArribo('')).toBeNull();
  });

  it('nombreEfecto acepta nombre o número GTFS-RT', () => {
    expect(nombreEfecto('SIGNIFICANT_DELAYS')).toBe('SIGNIFICANT_DELAYS');
    expect(nombreEfecto(1)).toBe('NO_SERVICE');
    expect(nombreEfecto('2')).toBe('REDUCED_SERVICE');
    expect(nombreEfecto(null)).toBeUndefined();
  });

  it('severidadAlerta: efecto y texto', () => {
    expect(severidadAlerta({ efecto_gtfs: 'NO_SERVICE', contenido: '' })).toBe('interrumpida');
    expect(severidadAlerta({ efecto_gtfs: 1, contenido: '' })).toBe('interrumpida');
    expect(
      severidadAlerta({ efecto_gtfs: 'OTHER_EFFECT', contenido: 'Servicio interrumpido' }),
    ).toBe('interrumpida');
    expect(severidadAlerta({ efecto_gtfs: 'DETOUR', contenido: '' })).toBe('demorada');
    expect(severidadAlerta({ efecto_gtfs: 'OTHER_EFFECT', contenido: 'Trenes con demoras' })).toBe(
      'demorada',
    );
    expect(severidadAlerta({ efecto_gtfs: 'OTHER_EFFECT', contenido: 'Beneficio CUD' })).toBe(
      'informativa',
    );
  });

  it('alertaVigente: habilitado 1 y dentro de la vigencia', () => {
    const t = Date.parse('2026-11-05T12:00:00Z'); // 09:00 de Buenos Aires
    const a = { habilitado: 1, vigencia_desde: '2026-11-05 08:00:00', vigencia_hasta: null };
    expect(alertaVigente(a, t)).toBe(true);
    expect(alertaVigente({ ...a, habilitado: 0 }, t)).toBe(false);
    expect(alertaVigente({ ...a, vigencia_hasta: '2026-11-05 08:59:59' }, t)).toBe(false);
    expect(alertaVigente({ ...a, vigencia_desde: '2026-11-05 09:00:01' }, t)).toBe(false);
  });

  it('severidadEstadoSofse: «Alertas por ramal» es informativo', () => {
    expect(severidadEstadoSofse('Alertas por ramal')).toBe('informativa');
    expect(severidadEstadoSofse('Servicio suspendido')).toBe('interrumpida');
    expect(severidadEstadoSofse('Servicio con demoras')).toBe('demorada');
    expect(severidadEstadoSofse(null)).toBe('informativa');
  });

  it('tituloDe: primera oración sin cortar en abreviaturas ni iniciales', () => {
    expect(
      tituloDe(
        'Los trenes del ramal Dr. Sáenz - M.C.G. Belgrano circulan con recorrido limitado, por obras. Más información en la web',
      ),
    ).toBe(
      'Los trenes del ramal Dr. Sáenz - M.C.G. Belgrano circulan con recorrido limitado, por obras.',
    );
    expect(tituloDe('Sin punto final')).toBe('Sin punto final');
    const largo = tituloDe(`${'palabra '.repeat(30)}fin.`);
    expect(largo.length).toBeLessThanOrEqual(120);
    expect(largo.endsWith('…')).toBe(true);
  });

  it('lineaDeGerencia mapea las 6 gerencias e ignora Regionales', () => {
    expect([11, 1, 5, 31, 21, 41].map((id) => lineaDeGerencia(id))).toEqual(ORDEN);
    expect(lineaDeGerencia('5')).toBe('mitre');
    expect(lineaDeGerencia(501)).toBeUndefined();
  });
});

describe('settledConLimite', () => {
  it('nunca supera el límite en vuelo y respeta el orden de los resultados', async () => {
    let enVuelo = 0;
    let maximo = 0;
    const tareas = Array.from({ length: 7 }, (_, i) => async () => {
      enVuelo++;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((r) => setTimeout(r, 5 + (i % 3)));
      enVuelo--;
      if (i === 3) throw new Error('falla');
      return i;
    });
    const res = await settledConLimite(tareas, 6);
    expect(maximo).toBe(6);
    expect(res.map((r) => r.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
    expect(res[6]).toEqual({ status: 'fulfilled', value: 6 });
  });
});
