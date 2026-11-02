# shared/ui — componentes compartidos (tarea 3.7)

Componentes de la app construidos sobre los tokens de [`../theme/tokens.ts`](../theme/tokens.ts) (Obelisco v2, identidad vigente, con la paleta oscura derivada; fuentes: [`DESIGN.md`](../../../../../DESIGN.md) y [`docs/02-obelisco-tokens.md`](../../../../../docs/02-obelisco-tokens.md)). Los patrones de uso están en [`docs/briefs/README.md`](../../../../../docs/briefs/README.md), "Patrones compartidos". Ninguna pantalla inventa su variante.

```tsx
import { ThemeProvider } from '@/shared/theme';          // o la ruta relativa que use el scaffold
import { Button, FreshnessLabel, StatusChip } from '@/shared/ui';
```

## Reglas transversales

- **Colores:** siempre desde `useTheme()`, nunca escritos en el componente. La única excepción son los datos (`route_color`/`route_text_color` del estático de subte), que llegan por props. `grep -n "#[0-9a-fA-F]\{6\}" src/shared/ui` solo da resultados en `__fixtures__` y `__tests__`.
- **Claro y oscuro:** todos los componentes leen el esquema activo (`ThemeProvider`: Sistema / Claro / Oscuro, S18). La vitrina `__fixtures__/Showcase.tsx` los renderiza en los dos esquemas en los tests.
- **Área táctil ≥ 44×44:** botones y chips de 32/40 usan `hitSlop` hasta 44 (`hitSlopFor`); los segmentos y el botón de limpiar miden 44 o más.
- **Tipografía con Dynamic Type:** `allowFontScaling` siempre activo, con `maxFontSizeMultiplier` de **1.3 en texto corrido** y **1.2 en títulos, headlines y etiquetas de tab/segmento** (DESIGN.md §3.2): los títulos ya son grandes y las etiquetas viven en controles de alto fijo. Las insignias (letra de línea, glifos de estado) usan `component.badgeFontScale` = 1.3. Con escala grande las filas crecen en alto: nunca se trunca el estado ni la frescura. Una familia por peso (`Nunito_700Bold`, `OpenSans_400Regular`); si la fuente no cargó todavía, RN usa la del sistema con el mismo tamaño e interlineado.
- **Bordes:** los controles (input, botón outline, chip, segmentado) usan `border.strong` (≥ 3:1, WCAG 1.4.11); `border.subtle` es solo separador decorativo (outline de `Card`). Los bordes de rol (Alert estándar, Badge secundaria) usan `role.<rol>.text` (warning en claro = orange-600, DESIGN.md §2.2).
- **Contraste verificado en tests:** `theme/__tests__/tokens.test.ts` fija los pares de DESIGN.md §2 (texto ≥ 4.5:1, `on`/`base` ≥ 4.5:1, bordes y foco ≥ 3:1) en claro y oscuro.
- **Accesibilidad:** `accessibilityRole`, `accessibilityLabel` y `accessibilityState` en cada control. Los íconos van como slot (`icon?: ReactNode`) y se ocultan al lector; el texto siempre está.
- **Hápticos** (`haptics.ts`, S25): selección al cambiar segmento o filtro (`SegmentedControl`, `Chip`); éxito al guardar favorito (`Button haptic="success"`). Nada en refrescos automáticos.
- **Movimiento:** solo el pulso del `Skeleton`, y se apaga con Reduce Motion (`useReduceMotion`, que arranca en `true` hasta conocer la preferencia).
- **Íconos:** hasta que exista `Icon` (tarea 3.5), los componentes aceptan un slot `icon`. `StatusChip` y `FreshnessLabel` traen un glifo de texto de respaldo (`✓ ! ✕ ?`, `⚠`) para no depender solo del color.
- **Copy** en voseo ("Tocá", "Probá de nuevo").

## Componentes

| Componente | Base Obelisco (`02-obelisco-tokens.md`) | Props clave | Estados |
|---|---|---|---|
| `Text` | §2 escala tipográfica (h1–h6 mobile, headline lg/md/sm, text xl–xs) | `variant` (`heading.h1`…`text.xs`), `tone` (`primary`/`secondary`/`tertiary`/`disabled`/`placeholder`/`link`/`inverse`), `color` | `heading.*` se anuncia como encabezado |
| `Button` | §1.5 y §4 Button: pill, `headline-md` bold, 32/40/48 | `label`, `onPress`, `variant` (`primary`/`secondary`/`tertiary`/`danger`/`light`/`link`), `outline`, `size` (`sm`/`md`/`lg`, default `lg`), `icon` + `iconPosition`, `haptic` | presionado (fondo hover), `disabled` (fondo y texto deshabilitados), `loading` (indicador + `busy`) |
| `Card` | §4 Card: outline 2 px `border.subtle`, sin sombra. **Radio 16 en nativo** (32 en web; DESIGN.md §4.2): en una pantalla de 360 pt el radio web recorta el contenido | `children`, `onPress` + `accessibilityLabel` (toda la tarjeta tocable) | presionado |
| `Alert` | §4 Alert: estándar (contenedor del rol, texto `text.primary`, outline 1 px `role.text`) y `system` (sólido; info usa secondary, warning texto primary) | `role` (`success`/`danger`/`warning`/`info`), `variant`, `title`, `message`, `icon`, `action`, `live` | `accessibilityRole="alert"`, live region `polite` (o `assertive`) |
| `Badge` | §4 Badge: secundaria (fondo suave + borde) y primaria (sólida); sm 20 / md 24 | `label`, `tone` (`default`/`info`/`success`/`danger`/`warning`), `variant`, `size`, `icon` | — |
| `LineBadge` | Badge + colores del GTFS (`02b-colores-subte.md` §3) | `kind: 'subte'` con `color`/`textColor` (route_color / route_text_color) o `kind: 'colectivo'` (número sobre neutro, S11); `label`, `size` (24/32/44), `surface` | borde automático si la insignia tiene < 3:1 contra la superficie (WCAG 1.4.11); "Línea A" para el lector |
| `StatusChip` | Badge secundaria + ícono | `estado: EstadoServicioV1` (`@transportate/contracts`) | `normal` → "Normal" (success), `demorada` → "Con demoras" (warning), `interrumpida` → "Interrumpida" (danger), `sin_datos` → "Sin información" (neutro); ícono + texto, lector: "Estado: …" |
| `Chip` | §4 Chip: badge secundaria clickeable, alto ≥ 32 | `label`, `selected`, `onPress`, `icon`, `disabled` | seleccionado (`role.secondary`, el activo de nav), presionado, deshabilitado; háptico de selección |
| `SearchInput` | §4 Input / búsqueda: pill 48, outline 2 px, lupa a 16 | `value`, `onChangeText`, `onClear`, `label` (nombre accesible), `placeholder`, `icon`, `clearIcon` | foco (outline = anillo de foco), con texto (botón "Borrar búsqueda" de 44×48), `returnKeyType="search"` |
| `SegmentedControl` / `Tabs` | §4 Tabs pill: activo `$active-color` con texto blanco; borde `border.strong` | `options`, `value`, `onChange`, `accessibilityLabel` del grupo, `size` | `tablist`/`tab` con `selected`; alto ≥ 44; háptico de selección |
| `Skeleton` + `SkeletonGroup` | Patrón "Skeleton" del brief | `Skeleton`: `width`, `height`, `radius`, `circle`; `SkeletonGroup`: `accessibilityLabel` (default "Cargando…") | pulso de opacidad (800 ms), sin animación con Reduce Motion; el grupo es `progressbar` `busy` |
| `EmptyState` | Patrón "EmptyState" | `message`, `title`, `icon`, `action` | solo para vacío real (no para errores) |
| `ErrorState` | Patrón "ErrorState" | `title`, `cause`, `onRetry`, `retryable` (default true), `retryLabel` ("Volver a intentar"), `retrying` | con `retryable: false` es informativo, sin botón |
| `FreshnessLabel` | Patrón "FreshnessLabel" (S6) | `sourceTimestamp` (ISO o null), `intervalSeconds` (R, default 20), `now` | fresco ≤ 3·R ("Actualizado hace 12 s"), viejo ≤ 10 min ("⚠ Dato de hace 4 min", color warning), muy viejo > 10 min (+ "Este dato puede no reflejar la situación actual."), sin dato ("Sin dato de actualización"); se actualiza cada segundo solo mientras está montado; el lector lee "hace 12 segundos" y no se re-anuncia |
| `OfflineBanner` | Alert `system` warning | `visible` | texto fijo "Sin conexión. Mostramos lo último guardado.", live region `polite` |

Utilidades: `triggerHaptic(kind)`, `useReduceMotion()`, `hitSlopFor(height, min)`, `alertPalette()`, `badgePalette()`, `freshnessLevel()`, `formatAge()`, `STATUS` (copy y tono por estado).

## Suposiciones de esta tarea

- **Card con radio 16 y padding 16** en nativo (Obelisco web: 32 y 24). DESIGN.md §4.2 fija el radio; el padding de 16 coincide con el gutter de pantalla (§4.1) para que el contenido de la card se alinee con el resto.
- **Badge md** con `text.sm` y **sm** con `text.xs`: Obelisco define sm con `text-sm` pero sus alturas (20/24 con padding 2/4) no entran con ese interlineado.
- **`light.text.secondary` = slate-700:** Obelisco usa `$body-secondary-color` slate-950 (más oscuro que el cuerpo); en la app "secundario" es texto de menor jerarquía.
- **Chip y SegmentedControl seleccionados** usan el color activo de navegación de Obelisco (`role.secondary`: secondary en claro, `blue-400` en oscuro).
- **`role.<rol>.text`** es un campo agregado a los roles de Obelisco: el color del rol usado como texto o borde sobre fondo claro/oscuro. En claro, los contenedores de estado llevan texto `text.primary` (DESIGN.md §2.2) y el color del rol queda para el borde y el ícono.
- **OfflineBanner** con el estilo de Alert `system` warning (estado degradado, no error).
