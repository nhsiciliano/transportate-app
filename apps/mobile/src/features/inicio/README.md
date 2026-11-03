# features/inicio

Inicio: estado del subte y favoritos de un vistazo (Fase 4, tareas 4.1, 4.4, 4.11 y 4.12). Brief de diseño: [`docs/briefs/01-inicio.md`](../../../../../docs/briefs/01-inicio.md). Ruta fina: `src/app/(tabs)/inicio/index.tsx`; Ajustes se abre desde el botón del header (`inicio/_layout.tsx`, S2).

## Brief operativo (tarea 4.1)

**Inicio** (`InicioScreen`), una columna con scroll y pull to refresh, de lo más urgente a lo menos:

1. **Header:** large title "Inicio" en iOS y botón de engranaje "Ajustes" (44×44).
2. **Alert destacada** (solo si hay líneas interrumpidas; `Alert` `system` danger):
   - una línea → título "Línea B interrumpida", el `resumen` de su alerta en 2 líneas como máximo y "Ver la línea" → `/subtes/B`;
   - varias → "3 líneas con problemas" y "Ver el subte" → `/subtes`;
   - las 7 → "El subte no está funcionando" y "Ver el subte".
3. **Estado del subte:** 7 filas compactas en orden fijo (A, B, C, D, E, H, Premetro) con `LineBadge`, nombre corto y `StatusChip`; cada fila abre `/subtes/[linea]`. Debajo, `FreshnessLabel`.
4. **Favoritos:** los primeros 5 en el orden guardado, cada uno con ícono de tipo, alias o nombre y su dato vivo (`FavoritoLiveData`). "Ver todos (N)" abre `/favoritos`.

| Estado          | Estado del subte                                                                        | Favoritos                                                                                               |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Carga sin caché | Skeleton de 7 filas                                                                     | Se muestran ya (MMKV); el dato vivo de cada fila en skeleton chico                                      |
| Vacío           | —                                                                                       | `EmptyState` "Guardá tus líneas, paradas y estaciones para verlas acá." + "Explorar subtes" → `/subtes` |
| Error sin datos | `ErrorState` **dentro del bloque**, con `userMessage()` y reintento si es `retryable`   | Siguen visibles; el dato vivo dice "Sin información"                                                    |
| Error con datos | Alert en línea "No pudimos actualizar. Mostramos lo último que sabemos." + "Reintentar" | —                                                                                                       |
| Dato viejo      | `FreshnessLabel` en warning (> 10 min, con su aviso)                                    | Dato vivo atenuado + "hace 6 min"                                                                       |
| Sin conexión    | `OfflineBanner` global + lo persistido                                                  | ídem                                                                                                    |

### Suposiciones nuevas

1. **F4-inicio-1** — Sin menú contextual con long press (el brief lo propone): las acciones sobre un favorito viven en el tab Favoritos. Sin reordenar acá.
2. **F4-inicio-2** — Tocar un favorito abre su detalle en el tab correspondiente: línea o estación de subte → `/subtes/…`; línea de colectivo → `/colectivos/[linea]`; parada → `/colectivos/parada/[id]` (S3).
3. **F4-inicio-3** — La Alert destacada usa el `resumen` del estado (`header_text` de la alerta más severa) para no pedir `/v1/subtes/alertas` en Inicio. Premetro cuenta como una línea (S8).
4. **F4-inicio-4** — El nombre corto de cada fila es el de la línea ("Línea B", "Premetro"); las cabeceras viven en Subtes.
5. **F4-inicio-5** — Sin bloque de Tránsito (N3: tab oculto).
6. **F4-inicio-6** — El pull to refresh refresca el estado del subte y las queries de los datos vivos (arribos y posiciones); el estático no.
