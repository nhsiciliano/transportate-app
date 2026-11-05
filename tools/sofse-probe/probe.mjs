#!/usr/bin/env node
// Volcado de la API comunitaria de trenes (SOFSE vía https://ariedro.dev/api-trenes).
//
// Uso: node probe.mjs [--fixtures] [--base <url>] [--sin-estaciones]
//   --fixtures        además escribe el subconjunto de fixtures en apps/proxy/test/fixtures/sofse/
//   --base <url>      base de la API (default https://ariedro.dev/api-trenes)
//   --sin-estaciones  no baja las estaciones de cada ramal (más rápido)
//
// La fuente no usa credenciales. Es el servidor personal de una persona: los pedidos van de a
// uno, con 300 ms de pausa entre pedidos y `User-Agent: transportate-tools/0.1`.
// Sin dependencias (Node ≥ 22: fetch nativo).

import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIXTURES_DIR = join(ROOT, 'apps', 'proxy', 'test', 'fixtures', 'sofse');
const CACHE_DIR = join(homedir(), '.cache', 'transportate', 'sofse');
const USER_AGENT = 'transportate-tools/0.1';
const PAUSA_MS = 300;

/** Gerencias (líneas) útiles: Roca, Sarmiento, Mitre, San Martín, Belgrano Sur, Tren de la Costa. */
const GERENCIAS = [11, 1, 5, 31, 21, 41];
/** Estaciones de muestra para arribos: Retiro (LGM), Caballito y una inexistente. */
const ARRIBOS = [
  { id: '332', archivo: 'arribos.332.json' },
  { id: '50', archivo: 'arribos.50.json' },
  { id: '999999', archivo: 'arribos.inexistente.json' },
];
/** Lo mismo que pide el proxy (`apps/proxy/src/adapters/trenes/sofse.ts`). */
const CANTIDAD_ARRIBOS = 8;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const valor = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const BASE = valor('--base', 'https://ariedro.dev/api-trenes').replace(/\/+$/, '');
const FIXTURES = flag('--fixtures');
const ESTACIONES = !flag('--sin-estaciones');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pedidos = 0;
/** GET JSON con pausa previa. Lanza si el status no es 200 o el cuerpo no es JSON. */
async function get(path) {
  if (pedidos++ > 0) await sleep(PAUSA_MS);
  const url = `${BASE}${path}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  const ms = Date.now() - t0;
  console.log(`${res.status} ${String(ms).padStart(5)} ms ${String(text.length).padStart(7)} B  ${path}`);
  if (res.status !== 200) throw new Error(`${path}: status ${res.status}: ${text.slice(0, 80)}`);
  return { json: JSON.parse(text), text };
}

function escribir(dir, archivo, text) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, archivo), text.endsWith('\n') ? text : `${text}\n`);
}

const capturadoEn = new Date().toISOString();

const gerencias = await get('/infraestructura/gerencias?idEmpresa=1');
escribir(CACHE_DIR, 'gerencias.json', gerencias.text);
if (FIXTURES) escribir(FIXTURES_DIR, 'gerencias.json', gerencias.text);

const ramalesPublicos = [];
for (const id of GERENCIAS) {
  const ramales = await get(`/infraestructura/ramales?idGerencia=${id}`);
  escribir(CACHE_DIR, `ramales-${id}.json`, ramales.text);
  if (FIXTURES) escribir(FIXTURES_DIR, `ramales.${id}.json`, ramales.text);
  for (const r of ramales.json) if (r.publico === true) ramalesPublicos.push(r);
}

const estacionesUnicas = new Set();
if (ESTACIONES || FIXTURES) {
  const ids = ESTACIONES ? ramalesPublicos.map((r) => r.id) : [1];
  for (const idRamal of ids) {
    const est = await get(`/infraestructura/estaciones?idRamal=${idRamal}`);
    if (ESTACIONES) escribir(CACHE_DIR, `estaciones-${idRamal}.json`, est.text);
    if (FIXTURES && idRamal === 1) escribir(FIXTURES_DIR, 'estaciones.ramal=1.json', est.text);
    for (const e of est.json) estacionesUnicas.add(String(e.id_estacion));
  }
}

for (const a of ARRIBOS) {
  const arr = await get(`/arribos/estacion/${a.id}?cantidad=${CANTIDAD_ARRIBOS}`);
  escribir(CACHE_DIR, a.archivo.replace(/^arribos\./, 'arribos-'), arr.text);
  if (FIXTURES) escribir(FIXTURES_DIR, a.archivo, arr.text);
}

escribir(
  CACHE_DIR,
  'capturado.json',
  JSON.stringify(
    {
      capturadoEn,
      base: BASE,
      gerencias: GERENCIAS,
      ramalesPublicos: ramalesPublicos.length,
      estaciones: ESTACIONES ? estacionesUnicas.size : null,
    },
    null,
    2,
  ),
);

console.log(
  `\nListo: ${pedidos} pedidos, ${ramalesPublicos.length} ramales públicos` +
    (ESTACIONES ? `, ${estacionesUnicas.size} estaciones únicas` : '') +
    `.\nVolcados en ${CACHE_DIR}` +
    (FIXTURES ? `\nFixtures en ${FIXTURES_DIR}` : ''),
);
