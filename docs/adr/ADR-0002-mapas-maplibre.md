# ADR-0002 — Mapas con MapLibre (en vez de react-native-maps)

- **Estado:** Aceptada (2026-11-01)
- **Fase:** 1 (se implementa en Fase 4, tareas 4.3 y 4.6)
- **Origen:** `docs/00-plan.md`, decisión de arquitectura 2

## Contexto

La app muestra posiciones de colectivos en tiempo real (miles de vehículos filtrados por línea), la red de subte y cortes de tránsito. Necesita:

1. **Costo predecible a escala**: sin facturación por carga de mapa si llega a millones de usuarios.
2. **Estilo propio claro/oscuro** alineado a Obelisco y a los colores de línea (ver `02b-colores-subte.md`).
3. **Capas de datos eficientes** (símbolos rotados por `bearing`, líneas y polígonos GeoJSON) con cientos o miles de elementos.
4. Opción de **autoalojar los tiles** más adelante.

Dato verificado con Context7 (2026-11-01): `react-native-maps` usa **Google Maps siempre en Android** (requiere API key en el manifest) y Apple MapKit por defecto en iOS; `@maplibre/maplibre-react-native` v11 funciona solo con la New Architecture (RN ≥ 0.80) y pide estilo/tiles propios o de un proveedor en producción. Ver `versiones.md`.

## Decisión

Usar **`@maplibre/maplibre-react-native` v11** con **tiles vectoriales de OpenFreeMap** al comienzo (sin API key) y un **estilo propio** claro y oscuro. El objetivo de mediano plazo es **autoalojar tiles como PMTiles en Cloudflare R2**.

## Alternativas consideradas

| Alternativa | Ventajas | Por qué no |
|---|---|---|
| **react-native-maps** | Mapas nativos (MapKit en iOS), look "de la plataforma", API simple | En Android depende de Google Maps SDK con billing y API key; estilo limitado; a escala de millones de usuarios el costo y la dependencia de Google son un riesgo. |
| **Mapbox (`@rnmapbox/maps`)** | Muy completo, mismo modelo de estilos | Requiere token y facturación por usuarios activos mensuales; mismo problema de costo y dependencia. |
| **Google Maps nativo** | Calidad y datos de lugares | Billing por carga, sin control del estilo, cierra la puerta al autoalojado. |
| **Mapa web embebido (WebView + MapLibre GL JS)** | Evita módulo nativo | Peor rendimiento y gestos; se pierde el sentimiento nativo. |
| **Sin mapa (solo listas)** | Más simple | Se pierde la funcionalidad central de seguimiento de colectivos. |

## Consecuencias

- (+) Sin API keys ni costo por carga de mapa; control total del estilo (claro/oscuro, colores de línea).
- (+) Camino claro a PMTiles en R2 para eliminar el tercero.
- (−) **Look menos "nativo"** que Apple Maps; aceptado en el plan.
- (−) **Requiere dev client y New Architecture**: no hay Expo Go en ningún momento del proyecto.
- (−) **Privacidad:** mientras se usen tiles de OpenFreeMap, el teléfono se conecta directamente a ese servicio y le revela IP y zona visualizada. Debe declararse en `05-privacidad.md` y en "Acerca de"; el autoalojado en R2 pasa por el proxy y lo evita.
- (−) Atribución obligatoria de OpenStreetMap / OpenMapTiles / OpenFreeMap en el mapa (confirmar el texto exacto en Fase 4).
- (−) Riesgo de dependencia de un servicio gratuito sin SLA hasta autoalojar (ver riesgo 5 del plan).
