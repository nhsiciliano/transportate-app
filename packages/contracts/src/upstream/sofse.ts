import { z } from 'zod';

/*
 * Esquemas LAXOS de la API comunitaria de trenes (SOFSE / Trenes Argentinos vía
 * https://ariedro.dev/api-trenes). No son contratos v1: solo los usa el adaptador de trenes para
 * leer la fuente sin romperse ante campos nuevos o nulos. Junto con
 * `apps/proxy/src/adapters/trenes/sofse.ts`, es lo único que conoce la forma de esta fuente.
 * Muestras reales: apps/proxy/test/fixtures/sofse/.
 */

const Id = z.union([z.number(), z.string()]);

/** Alerta de línea, ramal o estación. Las fechas `vigencia_*` son hora de Buenos Aires sin offset. */
export const UpstreamSofseAlerta = z.looseObject({
  id: Id,
  linea_id: Id.nullish(),
  ramal_id: Id.nullish(),
  estacion_id: Id.nullish(),
  sentido: Id.nullish(),
  causa_gtfs: Id.nullish(),
  /** Nombre GTFS (`SIGNIFICANT_DELAYS`) o, por las dudas, su número GTFS-RT. */
  efecto_gtfs: Id.nullish(),
  contenido: z.string().nullish(),
  habilitado: z.union([z.number(), z.boolean()]).nullish(),
  vigencia_desde: z.string().nullish(),
  vigencia_hasta: z.string().nullish(),
  criticidad_orden: z.number().nullish(),
});
export type UpstreamSofseAlerta = z.infer<typeof UpstreamSofseAlerta>;

const Alertas = z.array(UpstreamSofseAlerta).nullish();

const Gerencia = z.looseObject({
  id: Id,
  id_empresa: Id.nullish(),
  nombre: z.string(),
  estado: z.looseObject({ id: Id.nullish(), mensaje: z.string().nullish() }).nullish(),
  alerta: Alertas,
});

/** `/infraestructura/gerencias?idEmpresa=1`: las líneas. */
export const UpstreamSofseGerencias = z.array(Gerencia);
export type UpstreamSofseGerencias = z.infer<typeof UpstreamSofseGerencias>;

const Cabecera = z.looseObject({
  id: Id,
  nombre: z.string(),
  nombre_corto: z.string().nullish(),
});

const Ramal = z.looseObject({
  id: Id,
  id_gerencia: Id.nullish(),
  nombre: z.string(),
  publico: z.boolean().nullish(),
  orden_ramal: z.number().nullish(),
  cabecera_inicial: Cabecera.nullish(),
  cabecera_final: Cabecera.nullish(),
  alerta: Alertas,
});

/** `/infraestructura/ramales?idGerencia=<id>`. */
export const UpstreamSofseRamales = z.array(Ramal);
export type UpstreamSofseRamales = z.infer<typeof UpstreamSofseRamales>;

const Estacion = z.looseObject({
  nombre: z.string(),
  id_estacion: Id,
  id_tramo: Id.nullish(),
  orden: Id.nullish(),
  latitud: Id.nullish(),
  longitud: Id.nullish(),
  andenes_habilitados: Id.nullish(),
  visibilidad: z.unknown(),
  incluida_en_ramales: z.array(z.number()).nullish(),
  operativa_en_ramales: z.array(z.number()).nullish(),
});

/** `/infraestructura/estaciones?idRamal=<id>`. */
export const UpstreamSofseEstaciones = z.array(Estacion);
export type UpstreamSofseEstaciones = z.infer<typeof UpstreamSofseEstaciones>;

const Horario = z
  .looseObject({ programada: z.string().nullish(), estimada: z.string().nullish() })
  .nullish();

const CabeceraServicio = z.looseObject({
  id: Id.nullish(),
  nombre: z.string(),
  nombreCorto: z.string().nullish(),
});

/*
 * `/arribos/estacion/<id>?cantidad=N`. Solo se declara lo que usa el proxy: `servicio.desde`,
 * `servicio.hasta` y `servicio.estaciones` (lo pesado) quedan sin validar.
 */
const Resultado = z.looseObject({
  arribo: z.looseObject({
    anden: z.looseObject({ id: Id.nullish(), nombre: Id.nullish() }).nullish(),
    llegada: Horario,
    salida: Horario,
    nombre: z.string().nullish(),
    segundos: z.number().nullish(),
  }),
  servicio: z.looseObject({
    id: Id.nullish(),
    numero: Id.nullish(),
    ramal: z.looseObject({
      id: Id,
      nombre: z.string(),
      cabeceraInicial: CabeceraServicio,
      cabeceraFinal: CabeceraServicio,
    }),
    gerencia: z.looseObject({ id: Id, nombre: z.string().nullish() }),
    sentido: Id,
    cancelacion: z.unknown(),
  }),
});

export const UpstreamSofseArribos = z.looseObject({
  timestamp: z.number(),
  total: z.number().nullish(),
  results: z.array(Resultado),
});
export type UpstreamSofseArribos = z.infer<typeof UpstreamSofseArribos>;
