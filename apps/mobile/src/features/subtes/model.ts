// Modelo de la feature: une el estático (`subte-lineas.json`, `subte-estaciones.json`) con el
// tiempo real (estado, alertas, arribos). Funciones puras: se testean sin React.
import type {
  AlertaV1,
  ArriboSubteV1,
  EstacionSubteV1,
  EstadoLineaV1,
  EstadoServicioV1,
  LineaSubteId,
  LineaSubteV1,
  SubteEstacionesArchivoV1,
  SubteLineasArchivoV1,
} from '@transportate/contracts';

/** Clave de línea en la app: el Premetro es una sola fila (S8, F4-subtes-1). */
export type LineaKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'H' | 'PM';

/** Orden fijo de la raíz (brief §3). */
export const LINEA_KEYS: readonly LineaKey[] = ['A', 'B', 'C', 'D', 'E', 'H', 'PM'];

export function isLineaKey(value: string): value is LineaKey {
  return (LINEA_KEYS as readonly string[]).includes(value);
}

/** `PM-C` y `PM-S` → `PM`; el resto queda igual. */
export function toLineaKey(id: LineaSubteId): LineaKey {
  return id === 'PM-C' || id === 'PM-S' ? 'PM' : id;
}

export interface SentidoSubte {
  /** "Plaza de Mayo", "Saguier". */
  cabecera: string;
  estacionIds: readonly string[];
}

export interface EstacionEnLinea {
  id: string;
  /** Ramal exclusivo (solo Premetro): "Ramal Centro Cívico". */
  ramal?: string;
}

export interface LineaSubte {
  key: LineaKey;
  /** "Línea A" / "Premetro". */
  nombre: string;
  /** Texto de la insignia: "A" / "PM". */
  badge: string;
  /** "Plaza de Mayo – San Pedrito" (F4-subtes-2). */
  cabeceras: string;
  color: string;
  colorTexto: string;
  /** Orden de recorrido. */
  estaciones: readonly EstacionEnLinea[];
  /** Sentidos del GTFS (Premetro: los de los dos ramales, sin repetir cabecera). */
  sentidos: readonly SentidoSubte[];
  /** Ids del contrato que agrupa (`['PM-C', 'PM-S']` en el Premetro). */
  ids: readonly LineaSubteId[];
}

export interface EstacionSubte extends EstacionSubteV1 {
  /** Línea de la app a la que pertenece. */
  linea: LineaKey;
}

export interface RedSubte {
  lineas: readonly LineaSubte[];
  lineaPorKey: ReadonlyMap<LineaKey, LineaSubte>;
  estaciones: readonly EstacionSubte[];
  estacionPorId: ReadonlyMap<string, EstacionSubte>;
}

export const EN_DASH = '–';

/** Línea de la app para el lector y los títulos. */
export function nombreLinea(key: LineaKey): string {
  return key === 'PM' ? 'Premetro' : `Línea ${key}`;
}

/** Une el estático en la red de la app (7 líneas, 108 estaciones). */
export function buildRed(
  lineasArchivo: SubteLineasArchivoV1,
  estacionesArchivo: SubteEstacionesArchivoV1,
): RedSubte {
  const estacionPorId = new Map<string, EstacionSubte>();
  for (const e of estacionesArchivo.estaciones) {
    const first = e.lineas[0];
    if (first === undefined) continue;
    estacionPorId.set(e.id, { ...e, linea: toLineaKey(first) });
  }
  const nombre = (id: string) => estacionPorId.get(id)?.nombre ?? id;

  const porKey = new Map<LineaKey, LineaSubteV1[]>();
  for (const l of lineasArchivo.lineas) {
    const key = toLineaKey(l.id);
    porKey.set(key, [...(porKey.get(key) ?? []), l]);
  }

  const lineas: LineaSubte[] = [];
  for (const key of LINEA_KEYS) {
    const rutas = porKey.get(key);
    const primera = rutas?.[0];
    if (rutas === undefined || primera === undefined) continue;
    lineas.push(key === 'PM' ? buildPremetro(rutas, nombre) : buildLinea(key, primera, nombre));
  }

  return {
    lineas,
    lineaPorKey: new Map(lineas.map((l) => [l.key, l])),
    estaciones: [...estacionPorId.values()],
    estacionPorId,
  };
}

function buildLinea(key: LineaKey, l: LineaSubteV1, nombre: (id: string) => string): LineaSubte {
  const first = l.estacionIds[0] ?? '';
  const last = l.estacionIds[l.estacionIds.length - 1] ?? '';
  return {
    key,
    nombre: nombreLinea(key),
    badge: key,
    cabeceras: `${nombre(first)} ${EN_DASH} ${nombre(last)}`,
    color: l.color,
    colorTexto: l.colorTexto,
    estaciones: l.estacionIds.map((id) => ({ id })),
    sentidos: l.sentidos.map((s) => ({ cabecera: s.cabecera, estacionIds: s.estacionIds })),
    ids: [l.id],
  };
}

/**
 * Premetro (F4-subtes-1): el ramal más largo primero (General Savio) y después las estaciones
 * exclusivas del otro (Centro Cívico), marcadas con su ramal.
 */
function buildPremetro(rutas: readonly LineaSubteV1[], nombre: (id: string) => string): LineaSubte {
  const ordenadas = [...rutas].sort((a, b) => b.estacionIds.length - a.estacionIds.length);
  const principal = ordenadas[0] as LineaSubteV1;
  const vistos = new Set(principal.estacionIds);
  const estaciones: EstacionEnLinea[] = principal.estacionIds.map((id) => ({ id }));
  const finales = [principal.estacionIds[principal.estacionIds.length - 1] ?? ''];
  for (const otra of ordenadas.slice(1)) {
    const fin = otra.estacionIds[otra.estacionIds.length - 1] ?? '';
    finales.push(fin);
    const ramal = `Ramal ${nombre(fin)}`;
    for (const id of otra.estacionIds) {
      if (vistos.has(id)) continue;
      vistos.add(id);
      estaciones.push({ id, ramal });
    }
  }
  const sentidos: SentidoSubte[] = [];
  for (const r of ordenadas) {
    for (const s of r.sentidos) {
      const igual = sentidos.find((x) => x.cabecera === s.cabecera);
      if (igual === undefined) {
        sentidos.push({ cabecera: s.cabecera, estacionIds: s.estacionIds });
      } else {
        // Misma cabecera en los dos ramales ("Saguier"): un solo sentido con todas sus estaciones.
        const ids = [...igual.estacionIds];
        for (const id of s.estacionIds) if (!ids.includes(id)) ids.unshift(id);
        igual.estacionIds = ids;
      }
    }
  }
  const inicio = principal.estacionIds[0] ?? '';
  return {
    key: 'PM',
    nombre: nombreLinea('PM'),
    badge: 'PM',
    cabeceras: `${nombre(inicio)} ${EN_DASH} ${finales.map(nombre).join(' / ')}`,
    color: principal.color,
    colorTexto: principal.colorTexto,
    estaciones,
    sentidos,
    ids: ordenadas.map((r) => r.id),
  };
}

// ---------------------------------------------------------------- estado y alertas

const SEVERIDAD: Record<EstadoServicioV1, number> = {
  sin_datos: 0,
  normal: 1,
  demorada: 2,
  interrumpida: 3,
};

export interface EstadoLinea {
  estado: EstadoServicioV1;
  /** `header_text` de la alerta más severa. */
  resumen: string | undefined;
}

/** Estado de una línea de la app: el más severo de sus ids (Premetro: PM-C y PM-S). */
export function estadoDeLinea(
  linea: Pick<LineaSubte, 'ids'>,
  estados: readonly EstadoLineaV1[] | undefined,
): EstadoLinea {
  let peor: EstadoLineaV1 | undefined;
  for (const e of estados ?? []) {
    if (!linea.ids.includes(e.linea)) continue;
    if (peor === undefined || SEVERIDAD[e.estado] > SEVERIDAD[peor.estado]) peor = e;
  }
  return { estado: peor?.estado ?? 'sin_datos', resumen: peor?.resumen };
}

/** Alertas que afectan a la línea, sin repetir y en el orden del feed. */
export function alertasDeLinea(
  linea: Pick<LineaSubte, 'ids'>,
  alertas: readonly AlertaV1[] | undefined,
): AlertaV1[] {
  return (alertas ?? []).filter((a) => a.lineas.some((id) => linea.ids.includes(id)));
}

/** "Desde las 14:05" / "Hasta las 18:00" / "De 14:05 a 18:00" (S21, hora de Buenos Aires). */
export function periodoAlerta(alerta: Pick<AlertaV1, 'desde' | 'hasta'>): string | undefined {
  const desde = alerta.desde === undefined ? undefined : horaBsAs(alerta.desde);
  const hasta = alerta.hasta === undefined ? undefined : horaBsAs(alerta.hasta);
  if (desde !== undefined && hasta !== undefined) return `De ${desde} a ${hasta}`;
  if (desde !== undefined) return `Desde las ${desde}`;
  if (hasta !== undefined) return `Hasta las ${hasta}`;
  return undefined;
}

/** HH:MM en la zona de Buenos Aires (UTC−3 fijo: Argentina no tiene horario de verano). */
export function horaBsAs(iso: string): string | undefined {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  const d = new Date(ms - 3 * 60 * 60 * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ---------------------------------------------------------------- búsqueda

/** Minúsculas, sin tildes ni signos (F4-subtes-5). */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Estaciones cuyo nombre (normalizado o GTFS) contiene la consulta, en orden alfabético. */
export function buscarEstaciones(
  estaciones: readonly EstacionSubte[],
  consulta: string,
): EstacionSubte[] {
  const q = normalizar(consulta);
  if (q === '') return [];
  return estaciones
    .filter((e) => normalizar(e.nombre).includes(q) || normalizar(e.nombreGtfs).includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// ---------------------------------------------------------------- arribos

/** < 30 s es "Llegando" (S30). */
export const LLEGANDO_SEGUNDOS = 30;
/** Hasta 3 arribos por sentido (S9). */
export const ARRIBOS_POR_SENTIDO = 3;
/** Con dato más viejo, los tiempos se reemplazan (S30). */
export const ARRIBOS_VIEJOS_SEGUNDOS = 10 * 60;

export function formatArribo(enSegundos: number): { short: string; spoken: string } {
  if (enSegundos < LLEGANDO_SEGUNDOS) return { short: 'Llegando', spoken: 'llegando' };
  const min = Math.max(1, Math.ceil(enSegundos / 60));
  return { short: `${min} min`, spoken: min === 1 ? 'en 1 minuto' : `en ${min} minutos` };
}

export interface BloqueArribos {
  /** "Hacia Plaza de Mayo". */
  titulo: string;
  cabecera: string;
  arribos: ArriboSubteV1[];
}

/**
 * Sentidos que salen de la estación (en una terminal, solo uno) con sus próximos arribos
 * (F4-subtes-3). Siempre devuelve un bloque por sentido del estático, aunque esté vacío.
 */
export function agruparArribos(
  estacionId: string,
  linea: Pick<LineaSubte, 'sentidos'>,
  arribos: readonly ArriboSubteV1[],
  estacionPorId: ReadonlyMap<string, Pick<EstacionSubteV1, 'nombre' | 'nombreGtfs'>>,
): BloqueArribos[] {
  const bloques: (BloqueArribos & { claves: Set<string> })[] = [];
  for (const s of linea.sentidos) {
    const idx = s.estacionIds.indexOf(estacionId);
    // La estación no está en este sentido o es su última parada: de acá no sale hacia allá.
    if (idx === -1 || idx === s.estacionIds.length - 1) continue;
    const ultima = estacionPorId.get(s.estacionIds[s.estacionIds.length - 1] ?? '');
    const claves = new Set(
      [s.cabecera, ultima?.nombre, ultima?.nombreGtfs]
        .filter((x): x is string => x !== undefined)
        .map(normalizar),
    );
    bloques.push({ titulo: `Hacia ${s.cabecera}`, cabecera: s.cabecera, arribos: [], claves });
  }
  const ordenados = [...arribos].sort((a, b) => a.enSegundos - b.enSegundos);
  for (const a of ordenados) {
    const destino = normalizar(a.destino);
    let bloque = bloques.find((b) => b.claves.has(destino));
    if (bloque === undefined) {
      if (destino === '') continue;
      bloque = {
        titulo: `Hacia ${a.destino}`,
        cabecera: a.destino,
        arribos: [],
        claves: new Set([destino]),
      };
      bloques.push(bloque);
    }
    if (bloque.arribos.length < ARRIBOS_POR_SENTIDO) bloque.arribos.push(a);
  }
  return bloques.map(({ titulo, cabecera, arribos: lista }) => ({
    titulo,
    cabecera,
    arribos: lista,
  }));
}
