# `src/shared/map` — plan del mapa (tarea 4.0)

Todavía sin código. Acá van a vivir las piezas que comparten el mapa de subte (4.3) y el de colectivos (4.6): el `Map` con el estilo según el tema, la atribución, la cámara inicial sobre CABA y los helpers de GeoJSON. Las dependencias nativas ya están instaladas y configuradas (ver `apps/mobile/README.md`, "Dependencias nativas de la Fase 4").

## Librería: MapLibre React Native v11 (ADR-0002)

`@maplibre/maplibre-react-native` **11.5.1**: solo New Architecture. El config plugin está en `app.config.ts` y en iOS agrega `$MLRN.post_install(installer)` al Podfile. Sin API key y sin telemetría.

**La API de v11 no es la de v10.** Los nombres que aparecen en ejemplos viejos ya no existen:

| v10 (no usar) | v11 (instalada) |
|---|---|
| `MapView` | `Map` (prop `mapStyle`, obligatoria) |
| `ShapeSource` | `GeoJSONSource` (prop `data`) |
| `LineLayer`, `SymbolLayer`, `CircleLayer`, `FillLayer` | `Layer` con `type="line" \| "symbol" \| "circle" \| "fill"` y `paint`/`layout` de la especificación de estilo |
| `Camera` con `centerCoordinate`/`zoomLevel` | `Camera` con `initialViewState={{ center, zoom }}` y ref con `flyTo`/`easeTo`/`jumpTo`/`fitBounds` |
| `UserLocation` | `UserLocation` (sigue igual) |

Antes de escribir, leer los tipos en `node_modules/@maplibre/maplibre-react-native/lib/typescript/module/index.d.ts` o consultar Context7 (`/maplibre/maplibre-react-native`).

**Ubicación en el mapa:** la posición de la persona sale de `expo-location` (4.7), que es el permiso que declaramos. `UserLocation`/`useCurrentPosition` de MapLibre usan su propio `LocationManager`: si 4.6 los usa, tiene que ser *después* de que `expo-location` haya obtenido el permiso en contexto (S32), nunca al montar el mapa.

## Estilos de OpenFreeMap

Verificados el 2026-11-03 (`https://openfreemap.org/quick_start/` y HTTP 200 de cada URL). Son gratis, no piden API key y la doc dice que se usan igual con MapLibre Native:

| Tema | URL | Por qué |
|---|---|---|
| Claro | `https://tiles.openfreemap.org/styles/positron` | Gris claro y de poco contraste: las líneas de subte y los colectivos resaltan encima |
| Oscuro | `https://tiles.openfreemap.org/styles/dark` | Existe (no hace falta derivarlo). Misma fuente `openmaptiles` que `positron`, así que las capas propias valen para los dos |

También existen `liberty`, `bright` y `fiord`; quedan como alternativas si 4.3 necesita más detalle de calles. El estilo se elige con `useTheme()` y cambia con el tema (claro/oscuro de primera clase). Si 4.3 personaliza el estilo (por ejemplo, para bajar el contraste de las calles debajo de las líneas), la doc de OpenFreeMap pide alojar el JSON del estilo nosotros. El candidato es el paquete estático del proxy.

## Atribución (obligatoria)

El TileJSON de `https://tiles.openfreemap.org/planet` declara:

> OpenFreeMap © OpenMapTiles Data from OpenStreetMap

Con enlaces a `https://openfreemap.org`, `https://www.openmaptiles.org/` y `https://www.openstreetmap.org/copyright`. En la app:

- **En el mapa**, siempre visible: el botón de atribución nativo de MapLibre (`attribution` del `Map`, que abre la lista con los enlaces), o un `Text` propio con "© OpenStreetMap · OpenMapTiles · OpenFreeMap" que lleve a Acerca de. No taparlo con la sheet ni con controles.
- **En Acerca de** (4.10): el texto completo con los tres enlaces (`docs/05-privacidad.md` §7).

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

| Opción | Estado (npm, Context7 `/omahili/react-native-reorderable-list`) | Veredicto |
|---|---|---|
| `react-native-reorderable-list` 0.18.3 | Publicada el 2026-11-01. Peers: `react-native-reanimated >=3.12.0` y `react-native-gesture-handler >=2.12.0`, que cumplen con Reanimated 4.7.1 y Gesture Handler 3.3.0. API chica: `ReorderableList`, `useReorderableDrag`, `reorderItems` | **Elegida** |
| `react-native-draggable-flatlist` 4.0.3 | Último release el 2025-05-06, sin cambios desde entonces. Peers viejos (Reanimated `>=2.8`) y sin pruebas declaradas con Reanimated 4 | Descartada |
| Implementación propia (Gesture Handler + Reanimated) | Posible, pero hay que medir celdas y hacer autoscroll a mano | Solo si la librería falla |

Notas para 4.9:

- Usa la API `Gesture.Pan()` de Gesture Handler, que en v3 está marcada deprecada pero funciona. En nuestro código conviene usar las APIs de hooks de v3 (`usePanGesture`, etc.); la regla `@typescript-eslint/no-deprecated` las exige.
- El arrastre no es accesible con lector de pantalla. Cada fila necesita `accessibilityActions` "Mover arriba" / "Mover abajo" que llamen a `FavoritosRepository.reorder` sin gesto.
- Las docs de la librería piden `react-native-reanimated/plugin` en Babel. Con Reanimated 4 y Expo no hace falta: `babel-preset-expo` agrega `react-native-worklets/plugin` solo (ver abajo).

## Gestos y animaciones

`react-native-gesture-handler` 3.3.0 y `react-native-reanimated` 4.7.1 (+ `react-native-worklets` 0.13.0), las versiones que fija el SDK 58. **Sin `babel.config.js`:** `babel-preset-expo` 58.0.23 agrega `react-native-worklets/plugin` automáticamente cuando el paquete se resuelve desde la app (`configs/expo.js`; doc de Expo "Reanimated": "No additional configuration is required").

**Pendiente para el primer uso (4.6 o 4.9):** los gestos solo se reconocen dentro de `<GestureHandlerRootView>`, que tiene que envolver el `Stack` en `src/app/_layout.tsx` (doc de Expo, tutorial "Gestures"). No se montó en esta tarea porque `_layout.tsx` no es de 4.0. El primero que use gestos lo agrega, por fuera de `SafeAreaProvider` y con `style={{ flex: 1 }}`.

## Tests

En Jest, `jest.setup.ts` mockea MapLibre (`test/mocks/maplibre.tsx`) y `expo-location` (`test/mocks/expo-location.ts`), y carga los setups oficiales de Reanimated, Worklets y Gesture Handler.

- **Componentes del mapa:** se renderizan como `View` con `testID` `maplibre-<Componente>` o `maplibre-<Componente>-<id>`, y con todas sus props.
- **Refs de la cámara y del mapa:** son `jest.fn` en `mapLibreMock`.
- **Ubicación:** arranca en `undetermined`. Se controla con `locationMock.setPermission`, `setRequestAnswer`, `setPosition` y `emitPosition`.

Ejemplos en `test/mocks/native-deps.test.tsx`.
