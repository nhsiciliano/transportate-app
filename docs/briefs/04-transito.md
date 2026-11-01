# Brief: Tránsito

> `shape` · modo **Operate** · plataforma adaptive. Suposiciones marcadas **(suposición)**; consolidadas en [README.md](README.md#suposiciones-consolidadas-a-validar-por-el-usuario).
> **Fuente sin confirmar.** `/transito/v1/cortes` está **comentado** en la spec oficial (`docs/fuentes/api-transporte-v1.raml:1260-1289`; `docs/01a-api-console.md`, "Recursos comentados"). Otro worker verifica si igual responde (tarea 1.3). Este brief diseña la pantalla con **"Fuente no disponible" como estado de primera clase** y usa **solo** los campos de `CortesEntity`.

## 1. Trabajo y audiencia

- **Quién:** quien viaja en colectivo (o camina/maneja) y quiere saber si hay calles cortadas que desvíen su recorrido; uso menos frecuente que Subtes/Colectivos *(suposición)*.
- **Necesidad:** "¿hay cortes cerca de donde voy?", con ubicación y motivo.
- **Modo:** Operate.

## 2. Resultado y evidencia

- **Tarea principal:** ver los cortes vigentes en un mapa y en una lista, filtrar por tipo y abrir el detalle.
- **Éxito:** la persona encuentra en segundos si hay un corte en una zona y por qué, o entiende sin ambigüedad que la información no está disponible.
- **Datos que existen** (`CortesEntity`, spec L507–L530; `docs/01a-api-console.md`): por corte, `id`, `geometry` (`type` + `coordinates`; Point o LineString, a confirmar) y `properties` = **`Nombre`**, **`Motivo`**, **`Id`**, **`Tipo`**.
- **Datos que NO existen** en la spec y no se deben diseñar: fecha/hora de inicio y fin, duración, severidad, desvíos de líneas de colectivo, sentido, calles alternativas. Si la respuesta real trae más campos, se agregan en una revisión del brief, no por iniciativa del builder.

## 3. Dirección estructural

**Raíz del tab — "Tránsito":**
1. `SegmentedControl` **Lista | Mapa**, con Lista por defecto *(suposición: más accesible y rápida de escanear; S26)*.
2. Fila de filtros por **Tipo** (badges secundarias clickeables como chips, `docs/02-obelisco-tokens.md` §4 "Chip") con los valores que traiga el feed (S13) + "Todos". Con 1 solo tipo, no se muestran filtros.
3. **Lista:** cada corte como fila: `Nombre` (título, p. ej. "Av. Corrientes entre Callao y Uruguay"), `Tipo` como badge, `Motivo` en una línea con elipsis; distancia a la persona si hay permiso ("a 1,2 km") *(suposición)*. Orden: por cercanía si hay ubicación; si no, alfabético por `Nombre` *(suposición)*.
4. **Mapa:** cortes como marcadores (Point) o trazos (LineString) con color de estado warning/danger según `Tipo` *(decisión abierta: el mapeo tipo→color no está definido)*; tocar → bottom sheet con el detalle.
5. FreshnessLabel común a lista y mapa.

**Detalle de corte** (sheet desde el mapa o push desde la lista): `Nombre`, `Tipo`, `Motivo` completo, mini-mapa con la geometría, botón "Ver en el mapa". Nada más (no hay más datos).

- **Momento focal:** en lista, el `Nombre` (la calle) — es lo que la persona reconoce; en mapa, la geometría sobre su recorrido.
- **Consecuencia para implementación:** `/v1/transito/cortes` devuelve una lista + GeoJSON mínimo (plan 2.7); la app no conoce el formato upstream (XML/GeoJSON/CIFS, `docs/01a-api-console.md`).

## 4. Alcance y límites

- **Fidelidad:** producción (Fase 4, tarea 4.8), condicionada a N3.
- **No hace:** guardar cortes en favoritos (S14), alertas push, rutas alternativas, semáforos, estacionamiento (existen en la spec pero están fuera del MVP).
- **Anti-objetivos:** inventar vigencia ("hasta las 18 h") o severidad; mostrar una lista vacía cuando en realidad la fuente no respondió.

## 5. Estados y rangos

| Estado | Qué se ve |
|---|---|
| **Fuente no disponible** (feed inexistente: el proxy responde `retryable: false`) | Estado de pantalla completa, **informativo y sin reintento**: ícono + "La información de cortes de tránsito no está disponible por ahora." + texto secundario "La Ciudad no está publicando estos datos. Cuando vuelvan a estar disponibles, los vas a ver acá." *(suposición: copy a validar)*. Sin filtros ni segmentado. No se culpa a la persona ni se sugiere revisar la conexión |
| **Carga** | Skeleton de 6 filas (lista) / mapa sin marcadores con indicador de carga en la sheet |
| **Normal** | §3 |
| **Sin cortes** (0, la fuente respondió OK) | EmptyState positivo: "No hay cortes informados en este momento." + FreshnessLabel (la persona tiene que ver que el "no hay" es reciente) |
| **Filtro sin resultados** | "No hay cortes de tipo «Obra» ahora." + "Ver todos" |
| **Dato viejo** | FreshnessLabel warning; > 10 min, Alert "Los cortes pueden haber cambiado" *(suposición: los cortes cambian más lento; quizá umbrales distintos, decisión abierta)* |
| **Sin conexión** | Banner global; lista/mapa desde caché con antigüedad |
| **Servicio no disponible** (`retryable: true`) | Con caché: último dato + Alert con reintentar; sin caché: ErrorState "El servicio de la Ciudad no responde" + "Volver a intentar". Distinto de "Fuente no disponible" |
| **Sin permiso de ubicación** | La lista funciona igual (sin distancias, orden alfabético); el mapa abre centrado en CABA; aviso discreto "Activá la ubicación para ordenar por cercanía" con acción. No se bloquea nada |
| **Geometría inválida o ausente** | El corte aparece en la lista sin "Ver en el mapa" *(suposición)* |

Rangos realistas *(suposición: sin datos reales todavía)*:
- **Cortes:** 0, 12, 150 (eventos masivos/marchas).
- **`Tipo`:** 1 a ~6 valores distintos; textos de 4 a 25 caracteres.
- **`Nombre`:** de "Florida" a "Av. Presidente Figueroa Alcorta entre Av. Sarmiento y La Pampa" (2–3 líneas).
- **`Motivo`:** de "Obra" a varios párrafos; en lista 1 línea, en detalle completo.

## 6. Interacción y layout

- Pull to refresh en la lista; en mapa, botón "Actualizar" en la sheet (mismo criterio que Colectivos).
- Polling con intervalo propio más largo *(suposición: 60 s o más; los cortes no cambian cada 20 s — decisión abierta)*.
- Cambiar filtro o segmento: haptic de selección; la selección del segmento y del filtro se conserva al volver al tab *(suposición)*.
- Lector de pantalla: "Corte. Av. Corrientes entre Callao y Uruguay. Tipo: obra. Motivo: …". En mapa, la lista es la alternativa accesible equivalente.

## 7. Restricciones y decisiones abiertas

- Safe areas; back nativo desde el detalle; el pan del mapa no captura el gesto de volver.
- Componentes: `SegmentedControl`, chips (badge clickeable), `MapView`, bottom sheet, `Alert`, `FreshnessLabel`, `EmptyState`, `ErrorState`, `Skeleton`, estado "Fuente no disponible" (variante de ErrorState sin reintento, compartida con otros feeds inexistentes).
- **Abiertas (no inventar):**
  - **N3:** si la fuente no existe, ¿se oculta el tab (barra de 4) o se mantiene con el estado "Fuente no disponible"? Este brief asume que se mantiene.
  - Valores reales de `Tipo` y su mapeo a color/ícono.
  - Forma real de `geometry` (Point vs LineString vs polígono) y cómo se dibuja cada una.
  - Intervalo de polling y umbrales de frescura propios de cortes.
  - Si existiera vigencia en la respuesta real, cómo se muestra (requiere revisar este brief).
