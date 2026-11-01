# ADR-0006 — Paradas de colectivo: catálogo BA + tabla de equivalencias aprendida

- **Estado:** Propuesta (2026-11-01). La confirma el usuario; hasta entonces la Fase 2 puede avanzar con el catálogo BA y la tabla de equivalencias, pero no incorpora OSM.
- **Origen:** `docs/01b-gtfs-alternativos.md` (tarea 1.11) y `docs/00-plan.md`, "Correcciones tras la Fase 1". Captura de 24–48 h: `tools/captura-posiciones/`.

## Contexto

Para mostrar paradas y arribos de colectivos hacen falta tres cosas: **dónde está la parada** (y cómo se llama), **qué líneas paran** y **qué `stop_id` del tiempo real corresponde a esa parada**.

Lo que hay hoy (verificado el 2026-11-01):

- **No existe un GTFS de colectivos vigente y público.** El de la API (`/colectivos/feed-gtfs`, 209 MB) es de 2021; el de BA Data/Mobility Database es de 2019; la Nación no publica GTFS (`01b`, §1).
- **Los IDs del tiempo real no cruzan con el estático.** De los 252 `route_id` que existen en ambos lados, **0** son la misma línea. Solo el 40 % de los `stop_id` de `tripUpdates` existe en el GTFS de 2021, y el 10 % (los de formato `S…`) tiene 0 % de cruce (`01b`, §3).
- **Los `stop_id` numéricos parecen estables:** el 79 % de los vehículos está a menos de 1 km de la parada que informa (p50 234 m), pero un 21 % tiene distancias de varios kilómetros (IDs reasignados) (`01b`, §3).
- **Hay un catálogo oficial vigente de paradas en CABA:** el dataset "Colectivos: paradas" de BA Data, actualizado el **2026-09-21**, licencia **CC-BY-2.5-AR**, 7.027 paradas con calle, altura, coordenadas y hasta 6 líneas con sentido. **No trae `stop_id`.** El 69,5 % de los `stop_id` ubicables en CABA tiene una de esas paradas a ≤ 40 m (p50 8 m).
- **OpenStreetMap** (`highway=bus_stop`, 8.687 nodos en el bbox de CABA) cubre más (78,8 % a ≤ 40 m), pero no tiene líneas por parada y su licencia es **ODbL 1.0**, con *share-alike*: una base de datos derivada que lo mezcle con datos propios queda alcanzada por esa licencia.
- La app resuelve búsqueda y paradas cercanas **sin red**, contra un índice estático (`03-arquitectura.md`, §6), así que lo que se publique en ese índice es una base de datos derivada que se distribuye con la app.

## Decisión

1. **Catálogo de paradas: el dataset oficial de BA Data** ("Colectivos: paradas", CC-BY-2.5-AR). Es lo que ve la persona: nombre (calle y altura), ubicación y líneas que paran. Se atribuye en "Acerca de" (`05-privacidad.md`, §7). Se revisa su `Last-Modified` cada 6 meses.
2. **Tabla de equivalencias propia `stop_id` (tiempo real) → parada BA**, que se arma y mejora con datos propios:
   - **Semilla (offline, una vez):** los `stop_id` numéricos del tiempo real que existen en el `stops.txt` del GTFS 2021 toman sus coordenadas, descartando los que quedan a más de 1 km de los vehículos que los informan.
   - **Aprendizaje:** acumular `vehiclePositions` (parada informada + posición del vehículo, cada 60 s) durante días; estimar el punto de cada `stop_id` y **ajustarlo a la parada BA más cercana a ≤ 40 m que tenga el mismo número de línea** (`L1…L6`).
   - **Confianza por fila:** cada equivalencia guarda su origen (`gtfs2021`, `aprendida`, `ajustada-BA`) y la cantidad de observaciones. La app muestra arribos **solo** donde hay equivalencia con confianza suficiente; en el resto, la parada aparece sin arribos.
3. **No usar OpenStreetMap en el MVP.** Ni como fuente de paradas, ni de nombres, ni de respaldo en el preprocesado. Así el índice estático y la tabla de equivalencias quedan **solo con BA Data (CC-BY-2.5-AR) y datos derivados del tiempo real** y no heredan las obligaciones de ODbL (publicar la base derivada bajo la misma licencia). El mapa base de OpenFreeMap/OSM es otra cosa: es una capa de renderizado con su propia atribución (ADR-0002) y no se mezcla con esta base.
4. **Líneas y ramales** no salen de ningún GTFS: se arman desde el propio tiempo real (`vehiclePositionsSimple`: `route_short_name`, `agency_name`, `trip_headsign`), unidos por **empresa normalizada + número**, nunca por `route_id`.
5. **Midiendo antes de comprometerse:** la cobertura real del aprendizaje se mide con la captura continua de 24–48 h (`tools/captura-posiciones/`) al inicio de la Fase 2. Si la cobertura es insuficiente, la decisión 2 se revisa (ver "Consecuencias").

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **Usar el GTFS de la API (2021)** como catálogo y para cruzar | Cruza solo el 40 % de los `stop_id` y 0 líneas por `route_id`. Muestra paradas que pueden no existir o haberse movido, con nombres de hace cinco años. |
| **Esperar o pedir un GTFS vigente** | No existe público. Se pide igual (`docs/solicitud-gtfs-gcba.md`), pero no se puede planificar sobre algo que puede no llegar. Si aparece, `tools/gtfs-cruce/cruce.mjs` lo evalúa en minutos y este ADR se reemplaza. |
| **OSM `bus_stop` como catálogo principal o como respaldo para nombres** | Mejor cobertura (78,8 % vs. 69,5 %) pero sin líneas por parada y con ODbL *share-alike*. Si el índice mezcla OSM, hay que publicar la base derivada bajo ODbL o cuidar la separación de bases; es una carga legal y operativa que el MVP no necesita. Se puede reabrir en un ADR posterior, con asesoramiento, si la cobertura de BA resulta insuficiente. |
| **Geocodificación inversa para los nombres faltantes** | Depende de un servicio externo (costo, licencia, privacidad) o de OSM (ver arriba). Sin nombre, la parada simplemente no se muestra con arribos. |
| **Solo arribos por línea, sin paradas** | Pierde la función central de "cuándo llega a mi parada". Es el plan de contingencia si la cobertura es muy baja, no el punto de partida. |
| **Mostrar arribos de todas las paradas del tiempo real aunque no estén ubicadas** | Sin nombre ni posición no hay forma de que la persona reconozca la parada, y los IDs reasignados pueden mostrar datos de otra parada. |

## Consecuencias

- (+) El catálogo que ve la persona es oficial, vigente (2026) y con licencia compatible con uso comercial y obras derivadas, solo con atribución.
- (+) El índice estático no hereda ODbL, así que se puede distribuir con la app sin condiciones de re-licenciamiento.
- (+) La tabla mejora con el tiempo y no depende de que alguien publique un GTFS nuevo.
- (−) **Cobertura parcial de arribos:** hoy ~40 % de las predicciones tienen parada ubicable, y de esas el 69,5 % se ajusta a una parada oficial. La UI tiene que **ocultar arribos en paradas sin equivalencia** (`docs/briefs/02-colectivos.md`) y no prometer "todas las paradas".
- (−) El catálogo BA cubre solo CABA y se actualiza cada medio año; las paradas nuevas (`S…`) aparecen en el tiempo real antes que en el dataset. El aprendizaje cubre parte del desfase, no todo.
- (−) Hay que operar un **job de aprendizaje** (dónde corre y cuánto cuesta, por ejemplo cron de Worker + D1/R2, se define en Fase 2) y revisar la calidad de la tabla (falsos positivos por `stop_id` reasignados): validación espacial obligatoria, nunca confiar en un id sin verificar su posición.
- (−) La atribución CC-BY-2.5-AR es obligatoria y debe ser visible en la app.
- Si la captura de 24–48 h muestra que la cobertura aprendida es demasiado baja, las salidas son: (a) conseguir un GTFS vigente (solicitud al GCBA), (b) abrir un ADR para evaluar OSM con su licencia, o (c) limitar los arribos a las líneas/paradas con equivalencia confirmada.
