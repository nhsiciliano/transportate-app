import { z } from 'zod';

/*
 * Esquema LAXO del JSON upstream de `/subtes/forecastGTFS`. No es GTFS-RT: es un formato propio
 * del GCBA (`Header` / `Entity` / `Linea` / `Estaciones`, con mayúsculas mezcladas), igual con o
 * sin `json=1`. No es un contrato v1: solo lo usa el adaptador de subtes.
 * Muestra real: apps/proxy/test/fixtures/subtes/forecastGTFS.json (congelado desde 2026-10-24).
 */

const StopTimeEvent = z.looseObject({
  time: z.number().nullish(),
  delay: z.number().nullish(),
});

const Estacion = z.looseObject({
  stop_id: z.string(),
  stop_name: z.string().nullish(),
  arrival: StopTimeEvent.nullish(),
  departure: StopTimeEvent.nullish(),
});

const Linea = z.looseObject({
  Trip_Id: z.string().nullish(),
  Route_Id: z.string(),
  Direction_ID: z.number().nullish(),
  start_time: z.string().nullish(),
  start_date: z.string().nullish(),
  Estaciones: z.array(Estacion).nullish(),
});

export const UpstreamSubteForecastJson = z.looseObject({
  Header: z.looseObject({ timestamp: z.number().nullish() }),
  Entity: z.array(z.looseObject({ ID: z.string().nullish(), Linea: Linea })).nullish(),
});
export type UpstreamSubteForecastJson = z.infer<typeof UpstreamSubteForecastJson>;
