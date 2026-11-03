# features/subtes

Subtes: estado por línea, alertas, estaciones y arribos por sentido (Fase 4, tareas 4.1, 4.2, 4.11 y 4.12). Brief de diseño: [`docs/briefs/03-subtes.md`](../../../../../docs/briefs/03-subtes.md). Rutas finas en `src/app/(tabs)/subtes/`; el mapa (`subtes/mapa.tsx`, tarea 4.3) es de otra tarea.

## Brief operativo (tarea 4.1)

**Raíz "Subtes"** (`SubtesScreen`): 7 filas en orden fijo A, B, C, D, E, H, Premetro. Cada fila es un solo botón: `LineBadge`, cabeceras ("Plaza de Mayo – San Pedrito"), `StatusChip` y el `resumen` de la alerta más severa en 1 línea. Arriba: `SearchInput` "Buscá una estación" y botón "Ver mapa". Abajo de las filas: `FreshnessLabel` del estado.

**Línea** (`LineaScreen`, `/subtes/[linea]`): `LineBadge` grande, cabeceras, `StatusChip`, `FavoriteToggle`. Alertas de la línea completas (una `Alert` por alerta, con "Desde las 14:05" si hay período) o "Sin novedades informadas". Estaciones en orden de recorrido con un trazo vertical del color de la línea; cada estación abre su detalle.

**Estación** (`EstacionScreen`, `/subtes/estacion/[id]`): nombre, `LineBadge`, `FavoriteToggle`, alerta resumida de la línea (toca → línea), un bloque "Hacia <cabecera>" por sentido con hasta 3 arribos ("Llegando", "2 min"; el primero grande) y `FreshnessLabel`.

| Estado          | Raíz                                                                             | Línea                            | Estación                                                                                                          |
| --------------- | -------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Carga sin caché | Skeleton de 7 filas                                                              | Skeleton de encabezado y filas   | Nombre y línea ya visibles (estático) + skeleton de 2 bloques de 3 filas                                          |
| Vacío           | Búsqueda: "No encontramos «X». Probá con otro nombre de estación."               | "Sin novedades informadas"       | "No hay próximos trenes informados para esta estación."                                                           |
| Error sin datos | Filas con "Sin información" + `ErrorState` con `userMessage()`                   | ídem en el chip y en las alertas | `ErrorState` en arribos; con `retryable: false`: "Los próximos arribos no están disponibles por ahora", sin botón |
| Error con datos | `Alert` "No pudimos actualizar. Mostramos lo último que sabemos." + "Reintentar" | ídem                             | ídem                                                                                                              |
| Dato viejo      | `FreshnessLabel` en warning                                                      | ídem                             | > 10 min: los tiempos se reemplazan por "Dato de hace X min" atenuado (S30)                                       |
| Sin conexión    | `OfflineBanner` global (montado en `src/app/_layout.tsx`) + lo persistido        | ídem                             | ídem                                                                                                              |

Pull to refresh nativo en las tres pantallas (refresca estado, alertas y arribos; el estático no).

### Suposiciones nuevas

1. **F4-subtes-1** — Premetro es una sola fila (S8) con clave de app `PM` (ruta `/subtes/PM`, favorito `linea_subte:PM`). Su estado es el más severo de `PM-C` y `PM-S`; sus alertas, la unión de las de los dos ramales. Sus estaciones van en el orden del ramal General Savio y después las dos exclusivas del ramal Centro Cívico, marcadas "Ramal Centro Cívico".
2. **F4-subtes-2** — Las cabeceras se arman con el nombre normalizado de la primera y la última estación del recorrido ("Plaza de Mayo – San Pedrito"), no con `nombre` del GTFS (que trae guion y nombres cortos). Premetro: "Intendente Saguier – General Savio / Centro Cívico".
3. **F4-subtes-3** — Los arribos se agrupan por sentido comparando `destino` (sin tildes ni mayúsculas) con la cabecera del sentido o con el nombre de su última estación. Un destino que no coincide con ningún sentido arma su propio bloque "Hacia <destino>". En una estación terminal se muestra solo el sentido que sale.
4. **F4-subtes-4** — Con el estado caído y sin caché, la raíz igual lista las 7 líneas (con "Sin información") arriba de un `ErrorState`: el estático sigue sirviendo para buscar y navegar.
5. **F4-subtes-5** — La búsqueda ignora tildes, mayúsculas y signos de puntuación; busca en el nombre normalizado y en el del GTFS. Los resultados reemplazan a la lista de líneas mientras hay texto.
6. **F4-subtes-6** — "Llegando" para < 30 s (S30); el resto se redondea hacia arriba en minutos ("1 min" desde 30 s). El umbral de 10 min de S30 se mide con `sourceTimestamp` del feed.
7. **F4-subtes-7** — La alerta resumida en la estación es la más severa de la línea (la del `resumen` del estado); `Alert` `system` danger si la línea está interrumpida, warning si no.

## Lo que quedó

| Archivo                                                       | Qué hace                                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model.ts`                                                    | Funciones puras: `buildRed` (7 líneas + 108 estaciones, Premetro unificado), `estadoDeLinea`, `alertasDeLinea`, `periodoAlerta`, `buscarEstaciones`, `agruparArribos`, `formatArribo` |
| `hooks.ts`                                                    | `useRedSubte`, `useLineasSubte`, `useEstacionesSubte`, `useLineasConEstado`, `useLineaDetalle`, `usePullToRefresh`                                                                    |
| `components.tsx`                                              | `EstadoChip` (StatusChip con `Icon`), `LineaBadge`, `AvisoAlert`, `RefreshErrorAlert`, `ScreenScroll` (scroll + `RefreshControl`), `FilaTocable`, `Seccion`                           |
| `SubtesScreen.tsx` / `LineaScreen.tsx` / `EstacionScreen.tsx` | Las tres pantallas; cada una pone su título con `Stack.Screen options`                                                                                                                |

- **Datos:** el estático sale de `useStaticArchivo` (`src/shared/static`); el tiempo real, solo de los hooks de `shared/api`. Los colores de línea son los únicos que no vienen del tema: llegan como datos del estático.
- **Arribos:** se recalculan con `horaEstimada` contra un reloj que avanza cada 15 s, así un dato de la caché no muestra "2 min" de hace un rato. Se descartan los que pasaron hace más de 30 s, igual que el proxy.
- **Mapa de la red (4.3):** hecho, en `MapaRedScreen.tsx` (ruta `subtes/mapa.tsx`; ver `shared/map/README.md`).
- **Pendiente para otras tareas:** combinaciones ("Combinás con D"), porque el estático no trae `transfers.txt`; "El servicio no está funcionando a esta hora", porque el estático no trae horarios.
- **Tests:** `test/subtes/` (pantallas y `useStaticArchivo`) y `__tests__/model.test.ts`.
