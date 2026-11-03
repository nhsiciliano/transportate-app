# `src/shared/map` — mapa compartido (tareas 4.0 y 4.3)

Piezas comunes de los mapas: el mapa de la red de subte (4.3, `features/subtes/MapaRedScreen.tsx`) y, después, el de colectivos (4.6). Las dependencias nativas están en `apps/mobile/README.md`, "Dependencias nativas de la Fase 4".

| Archivo                 | Qué exporta                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `MapView.tsx`           | `MapView`, `MapViewHandle`, `CAMERA_ANIMATION_MS`, `USER_ZOOM`, `EDGE_GESTURE_GUTTER`              |
| `styles.ts`             | `MAP_STYLE_URLS`, `mapStyleFor`, `MAP_ATTRIBUTION`, `MAP_FONT`, `CABA_BOUNDS`                      |
| `geojson.ts`            | `boundsOf`, `pointCollection`, `pressedProperty`                                                   |
| `staticData.ts` | `useStaticGeoJson`, `geoJsonVersion`, `StaticGeoJsonQuery`: los `.geojson` del paquete (los JSON con contrato van por `useStaticArchivo` de `shared/static`) |
| `useLocationGranted.ts` | `useLocationGranted()`: consulta el permiso de ubicación, nunca lo pide                            |

## `MapView`

```tsx
<MapView accessibilityLabel="Mapa de la red de subte" initialBounds={bounds} ref={mapRef}>
  <GeoJSONSource id="lineas" data={fc} hitbox={{ top: 22, right: 22, bottom: 22, left: 22 }} onPress={…}>
    <Layer id="lineas-trazo" type="line" paint={{ 'line-color': ['get', 'color'] }} />
  </GeoJSONSource>
</MapView>
```

| Prop                            | Default       | Qué hace                                                                                                                                     |
| ------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessibilityLabel`            | (obligatoria) | El mapa se anuncia como una imagen con esa etiqueta. La vía accesible a los datos es la lista de cada tab, no el mapa                        |
| `children`                      | —             | Fuentes y capas de MapLibre v11 (`GeoJSONSource`, `Layer`, `Images`…)                                                                        |
| `initialBounds`                 | `CABA_BOUNDS` | Extensión inicial `[oeste, sur, este, norte]`, con margen para los controles. Gana sobre `initialCenter`                                     |
| `initialCenter` + `initialZoom` | — + 13        | Alternativa a `initialBounds`                                                                                                                |
| `onPress`                       | —             | Toque en el mapa fuera de las fuentes con `onPress` propio                                                                                   |
| `showsUserLocation`             | `true`        | Dibuja el punto de la persona, **solo si el permiso ya está concedido**                                                                      |
| `insetBottom`                   | `false`       | Suma el área segura inferior a los controles. En las tabs no hace falta, porque la barra ya deja el contenido arriba del indicador de inicio |
| `testID`                        | `map-view`    | Subvistas: `-map`, `-attribution`, `-north-up`, `-center-user`, `-edge-gutter`                                                               |
| `ref`                           | —             | `MapViewHandle`: `flyTo(center, zoom?)`, `fitBounds(bounds)`, `resetNorth()`                                                                 |

- **Estilo:** `positron` en claro y `dark` en oscuro, según `useTheme().scheme`. Cambia en vivo con el tema y las capas propias se vuelven a montar solas. Los colores de las capas salen siempre de `useTheme()`.
- **Atribución:** `© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap`.
  - Es un `Text` propio (`text.xs`, tono secundario, sobre `bg.base`), abajo a la izquierda y siempre visible.
  - Los controles van a la derecha, así que no la tapan.
  - La atribución nativa y el logo de MapLibre se apagan (`attribution={false}`, `logo={false}`). Los enlaces completos están en Acerca de.
- **Controles:** botones redondos de 48 × 48, abajo a la derecha, corridos por el área segura lateral. Cada uno tiene `accessibilityRole="button"` y su etiqueta.
  - **"Orientar el mapa con el norte arriba":** siempre visible. Usa `setStop({ bearing: 0, pitch: 0 })`.
  - **"Centrar en mi ubicación":** aparece solo si `expo-location` ya informa `granted` (se consulta al montar y al volver a primer plano). Toma una posición con precisión `Balanced`, la usa para la cámara y no la guarda. **El mapa nunca pide el permiso:** el pedido en contexto es de 4.7 (S32).
  - La brújula nativa se apaga para no duplicar el control.
- **Reducir movimiento** (`useReduceMotion` de `shared/ui`): `flyTo` pasa a `jumpTo` y `fitBounds`/`setStop` usan duración 0. Si no, animan 500 ms.
- **Gesto de volver en iOS:** una franja transparente de `EDGE_GESTURE_GUTTER` (20 pt) sobre el borde izquierdo recibe los toques que empiezan ahí. Así el arrastre del mapa no compite con el gesto de borde del stack nativo. Esa franja no es accesible y en Android no existe, porque el volver es del sistema.
- **Privacidad:** el punto de ubicación lo dibuja MapLibre con su propio `LocationManager`, que solo arranca al montarse `UserLocation`, o sea, con el permiso ya concedido. La posición no sale del teléfono ni va en las requests de tiles (`docs/05-privacidad.md` §3 y §4).

## Estilos, atribución y autoalojado (ADR-0002)

| Tema   | URL                                             | Por qué                                                                              |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Claro  | `https://tiles.openfreemap.org/styles/positron` | Gris claro y de poco contraste: las líneas de subte y los colectivos resaltan encima |
| Oscuro | `https://tiles.openfreemap.org/styles/dark`     | Existe (no hace falta derivarlo). Usa la misma fuente `openmaptiles` que `positron`  |

- **Verificados el 2026-11-03.** Las dos URLs responden HTTP 200 y declaran fuente vectorial, glifos y sprites en `tiles.openfreemap.org`. Los glifos comunes a los dos estilos son `Noto Sans Regular` (`MAP_FONT`), así que las etiquetas propias usan solo esa familia.
- **No se pueden probar en Jest.** El render real de cada estilo se valida en el dispositivo.
- **Atribución:** el TileJSON (`https://tiles.openfreemap.org/planet`) declara "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". La app la muestra con el texto de `MAP_ATTRIBUTION`.
- **Recolorear:** los tiles de OpenFreeMap no se recolorean. Para un estilo propio (por ejemplo, calles más tenues debajo de los trazos), OpenFreeMap pide alojar nosotros el JSON del estilo.
- **Plan de autoalojado (ADR-0002, sin implementar):**
  1. Generar un `.pmtiles` del AMBA con Planetiler (esquema OpenMapTiles, para que los estilos sigan sirviendo).
  2. Subirlo a R2 junto con glifos, sprites y dos JSON de estilo propios (claro y oscuro, con colores de Obelisco).
  3. Servirlo desde el proxy (`/v1/tiles/{z}/{x}/{y}` con lectura por rangos de PMTiles en el Worker, más `/v1/tiles/style-{scheme}.json`).
  4. En la app solo cambian `MAP_STYLE_URLS`.
  5. Ganancias: OpenFreeMap deja de ver IP y zona (`05-privacidad.md` §4), desaparece la dependencia de un servicio sin SLA y los estilos se pueden recolorear.

## Mapa de la red de subte (4.3): brief operativo

Ruta `/subtes/mapa` (header "Mapa de la red"), que monta `features/subtes/MapaRedScreen.tsx`. Es una vista secundaria: la lista de Subtes sigue siendo la vía principal y la accesible.

- **Qué muestra:**
  - **Trazos:** salen de `subte-red.geojson`, con un `LineString` por línea y cada ramal del Premetro aparte. Cada trazo lleva un contorno y la letra de la línea a lo largo.
  - **Estaciones:** salen de `subte-estaciones.json`, porque el GeoJSON no trae puntos. Son círculos `bg.base` con borde `text.primary`, y el nombre aparece desde zoom 14.
  - **Cámara inicial:** la extensión de la red (`boundsOf`).
- **Interacción:** tocar una estación lleva a `/subtes/estacion/[id]` y tocar un trazo, a `/subtes/[linea]`. Las fuentes tienen `hitbox` de 22 pt por lado (44 pt en total). Si un mismo toque cae sobre una estación y su línea, gana la estación y se navega una sola vez: los avisos de las dos fuentes se juntan durante `PRESS_SETTLE_MS` = 60 ms.
- **Estados y copy:**

| Estado                           | Qué se ve                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Carga sin caché                  | Skeleton de pantalla completa, con "Cargando el mapa de la red…" para el lector de pantalla                                                     |
| Error sin datos                  | `ErrorState` con `error.userMessage()`. "Volver a intentar" aparece solo si `retryable` (un GeoJSON fuera de contrato no se reintenta)          |
| Sin conexión y sin nada guardado | `EmptyState` "Sin conexión": "El mapa de la red se carga cuando vuelvas a tener conexión. Mientras tanto, la lista de Subtes sigue disponible." |
| Manifiesto sin `subte-red.geojson` | `ErrorState` "Esta información no está disponible por ahora.", sin reintento |
| Sin conexión con caché           | El mapa con los datos persistidos en MMKV, sin requests. El `OfflineBanner` es global                                                           |
| Red vacía                        | `EmptyState`: "Todavía no tenemos el mapa de la red. Mientras tanto, la lista de Subtes tiene todas las líneas y estaciones."                   |

- **Suposiciones nuevas:**
  - **F4-mapa-1.** El mapa no lleva `FreshnessLabel` ni pull to refresh. Es estático versionado: no tiene `sourceTimestamp` y se renueva con el manifiesto (TTL 300 s).
  - **F4-mapa-2.** Las estaciones salen de `subte-estaciones.json`. Las de combinación se dibujan una por línea, igual que en el GTFS.
  - **F4-mapa-3.** El nombre de la estación aparece desde zoom 14; con menos zoom se superponen.
  - **F4-mapa-4.** El control "Norte arriba" usa el ícono `sentidoHacia` girado −90° (una flecha que apunta al norte), porque el mapa curado no tiene brújula. Si se suma un ícono `norte` (Material `navigation`), se cambia en `MapView.tsx`.
  - **F4-mapa-5.** Los controles van abajo a la derecha y la atribución abajo a la izquierda. Ninguno lleva el área segura inferior dentro de las tabs (`insetBottom`).
  - **F4-mapa-6.** Las estaciones van por `useStaticArchivo` (`shared/static`), que guarda una última versión conocida. La red (`.geojson`) va por `useStaticGeoJson`, que se apoya solo en la caché persistida de TanStack Query (24 h). Si se abre la app sin red después de más de un día, se ve "Sin conexión" hasta que vuelva la red.
  - **F4-mapa-7.** No hay estado de "actualización fallida con datos": una versión del estático es inmutable y el archivo no se vuelve a pedir mientras no cambie la versión del manifiesto.

**Decisión N2 (colores de los trazos):** se usan los **colores del GTFS** (`route_color` del estático, `docs/02b-colores-subte.md` §3), no los de señalética.

- **Contorno:** `text.primary` del tema, oscuro sobre `positron` y claro sobre `dark`. Le da a cada trazo un borde que contrasta con el fondo, también en A, H y Premetro sobre claro y en C y E sobre oscuro (WCAG 1.4.11).
- **Letra de la línea** a lo largo del trazo: el color nunca es la única pista.
- **Por qué no la señalética:** el celeste `#08B0E1` para la A queda descartado porque la app no hardcodea colores de línea (02b §3, "Reglas de uso") y el contorno ya resuelve el contraste.

## Lectura de los GeoJSON (`staticData.ts`)

- **JSON con contrato:** `subte-estaciones.json`, `subte-lineas.json` y el resto van por `useStaticArchivo` de [`src/shared/static`](../static/README.md), de mid-dev (4.2). Ese hook usa `client.staticFile`, que solo acepta `ARCHIVOS_ESTATICOS_V1`.
- **GeoJSON:** `useStaticGeoJson(archivo)` hace lo mismo para los `.geojson`, con `client.staticGeoJson` validado con `GEOJSON_ESTATICOS_V1` de `@transportate/contracts`.
  - Los esquemas son `SubteRedGeoJsonV1` para la red y `GeoJsonFeatureCollectionV1`, una FeatureCollection mínima, para los recorridos.
  - Respeta la convención de `shared/static`: la versión sale de `archivos[archivo].url`, la key es `['static', 'archivo', <archivo>, <version>]`, con `staleTime: Infinity` y `gcTime` de 24 h, y en la caché va el dato solo.
  - Si el manifiesto no publica el archivo, devuelve `isLoadingError` con un `HttpError` 404 ("Esta información no está disponible por ahora.") en vez de quedar cargando.
- **Pendiente:** sumar los `.geojson` a `useStaticArchivo` (con su última versión conocida) cuando `shared/static` acepte `GEOJSON_ESTATICOS_V1`. Los recorridos de colectivos (742 KB) entran en la estrategia de archivos grandes de 4.5.

## Para 4.6 (colectivos)

- **Mapa:** `MapView` sin cambios, con `initialCenter`/`initialZoom` o `initialBounds` del recorrido (`boundsOf`) y `ref` para seguir un vehículo (`flyTo`, que respeta Reducir movimiento).
- **Vehículos:**
  - `GeoJSONSource id="colectivos-vehiculos"` con `pointCollection(posiciones.data.vehiculos, (v) => ({ id: v.id, coordinates: [v.lon, v.lat], properties: { id: v.id, rumbo: v.rumbo ?? 0 } }))`. Los campos salen de `VehiculoV1`; el rumbo es `rumbo`, no `bearing`.
  - Encima, `Layer type="symbol"` con `layout={{ 'icon-image': 'colectivo', 'icon-rotate': ['get', 'rumbo'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true }}` y la imagen registrada con `<Images images={{ colectivo: … }} />`.
  - Hoy el feed no trae rumbo (`rumbo: null`, `docs/00-plan.md`): o se deriva de posiciones sucesivas o se dibuja un círculo sin rotación.
- **Recorrido:** `useStaticGeoJson('recorridos-colectivos.geojson')` + `Layer type="line"` filtrada por número de línea (`filter={['==', ['get', 'numero'], 60]}`).
- **Detalle:** la `formSheet` nativa, con la configuración de abajo.

## Bottom sheet sobre el mapa (S24): sheet nativa, sin `@gorhom/bottom-sheet`

**Decisión:** el detalle sobre el mapa (parada, vehículo, estación) es una **ruta de Expo Router con `presentation: 'formSheet'`**, apilada sobre la ruta del mapa en el mismo `Stack`. **No se instala `@gorhom/bottom-sheet`.**

Fuentes:

- Expo Router, `NativeStackNavigationOptions` (Context7 `/websites/expo_dev`, `docs.expo.dev/versions/latest/sdk/router/`): `sheetAllowedDetents` acepta fracciones ascendentes o `'fitToContents'`, con un máximo de tres en Android. `sheetLargestUndimmedDetentIndex` es "the largest sheet detent for which a view underneath won't be dimmed", con valores `number | 'none' | 'last'`.
- react-native-screens 4.30.1 (Context7 `/software-mansion/react-native-screens`, escenario "largest undimmed detent index"): verifica que "the screen underneath stays interactive while the sheet is undimmed".
- En **Android** lo confirmé en el código de la versión instalada: `bottomsheet/DimmingView.kt` bloquea gestos solo si su `alpha` no es 0, y `DimmingViewPointerEvents.kt` le pone `PointerEvents.NONE` cuando no atenúa. En **iOS** es `UISheetPresentationController.largestUndimmedDetentIdentifier`, el mismo mecanismo que usa Apple Maps.

Configuración sugerida para 4.6:

```tsx
<Stack.Screen
  name="parada/[id]"
  options={{
    presentation: 'formSheet',
    sheetAllowedDetents: [0.3, 0.6, 1],
    sheetLargestUndimmedDetentIndex: 1, // con 30 % y 60 % el mapa sigue tocable
    sheetGrabberVisible: true,
    sheetCornerRadius: 16,
  }}
/>
```

Cosas que quedan para validar en el dispositivo (no se pueden probar en Jest):

- **Mapa tocable con la sheet abierta.** Con la sheet en un detent sin atenuar, hay que confirmar que el mapa recibe pan, zoom y toques en iOS y Android. Si no los recibe, el plan B es `@gorhom/bottom-sheet` 5.2.14: peers `react-native-reanimated >=4.0.0-` y `react-native-gesture-handler >=2.16.1`, que cumplen con lo instalado.
- **Tocar otro elemento del mapa con la sheet abierta.** Tiene que reemplazar el detalle (`router.setParams` o `router.replace`), no apilar sheets.
- **Lector de pantalla.** La sheet tiene que anunciarse como diálogo y el foco tiene que volver al mapa al cerrarla.

## Reorden por arrastre (4.9): `react-native-reorderable-list`

**Decisión:** `react-native-reorderable-list` **0.18.3**. Es **puro JS**: el paquete publicado trae solo `lib/` y `src/`, sin `android/` ni `ios/`. **No se instala ahora: la instala 4.9** con `pnpm add react-native-reorderable-list@0.18.3 --save-exact` en `apps/mobile`, y no hace falta reconstruir el dev client.

| Opción                                               | Estado (npm, Context7 `/omahili/react-native-reorderable-list`)                                                                                                                                                                            | Veredicto                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `react-native-reorderable-list` 0.18.3               | Publicada el 2026-11-01. Peers: `react-native-reanimated >=3.12.0` y `react-native-gesture-handler >=2.12.0`, que cumplen con Reanimated 4.7.1 y Gesture Handler 3.3.0. API chica: `ReorderableList`, `useReorderableDrag`, `reorderItems` | **Elegida**               |
| `react-native-draggable-flatlist` 4.0.3              | Último release el 2025-05-06, sin cambios desde entonces. Peers viejos (Reanimated `>=2.8`) y sin pruebas declaradas con Reanimated 4                                                                                                      | Descartada                |
| Implementación propia (Gesture Handler + Reanimated) | Posible, pero hay que medir celdas y hacer autoscroll a mano                                                                                                                                                                               | Solo si la librería falla |

Notas para 4.9:

- Usa la API `Gesture.Pan()` de Gesture Handler, que en v3 está marcada deprecada pero funciona. En nuestro código conviene usar las APIs de hooks de v3 (`usePanGesture`, etc.); la regla `@typescript-eslint/no-deprecated` las exige.
- El arrastre no es accesible con lector de pantalla. Cada fila necesita `accessibilityActions` "Mover arriba" / "Mover abajo" que llamen a `FavoritosRepository.reorder` sin gesto.
- Las docs de la librería piden `react-native-reanimated/plugin` en Babel. Con Reanimated 4 y Expo no hace falta: `babel-preset-expo` agrega `react-native-worklets/plugin` solo (ver abajo).

## Gestos y animaciones

`react-native-gesture-handler` 3.3.0 y `react-native-reanimated` 4.7.1 (+ `react-native-worklets` 0.13.0), las versiones que fija el SDK 58. **Sin `babel.config.js`:** `babel-preset-expo` 58.0.23 agrega `react-native-worklets/plugin` automáticamente cuando el paquete se resuelve desde la app (`configs/expo.js`; doc de Expo "Reanimated": "No additional configuration is required").

**`GestureHandlerRootView`** envuelve toda la app (`src/app/_layout.tsx`, tarea 4.3), con `style={{ flex: 1 }}` y por fuera de `SafeAreaProvider`, como pide la doc de RNGH 3 ("Keep `GestureHandlerRootView` as close to the actual root of the app as possible"). Para no re-indentar el árbol, el layout de siempre pasó a llamarse `AppTree` y el `RootLayout` exportado solo lo envuelve.

## Tests

En Jest, `jest.setup.ts` mockea MapLibre (`test/mocks/maplibre.tsx`) y `expo-location` (`test/mocks/expo-location.ts`), y carga los setups oficiales de Reanimated, Worklets y Gesture Handler.

- **Componentes del mapa:** se renderizan como `View` con `testID` `maplibre-<Componente>` o `maplibre-<Componente>-<id>`, y con todas sus props.
- **Refs de la cámara y del mapa:** son `jest.fn` en `mapLibreMock`.
- **Ubicación:** arranca en `undetermined`. Se controla con `locationMock.setPermission`, `setRequestAnswer`, `setPosition` y `emitPosition`.

Ejemplos en `test/mocks/native-deps.test.tsx`. Tests de este módulo:

- `__tests__/MapView.test.tsx`: estilo por tema y su cambio en vivo, atribución, cámara inicial, franja de iOS, "Norte arriba" con y sin Reducir movimiento, "Centrar en mí" (oculto sin permiso, sin pedirlo; con permiso centra; sin GPS no rompe) y `ref`.
- `__tests__/geojson.test.ts`: los helpers.
- `test/map/MapaRedScreen.test.tsx`: carga, datos, navegación, prioridad estación > línea, error con reintento, contrato roto, archivo no publicado, offline con y sin caché, vacío y tema oscuro. Usa `test/map/harness.tsx` (tema, áreas seguras, Query y cliente con `fetch` mockeado) y `test/map/fixtures.ts`.
- `test/api/static-geojson.test.ts`: `client.staticGeoJson`.
