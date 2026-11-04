// Detalle de línea (tarea 4.6): funciones puras para el mapa y la sheet. Se testean sin React.
// Suposiciones F4-colectivos-mapa-n: README.md, "Línea y mapa".
import type { GeoJsonFeatureCollectionV1, VehiculoV1 } from '@transportate/contracts';

import type { LatLon } from '@/features/ubicacion';
import { distanceMeters } from '@/features/ubicacion';
import { formatAge, type SignBandStatus } from '@/shared/ui';

/** S31: un vehículo con más de 5 min sin reportar se atenúa. */
export const VEHICULO_VIEJO_S = 5 * 60;
/** Feed con más de 10 min: todos atenuados + Alert "Las posiciones pueden no ser actuales". */
export const FEED_VIEJO_S = 10 * 60;
/** F4-colectivos-mapa-3: con más de 80 vehículos se agrupan, solo hasta zoom 13. */
export const CLUSTER_MIN_VEHICULOS = 80;
export const CLUSTER_MAX_ZOOM = 13;

export const SIN_VEHICULOS = 'No hay colectivos de esta línea con GPS activo ahora.';
export const POSICIONES_NO_DISPONIBLES =
  'Las posiciones de colectivos no están disponibles por ahora';
export const POSICIONES_VIEJAS = 'Las posiciones pueden no ser actuales';
export const REFRESH_FALLIDO = 'No pudimos actualizar. Mostramos lo último que sabemos.';

/** Segundos desde el reporte del vehículo, contados con el reloj actual. */
export function edadVehiculo(v: Pick<VehiculoV1, 'ts' | 'edadSegundos'>, now: number): number {
  const ts = Date.parse(v.ts);
  return Number.isFinite(ts) ? Math.max(0, Math.round((now - ts) / 1000)) : v.edadSegundos;
}

/** "18 colectivos en servicio" / "1 colectivo en servicio". */
export function enServicio(n: number): string {
  return `${String(n)} ${n === 1 ? 'colectivo' : 'colectivos'} en servicio`;
}

/** "a 600 m de vos" / "a 1,2 km de vos" (y su versión hablada). */
export function formatDistancia(metros: number): { short: string; spoken: string } {
  if (metros < 1000) {
    const m = Math.max(10, Math.round(metros / 10) * 10);
    return { short: `a ${String(m)} m de vos`, spoken: `a ${String(m)} metros de vos` };
  }
  const km = (Math.round(metros / 100) / 10).toLocaleString('es-AR');
  return { short: `a ${km} km de vos`, spoken: `a ${km} kilómetros de vos` };
}

export interface VehiculoVista {
  id: string;
  lat: number;
  lon: number;
  /** "Interno 1404" (F4-colectivos-mapa-2: el `id` del vehículo del feed). */
  nombre: string;
  edad: number;
  viejo: boolean;
  /** "Interno 1404 · actualizado hace 25 s · a 600 m de vos". */
  texto: string;
  /** Lo mismo para el lector de pantalla, con unidades enteras. */
  hablado: string;
  rumbo: number | null;
  /** Distancia a la persona; `null` sin permiso o sin posición. */
  metros: number | null;
}

export function vistaVehiculo(
  v: VehiculoV1,
  { now, posicion }: { now: number; posicion: LatLon | null },
): VehiculoVista {
  const edad = edadVehiculo(v, now);
  const age = formatAge(edad);
  const nombre = `Interno ${v.id}`;
  const metros = posicion === null ? null : distanceMeters(posicion, { lat: v.lat, lon: v.lon });
  const distancia = metros === null ? null : formatDistancia(metros);
  return {
    id: v.id,
    lat: v.lat,
    lon: v.lon,
    nombre,
    edad,
    viejo: edad > VEHICULO_VIEJO_S,
    texto: [nombre, `actualizado hace ${age.short}`, distancia?.short]
      .filter((x) => x !== undefined)
      .join(' · '),
    hablado: [nombre, `actualizado hace ${age.spoken}`, distancia?.spoken]
      .filter((x) => x !== undefined)
      .join(', '),
    rumbo: v.rumbo ?? null,
    metros,
  };
}

/** Rótulo de la banda del panel cuando muestra el conteo. */
export const ROTULO_EN_SERVICIO = 'En servicio';
export const ROTULO_ACTUALIZADO = 'Actualizado';
export const VALOR_SIN_COLECTIVOS = 'Sin colectivos con GPS ahora';
export const VALOR_SIN_DATOS = 'Sin datos';

/** «Línea 152 · Ramal A»; sin ramal, la cabecera («Línea 152 · Constitución – Retiro»). */
export function mensajeDeLinea(l: {
  numero: string;
  ramal?: string | undefined;
  cabecera?: string | undefined;
}): string {
  const detalle = l.ramal !== undefined && l.ramal !== '' ? `Ramal ${l.ramal}` : l.cabecera;
  return [`Línea ${l.numero}`, detalle].filter((x) => x !== undefined && x !== '').join(' · ');
}

export interface BandaPanelEntrada {
  /** Mensaje de la línea (`mensajeDeLinea`). */
  mensaje: string;
  /** `cargando`: sin respuesta todavía; `error`: sin datos y con falla. */
  estado: 'cargando' | 'error' | 'vacio' | 'datos';
  cantidad: number;
  /** Segundos del dato más viejo de las posiciones; `null` sin vehículos. */
  edadMasVieja: number | null;
  /** Feed con más de 10 min (S31). */
  feedViejo: boolean;
  seleccionado: VehiculoVista | null;
}

export interface BandaPanel {
  message: string;
  label: string;
  /** `null` = cargando. */
  value: string | null;
  valueStyle: 'display' | 'text';
  status: SignBandStatus | undefined;
  /** Cambia con el conteo o con el vehículo elegido: la banda cruza en fundido. */
  transitionKey: string;
  accessibilityLabel: string;
}

/**
 * Contenido de la banda fija del panel (F5-MID-B). Sin vehículo elegido responde «¿cuántos
 * hay?»; con uno elegido se vuelve a señalizar con «Interno 1404 · Actualizado · hace 25 s».
 * Si el feed está viejo, el aviso (warning) manda sobre la antigüedad o la distancia.
 */
export function bandaDelPanel(e: BandaPanelEntrada): BandaPanel {
  const aviso: SignBandStatus | undefined = e.feedViejo
    ? { text: POSICIONES_VIEJAS, tone: 'warning' }
    : undefined;

  if (e.seleccionado !== null) {
    const v = e.seleccionado;
    const distancia = v.metros === null ? undefined : formatDistancia(v.metros);
    return {
      message: v.nombre,
      label: ROTULO_ACTUALIZADO,
      value: `hace ${formatAge(v.edad).short}`,
      valueStyle: 'text',
      status:
        aviso ??
        (distancia === undefined ? undefined : { text: distancia.short, tone: 'muted' as const }),
      transitionKey: `interno-${v.id}`,
      accessibilityLabel: [v.hablado, aviso?.text].filter((x) => x !== undefined).join(', '),
    };
  }

  const base = { message: e.mensaje, label: ROTULO_EN_SERVICIO };
  if (e.estado === 'cargando') {
    return {
      ...base,
      value: null,
      valueStyle: 'display',
      status: undefined,
      transitionKey: 'cargando',
      accessibilityLabel: `${e.mensaje}, buscando colectivos`,
    };
  }
  if (e.estado === 'error') {
    return {
      ...base,
      value: VALOR_SIN_DATOS,
      valueStyle: 'text',
      status: undefined,
      transitionKey: 'error',
      accessibilityLabel: `${e.mensaje}, ${POSICIONES_NO_DISPONIBLES.toLowerCase()}`,
    };
  }
  const antiguedad =
    e.edadMasVieja === null
      ? undefined
      : { short: formatAge(e.edadMasVieja).short, spoken: formatAge(e.edadMasVieja).spoken };
  const status =
    aviso ??
    (antiguedad === undefined
      ? undefined
      : { text: `hace ${antiguedad.short}`, tone: 'muted' as const });
  const hablado = [
    e.mensaje,
    e.estado === 'vacio' ? SIN_VEHICULOS : enServicio(e.cantidad),
    antiguedad === undefined ? undefined : `dato más viejo de hace ${antiguedad.spoken}`,
    aviso?.text,
  ]
    .filter((x) => x !== undefined)
    .join(', ');
  return {
    ...base,
    value: e.estado === 'vacio' ? VALOR_SIN_COLECTIVOS : String(e.cantidad),
    valueStyle: e.estado === 'vacio' ? 'text' : 'display',
    status,
    transitionKey: `conteo-${String(e.cantidad)}`,
    accessibilityLabel: hablado,
  };
}

export interface VehiculoProps {
  [key: string]: string | number | boolean | null;
  id: string;
  /** Lo que se lee sobre el marcador ("60"). */
  etiqueta: string;
  /** Atenuado: dato viejo del vehículo, feed viejo, sin conexión o actualización fallida. */
  atenuado: boolean;
  seleccionado: boolean;
  /** `null` si el feed no trae rumbo (hoy nunca lo trae): sin flecha. */
  rumbo: number | null;
}

/** Puntos para el `GeoJSONSource` de vehículos. */
export function vehiculosCollection(
  vehiculos: readonly VehiculoVista[],
  {
    etiqueta,
    todosAtenuados,
    seleccionadoId,
  }: { etiqueta: string; todosAtenuados: boolean; seleccionadoId: string | null },
): GeoJSON.FeatureCollection<GeoJSON.Point, VehiculoProps> {
  return {
    type: 'FeatureCollection',
    features: vehiculos.map((v) => ({
      type: 'Feature',
      id: v.id,
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      properties: {
        id: v.id,
        etiqueta,
        atenuado: todosAtenuados || v.viejo,
        seleccionado: v.id === seleccionadoId,
        rumbo: v.rumbo,
      },
    })),
  };
}

/** Recorrido de un número de línea (`recorridos-colectivos.geojson` trae uno por número). */
export function recorridoDe(
  recorridos: GeoJsonFeatureCollectionV1 | undefined,
  numero: string,
): GeoJSON.FeatureCollection | null {
  if (recorridos === undefined) return null;
  const features = recorridos.features.filter((f) => String(f.properties?.['numero']) === numero);
  if (features.length === 0) return null;
  return { type: 'FeatureCollection', features };
}

/** Orden de la lista: con ubicación, el más cercano primero; sin ubicación (o en empate), los
 *  más recientes primero y después por interno (F4-colectivos-mapa-11). */
export function ordenarVehiculos(vehiculos: readonly VehiculoVista[]): VehiculoVista[] {
  return [...vehiculos].sort(
    (a, b) =>
      (a.metros ?? Infinity) - (b.metros ?? Infinity) ||
      a.edad - b.edad ||
      a.id.localeCompare(b.id, 'es'),
  );
}

// ---- lista a menos de 3 km (F5-MID-C, F5-colectivos-12)

/** Hasta dónde llega la lista de colectivos cuando se conoce la posición de la persona. */
export const RADIO_LISTA_METROS = 3000;
export const ROTULO_LISTA_TODOS = 'Colectivos en servicio';
export const ROTULO_LISTA_CERCA = 'Colectivos a menos de 3 km';

/**
 * Los colectivos que entran en la lista: los que están a ≤ `RADIO_LISTA_METROS`. El vehículo
 * `seleccionado` (o seguido) se queda aunque se haya alejado, para no sacarlo de abajo del dedo.
 * Sin distancia (`metros === null`: sin permiso o sin posición) no hay con qué filtrar y pasa
 * todo. Conserva el orden de entrada.
 */
export function filtrarCercanos(
  vehiculos: readonly VehiculoVista[],
  { seleccionado }: { seleccionado: string | null },
): VehiculoVista[] {
  return vehiculos.filter(
    (v) => v.metros === null || v.metros <= RADIO_LISTA_METROS || v.id === seleccionado,
  );
}

/** «3 de 7 en servicio»: cuántos de los de la línea muestra la lista. */
export function resumenDeLista(visibles: number, total: number): string {
  return `${String(visibles)} de ${String(total)} en servicio`;
}

/** El vacío de la lista cuando hay colectivos pero ninguno a menos de 3 km. */
export function mensajeSinCercanos(total: number): string {
  const hay = total === 1 ? 'Hay 1 en servicio' : `Hay ${String(total)} en servicio`;
  return `Ningún colectivo a menos de 3 km. ${hay} más lejos.`;
}
