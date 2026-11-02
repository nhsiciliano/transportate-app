#!/usr/bin/env node
// Prueba de carga local del proxy (tarea 2.12). Corre contra `wrangler dev` ya levantado.
//
//   node carga.mjs --base=http://localhost:8787 --log=~/.cache/transportate/carga/wrangler-dev.log
//
// Escenario A (coalescing): N conexiones durante D segundos contra dos rutas de datos. Cuenta en el
// log de `wrangler dev` los eventos `upstream_fetch` que aparecieron durante la corrida (los emite
// EdgeCachedFeedSource; solo llevan { event, key, status, ms }, nunca URL ni credenciales).
// Para que las requests lleguen a los adaptadores, cada request usa un `cf-connecting-ip` sintético
// distinto (en local wrangler respeta el header del cliente; en Cloudflare lo pone el edge y no se
// puede falsificar), así el rate limit no corta la prueba.
//
// Escenario B (rate limit): 100 requests seguidas con la misma IP sintética → cuenta 200/429 y
// verifica Retry-After.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import autocannon from 'autocannon';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);
const BASE = args.base ?? 'http://localhost:8787';
const LOG = (args.log ?? '~/.cache/transportate/carga/wrangler-dev.log').replace(/^~/, homedir());
const CONNECTIONS = Number(args.connections ?? 50);
const DURATION = Number(args.duration ?? 10);
const PATHS = (args.paths ?? '/v1/subtes/estado,/v1/colectivos/lineas/1858/posiciones').split(',');
const UA = 'transportate-tools/0.1';

const randomIp = () =>
  `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;

function logSize() {
  try {
    return statSync(LOG).size;
  } catch {
    return null;
  }
}

/** Eventos upstream_* escritos en el log desde `offset`. */
function upstreamEventsSince(offset) {
  if (offset === null) return null;
  const text = readFileSync(LOG, 'utf8').slice(offset);
  const events = [...text.matchAll(/\{"event":"(upstream_fetch|upstream_error)"[^}]*\}/g)].map((m) =>
    JSON.parse(m[0]),
  );
  const porClave = {};
  for (const e of events) {
    porClave[e.key] ??= { fetch: 0, error: 0 };
    porClave[e.key][e.event === 'upstream_fetch' ? 'fetch' : 'error'] += 1;
  }
  return { total: events.length, porClave };
}

async function escenarioA() {
  const offset = logSize();
  const t0 = Date.now();
  const result = await autocannon({
    url: BASE,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { 'user-agent': UA },
    requests: PATHS.map((path) => ({
      path,
      setupRequest: (req) => ({ ...req, headers: { ...req.headers, 'cf-connecting-ip': randomIp() } }),
    })),
    renderProgressBar: false,
    renderResultsTable: false,
  });
  // Darle un momento a wrangler dev para volcar el log.
  await new Promise((r) => setTimeout(r, 1500));
  const upstream = upstreamEventsSince(offset);
  return {
    conexiones: CONNECTIONS,
    duracion_s: DURATION,
    segundosReales: Math.round((Date.now() - t0) / 100) / 10,
    rutas: PATHS,
    requests: result.requests.total,
    reqPorSeg: Math.round(result.requests.average),
    latencia_ms: {
      p50: result.latency.p50,
      p90: result.latency.p90,
      p99: result.latency.p99,
      max: result.latency.max,
    },
    status: result.statusCodeStats,
    no2xx: result.non2xx,
    errores: result.errors,
    timeouts: result.timeouts,
    upstream,
  };
}

async function escenarioB() {
  const ip = `192.0.2.${1 + Math.floor(Math.random() * 254)}`;
  const counts = {};
  let retryAfter = null;
  for (let i = 0; i < 100; i += 1) {
    const res = await fetch(`${BASE}/v1/subtes/alertas`, {
      headers: { 'cf-connecting-ip': ip, 'user-agent': UA },
    });
    counts[res.status] = (counts[res.status] ?? 0) + 1;
    if (res.status === 429 && retryAfter === null) retryAfter = res.headers.get('retry-after');
    await res.arrayBuffer();
  }
  return { requests: 100, status: counts, retryAfter };
}

const health = await fetch(`${BASE}/v1/health`).catch(() => null);
if (!health || !health.ok) {
  console.error(`No responde ${BASE}/v1/health: levantá antes "pnpm --filter transportate-proxy dev".`);
  process.exit(1);
}

const out = { fecha: new Date().toISOString(), base: BASE, A: await escenarioA(), B: await escenarioB() };
console.log(JSON.stringify(out, null, 2));
if (args.out) writeFileSync(args.out, JSON.stringify(out, null, 2) + '\n');
