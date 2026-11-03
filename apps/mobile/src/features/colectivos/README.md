# features/colectivos

Colectivos: búsqueda local de líneas y paradas, paradas cercanas y detalle de parada (Fase 4, tareas 4.1, 4.5, 4.7, 4.11 y 4.12). Brief de diseño: [`docs/briefs/02-colectivos.md`](../../../../../docs/briefs/02-colectivos.md). El detalle de línea con el mapa (`LineaScreen`, tarea 4.6) es de otra tarea.

**Para el detalle de línea (tarea 4.6):** la ruta es `/colectivos/[linea]`, con `linea` = `lineaId` (el `route_id` del proxy). Desde una parada se suma el query param **`parada`** (constante `PARAM_PARADA` de `navigation.ts`, exportada en `@/features/colectivos`) con el id de la parada BA, para centrar la cámara ahí: `/colectivos/601?parada=p749f7ff366`.

## Brief operativo (tarea 4.1)

**Raíz "Colectivos"** (`ColectivosScreen`):

1. `SearchInput` "Buscá una línea o parada". Los resultados mezclan líneas (insignia con el número + ramal y cabecera) y paradas (calle y altura + insignias de las líneas que paran). Vacío: "No encontramos «608». Probá con el número de línea o el nombre de una calle."
2. **Paradas cercanas:** con permiso, las 10 más cercanas ("a 120 m") y "Ver más" hasta 30.
   - Sin permiso: "Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono." con "Activar" y "Buscar a mano". Si ya se negó: "Abrir configuración".
   - Fuera de CABA: "No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires."
3. **Líneas recientes** (las últimas 5 abiertas) y **favoritos de colectivo**, con su dato vivo.

**Parada** (`ParadaScreen`, `/colectivos/parada/[id]`): calle y altura, barrio, `FavoriteToggle` y líneas que paran (insignias tocables → `/colectivos/[linea]?parada=<id>`). "Próximos arribos" **solo si la respuesta trae arribos**: por línea hasta 3 tiempos, con `FreshnessLabel`. Si viene vacía, la sección no existe (N4).

| Estado                                      | Raíz                                                                                                    | Parada                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Índice sin descargar                        | "Preparando el listado de líneas y paradas…" con barra de progreso; la búsqueda se habilita al terminar | Skeleton                                                                       |
| Error de descarga                           | `ErrorState` "No pudimos descargar las líneas y paradas" + "Volver a intentar"                          | ídem                                                                           |
| Vacío                                       | Búsqueda sin resultados (copy de arriba); sin cercanas en 1,5 km: "No encontramos paradas cerca."       | Parada que no está: "No encontramos esta parada"                               |
| Arribos con error y datos                   | —                                                                                                       | Alert "No pudimos actualizar. Mostramos lo último que sabemos." + "Reintentar" |
| Arribos sin datos (vacío, cargando o error) | —                                                                                                       | Sin sección                                                                    |
| Sin conexión                                | `OfflineBanner` global; búsqueda y cercanas siguen andando (son locales)                                | Información estática                                                           |

### Suposiciones nuevas

1. **F4-colectivos-1** — El índice se arma con `lineas-colectivos.json` + `paradas.json` del paquete estático. Cuando `/v1/colectivos/lineas` (proxy, `route_id` vigentes) tiene dato, sus líneas reemplazan a las del archivo: el archivo es una semilla y los `route_id` se reasignan. `indice-colectivos.json` es para el proxy; la app no lo usa.
2. **F4-colectivos-2** — Búsqueda sin tildes ni mayúsculas. Ranking de líneas: número exacto, nombre exacto ("60 a"), número que empieza igual, y después ramal, cabecera o empresa. Las paradas se buscan desde 3 caracteres, por calle y altura. Hasta 20 de cada una.
3. **F4-colectivos-3** — Tocar un número de línea en una parada abre su primer ramal en CABA; el detalle de línea ofrece cambiar de ramal.
4. **F4-colectivos-4** — Cercanas en un radio de 1,5 km. La posición se pide una vez al mostrar la raíz con permiso (precisión `Balanced`) y vive solo en memoria.
5. **F4-colectivos-5** — "Líneas recientes" se guardan al abrir una línea desde esta feature (búsqueda, parada o reciente): las últimas 5, en MMKV (`transportate.colectivos.recientes.v1`).
6. **F4-colectivos-6** — Detalle de línea: la ruta es `/colectivos/[linea]` con `linea` = `lineaId` (el `route_id` del proxy). Desde una parada se suma el query param `parada=<paradaId>` para centrar la cámara.
7. **F4-colectivos-7** — Arribos de parada: si fallan sin datos, no se muestra nada (igual que la lista vacía, N4).
