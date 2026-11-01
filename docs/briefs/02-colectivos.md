# Brief: Colectivos

> `shape` · modo **Operate** · plataforma adaptive. Suposiciones marcadas **(suposición)**; consolidadas en [README.md](README.md#suposiciones-consolidadas-a-validar-por-el-usuario).
> **Esta pantalla no muestra arribos ni tiempos de espera.** La API no tiene `tripUpdates` de colectivos, ni siquiera comentado (`docs/01a-api-console.md`, sección `/colectivos`, y "Lo que el MVP necesita vs lo que la spec ofrece"). Ningún copy, ícono ni layout debe sugerir "llega en X min".

## 1. Trabajo y audiencia

- **Quién:** alguien en una parada o caminando hacia ella, que quiere saber si su colectivo viene y dónde está. También quien busca qué colectivos pasan cerca.
- **Necesidad:** ver **dónde están ahora** los colectivos de una línea, en el mapa, respecto de donde está la persona; y saber si la línea tiene alertas.
- **Modo:** Operate.

## 2. Resultado y evidencia

- **Tarea principal:** elegir una línea → ver sus vehículos en el mapa con su antigüedad.
- **Tarea secundaria:** encontrar paradas cercanas (con o sin ubicación) y ver qué líneas pasan por cada una.
- **Éxito:** en menos de 10 s desde abrir el tab, la persona ve los colectivos de su línea cerca de ella y sabe si el dato es de hace segundos o de hace minutos.
- **Datos reales:**
  - Posiciones por línea: `/colectivos/vehiclePositions` (pb) o `vehiclePositionsSimple` (JSON con `route_short_name`), filtradas por línea en el proxy (`/v1/colectivos/lineas/:id`, `docs/03-arquitectura.md` §3). Campos útiles: lat/lon, `bearing`, `timestamp`, `trip.route_id`, `vehicle.label` (`docs/01a-api-console.md`, tipos `VehiclePosition`, `Position`). Actualización upstream cada 30 s.
  - Alertas por línea: `/colectivos/serviceAlerts` (`header_text`, `description_text`, `effect`, `active_period`).
  - Estático local: líneas, ramales, paradas (GTFS de colectivos preprocesado, `docs/03-arquitectura.md` §6).
- **Lo propio:** búsqueda y paradas cercanas **locales** (sin enviar la ubicación a ningún lado, `docs/05-privacidad.md:34`).

## 3. Dirección estructural

**Raíz del tab — "Colectivos":**
1. `SearchInput` arriba: "Buscá una línea o parada" (búsqueda local sobre el índice estático; por número de línea, nombre de ramal o calle de la parada).
2. **Paradas cercanas** (si hay permiso): lista de las 5–10 paradas más cercanas con distancia ("a 120 m") y las insignias de las líneas que pasan. Sin permiso → bloque de permiso (ver estados).
3. **Líneas recientes** *(suposición: las últimas 5 abiertas, guardadas localmente)* y acceso a favoritos de colectivo.

**Detalle de línea — "Línea 60":**
- Mapa a pantalla casi completa con: posición de la persona (si hay permiso), recorrido del ramal *(suposición: si el estático trae `shapes`)*, paradas de la línea a zoom cercano y **los vehículos activos** como marcadores con rotación por `bearing` (plan 4.6).
- Bottom sheet (S24) en tres alturas *(suposición)*: colapsada = encabezado con `LineBadge`, nombre del ramal, "18 colectivos en servicio", FreshnessLabel y `FavoriteToggle`; media = alertas de la línea (Alert estándar por cada una) + selector de ramal/sentido; expandida = lista de vehículos (interno `label`, "actualizado hace 25 s") para quien usa lector de pantalla o no quiere el mapa.
- Tocar un vehículo: lo resalta y muestra en la sheet "Interno 1404 · actualizado hace 25 s" y opción "Seguir" (la cámara lo sigue en cada refresh; plan 4.6).

**Detalle de parada — "Av. Rivadavia y Acoyte":**
- Información estática: líneas que paran, con `LineBadge` tocable → abre la línea con la cámara centrada en la parada.
- `FavoriteToggle`.
- **Punto de entrada futuro de arribos (N4):** debajo de la lista de líneas quedaría la sección "Próximos arribos". **No se diseña ni se muestra en el MVP**; no se deja un placeholder visible ni un "próximamente".

- **Momento focal:** el marcador de vehículo moviéndose en el mapa cerca del punto azul de la persona.
- **Consecuencia para implementación:** una línea por vez (S10); el polling se activa solo con el detalle de línea visible; el feed completo nunca viaja al teléfono.

## 4. Alcance y límites

- **Fidelidad:** producción (Fase 4, tareas 4.5–4.7).
- **No hace:** arribos/ETA, planificación de viaje, combinaciones, tarifas, SUBE, mostrar todas las líneas a la vez.
- **Anti-objetivos:** estimar tiempos de llegada a partir de posiciones (sería prometer algo que la fuente no da); animar interpolando entre posiciones como si fuera continuo *(suposición: sin interpolación en MVP, el marcador salta con un crossfade breve)*; mapas decorativos.

## 5. Estados y rangos

| Estado | Qué se ve |
|---|---|
| **Índice estático no descargado** (primer uso) | En la raíz: "Preparando el listado de líneas y paradas…" con barra de progreso determinada (tamaño conocido por el manifiesto). La búsqueda se habilita al terminar. Si falla: ErrorState "No pudimos descargar las líneas y paradas" + reintentar |
| **Carga** (detalle de línea) | Mapa visible al instante centrado en la persona o en la línea; sheet con skeleton del encabezado; los marcadores aparecen al llegar el dato |
| **Normal** | §3 |
| **Línea sin vehículos** (0) | Sheet: "No hay colectivos de esta línea con GPS activo ahora." + FreshnessLabel. Es un vacío real (de noche, por ejemplo), no un error *(suposición: distinguible porque el feed respondió OK)* |
| **Búsqueda sin resultados** | "No encontramos «608». Probá con el número de línea o el nombre de una calle." |
| **Dato viejo** | FreshnessLabel warning; > 10 min: marcadores atenuados + Alert "Las posiciones pueden no ser actuales" |
| **Vehículo con dato viejo dentro de un feed fresco** | El marcador de ese vehículo se atenúa si su `timestamp` tiene > 5 min *(suposición)*; la lista lo muestra con su propia antigüedad |
| **GPS inválido** | Vehículos con lat 91 / lon 181 (falla de GPS, `docs/01a-api-console.md`, tipo `Position`) se descartan en el proxy y no se cuentan |
| **Sin conexión** | Banner global; búsqueda y paradas cercanas siguen andando (son locales); detalle de línea con últimas posiciones atenuadas y su antigüedad |
| **Servicio no disponible** | Con caché: posiciones atenuadas + Alert "El servicio de la Ciudad no responde"; sin caché: mapa sin marcadores + ErrorState en la sheet con reintentar |
| **Feed inexistente** | Si `/v1/colectivos/*` respondiera "no disponible" (`retryable: false`), la sheet muestra "Las posiciones de colectivos no están disponibles por ahora"; búsqueda y paradas siguen funcionando |
| **Sin permiso de ubicación** | Bloque en la raíz: "Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono." + "Activar" (diálogo del sistema) y "Buscar a mano". Si se negó antes: "Abrir configuración". En el mapa, sin punto azul, centrado en la línea |
| **Ubicación fuera de CABA** | "No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires." + búsqueda manual |

Rangos realistas:
- **Vehículos por línea:** 0, 3, 200 *(suposición: las líneas más grandes; el feed total ronda 3.200, `docs/00-plan.md:11`)*. Con 200 marcadores, clustering a zoom bajo *(decisión abierta)*.
- **Alertas por línea:** 0 (casi siempre), 1, 5; texto de 20 a 500+ caracteres → la Alert muestra `header_text` y "Ver más" expande `description_text`.
- **Ramales por línea:** 1 a 10+; nombres largos ("Línea 60 A - Constitución - Escobar por Panamericana") en 2 líneas.
- **Paradas cercanas:** 0, 8, 30 en 500 m en el centro; se muestran 10 más "Ver más".

## 6. Interacción y layout

- Pull to refresh en la sheet/lista; en el mapa, botón "Actualizar" en la sheet en vez de pull *(suposición: el gesto de pull choca con el pan del mapa)*.
- Controles del mapa: centrar en mí, norte arriba; zoom con gestos; todos ≥ 44/48.
- Marcadores: forma con dirección (rotación por `bearing`) y número de línea legible; área táctil ampliada a 44/48 aunque el dibujo sea menor.
- Haptic de selección al seguir un vehículo y al marcar favorito.
- Lector de pantalla: el mapa no es la única vía — la lista de vehículos en la sheet expandida da la misma información ("Interno 1404, actualizado hace 25 segundos, a 600 metros de vos" *(suposición: distancia solo si hay permiso)*).
- Reduce Motion: la cámara salta en lugar de animar el seguimiento.

## 7. Restricciones y decisiones abiertas

- Safe areas también sobre el mapa (controles fuera de notch/home indicator); el gesto de volver por borde izquierdo en iOS no debe quedar capturado por el pan del mapa.
- Permiso "mientras se usa", pedido en contexto (al tocar "Paradas cercanas" o "centrar en mí"), nunca al abrir la app.
- Componentes: `SearchInput`, `LineBadge`, `FavoriteToggle`, `Alert`, `FreshnessLabel`, `MapView`, bottom sheet, `EmptyState`, `ErrorState`, `Skeleton`.
- **Abiertas (no inventar):**
  - Clustering de marcadores con muchos vehículos y su umbral.
  - Cómo se representa el sentido (ida/vuelta) si `trip` no lo trae claro; ¿se filtra por ramal o se muestran todos?
  - Si se dibuja el recorrido (depende de que el preprocesado incluya `shapes` sin explotar el tamaño del índice).
  - Qué identifica a un vehículo para la persona: `label` (interno) vs `license_plate`. Recomendación: interno; la patente no aporta y es más "dato personal" *(suposición)*.
  - Arribos (N4): fuera del MVP; si aparece un feed, se agrega en Detalle de parada y en el favorito de parada, con su propio `shape`.
