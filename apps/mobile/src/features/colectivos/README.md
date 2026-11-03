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

## Línea y mapa (tarea 4.6)

Ruta `/colectivos/[linea]` (`linea` = `lineaId`, el `route_id` del proxy; opcional `?parada=<paradaId>`, F4-colectivos-6) que monta `LineaScreen.tsx`. Brief: `docs/briefs/02-colectivos.md` §3, §5 y §6 (S10, S24, S29, S31).

**Qué se ve:**

- Mapa casi a pantalla completa (`MapaLinea.tsx`):
  - recorrido aproximado del número (punteado);
  - paradas del número desde zoom 14;
  - punto de la persona si ya dio permiso;
  - vehículos: círculo con el número encima, hit box de 44 pt.
- Panel abajo con tres alturas (`BottomPanel` de `shared/map`, contenido en `VehiculosSheet.tsx`):
  - **Colapsado:** `LineBadge`, ramal, "18 colectivos en servicio", `FreshnessLabel`, `FavoriteToggle` y "Actualizar" (en lugar de pull to refresh).
  - **Medio:** ramales (`Chip`s) y la nota del sentido.
  - **Expandido:** la lista de vehículos ("Interno 1404 · actualizado hace 25 s · a 600 m de vos"). La distancia aparece solo con permiso.
- Tocar un vehículo, en el mapa o en la lista, lo resalta y muestra su tarjeta con "Seguir". Seguir mueve la cámara con él en cada actualización, con háptico de selección; con Reducir movimiento, salta.
- **Controles:** "Centrar en mi ubicación" pide el permiso en contexto con `useUbicacion().request()`. También están "Norte arriba", la franja de iOS para el gesto de volver y las áreas seguras.
- **Polling:** `usePosicionesLinea(lineaId, { enabled: useIsFocused() })`, solo con la pantalla a la vista.

| Estado                             | Qué se ve                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Carga                              | Mapa al instante (CABA y después encuadre); en el panel, skeleton del encabezado y "Buscando colectivos…" |
| Normal                             | Marcadores y "N colectivos en servicio" con frescura                                                      |
| 0 vehículos                        | "No hay colectivos de esta línea con GPS activo ahora." + frescura (vacío real)                           |
| Vehículo con más de 5 min          | Su marcador atenuado; la lista dice su edad (S31)                                                         |
| Feed con más de 10 min             | Todos atenuados + Alert "Las posiciones pueden no ser actuales"                                           |
| Actualización fallida con datos    | Todos atenuados + Alert "No pudimos actualizar. Mostramos lo último que sabemos." con "Reintentar"        |
| Error sin datos                    | Mapa sin marcadores + `ErrorState` en el panel con `error.userMessage()` y "Volver a intentar"            |
| No disponible (`retryable: false`) | "Las posiciones de colectivos no están disponibles por ahora", sin reintento                              |
| Sin conexión                       | Últimas posiciones atenuadas, con su antigüedad; el `OfflineBanner` es global                             |

**Suposiciones nuevas:**

1. **F4-colectivos-mapa-1.** El panel vive dentro de la pantalla (`BottomPanel`), no es la `formSheet` nativa. La `formSheet` es una ruta modal: un gesto la cierra y el "volver" choca con el stack. Este panel tiene que quedar siempre, al menos colapsado. La `formSheet` sigue siendo la opción para detalles pasajeros sobre un mapa (`shared/map/README.md`).
2. **F4-colectivos-mapa-2.** "Interno" es el `id` del vehículo del feed (`VehiculoV1.id`). El contrato no trae `label` aparte, y la patente no se muestra nunca.
3. **F4-colectivos-mapa-3.** Clustering: con más de 80 vehículos, `cluster` del `GeoJSONSource` hasta zoom 13, con radio de 40. Tocar un grupo acerca la cámara a zoom 14.
4. **F4-colectivos-mapa-4.** El feed no informa el sentido. Se muestran todos los vehículos del ramal y la nota lo dice: "El GPS de los colectivos no informa el sentido: ves los de las dos direcciones." El selector es de ramal: los `lineaId` del mismo número, del índice.
5. **F4-colectivos-mapa-5.** La flecha ▲ (glifo de `Noto Sans Regular`, rotado por `rumbo` con `text-rotation-alignment: map`) se dibuja solo si el vehículo trae `rumbo`. Hoy el proxy manda `rumbo: null`: no se inventa una dirección.
6. **F4-colectivos-mapa-6.** Sin crossfade (S29): MapLibre no anima un `setData` de un `GeoJSONSource`, así que el marcador salta a la posición nueva. Es lo mismo que pide Reducir movimiento.
7. **F4-colectivos-mapa-7.** El contrato v1 no trae alertas de colectivos: el nivel medio no muestra alertas, en vez de mostrar un vacío.
8. **F4-colectivos-mapa-8.** El recorrido es el del número (`recorridos-colectivos.geojson` trae uno por número, aproximado), no el del ramal. Por eso va punteado.
9. **F4-colectivos-mapa-9.** Las paradas son las del número en los dos sentidos (`paradasDeNumero`). Aparecen recién desde zoom 14 para no tapar los vehículos.
10. **F4-colectivos-mapa-10.** La cámara se encuadra una sola vez: la parada de `?parada=` (zoom 16); si no hay, el recorrido; si no hay, los vehículos. Después solo la mueven la persona y "Seguir". Al cambiar de ramal se vuelve a encuadrar.
11. **F4-colectivos-mapa-11.** La lista ordena por el dato más reciente y después por interno.

**Datos:**

- **Índice:** línea, ramales y paradas salen de `useIndiceColectivos()` (archivos grandes).
- **Recorrido:** sale de `useStaticArchivoGrande('recorridos-colectivos.geojson')`, guardado en MMKV fuera de la caché de TanStack.
- **Posiciones:** vienen de `usePosicionesLinea`.

**Tests:**

- `test/colectivos/linea.test.tsx` cubre fuentes y capas, el polling solo de la línea abierta, 0 vehículos, el agrupamiento, la atenuación por vehículo y por feed, el error con reintento, el feed no disponible, seguir un vehículo, la lista, los grupos, el cambio de ramal, la apertura desde una parada, "Centrar en mí" con permiso en contexto y la distancia, "Actualizar" y el botón del panel.
- `__tests__/lineaModel.test.ts` cubre las funciones puras.
