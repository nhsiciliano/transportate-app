// trenes-lineas.json y trenes-estaciones.json desde los volcados de tools/sofse-probe
// (API comunitaria api-trenes, datos de SOFSE; docs/01d-api-trenes-sofse.md).
//
// Entradas (en `dir`, ver INPUTS.sofseDir): `capturado.json`, `gerencias.json`,
// `ramales-<idGerencia>.json` y `estaciones-<idRamal>.json`. No hay red: solo se leen los volcados.
//
// Dos cosas de los datos que el diseño original no tenía en cuenta y se resuelven acá:
// - `orden` de una estación **se reinicia en cada tramo** (`id_tramo`), no es un orden del ramal:
//   ordenar por él deja mal las cabeceras en 16 de los 27 ramales. El arreglo `estaciones` ya viene
//   «en orden de recorrido» (docs/01d §5.3), así que se conserva ese orden tal cual.
// - Para algunos ramales el upstream devuelve una lista incompleta (le falta la cabecera inicial o
//   tramos compartidos con otro ramal). No se inventa nada: se publica lo que viene y las
//   cabeceras que no coinciden quedan en el reporte (`cabecerasNoCoinciden`).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  EstacionTrenV1,
  LineaTrenId,
  LineaTrenV1,
  RamalTrenV1,
  TrenesEstacionesArchivoV1,
  TrenesLineasArchivoV1,
} from '@transportate/contracts';
import { z } from 'zod';
import { COLORES_TRENES, FUENTES, GERENCIAS_TRENES } from '../config.js';
import { isValidCoord, round6 } from '../lib/geo.js';

// ---------------------------------------------------------------- entradas (forma de los volcados)

/** Número o texto numérico (la API mezcla: `id_estacion` y coordenadas vienen como texto). */
const Texto = z.union([z.string(), z.number()]).transform(String);

const CapturadoSchema = z.object({ capturadoEn: z.string().min(1), base: z.string().min(1) });
const GerenciasSchema = z.array(z.object({ id: z.number(), nombre: z.string().min(1) }));
const CabeceraSchema = z.object({ id: Texto, nombre: z.string().min(1) });
const RamalFuenteSchema = z.object({
  id: Texto,
  nombre: z.string().min(1),
  siglas: z.string().nullish(),
  publico: z.boolean(),
  orden_ramal: z.coerce.number(),
  es_electrico: z.union([z.number(), z.boolean()]),
  cabecera_inicial: CabeceraSchema,
  cabecera_final: CabeceraSchema,
});
const EstacionFuenteSchema = z.object({
  id_estacion: Texto,
  nombre: z.string().min(1),
  latitud: z.unknown(),
  longitud: z.unknown(),
  /** Objeto en unos volcados y texto JSON en otros. */
  visibilidad: z.unknown(),
});

export type RamalFuente = z.infer<typeof RamalFuenteSchema>;
export type EstacionFuente = z.infer<typeof EstacionFuenteSchema>;

export interface TrenesInput {
  capturado: z.infer<typeof CapturadoSchema>;
  gerencias: z.infer<typeof GerenciasSchema>;
  /** Por `idGerencia`: todos los ramales que devolvió la fuente (públicos o no). */
  ramalesPorGerencia: Map<number, RamalFuente[]>;
  /** Por `idRamal`. */
  estacionesPorRamal: Map<string, EstacionFuente[]>;
}

function leerJson<T>(path: string, schema: z.ZodType<T>): T {
  if (!existsSync(path)) {
    throw new Error(
      `Falta ${path}. Generá los volcados con "node tools/sofse-probe/probe.mjs" (ver tools/gtfs/README.md, "Entradas")`,
    );
  }
  const r = schema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!r.success)
    throw new Error(`${path} no tiene la forma esperada:\n${z.prettifyError(r.error)}`);
  return r.data;
}

/** Lee los volcados de `dir`. Solo carga los ramales públicos de las seis líneas conocidas. */
export function readTrenesInput(dir: string, { completo = true }: ArmarOpciones = {}): TrenesInput {
  const capturado = leerJson(join(dir, 'capturado.json'), CapturadoSchema);
  const gerencias = leerJson(join(dir, 'gerencias.json'), GerenciasSchema);
  const ramalesPorGerencia = new Map<number, RamalFuente[]>();
  const estacionesPorRamal = new Map<string, EstacionFuente[]>();
  for (const { idGerencia } of GERENCIAS_TRENES) {
    if (!completo && !existsSync(join(dir, `ramales-${String(idGerencia)}.json`))) continue;
    const ramales = leerJson(
      join(dir, `ramales-${String(idGerencia)}.json`),
      z.array(RamalFuenteSchema),
    );
    ramalesPorGerencia.set(idGerencia, ramales);
    for (const r of ramales.filter((x) => x.publico)) {
      estacionesPorRamal.set(
        r.id,
        leerJson(join(dir, `estaciones-${r.id}.json`), z.array(EstacionFuenteSchema)),
      );
    }
  }
  return { capturado, gerencias, ramalesPorGerencia, estacionesPorRamal };
}

// ---------------------------------------------------------------- armado

/** `visibilidad.app_mobile` es `1` o `"1"`; `visibilidad` puede venir como objeto o como texto JSON. */
export function visibleEnApp(visibilidad: unknown): boolean {
  let v = visibilidad;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v) as unknown;
    } catch {
      return false;
    }
  }
  if (typeof v !== 'object' || v === null) return false;
  const flag = (v as Record<string, unknown>)['app_mobile'];
  return flag === 1 || flag === '1' || flag === true;
}

export interface TrenesStats {
  lineas: number;
  ramales: number;
  estaciones: number;
  /** Filas de estación leídas, antes de deduplicar. */
  filasDeEstacion: number;
  /** Estaciones sin `app_mobile` (no se publican). */
  sinAppMobile: { id: string; nombre: string }[];
  /** Estaciones con coordenada inválida (no se publican). */
  descartadas: { id: string; nombre: string; latitud: unknown; longitud: unknown }[];
  /** Ramales cuya primera o última estación no es la cabecera declarada (el upstream devuelve la lista incompleta). */
  cabecerasNoCoinciden: {
    ramalId: string;
    nombre: string;
    inicial: { esperada: string; primera: string };
    final: { esperada: string; ultima: string };
  }[];
  /** Ids de estación de un ramal que no se publican (sin `app_mobile` o sin coordenada): se sacan del ramal. */
  estacionesDeRamalNoPublicadas: number;
}

export interface TrenesBuild {
  lineas: TrenesLineasArchivoV1;
  estaciones: TrenesEstacionesArchivoV1;
  stats: TrenesStats;
}

const porNombre = (a: { nombre: string }, b: { nombre: string }): number =>
  a.nombre.localeCompare(b.nombre, 'es');

export interface ArmarOpciones {
  /** Exige las seis líneas (default). Con `false` se arman solo las que traiga la entrada (tests con muestras). */
  completo?: boolean;
}

export function armarTrenes(
  input: TrenesInput,
  { completo = true }: ArmarOpciones = {},
): TrenesBuild {
  const presentes = completo
    ? GERENCIAS_TRENES
    : GERENCIAS_TRENES.filter((g) => input.ramalesPorGerencia.has(g.idGerencia));
  const nombreDeGerencia = new Map(input.gerencias.map((g) => [g.id, g.nombre]));
  const stats: TrenesStats = {
    lineas: 0,
    ramales: 0,
    estaciones: 0,
    filasDeEstacion: 0,
    sinAppMobile: [],
    descartadas: [],
    cabecerasNoCoinciden: [],
    estacionesDeRamalNoPublicadas: 0,
  };

  // ---- estaciones: unión deduplicada por id_estacion, acumulando líneas y ramales
  interface Acum {
    id: string;
    nombre: string;
    lat: number;
    lon: number;
    visible: boolean;
    coordenadaValida: boolean;
    crudo: { latitud: unknown; longitud: unknown };
    lineas: Set<LineaTrenId>;
    ramalIds: string[];
  }
  const acum = new Map<string, Acum>();
  const ramalesPublicos: { linea: LineaTrenId; ramal: RamalFuente }[] = [];

  for (const { id: linea, idGerencia } of presentes) {
    if (!nombreDeGerencia.has(idGerencia)) {
      throw new Error(
        `gerencias.json no trae la línea ${linea} (idGerencia ${String(idGerencia)})`,
      );
    }
    const ramales = (input.ramalesPorGerencia.get(idGerencia) ?? [])
      .filter((r) => r.publico)
      .sort((a, b) => a.orden_ramal - b.orden_ramal || porNombre(a, b));
    for (const ramal of ramales) {
      ramalesPublicos.push({ linea, ramal });
      const filas = input.estacionesPorRamal.get(ramal.id);
      if (!filas) throw new Error(`faltan las estaciones del ramal ${ramal.id} (${ramal.nombre})`);
      for (const fila of filas) {
        stats.filasDeEstacion++;
        let a = acum.get(fila.id_estacion);
        if (!a) {
          const lat = Number(fila.latitud);
          const lon = Number(fila.longitud);
          const valida = isValidCoord(lat, lon) && !(lat === 0 && lon === 0);
          a = {
            id: fila.id_estacion,
            nombre: fila.nombre,
            lat: valida ? round6(lat) : NaN,
            lon: valida ? round6(lon) : NaN,
            visible: false,
            coordenadaValida: valida,
            crudo: { latitud: fila.latitud, longitud: fila.longitud },
            lineas: new Set(),
            ramalIds: [],
          };
          acum.set(a.id, a);
        }
        a.visible ||= visibleEnApp(fila.visibilidad);
        a.lineas.add(linea);
        if (!a.ramalIds.includes(ramal.id)) a.ramalIds.push(ramal.id);
      }
    }
  }

  const publicadas = new Map<string, Acum>();
  for (const a of acum.values()) {
    if (!a.visible) stats.sinAppMobile.push({ id: a.id, nombre: a.nombre });
    else if (!a.coordenadaValida) {
      stats.descartadas.push({ id: a.id, nombre: a.nombre, ...a.crudo });
    } else publicadas.set(a.id, a);
  }

  const orden = GERENCIAS_TRENES.map((g) => g.id);
  const estaciones: EstacionTrenV1[] = [...publicadas.values()]
    .map((a) => ({
      id: a.id,
      nombre: a.nombre,
      lat: a.lat,
      lon: a.lon,
      lineas: orden.filter((l) => a.lineas.has(l)),
      ramalIds: a.ramalIds,
    }))
    .sort(porNombre);
  stats.estaciones = estaciones.length;

  // ---- líneas y ramales
  const lineas: LineaTrenV1[] = presentes.map(({ id, idGerencia }) => {
    const colores = COLORES_TRENES[id];
    if (!colores) throw new Error(`COLORES_TRENES no tiene la línea ${id}`);
    const ramales: RamalTrenV1[] = ramalesPublicos
      .filter((x) => x.linea === id)
      .map(({ ramal }) => {
        const filas = input.estacionesPorRamal.get(ramal.id) ?? [];
        // Orden del upstream (ver el encabezado): sin reordenar y sin repetir.
        const vistos = new Set<string>();
        const todas = filas.filter((e) => !vistos.has(e.id_estacion) && vistos.add(e.id_estacion));
        const estacionIds = todas.map((e) => e.id_estacion).filter((e) => publicadas.has(e));
        stats.estacionesDeRamalNoPublicadas += todas.length - estacionIds.length;
        const primera = todas[0]?.id_estacion ?? '';
        const ultima = todas.at(-1)?.id_estacion ?? '';
        if (primera !== ramal.cabecera_inicial.id || ultima !== ramal.cabecera_final.id) {
          stats.cabecerasNoCoinciden.push({
            ramalId: ramal.id,
            nombre: ramal.nombre,
            inicial: { esperada: ramal.cabecera_inicial.id, primera },
            final: { esperada: ramal.cabecera_final.id, ultima },
          });
        }
        return {
          id: ramal.id,
          linea: id,
          nombre: ramal.nombre,
          ...(ramal.siglas ? { siglas: ramal.siglas } : {}),
          cabeceraInicial: ramal.cabecera_inicial,
          cabeceraFinal: ramal.cabecera_final,
          electrico: ramal.es_electrico === 1 || ramal.es_electrico === true,
          estacionIds,
        };
      });
    stats.ramales += ramales.length;
    return {
      id,
      idGerencia: String(idGerencia),
      nombre: nombreDeGerencia.get(idGerencia) ?? id,
      color: colores.color,
      colorTexto: colores.texto,
      ramales,
    };
  });
  stats.lineas = lineas.length;

  const base = {
    version: 1 as const,
    fuente: input.capturado.base,
    capturadoEn: input.capturado.capturadoEn,
  };
  return {
    lineas: { ...base, lineas },
    estaciones: { ...base, estaciones },
    stats,
  };
}

/** Lee los volcados de `dir` y arma los dos archivos del paquete. */
export function buildTrenes(dir: string): TrenesBuild {
  return armarTrenes(readTrenesInput(dir));
}

/** Para el manifest: fecha de los datos (día de la captura). */
export function fuenteSofse(
  capturadoEn: string,
): Record<'nombre' | 'url' | 'fecha' | 'licencia', string> {
  return { ...FUENTES.sofse, fecha: capturadoEn.slice(0, 10) };
}
