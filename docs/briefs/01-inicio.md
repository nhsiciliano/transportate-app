# Brief: Inicio

> `shape` · modo **Operate** · plataforma adaptive. Suposiciones marcadas **(suposición)**; consolidadas en [README.md](README.md#suposiciones-consolidadas-a-validar-por-el-usuario).

## 1. Trabajo y audiencia

- **Quién:** cualquiera que abre la app, casi siempre en la calle, apurado y con una mano (`PRODUCT.md:17`). Es la primera pantalla en cada apertura.
- **Necesidad:** en 2–3 segundos, saber si el subte funciona y ver sus favoritos sin buscar. Es la respuesta a "¿salgo ya o hay problema?".
- **Modo:** Operate. Panel de resumen, no portada: nada de saludo, ilustración ni marketing.

## 2. Resultado y evidencia

- **Tarea principal:** leer el estado de las líneas de subte y entrar a un favorito con un toque.
- **Éxito:** la persona ve el estado de su línea sin hacer scroll y sabe qué tan fresco es; si hay una interrupción, la ve antes que cualquier otra cosa.
- **Datos reales:** estado por línea derivado de `/subtes/serviceAlerts` + `/subtes/forecastGTFS` (`docs/01a-api-console.md`, sección MVP); favoritos locales (MMKV); alertas de subte. Cortes de tránsito **solo si** la fuente responde (ver `04-transito.md`).
- **Lo propio de Transportate:** datos oficiales con frescura visible y sin cuenta; nada que identifique a la persona.

## 3. Dirección estructural

Orden vertical, de lo más urgente a lo menos (una sola columna en teléfono):

1. **Barra superior:** título "Inicio" (large title en iOS, top app bar en Android) + ícono de **Ajustes** a la derecha (`README.md`, S2).
2. **Banner de alerta destacada** (condicional): si alguna línea de subte está **Interrumpida**, una Alert `system` danger arriba de todo: "Línea B interrumpida entre Medrano y Leandro N. Alem" (texto de la alerta). Si hay varias, una sola Alert con "3 líneas con problemas" que lleva a Subtes.
3. **Estado del subte:** una fila compacta por línea (A, B, C, D, E, H, Premetro; **7 filas**, S8) con `LineBadge` + `StatusChip`. Orden **fijo** A–H y Premetro, para no mover filas entre refrescos *(suposición, S28)*; las interrupciones ya quedan arriba en la Alert del punto 2. FreshnessLabel debajo del bloque.
4. **Favoritos:** hasta 5 primeros favoritos en el orden que eligió la persona *(suposición)*, cada uno como fila tocable con su tipo, alias y un dato vivo cuando existe (estado de línea de subte; próximo arribo de estación de subte; cantidad de vehículos activos de la línea de colectivo). "Ver todos" lleva al tab Favoritos.
5. **Tránsito (condicional):** si la fuente de cortes responde y hay cortes, una fila resumen "12 cortes informados" que lleva al tab Tránsito. Si la fuente no está disponible, **no** se muestra nada acá (el estado se explica en su tab).

- **Momento focal:** el bloque de estado del subte; en un día normal es una columna de "Normal" que se escanea en un vistazo; en un día malo, la interrupción salta arriba.
- **Consecuencia para implementación:** Inicio consume `/v1/subtes/estado` (una request para todas las líneas) y lee favoritos de MMKV; los datos vivos de favoritos reutilizan las queries de cada feature (misma clave de caché), no endpoints nuevos.

## 4. Alcance y límites

- **Fidelidad:** pantalla de producción (Fase 4, tarea 4.4).
- **No hace:** buscar, mostrar mapas, editar favoritos (eso es del tab Favoritos), mostrar arribos de colectivos (no existen; `docs/01a-api-console.md`).
- **Anti-objetivos:** carrusel, saludo personalizado, onboarding en la home, noticias, "tip del día", métricas decorativas.

## 5. Estados y rangos

| Estado | Qué se ve |
|---|---|
| **Primera carga** (sin caché) | Skeleton de 7 filas de línea + 3 filas de favoritos (si hay favoritos guardados, se muestran de inmediato desde MMKV con su dato vivo en skeleton) |
| **Normal** | Bloques como en §3 |
| **Sin favoritos** (0) | En el bloque de favoritos, EmptyState breve: "Guardá tus líneas, paradas y estaciones para verlas acá." + botón "Explorar subtes" *(suposición: subte como entrada por ser el que tiene más información)* |
| **Dato viejo** | FreshnessLabel en warning; los chips de estado se mantienen; con > 10 min, Alert "Este estado puede no estar actualizado" |
| **Sin conexión** | Banner global; estado del subte desde caché con su antigüedad real; favoritos visibles |
| **Servicio no disponible** (upstream caído) | Bloque de subte con Alert en línea "El servicio de la Ciudad no responde. Mostramos lo último que sabemos." + "Reintentar"; sin caché → las 7 filas con chip "Sin información" y el mismo aviso |
| **Error sin caché** | ErrorState dentro del bloque de subte (no de toda la pantalla): favoritos siguen visibles |
| **Feed inexistente** (cortes) | El bloque de tránsito no aparece |
| **Sin permiso de ubicación** | No aplica: Inicio no usa ubicación |

Rangos realistas:
- **Líneas con problemas:** 0 (lo más común), 1, 7 (paro total: todas interrumpidas → la Alert destacada dice "El subte no está funcionando" si las 7 están interrumpidas, *suposición*).
- **Favoritos:** 0, 3, 50 (solo se muestran 5; "Ver todos (50)").
- **Texto de alerta:** de "Demoras" a párrafos de 300+ caracteres; en Inicio se muestra solo el `header_text` en 2 líneas máximo con elipsis; el texto completo vive en Subtes.
- **Alias largos:** hasta 30 caracteres (S16); se truncan en 1 línea con elipsis, el lector de pantalla lee el alias completo.

## 6. Interacción y layout

- Pull to refresh refresca estado de subte y datos vivos de favoritos; polling cada R segundos con la pantalla visible.
- Tocar una fila de línea → detalle de línea en tab Subtes (N1). Tocar un favorito → su detalle. Tocar la Alert destacada → detalle de la línea afectada (o lista de Subtes si son varias).
- Long press en un favorito: menú contextual nativo con "Abrir", "Quitar de favoritos" *(suposición)*; el reordenamiento se hace en Favoritos.
- Feedback: al terminar un refresh manual, solo cambia la FreshnessLabel (sin toast). Haptic de selección solo al abrir el menú contextual.
- Lector de pantalla: cada fila de línea se lee como una unidad: "Línea B, con demoras. Servicio con demoras por problemas técnicos." Encabezados de sección marcados como headers.
- Tablet *(suposición, adapt en Fase 5)*: dos columnas (subte | favoritos).

## 7. Restricciones y decisiones abiertas

- Safe areas; large title en iOS que colapsa; top app bar en Android; back nativo no aplica (raíz).
- Dynamic Type: con texto grande, `LineBadge` y chip pueden pasar a dos renglones; nunca se oculta el estado.
- Áreas táctiles 44/48 en filas completas (toda la fila es tocable).
- Componentes: `LineBadge`, `StatusChip`, `FreshnessLabel`, `Alert` (system danger), `Card`/filas de lista, `EmptyState`, `Skeleton`, `OfflineBanner`.
- **Abiertas (no inventar):**
  - ¿Cuántos favoritos se muestran en Inicio (5 propuesto) y si la persona puede elegir cuáles?
  - ¿Las líneas con problemas suben al principio o se respeta el orden A–H fijo (memoria espacial)? Recomendación: orden fijo + Alert destacada arriba, para no mover filas entre refrescos; validar.
  - Texto exacto de la Alert destacada cuando hay varias líneas afectadas.
  - Si el bloque de tránsito vale la pena en Inicio con 0 cortes ("Sin cortes informados") o se oculta.
