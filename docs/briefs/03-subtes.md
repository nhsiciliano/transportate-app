# Brief: Subtes

> `shape` · modo **Operate** · plataforma adaptive. Suposiciones marcadas **(suposición)**; consolidadas en [README.md](README.md#suposiciones-consolidadas-a-validar-por-el-usuario).

## 1. Trabajo y audiencia

- **Quién:** alguien bajando a una estación o ya en el andén (a menudo con señal mala), o decidiendo en la vereda si tomar el subte o un colectivo. Incluye visitantes que no conocen la red (`PRODUCT.md:19`).
- **Necesidad:** "¿funciona mi línea?" y "¿en cuánto viene el próximo, en mi sentido?".
- **Modo:** Operate.

## 2. Resultado y evidencia

- **Tarea principal:** ver el estado de todas las líneas y, al elegir una estación, los próximos arribos por sentido.
- **Éxito:** desde el tab, en ≤ 2 toques la persona ve "Plaza de Mayo → 2 min, 7 min" para su andén, con la frescura del dato.
- **Datos reales:**
  - Estado por línea derivado de `/subtes/serviceAlerts` + `/subtes/forecastGTFS` (`docs/01a-api-console.md`, sección MVP; reglas en S7, finales en tarea 2.5). `effect` y `cause` vienen como enteros (`FeedEntityAlert`).
  - Arribos por estación: `/subtes/forecastGTFS` (estructura **no definida** en la spec: se espera TripUpdates; `docs/01a-api-console.md`, sección `/subtes`).
  - Estático: 7 líneas (A, B, C, D, E, H, Premetro) y 108 estaciones con sus andenes `N`/`S` o `E`/`O` (`docs/02b-colores-subte.md`, anexo A).
  - Colores: tabla final de `docs/02b-colores-subte.md` §3 (`#A5C8FF`/negro, `#FF0000`/negro, `#0000FF`/blanco, `#00AC67`/negro, `#8300BB`/blanco, `#FFF300`/negro, Premetro `#FFBD33`/negro).

## 3. Dirección estructural

**Raíz del tab — "Subtes":**
1. Lista de las **7 líneas** (Premetro como una fila, S8) en orden fijo A, B, C, D, E, H, Premetro. Cada fila: `LineBadge` (letra sobre color GTFS, con borde cuando contrasta < 3:1 con la superficie, `docs/02b-colores-subte.md:80`) + nombre de cabeceras ("Plaza de Mayo – San Pedrito") + `StatusChip` + `header_text` de la alerta en 1 línea si existe.
2. FreshnessLabel del conjunto.
3. Acceso "Buscar estación" (`SearchInput` que filtra las 108 estaciones localmente, con la línea a la que pertenecen).

**Detalle de línea — "Línea B":**
1. Encabezado con `LineBadge` grande, cabeceras, `StatusChip`, `FavoriteToggle`.
2. **Alertas activas** de la línea: Alert por alerta, con `header_text` y `description_text` completo (puede ser largo), y su período si `active_period` lo trae ("Desde las 14:05").
3. **Estaciones** en orden de recorrido (diagrama vertical de línea con puntos; el trazo usa el color de la línea): cada estación tocable. Las estaciones afectadas por una alerta (vía `informed_entity.stop_id`) se marcan con ícono *(suposición: si la alerta lo informa)*.

**Detalle de estación — "Medrano (B)":**
1. Encabezado: nombre normalizado, `LineBadge`, `FavoriteToggle`.
2. **Arribos por sentido** (S9): dos bloques, uno por andén, titulados por la cabecera de destino ("Hacia Leandro N. Alem" / "Hacia Juan Manuel de Rosas"), cada uno con hasta 3 próximos: "Llegando", "2 min", "7 min" *(suposición: < 30 s = "Llegando")*. Segmentado opcional si la pantalla es chica (decisión abierta).
3. FreshnessLabel; alerta de la línea si existe (resumida, toca → detalle de línea).
4. Combinaciones *(suposición: si el estático trae `transfers.txt`; la tarea 2.10 lo confirma)*: "Combinás con D (Pueyrredón)".

- **Momento focal:** en la raíz, la columna de chips de estado; en la estación, el primer tiempo de arribo de cada sentido, tipográficamente dominante.
- **Consecuencia para implementación:** `/v1/subtes/estado` (todas las líneas) en la raíz y `/v1/subtes/arribos?estacion=` en el detalle; polling solo en la pantalla visible.

## 4. Alcance y límites

- **Fidelidad:** producción (Fase 4, tareas 4.2–4.3).
- **Incluye** el mapa de red (tarea 4.3) como vista secundaria desde la raíz *(suposición: botón "Ver mapa"; la lista es la vista principal porque responde más rápido y es accesible)*.
- **No hace:** planificación de viaje, tarifas, accesibilidad de estaciones (ascensores) — no hay fuente en la spec —, horarios teóricos.
- **Anti-objetivos:** mostrar "Normal" cuando no hay datos (eso es "Sin información"); presentar el horario teórico (`frequencies.txt`) como si fuera tiempo real.

## 5. Estados y rangos

| Estado | Qué se ve |
|---|---|
| **Carga** (sin caché) | Skeleton de 7 filas; en estación, skeleton de 2 bloques de 3 filas. El nombre de la estación y la línea se muestran ya (son estáticos) |
| **Normal** | §3 |
| **Sin alertas** (0) | Chips "Normal"; en detalle de línea, sin bloque de alertas (no un vacío con ilustración; solo "Sin novedades informadas") |
| **Sin arribos** para una estación | "No hay próximos trenes informados para esta estación." Si es fuera de horario *(suposición: deducible del estático)*: "El servicio no está funcionando a esta hora." |
| **Línea interrumpida** | Chip "Interrumpida" (danger, ícono); en estación de esa línea, Alert `system` danger arriba de los arribos; los arribos que haya se muestran igual (puede ser interrupción parcial) |
| **Dato viejo** | FreshnessLabel warning; > 10 min: los tiempos de arribo se reemplazan por "Dato de hace 12 min" y se atenúan *(suposición: un "2 min" de hace 12 min es engañoso)* |
| **Sin conexión** (frecuente en andenes) | Banner global; estados y arribos de caché con antigüedad; regla de arriba para arribos viejos |
| **Servicio no disponible** | Con caché: Alert "El servicio de la Ciudad no responde" + último dato; sin caché: chips "Sin información" y ErrorState en arribos con reintentar |
| **Feed inexistente** (`forecastGTFS` no disponible pero `serviceAlerts` sí) | Estados se muestran (solo desde alertas: "Normal" pasa a "Sin alertas informadas" *(suposición)*); en estación: "Los próximos arribos no están disponibles por ahora", sin botón de reintento |
| **Sin permiso de ubicación** | No aplica en el MVP *(suposición: no hay "estación más cercana"; si se agrega, mismo bloque de permiso que Colectivos)* |
| **Búsqueda sin resultados** | "No encontramos «Corrientes». Probá con otro nombre de estación." (ojo: "Corrientes" existe en H; ejemplo ilustrativo) |

Rangos realistas:
- **Líneas con alertas:** 0, 1, 7 (paro). Varias alertas por línea: 1–3.
- **Texto de alertas:** de "Demoras" a 500+ caracteres con nombres de estaciones; nunca truncado en el detalle de línea.
- **Arribos por sentido:** 0, 1, 3. Cabeceras terminales: un solo sentido (la estación cabecera muestra solo el sentido que sale).
- **Estaciones por línea:** 9 (C) a 18 (A, E, Premetro).
- **Nombres:** "Congreso de Tucumán", "Ntra. Sra. de Fátima" → 2 líneas a tamaño de texto grande.

## 6. Interacción y layout

- Pull to refresh en las tres pantallas.
- Fila de línea tocable completa → detalle de línea; estación tocable → detalle de estación.
- Haptic de selección al marcar favorito y al cambiar de sentido (si se usa segmentado).
- Lector de pantalla: "Línea B, con demoras" / "Hacia Leandro N. Alem: próximo en 2 minutos, siguiente en 7 minutos. Actualizado hace 10 segundos." El color de la línea nunca es la única pista (la letra siempre está, `PRODUCT.md:96`).
- Transiciones nativas de push; sin animaciones en los tiempos de arribo (el número cambia y listo).

## 7. Restricciones y decisiones abiertas

- Safe areas, large title en la raíz, títulos inline en detalles, back nativo.
- `LineBadge` con borde en las combinaciones de bajo contraste (A, D, H, Premetro en claro; C, E en oscuro, `docs/02b-colores-subte.md:66-72,80`).
- Componentes: `LineBadge`, `StatusChip`, `Alert`, `FreshnessLabel`, `FavoriteToggle`, `SearchInput`, `SegmentedControl`, `Skeleton`, `EmptyState`, `ErrorState`, `MapView` (mapa de red).
- **Abiertas (no inventar):**
  - Reglas exactas de derivación de estado (tarea 2.5), incluida la etiqueta para efectos distintos de demora/interrupción ("Con novedades").
  - Cómo mapear `route_id` de `forecastGTFS`/`serviceAlerts` a `LineaA`… (a confirmar con respuestas reales, `docs/02b-colores-subte.md:28`).
  - Premetro: ¿una fila o dos (PM-C / PM-S)? (S8).
  - Arribos: ¿dos bloques apilados o segmentado por sentido? Recomendación: apilados (se ve todo sin tocar), segmentado solo si con Dynamic Type grande no entran.
  - Si el mapa de red usa colores GTFS o de señalética para los trazos (N2).
