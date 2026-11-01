# ADR-0004 — Íconos Material Symbols Rounded como SVG (en vez de fuente variable)

- **Estado:** Aceptada (2026-11-01)
- **Fase:** 1 (se implementa en Fase 3, tarea 3.5)
- **Origen:** `docs/00-plan.md`, decisión de arquitectura 4

## Contexto

La identidad visual fija **Material Symbols Rounded con FILL 1** (ver `PRODUCT.md`, Brand Commitments). Material Symbols se distribuye en dos formas: una **fuente variable** (ejes FILL, wght, GRAD, opsz) y **archivos SVG estáticos** por ícono y variante. React Native **no soporta `font-variation-settings`**, por lo que con la fuente variable no se puede garantizar de forma portable el eje FILL = 1 en iOS y Android.

Verificado el 2026-11-01: el paquete `@material-symbols/svg-400` (v0.48.2, Apache-2.0) incluye `rounded/<nombre>-fill.svg` (por ejemplo `directions_bus-fill.svg`, `subway-fill.svg`, `star-fill.svg`).

## Decisión

Usar **`@material-symbols/svg-400`**, variantes **`rounded/*-fill.svg`**, renderizados con **`react-native-svg`** mediante un componente **`Icon`** que recibe un nombre de un **mapa curado** (solo los íconos que la app usa). Los SVG se importan de forma estática para que el bundler incluya únicamente los usados (tree-shaking real).

## Alternativas consideradas

| Alternativa | Ventajas | Por qué no |
|---|---|---|
| **Fuente variable de Material Symbols** (`expo-font`) | Un solo archivo, todos los íconos, ejes ajustables | Sin `font-variation-settings` en RN no se puede fijar FILL 1 de forma confiable; el archivo es grande (todos los glifos) aunque se usen 30. |
| **Fuente estática "Material Symbols Rounded Filled"** | Fácil con `expo-font` | Pesa mucho; se trae toda la fuente; cambiar peso o relleno exige otro archivo. |
| **`@expo/vector-icons` (MaterialIcons / MaterialCommunityIcons)** | Ya incluido en Expo | Es el conjunto Material clásico, no Symbols Rounded; el trazo no coincide con Obelisco. |
| **SF Symbols en iOS / Material en Android** | Máxima sensación nativa | Dos sistemas de íconos para mantener; contradice el compromiso de marca de usar Material Symbols Rounded en ambas plataformas (la tensión con la guía nativa queda registrada en `PRODUCT.md` para `shape`/`adapt`). |

## Consecuencias

- (+) FILL 1 garantizado en iOS y Android; tamaño de app proporcional a los íconos usados.
- (+) El color se hereda por `fill` y respeta tema claro/oscuro y contraste.
- (−) Hay que mantener el **mapa curado**: sumar un ícono es agregar una entrada (y se versiona con el paquete).
- (−) Requiere una forma de importar SVG como componentes (transformador de Metro o conversión a datos de path en build). Definir en Fase 3 con Context7 sobre `react-native-svg` y Metro.
- (−) Los SVG son de 24 px a peso 400: para tamaños distintos se escala el viewBox; si se necesitara otro peso u óptica (`opsz`), habría que sumar otro paquete (`svg-300`, `svg-500`…).
- (−) Cada ícono necesita etiqueta de accesibilidad explícita (los SVG no la traen).
