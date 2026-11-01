import { z } from 'zod';

/*
 * Esquema LAXO del JSON upstream de `/subtes/serviceAlerts?json=1` (GTFS-RT en
 * snake_case serializado por el GCBA). No es un contrato v1: solo lo usan los
 * adaptadores para leer el upstream sin romperse ante campos nuevos o nulos.
 * Muestra real: apps/proxy/test/fixtures/subtes/serviceAlerts.json=1.json.
 */

const Translation = z.looseObject({
  text: z.string(),
  language: z.string().nullish(),
});

const TranslatedString = z.looseObject({
  translation: z.array(Translation).nullish(),
});

const TimeRange = z.looseObject({
  start: z.number().nullish(),
  end: z.number().nullish(),
});

const EntitySelector = z.looseObject({
  agency_id: z.string().nullish(),
  route_id: z.string().nullish(),
  route_type: z.number().nullish(),
  stop_id: z.string().nullish(),
  trip: z.unknown().nullish(),
});

const Alert = z.looseObject({
  active_period: z.array(TimeRange).nullish(),
  informed_entity: z.array(EntitySelector).nullish(),
  cause: z.number().nullish(),
  effect: z.number().nullish(),
  url: TranslatedString.nullish(),
  header_text: TranslatedString.nullish(),
  description_text: TranslatedString.nullish(),
});

const Entity = z.looseObject({
  id: z.string(),
  is_deleted: z.boolean().nullish(),
  alert: Alert.nullish(),
});

export const UpstreamSubteAlertsJson = z.looseObject({
  header: z.looseObject({
    gtfs_realtime_version: z.string().nullish(),
    incrementality: z.number().nullish(),
    timestamp: z.number().nullish(),
  }),
  entity: z.array(Entity).nullish(),
});
export type UpstreamSubteAlertsJson = z.infer<typeof UpstreamSubteAlertsJson>;
