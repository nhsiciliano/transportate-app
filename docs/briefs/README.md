# Briefs de diseño (`shape`) — MVP de Transportate

> Tarea 1.9 de la Fase 1. Proceso: Impeccable `shape` (`reference/shape.md`, fases 1–3), modo **Operate**, plataforma **adaptive** (`PRODUCT.md:9`).
> **Sin entrevista:** no hubo usuario disponible. El discovery se respondió desde `PRODUCT.md` y `docs/00-plan.md`; todo lo que no sale de ahí está marcado **(suposición)** y consolidado al final de este archivo para que lo valide el usuario.
> `shape` no elige mundo visual ni escribe código. Los briefs fijan qué resuelve cada pantalla, cómo se comporta y qué estados tiene; el look lo define `DESIGN.md` en Fase 3 a partir de `docs/02-obelisco-tokens.md`.

## Índice

| # | Pantalla | Pregunta que responde | Brief |
|---|---|---|---|
| 1 | Inicio | "¿Funciona el subte y cómo están mis cosas de siempre?" | [01-inicio.md](01-inicio.md) |
| 2 | Colectivos | "¿Dónde está mi colectivo ahora?" (posiciones, **sin arribos**) | [02-colectivos.md](02-colectivos.md) |
| 3 | Subtes | "¿Funciona mi línea y cuándo viene el próximo?" | [03-subtes.md](03-subtes.md) |
| 4 | Tránsito **(diferido: tab oculto, sin fuente de cortes)** | "¿Hay cortes en mi camino?" | [04-transito.md](04-transito.md) |
| 5 | Favoritos | "Lo mío, sin buscarlo de nuevo" | [05-favoritos.md](05-favoritos.md) |
| 6 | Ajustes (+ Acerca de) | "Configurar y saber de dónde salen los datos" | [06-ajustes.md](06-ajustes.md) |

## Mapa de navegación

Según `docs/00-plan.md` (tarea 3.8) y `docs/03-arquitectura.md` §7.

```
Tab bar (iOS) / Navigation bar (Android) — 5 destinos, siempre visibles
├── Inicio ───────────────┬─► Ajustes (stack, ícono en la barra superior de Inicio)
│                         │      └─► Acerca de (stack)
│                         ├─► Detalle de línea de subte  (→ tab Subtes, ver nota)
│                         └─► Favorito tocado            (→ su pantalla de detalle)
├── Colectivos ─► Línea (mapa + lista de vehículos y alertas) ─► Parada (info estática)
├── Subtes ─────► Línea (estado + alertas + estaciones) ─► Estación (arribos por andén)
├── Tránsito ───► Lista ⇄ Mapa ─► Detalle de corte
└── Favoritos ──► (abre el detalle del tipo: línea/parada de colectivo, línea/estación de subte)
```

- Cada tab tiene su propio stack; el gesto/botón de volver nativo funciona en todos los niveles (borde izquierdo en iOS, Back predictivo en Android).
- Tocar el tab activo vuelve a la raíz de ese stack y, si ya está en la raíz, hace scroll al principio *(suposición: comportamiento estándar de ambas plataformas)*.
- **Decisión abierta (N1):** desde Inicio, tocar una línea de subte ¿cambia al tab Subtes (y apila el detalle ahí) o apila el detalle dentro del stack de Inicio? Recomendación: cambiar de tab, para que "volver" lleve al listado de Subtes y no haya dos copias de la misma pantalla. Lo mismo para los accesos desde Favoritos.
- Deep links (`transportate://subtes/LineaA`, etc.) quedan fuera del MVP *(suposición)*.

## Patrones compartidos

Todos se construyen una vez en `shared/ui` (plan, tarea 3.7) y se usan igual en todas las pantallas. Ninguna pantalla inventa su variante.

### FreshnessLabel — frescura del dato

- Texto corto bajo el título o junto al dato: **"Actualizado hace 12 s"**, "hace 3 min", "hace 2 h". Se calcula con `sourceTimestamp` del contrato v1 (`docs/03-arquitectura.md` §5), no con la hora de la request.
- Umbrales *(suposición, a validar)*, con intervalo de refresco `R` (default 20 s):
  - **Fresco:** edad ≤ 3·R (≤ 60 s). Texto neutro (`text.secondary`).
  - **Viejo (stale):** 3·R < edad ≤ 10 min. Ícono + texto en color warning: "Dato de hace 4 min". El contenido se sigue mostrando.
  - **Muy viejo:** > 10 min. Aviso en línea (Alert warning): "Este dato puede no reflejar la situación actual". En posiciones de colectivos, los vehículos se atenúan.
- Se actualiza cada segundo mientras la pantalla está visible, sin animación (no "tiquea" visualmente más que el número).
- Accesibilidad: el lector de pantalla lo anuncia como "Actualizado hace 12 segundos"; no se re-anuncia en cada segundo.
- El upstream puede tener su propio retraso: si `sourceTimestamp` es mucho más viejo que `generatedAt`, manda `sourceTimestamp` (lo que importa es la antigüedad del dato, no de nuestra caché).

### Skeleton — carga

- Primera carga sin datos guardados: skeleton con la forma real del contenido (filas de líneas, tarjetas), nunca un spinner centrado (`reference/operate.md`: "Skeleton states for loading").
- Recargas con datos en pantalla: **no** se muestra skeleton; el contenido se queda y solo cambia la FreshnessLabel. Pull to refresh muestra el indicador nativo.

### EmptyState — vacío

- Ícono + una frase que explica por qué está vacío + una acción que lo resuelve. Ejemplos: "Todavía no guardaste favoritos. Tocá la estrella en una línea, parada o estación." / "No hay cortes informados ahora."
- Distinguir **vacío real** ("no hay alertas": buena noticia, tono neutro-positivo) de **sin datos** (error o fuente caída), que nunca se muestra como vacío.

### ErrorState — error con reintento

- Se usa cuando **no hay nada que mostrar** (sin caché). Título llano + causa en lenguaje de la persona + botón "Volver a intentar". Nunca culpa a la persona (`PRODUCT.md:87`).
- Si hay caché, no se reemplaza el contenido: se muestra el último dato bueno con FreshnessLabel stale y una Alert en línea "No pudimos actualizar. Mostramos lo último que sabemos." con acción "Reintentar".
- Tipos de error del contrato (`code`, `retryable`, `docs/03-arquitectura.md` §5) mapean a mensajes:
  - **Sin conexión** (NetInfo offline) → banner global (abajo), no ErrorState por pantalla.
  - **Servicio no disponible** (`retryable: true`, upstream caído o suspendido) → "El servicio de la Ciudad no responde en este momento." + reintento automático con backoff + botón manual.
  - **Feed inexistente / función no disponible** (`retryable: false`) → estado informativo sin botón de reintento: "Esta información no está disponible por ahora." Ej.: cortes de tránsito si el endpoint no existe.
  - **Error del cliente** (pedido inválido, contrato roto) → "Algo falló de nuestro lado." + reintentar.

### Banner sin conexión

- Banner fijo arriba del contenido (debajo de la barra de navegación, respetando safe area), en todas las pantallas: **"Sin conexión. Mostramos lo último guardado."**
- No bloquea la UI; desaparece solo al volver la red, con un aviso breve "Conexión restablecida" *(suposición)* y refetch automático (`onlineManager`).
- Con el banner visible, todas las FreshnessLabel siguen corriendo (el dato envejece aunque no haya red).

### Otros componentes compartidos

| Componente | Base Obelisco (`docs/02-obelisco-tokens.md` §4) | Uso |
|---|---|---|
| `LineBadge` (insignia de línea) | Badge, con colores del GTFS (`docs/02b-colores-subte.md` §3) | Subte: letra sobre `route_color`; colectivo: número sobre color neutro *(suposición: no hay color oficial por línea de colectivo)* |
| `StatusChip` (estado de servicio) | Badge secundaria + ícono | "Normal", "Con demoras", "Interrumpida", "Sin información"; siempre ícono + texto |
| `FavoriteToggle` | Button de ícono (estrella) | En detalle de línea, parada, estación |
| `SearchInput` | Input de búsqueda (radio pill, lupa, reset) | Colectivos, Subtes (estaciones), Favoritos (si hay muchos) |
| `SegmentedControl` / `Tabs` | Tabs tipo pill | Lista ⇄ Mapa en Tránsito; andén/sentido en Estación |
| `Card` | Card (radio 32 en web; en nativo, a definir en Fase 3) | Resúmenes de Inicio, favoritos |
| `Alert` | Alert estándar y `system` | Alertas de servicio, avisos de stale/servicio caído |
| `MapView` | — (MapLibre, ADR-0002) | Colectivos, Tránsito; estilo claro/oscuro propio |
| `Skeleton`, `EmptyState`, `ErrorState`, `FreshnessLabel`, `OfflineBanner` | — | Ver arriba |

### Interacción común

- **Pull to refresh** nativo en toda pantalla con datos en tiempo real; además del polling de 20 s con la pantalla visible (pausa en segundo plano, `PRODUCT.md:42`).
- **Haptics** sobrios *(suposición)*: selección al cambiar segmento o marcar favorito; éxito al guardar favorito; nada en el refresco automático. Se respeta la configuración del sistema.
- **Movimiento:** solo para comunicar estado (150–250 ms); Reduce Motion / Remove animations → crossfade o corte.
- **Áreas táctiles** 44×44 pt / 48×48 dp, también para insignias tocables y marcadores del mapa.
- **Dynamic Type / escala de fuente** con tope razonable (`maxFontSizeMultiplier`, plan 3.4); a tamaños grandes las filas crecen en alto, nunca se trunca el estado ni la frescura.
- **Modo claro y oscuro** de primera clase (paleta oscura en `docs/02-obelisco-tokens.md` §6).
- **Voseo** en todo el copy; nada de "usted" ni de "tú".

## Suposiciones consolidadas (a validar por el usuario)

### Producto y navegación
1. **S1** — Las seis pantallas son Inicio, Colectivos, Subtes, Tránsito, Favoritos y Ajustes (con Acerca de anidada) (`PRODUCT.md:47`).
2. **S2** — Ajustes se abre desde un ícono en la barra superior de **Inicio** únicamente (no desde los otros tabs).
3. **S3** — Desde Inicio y Favoritos, abrir un elemento **cambia de tab** (decisión N1).
4. **S4** — Sin deep links ni widgets ni notificaciones en el MVP.
5. **S5** — Sin onboarding de varias pantallas: la primera vez se abre Inicio directamente; el permiso de ubicación se pide recién al usar "Paradas cercanas".

### Datos y frescura
6. **S6** — Umbrales de frescura: fresco ≤ 3×intervalo, stale hasta 10 min, muy viejo > 10 min.
7. **S7** — El estado de línea de subte se deriva así: alerta activa con `effect` NO_SERVICE → "Interrumpida"; SIGNIFICANT_DELAYS o REDUCED_SERVICE → "Con demoras"; otro efecto → "Con novedades"; sin alertas y con forecast reciente → "Normal"; sin forecast ni alertas → "Sin información" (`docs/01a-api-console.md`, sección MVP). Las reglas finales las fija la tarea 2.5.
8. **S8** — El Premetro se muestra como **una sola fila** aunque el GTFS tenga dos rutas (`PM-Civico`, `PM-Savio`) con el mismo color (`docs/02b-colores-subte.md:22-23`).
9. **S9** — Los arribos de subte se muestran por **andén/sentido** (cabecera de destino), con hasta 3 próximos por sentido.
10. **S10** — Colectivos: el mapa muestra **una línea por vez** (no el feed completo de ~3.200 vehículos; `docs/00-plan.md:11`).
11. **S11** — Las líneas de colectivo no tienen color oficial: insignia en neutro con el número.
12. **S12** — Tránsito: el MVP muestra solo los campos de `CortesEntity` (`Nombre`, `Motivo`, `Tipo`, geometría); no hay fechas de inicio/fin, así que no se muestran ni se filtran por fecha.
13. **S13** — El filtro de Tránsito es por `Tipo`, con los valores que traiga el feed (no hay enum en la spec).

### Favoritos y ajustes
14. **S14** — Tipos de favorito: línea de colectivo, parada de colectivo, línea de subte, estación de subte. Los cortes no se guardan.
15. **S15** — Sin límite duro de favoritos; el diseño se prueba con 50.
16. **S16** — El alias es opcional, de hasta 30 caracteres, y no se envía a ningún lado (`docs/05-privacidad.md:22`).
17. **S17** — Intervalos de refresco ofrecidos: 15, 20 (default), 30 y 60 s. No hay "tiempo real continuo" (el proxy cachea 15–30 s).
18. **S18** — Tema: Sistema (default) / Claro / Oscuro.
19. **S19** — Borrar favoritos y limpiar caché se confirman con **deshacer** (snackbar/toast con acción), no con diálogo modal, salvo "Borrar todos los favoritos", que pide confirmación.

### Copy y tono
20. **S20** — Tono sobrio, sin humor en errores del servicio (`PRODUCT.md:68`).
21. **S21** — Fechas y horas en formato argentino (24 h, "14:05"); tiempos de arribo relativos ("2 min", "Llegando").
22. **S22** — Los nombres de estaciones se muestran normalizados con tildes desde el estático procesado (`docs/02b-colores-subte.md:97`).

### Plataforma
23. **S23** — Tipografía de marca (Nunito/Open Sans) en títulos y contenido; controles del sistema (switches, segmentados, menús) con su tipografía nativa. Resuelve la tensión 1 de `PRODUCT.md:72` sin romper Dynamic Type.
24. **S24** — Bottom sheet para el detalle sobre el mapa (sheet nativa en iOS, bottom sheet Material en Android).
25. **S25** — Haptics solo en selección y en guardar favorito.

### Agregadas en los briefs por pantalla
26. **S26** — Tránsito abre en **Lista** (no en Mapa) y refresca con un intervalo más largo que el resto (≥ 60 s).
27. **S27** — Acerca de aclara "Transportate no es una app oficial del Gobierno de la Ciudad" (usa Obelisco y datos del GCBA).
28. **S28** — Inicio muestra hasta 5 favoritos y las líneas de subte en orden fijo A–H (la Alert destacada arriba lleva las interrupciones).
29. **S29** — Los marcadores de colectivos no se interpolan entre posiciones: saltan con un crossfade breve.
30. **S30** — Subte: "Llegando" para arribos < 30 s; arribos con dato > 10 min se reemplazan por "Dato de hace X min".
31. **S31** — Colectivos: un vehículo con `timestamp` > 5 min se atenúa aunque el feed sea fresco; se identifica por interno (`label`), no por patente.
32. **S32** — El permiso de ubicación se pide en contexto (al tocar "Paradas cercanas" o "centrar en mí"), nunca al abrir la app.
33. **S33** — Favoritos es una lista única con orden manual (no agrupada por tipo); los datos vivos se piden solo para las filas visibles.

## Decisiones abiertas transversales

- **N1** — Navegación cruzada entre tabs (ver arriba).
- **N2 — RESUELTA (tarea 4.3, 2026-11-03):**
  - **Estilo del mapa:** OpenFreeMap `positron` en claro y `dark` en oscuro. Cambia con el tema y el estilo oscuro existe, así que no hay que derivarlo.
  - **Trazos de subte:** van con los **colores del GTFS** (`route_color` del estático, `02b-colores-subte.md` §3), no con los de señalética. La app no hardcodea colores de línea.
  - **Contraste:** cada trazo lleva un contorno del color de texto del tema (oscuro sobre claro y claro sobre oscuro), que delimita A, H y Premetro sobre fondo claro y C y E sobre oscuro (WCAG 1.4.11), y la letra de la línea a lo largo, para que el color no sea la única pista.
  - Detalle en `apps/mobile/src/shared/map/README.md`.
- **N3 — RESUELTA (usuario, 2026-11-01):** `/transito/v1/cortes` devuelve 500 (`docs/01-api-transporte.md`). **Se oculta el tab Tránsito por ahora**: la barra queda con 4 destinos (Inicio, Colectivos, Subtes, Favoritos). El brief `04-transito.md` se conserva como diferido para cuando exista una fuente de cortes; nada de Tránsito se implementa en Fases 2–4.
- **N4** — Si en el futuro aparece un feed de arribos de colectivos: dónde entra está marcado en `02-colectivos.md` y `05-favoritos.md`, pero **no** se diseña ni se promete.
