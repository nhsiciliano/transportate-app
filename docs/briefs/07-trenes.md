# Brief: Trenes

> `shape` · modo **Operate** · plataforma adaptive. Fase 6 (2026-11-05). Suposiciones marcadas **(suposición)**; consolidadas en [README.md](README.md#suposiciones-consolidadas-a-validar-por-el-usuario) (S34 en adelante). Contrato de dirección visual: `apps/mobile/.impeccable/surfaces/src-features-trenes-trenesscreen-tsx.md`. Fuente de datos y sus riesgos: [`../01d-api-trenes-sofse.md`](../01d-api-trenes-sofse.md). Colores: [`../02c-colores-trenes.md`](../02c-colores-trenes.md) (provisorios).

## 1. Trabajo y audiencia

- **Quién:** alguien yendo a una estación de tren, o ya en el andén, o decidiendo en la puerta de casa si le da el tiempo; mucha gente del conurbano que entra a CABA. A menudo con señal mala. Incluye visitantes que no conocen los nombres de los ramales (`PRODUCT.md`).
- **Necesidad:** "¿funciona mi línea?" y "¿cuándo sale el próximo tren hacia mi destino desde mi estación?".
- **Modo:** Operate.

## 2. Resultado y evidencia

- **Tarea principal:** ver el estado de las 6 líneas y, al elegir una estación, los próximos trenes por destino con la hora programada y la estimada.
- **Éxito:** desde el tab, en ≤ 3 toques (línea → ramal → estación) o en 2 (búsqueda de estación → estación) la persona ve "Hacia Moreno · 4 min · después 7 y 12 min" con la frescura del dato. Con la estación guardada, en 1 toque desde Inicio o Favoritos.
- **Datos reales** (2026-11-05, `01d-api-trenes-sofse.md`):
  - Líneas: `/infraestructura/gerencias` con sus alertas; ramales: `/infraestructura/ramales?idGerencia=`; estaciones: `/infraestructura/estaciones?idRamal=`; arribos: `/arribos/estacion/<id>`.
  - Estático: 6 líneas, 27 ramales públicos, ~300 estaciones con latitud y longitud (paquete en R2: `trenes-lineas.json`, `trenes-estaciones.json`, ~60 KB).
  - Colores: tabla de `02c-colores-trenes.md` (todos provisorios).
  - **Lo que no hay:** estado operativo de la línea (el campo `estado` de `gerencias` es siempre «Alertas por ramal»), posición en mapa en esta fase, Belgrano Norte ni Urquiza.

## 3. Dirección estructural

**Raíz del tab — "Trenes":**
1. `SearchInput` «Buscá una estación» que filtra las ~300 estaciones localmente (sin red), con la línea y los ramales a los que pertenece cada resultado.
2. Lista de las **6 líneas** en orden fijo: Roca, Sarmiento, Mitre, San Martín, Belgrano Sur, Tren de la Costa (S35). Cada fila: insignia rectangular (siglas sobre el color de línea) + «Línea Roca» + cabeceras o «12 ramales» + estado a la derecha + resumen de la alerta más severa en una línea si existe.
3. `FreshnessLabel` del conjunto. **Sin mapa** (S34).

**Detalle de línea — "Línea Sarmiento":**
1. Banda con el estado de la línea.
2. **Alertas de la línea** (las que no apuntan a un ramal): `Alert` por alerta, con el texto completo y su vigencia ("Hasta el 6/11").
3. **Ramales** de la línea (1 a 12) en una placa: nombre ("Once – Moreno"), cabeceras y estado de cada uno. Tocar un ramal abre el ramal.

**Detalle de ramal — "Once – Moreno":**
1. Banda con el estado del ramal; estrella de favorito (S37).
2. **Alertas del ramal**, agrupadas: las que valen para todo el ramal y las de un sentido ("Hacia Moreno: el último tren partirá a las 23:02 por obras"). Si una alerta trae `sentido`, el título del sentido usa la cabecera (S39).
3. **Estaciones** en orden de recorrido (16 en Once–Moreno), con el trazo vertical del color de la línea; cada una tocable. Las que figuran como incluidas en el ramal pero **no operativas** (Flores en el ramal 111) se marcan "Sin servicio en este ramal" y no abren arribos de ese ramal.

**Detalle de estación — "Caballito":**
1. Encabezado: nombre, insignia de la línea (o las insignias, si sirve a varias), estrella de favorito (S37).
2. **Arribos por destino**: una banda por ramal y sentido ("Hacia Moreno", "Hacia Once"), con el próximo ("Próximo · 4 min"), "Después 7 y 12 min" (hasta 3 por destino, S9), andén y ramal ("Andén 3 · Ramal Once–Moreno"). Con demora (la `estimada` supera a la `programada`; el umbral exacto, tal vez la `tolerancia` del ramal, es una suposición a validar con datos reales), se muestra la hora estimada y la programada al lado. Un tren **cancelado** no cuenta como próximo (S40).
3. Alerta de la estación, el ramal o la línea, resumida; toca → detalle.
4. `FreshnessLabel`.

- **Momento focal:** en la raíz, la columna de estados; en la estación, el primer tiempo de cada destino, tipográficamente dominante.
- **Consecuencia para implementación:** `/v1/trenes/estado` (6 líneas con ramales y alertas) en la raíz, la línea y el ramal; `/v1/trenes/arribos?estacion=` en la estación; el paquete estático para búsqueda y para el orden de estaciones; polling solo en la pantalla visible (S38).

## 4. Alcance y límites

- **Fidelidad:** producción (Fase 6, tarea 6.4).
- **Incluye:** favoritos de **ramal** y de **estación** (S37); búsqueda local de estaciones; estado derivado de alertas (S36); atribución honesta de la fuente en Acerca de.
- **No hace:** mapa de trenes ni posición del tren en pantalla (la fuente trae `location` por servicio: queda para una fase posterior); planificación de viaje, tarifas, accesibilidad de estaciones; horarios teóricos completos (el programado se muestra solo como referencia de la demora); Belgrano Norte y Urquiza.
- **Anti-objetivos:** mostrar "Sin sobresaltos" o "Normal" cuando no hay datos (eso es "Sin información"); mostrar un horario de hace 15 minutos como si fuera de ahora; presentar los arribos como oficiales de SOFSE (son de una API comunitaria); inventar un estado de línea que la fuente no da.

## 5. Estados y rangos

| Estado | Qué se ve |
|---|---|
| **Carga** (sin caché) | Skeleton de 6 filas en la raíz; en estación, skeleton de 2 bandas. El nombre de la estación y de la línea se muestran ya (son estáticos) |
| **Normal** | §3 |
| **Sin alertas** (0) | Estado "Sin novedades" en las filas; en línea y ramal, sin bloque de alertas ("Sin novedades informadas") |
| **Sin arribos** para una estación | "No hay próximos trenes informados para esta estación." Si es fuera de horario (S41): "No hay trenes programados a esta hora." |
| **Ramal interrumpido** | Estado "Interrumpida" (rojo, con texto); en estación de ese ramal, `Alert` danger arriba de los arribos; los arribos que haya se muestran igual |
| **Tren cancelado** | No es el próximo; si hay un solo tren y está cancelado: "Cancelado" en el destino (S40) |
| **Dato viejo** | `FreshnessLabel` warning; > 10 min: los tiempos de arribo se reemplazan por "Dato de hace 12 min" y se atenúan (S30) |
| **Sin conexión** | Banner global; estados y arribos de caché con antigüedad; misma regla de arribos viejos |
| **Fuente caída** (instancia comunitaria sin respuesta, cifrado rotado o kill-switch `TRENES_ENABLED=false`) | Con caché: `Alert` "La fuente de datos de trenes no responde." + último dato marcado como viejo. Sin caché: estados "Sin información" en las 6 líneas y `ErrorState` en arribos con reintentar. **Nunca** datos inventados ni "Sin novedades" (S42) |
| **Estación sin servicio** (no operativa) | La estación abre con "Sin servicio en este ramal" y sin banda de arribos |
| **Sin permiso de ubicación** | No aplica: no hay "estación más cercana" en esta fase |
| **Búsqueda sin resultados** | "No encontramos «Plaza Italia». Probá con otro nombre de estación." |
| **Favorito huérfano** (estación o ramal que ya no está en el paquete estático) | Como en Subtes: fila con "Ya no está disponible" y acción de quitar |

Rangos realistas:
- **Líneas con alertas:** casi todas tienen al menos una informativa (hoy, la del CUD con SUBE en las seis); alertas de ramal con sentido: 0–3.
- **Texto de alertas:** de "Demoras" a 300+ caracteres; nunca truncado en los detalles.
- **Ramales por línea:** 1 (Tren de la Costa) a 12 (Roca).
- **Estaciones por ramal:** 16 (Once–Moreno); algunas con 4 ramales (Liniers) o 4 andenes (Caballito).
- **Arribos por estación:** 0, 1 o hasta 13 trenes en Retiro; las cabeceras tienen un solo sentido (Retiro: todos salen "Hacia" su destino).
- **Nombres de ramal:** "Villa Ballester – Zárate", "Retiro – J. L. Suárez", "Victoria – Capilla del Señor" → 2 líneas con texto grande.

## 6. Interacción y layout

- Pull to refresh en las cuatro pantallas.
- Fila de línea tocable completa → línea; ramal → ramal; estación → estación.
- Haptic de selección al marcar favorito.
- Lector de pantalla: "Línea Sarmiento, con demoras" / "Hacia Moreno: próximo en 4 minutos, después en 7 y 12 minutos. Andén 3. Actualizado hace 10 segundos." El color de la línea nunca es la única pista: las siglas siempre están.
- Transiciones nativas de push; sin animaciones en los tiempos de arribo (el número cambia y listo).

## 7. Restricciones y decisiones abiertas

- Safe areas, large title en la raíz, títulos inline en los detalles, back nativo.
- Insignia de línea con **borde** donde el color no llega a 3:1 con la superficie (Roca, Mitre y San Martín en claro; Tren de la Costa en oscuro; `02c-colores-trenes.md` §3).
- Componentes: insignia de línea (ver abajo), `StatusChip` (o su equivalente en estado), `Alert`, `FreshnessLabel`, `FavoriteToggle`, `SearchInput`, `Skeleton`, `EmptyState`, `ErrorState`, `OfflineBanner`. Los componentes de `features/subtes` que haga falta compartir (placa de tablero, trazo de recorrido) se reutilizan en la ola 2 y se mueven a `shared/ui` en la tarea 6.8.
- **Abiertas (no inventar):**
  - Colores oficiales de las líneas (tarea 6.6).
  - Reglas exactas de derivación del estado (S36): qué efectos cuentan como "Con demoras".
  - Cuántas bandas caben en una estación con muchos destinos antes de bajar a placa (propuesta: dos).
  - Belgrano Norte y Urquiza: ¿se aclara en pantalla que no están? Recomendación: una nota al pie de la placa.
  - Tira «Trenes ahora» en Inicio: fuera de la Fase 6.
  - Orden de la tab: ¿después de Subtes (propuesta) o antes de Favoritos?
