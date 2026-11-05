// Modelo de la feature de Trenes: une el estático (`trenes-lineas.json`, `trenes-estaciones.json`)
// con el tiempo real del proxy (estado, alertas, arribos). Funciones puras: se testean sin React.
//
// Terminología (PRODUCT.md): la **línea** (Roca) tiene **ramales** (Once – Moreno) que van de
// **cabecera** a cabecera por **estaciones**; los trenes paran en un **andén**. En trenes se guarda
// el ramal o la estación, nunca la línea.
import type {
  AlertaTrenV1,
  ArriboTrenV1,
  EstacionTrenV1,
  EstadoLineasTrenV1,
  EstadoServicioV1,
  LineaTrenId,
  RamalTrenV1,
  TrenesEstacionesArchivoV1,
  TrenesLineasArchivoV1,
} from '@transportate/contracts';

import { normalizar } from '@/features/subtes/model';

export { horaBsAs } from '@/features/subtes/model';

/** Orden fijo de la raíz (brief §3, S35). */
export const LINEA_TREN_IDS: readonly LineaTrenId[] = [
  'roca',
  'sarmiento',
  'mitre',
  'san-martin',
  'belgrano-sur',
  'tren-de-la-costa',
];

const NOMBRE_CORTO: Record<LineaTrenId, string> = {
  roca: 'Roca',
  sarmiento: 'Sarmiento',
  mitre: 'Mitre',
  'san-martin': 'San Martín',
  'belgrano-sur': 'Belgrano Sur',
  'tren-de-la-costa': 'Tren de la Costa',
};

const SIGLAS: Record<LineaTrenId, string> = {
  roca: 'R',
  sarmiento: 'S',
  mitre: 'M',
  'san-martin': 'SM',
  'belgrano-sur': 'BS',
  'tren-de-la-costa': 'TC',
};

export function isLineaTrenId(value: string): value is LineaTrenId {
  return (LINEA_TREN_IDS as readonly string[]).includes(value);
}

/** «Línea Roca»; el Tren de la Costa ya es un nombre propio y no lleva «Línea». */
export function nombreLinea(id: LineaTrenId): string {
  return id === 'tren-de-la-costa' ? NOMBRE_CORTO[id] : `Línea ${NOMBRE_CORTO[id]}`;
}

/** Siglas de la insignia: R / S / M / SM / BS / TC (`docs/02c-colores-trenes.md` §3). */
export function siglasLinea(id: LineaTrenId): string {
  return SIGLAS[id];
}

export const EN_DASH = '–';

/**
 * Nombre de SOFSE con raya: «Once-Moreno» → «Once – Moreno». Un sufijo de una o dos letras (las
 * variantes «Bosques-Q» y «Bosques-T» del Roca) queda pegado: es parte del nombre de la cabecera.
 */
export function formatearRamal(nombre: string): string {
  const partes = nombre.split(/\s*-\s*/).filter((p) => p !== '');
  const unidas: string[] = [];
  for (const p of partes) {
    const anterior = unidas[unidas.length - 1];
    if (anterior !== undefined && p.length <= 2) unidas[unidas.length - 1] = `${anterior}-${p}`;
    else unidas.push(p.trim());
  }
  return unidas.join(` ${EN_DASH} `);
}

export interface RamalTren extends RamalTrenV1 {
  /** «Once – Moreno». */
  nombreVisible: string;
  /** «Once – Moreno» desde las cabeceras del estático (puede coincidir con el nombre). */
  cabeceras: string;
}

export interface LineaTren {
  id: LineaTrenId;
  /** «Línea Roca». */
  nombre: string;
  /** «Roca». */
  nombreCorto: string;
  siglas: string;
  color: string;
  colorTexto: string;
  ramales: readonly RamalTren[];
}

export interface RedTrenes {
  lineas: readonly LineaTren[];
  lineaPorId: ReadonlyMap<LineaTrenId, LineaTren>;
  ramalPorId: ReadonlyMap<string, RamalTren>;
  estaciones: readonly EstacionTrenV1[];
  estacionPorId: ReadonlyMap<string, EstacionTrenV1>;
}

/** Une el estático en la red de la app (6 líneas en orden fijo, 27 ramales, ~260 estaciones). */
export function buildRedTrenes(
  lineasArchivo: TrenesLineasArchivoV1,
  estacionesArchivo: TrenesEstacionesArchivoV1,
): RedTrenes {
  const porId = new Map(lineasArchivo.lineas.map((l) => [l.id, l]));
  const lineas: LineaTren[] = [];
  const ramalPorId = new Map<string, RamalTren>();
  for (const id of LINEA_TREN_IDS) {
    const l = porId.get(id);
    if (l === undefined) continue;
    const ramales = l.ramales.map((r): RamalTren => ({
      ...r,
      nombreVisible: formatearRamal(r.nombre),
      cabeceras: `${r.cabeceraInicial.nombre} ${EN_DASH} ${r.cabeceraFinal.nombre}`,
    }));
    for (const r of ramales) ramalPorId.set(r.id, r);
    lineas.push({
      id,
      nombre: nombreLinea(id),
      nombreCorto: NOMBRE_CORTO[id],
      siglas: SIGLAS[id],
      color: l.color,
      colorTexto: l.colorTexto,
      ramales,
    });
  }
  const estaciones = [...estacionesArchivo.estaciones];
  return {
    lineas,
    lineaPorId: new Map(lineas.map((l) => [l.id, l])),
    ramalPorId,
    estaciones,
    estacionPorId: new Map(estaciones.map((e) => [e.id, e])),
  };
}

/** Debajo del nombre de la línea: las cabeceras si tiene un solo ramal, si no «12 ramales». */
export function detalleLinea(linea: Pick<LineaTren, 'ramales'>): string {
  const [unico] = linea.ramales;
  if (linea.ramales.length === 1 && unico !== undefined) return unico.cabeceras;
  return `${linea.ramales.length} ramales`;
}

/** Líneas a las que pertenece una estación, en el orden fijo. */
export function lineasDeEstacion(
  estacion: Pick<EstacionTrenV1, 'lineas'>,
  red: Pick<RedTrenes, 'lineaPorId'>,
): LineaTren[] {
  return LINEA_TREN_IDS.filter((id) => estacion.lineas.includes(id)).flatMap((id) => {
    const l = red.lineaPorId.get(id);
    return l === undefined ? [] : [l];
  });
}

// ---------------------------------------------------------------- estado y alertas

export interface EstadoLineaTren {
  estado: EstadoServicioV1;
  /** Título de la alerta más severa (o el mensaje de la gerencia). */
  resumen: string | undefined;
}

/** Estado de una línea. Sin dato (o sin esa línea en la respuesta): `sin_datos`. */
export function estadoDeLineaTren(
  id: LineaTrenId,
  estado: EstadoLineasTrenV1 | undefined,
): EstadoLineaTren {
  const l = estado?.lineas.find((x) => x.linea === id);
  return { estado: l?.estado ?? 'sin_datos', resumen: l?.resumen };
}

/**
 * Estado de un ramal. Si la línea vino sin ramales (la fuente de ramales de esa línea no
 * respondió), el ramal queda `sin_datos`: no se inventa con el estado de la línea.
 */
export function estadoDeRamal(
  ramalId: string,
  estado: EstadoLineasTrenV1 | undefined,
): EstadoServicioV1 {
  for (const l of estado?.lineas ?? []) {
    const r = l.ramales.find((x) => x.ramalId === ramalId);
    if (r !== undefined) return r.estado;
  }
  return 'sin_datos';
}

const SEVERIDAD: Record<EstadoServicioV1, number> = {
  sin_datos: 0,
  normal: 1,
  demorada: 2,
  interrumpida: 3,
};

/** El más severo de varios estados (`sin_datos` solo si no hay ninguno con dato). */
export function peorEstado(estados: readonly EstadoServicioV1[]): EstadoServicioV1 {
  let peor: EstadoServicioV1 = 'sin_datos';
  for (const e of estados) if (SEVERIDAD[e] > SEVERIDAD[peor]) peor = e;
  return peor;
}

/** Estado de una estación para su banda de favorito: el peor de los ramales que la sirven. */
export function estadoDeEstacionTren(
  estacion: Pick<EstacionTrenV1, 'ramalIds'>,
  estado: EstadoLineasTrenV1 | undefined,
): EstadoServicioV1 {
  return peorEstado(estacion.ramalIds.map((id) => estadoDeRamal(id, estado)));
}

/** Alertas de la línea que no apuntan a un ramal (las de ramal se ven en el ramal). */
export function alertasDeLinea(
  id: LineaTrenId,
  alertas: readonly AlertaTrenV1[] | undefined,
): AlertaTrenV1[] {
  return (alertas ?? []).filter((a) => a.linea === id && a.ramalId === undefined);
}

/** Alertas de un ramal: las propias primero y después las de su línea sin ramal. */
export function alertasDeRamal(
  ramal: Pick<RamalTrenV1, 'id' | 'linea'>,
  alertas: readonly AlertaTrenV1[] | undefined,
): AlertaTrenV1[] {
  const lista = alertas ?? [];
  return [
    ...lista.filter((a) => a.ramalId === ramal.id),
    ...lista.filter((a) => a.linea === ramal.linea && a.ramalId === undefined),
  ];
}

/**
 * Alertas que conciernen a una estación: las que la nombran y las de los ramales que la sirven
 * (sin las generales de línea, que son casi siempre informativas y se ven en la línea).
 */
export function alertasDeEstacion(
  estacion: Pick<EstacionTrenV1, 'id' | 'ramalIds'>,
  alertas: readonly AlertaTrenV1[] | undefined,
): AlertaTrenV1[] {
  const ramales = new Set(estacion.ramalIds);
  return (alertas ?? []).filter(
    (a) =>
      a.estacionId === estacion.id ||
      (a.estacionId === undefined && a.ramalId !== undefined && ramales.has(a.ramalId)),
  );
}

/** «Hacia Moreno» para una alerta de sentido (S39); `undefined` si vale para los dos. */
export function sentidoDeAlerta(
  alerta: Pick<AlertaTrenV1, 'sentido'>,
  ramal: Pick<RamalTrenV1, 'cabeceraInicial' | 'cabeceraFinal'>,
): string | undefined {
  if (alerta.sentido === '1') return `Hacia ${ramal.cabeceraFinal.nombre}`;
  if (alerta.sentido === '2') return `Hacia ${ramal.cabeceraInicial.nombre}`;
  return undefined;
}

// ---------------------------------------------------------------- búsqueda

/** Estaciones cuyo nombre contiene la consulta (sin tildes ni mayúsculas), en orden alfabético. */
export function buscarEstacionesTren(
  red: Pick<RedTrenes, 'estaciones'>,
  consulta: string,
): EstacionTrenV1[] {
  const q = normalizar(consulta);
  if (q === '') return [];
  return red.estaciones
    .filter((e) => normalizar(e.nombre).includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// ---------------------------------------------------------------- arribos

/** Hasta 3 arribos por destino (S9). */
export const ARRIBOS_POR_DESTINO = 3;
/** Bandas por estación antes de bajar al resto a una placa (contrato de superficie). */
export const BANDAS_POR_ESTACION = 2;
/** Con dato más viejo, los tiempos se reemplazan (S30). */
export const ARRIBOS_VIEJOS_SEGUNDOS = 10 * 60;
/** Demora a partir de la cual se muestra la hora programada al lado (S38). */
export const DEMORA_VISIBLE_SEGUNDOS = 2 * 60;
/** Arribos más viejos que esto se descartan (igual que el proxy). */
const PASADO_SEGUNDOS = -30;

/** Hora que manda: la estimada si la hay, si no la programada. */
function horaDe(a: Pick<ArriboTrenV1, 'horaEstimada' | 'horaProgramada'>): number {
  return Date.parse(a.horaEstimada ?? a.horaProgramada);
}

/**
 * Recalcula `enSegundos` contra `now` (el dato puede venir de la caché) con la estimada o, si no
 * hay, la programada, y descarta los que pasaron hace más de 30 s.
 */
export function arribosTrenVigentes(arribos: readonly ArriboTrenV1[], now: number): ArriboTrenV1[] {
  return arribos
    .map((a) => {
      const t = horaDe(a);
      return { ...a, enSegundos: Number.isNaN(t) ? a.enSegundos : Math.round((t - now) / 1000) };
    })
    .filter((a) => a.enSegundos >= PASADO_SEGUNDOS)
    .sort((a, b) => a.enSegundos - b.enSegundos);
}

/** Estimada − programada en segundos (0 sin estimada). Negativa si viene adelantado. */
export function demoraDe(a: Pick<ArriboTrenV1, 'horaEstimada' | 'horaProgramada'>): number {
  if (a.horaEstimada === undefined) return 0;
  const e = Date.parse(a.horaEstimada);
  const p = Date.parse(a.horaProgramada);
  return Number.isNaN(e) || Number.isNaN(p) ? 0 : Math.round((e - p) / 1000);
}

/** Minutos para la banda: «Ahora» con menos de un minuto; si no, «N min» redondeado. */
export function formatArriboTren(enSegundos: number): { short: string; spoken: string } {
  if (enSegundos < 60) return { short: 'Ahora', spoken: 'ahora' };
  const min = Math.max(0, Math.round(enSegundos / 60));
  return { short: `${min} min`, spoken: min === 1 ? 'en 1 minuto' : `en ${min} minutos` };
}

export interface BloqueTren {
  /** Nombre de la cabecera de destino («Moreno»). */
  destino: string;
  /** «Hacia Moreno». */
  titulo: string;
  /** Próximos trenes no cancelados (hasta 3), del más cercano al más lejano. */
  arribos: ArriboTrenV1[];
  /** Cancelados que salían antes que el último de `arribos` (o todos, si no hay otros). */
  cancelados: ArriboTrenV1[];
  /** Ramal y andén del próximo (o del primer cancelado): «Ramal Once – Moreno». */
  ramal: string;
  anden: string | undefined;
  /** Segundos del primer tren del bloque (para ordenar). */
  primero: number;
}

/**
 * Bloques por destino («Hacia Moreno», «Hacia Once»), ordenados por el tren más próximo. Un
 * cancelado no cuenta como próximo (S40): queda en `cancelados`. `arribos` ya tiene que venir
 * vigente (`arribosTrenVigentes`).
 */
export function agruparArribosTren(arribos: readonly ArriboTrenV1[]): BloqueTren[] {
  const porDestino = new Map<string, ArriboTrenV1[]>();
  for (const a of [...arribos].sort((x, y) => x.enSegundos - y.enSegundos)) {
    const clave = normalizar(a.destino);
    if (clave === '') continue;
    porDestino.set(clave, [...(porDestino.get(clave) ?? []), a]);
  }
  const bloques: BloqueTren[] = [];
  for (const lista of porDestino.values()) {
    const proximos = lista.filter((a) => !a.cancelado).slice(0, ARRIBOS_POR_DESTINO);
    const ultimo = proximos[proximos.length - 1];
    const cancelados = lista.filter(
      (a) => a.cancelado && (ultimo === undefined || a.enSegundos <= ultimo.enSegundos),
    );
    const ref = proximos[0] ?? cancelados[0] ?? lista[0];
    if (ref === undefined) continue;
    bloques.push({
      destino: ref.destino,
      titulo: `Hacia ${ref.destino}`,
      arribos: proximos,
      cancelados,
      ramal: `Ramal ${formatearRamal(ref.ramal)}`,
      anden: ref.anden,
      primero: Math.min(...[...proximos, ...cancelados].map((a) => a.enSegundos)),
    });
  }
  return bloques.sort((a, b) => a.primero - b.primero);
}
