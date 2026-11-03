# 08 — Sistema de diseño en React Native

> **Estado: ✅ Fase 3.** Describe lo que hay **en código** (`apps/mobile/src/shared/{theme,ui,icons}`).
>
> - Los **valores** (colores, escala, contrastes verificados) están en [`../DESIGN.md`](../DESIGN.md).
> - El **origen** de cada token, con cita, está en [`02-obelisco-tokens.md`](02-obelisco-tokens.md).
> - Los **patrones de uso** (frescura, skeleton, errores, offline) están en [`briefs/README.md`](briefs/README.md).
>
> Este documento no repite valores: remite a esas fuentes.

## Tokens en código

`apps/mobile/src/shared/theme/tokens.ts` exporta los tokens tipados. Cada valor lleva un comentario con la cita de `02-obelisco-tokens.md`.

| Export | Qué es | Valores |
|---|---|---|
| `primitives` | Paletas de Obelisco (blue, slate, orange…) | DESIGN.md §2 |
| `light`, `dark`, `schemes` | Esquemas de color por rol: `text.*`, `surface.*`, `border.*`, `role.<primary\|secondary\|tertiary\|danger\|success\|warning\|info>.{base,on,container,onContainer,text}`, foco | DESIGN.md §2.1–2.2 (claro y oscuro) / `02-obelisco-tokens.md` §6 (paleta oscura) |
| `fontFamily`, `typography`, `typeStyle()` | Familias por peso y escala h1–h6, headline lg/md/sm, text xl–xs | DESIGN.md §3.1 |
| `maxFontSizeMultiplier` | Tope de Dynamic Type: `heading` 1.2, `text` 1.3 | DESIGN.md §3.2 |
| `space`, `radius`, `borderWidth`, `elevation`, `hitSlop` (44) | Espaciado (n × 4), radios (Card 16 en nativo), bordes, área táctil mínima | DESIGN.md §4 (4.4 alturas y áreas táctiles) |
| `component` | Medidas de componentes (alturas de botón, badge, input…) | DESIGN.md §7 |
| `motion` | Duraciones (pulso del skeleton) | DESIGN.md §5 (Movimiento) |

**Uso:**
- Siempre a través de `useTheme()`, que devuelve el esquema activo. Ningún componente escribe un hex.
- Para texto, `textStyle(variant)` + `fontScaleCap(variant)`, o directamente el componente `Text`.
- La preferencia de tema (Sistema / Claro / Oscuro) se persiste con `createThemePreferenceStore` ([`07-app.md`](07-app.md) §4 y §7).

Los contrastes se fijan en tests: `theme/__tests__/tokens.test.ts` verifica los pares de DESIGN.md §2 en claro y oscuro (texto ≥ 4.5:1, bordes y foco ≥ 3:1).

## Componentes (`shared/ui`)

Resumen de [`../apps/mobile/src/shared/ui/README.md`](../apps/mobile/src/shared/ui/README.md), que tiene la tabla completa de props y estados. Regla: **ninguna pantalla inventa su variante**.

| Componente | Cuándo usarlo |
|---|---|
| `Text` | Todo texto de la app. `variant` de la escala y `tone` del tema; `heading.*` se anuncia como encabezado |
| `Button` | Acciones. `primary` para la acción principal de la pantalla (una sola), `secondary`/`tertiary`/`outline` para el resto, `danger` para destructivas, `link` en línea. `haptic="success"` solo al guardar un favorito |
| `Card` | Agrupar una unidad tocable (línea, parada, favorito). Toda la tarjeta es el área táctil, con `accessibilityLabel` |
| `Alert` | Mensajes en línea con rol (`success`/`danger`/`warning`/`info`): interrupciones de servicio, dato muy viejo. `system` para los avisos fuertes |
| `Badge` | Etiquetas no interactivas (conteos, "Nuevo") |
| `LineBadge` | La insignia de una línea: letra de subte con su color GTFS, o número de colectivo sobre neutro. Siempre con texto adentro |
| `StatusChip` | Estado de servicio de una línea de subte (`EstadoServicioV1`): ícono + texto, nunca solo color |
| `Chip` | Filtros seleccionables (p. ej. líneas en un mapa). Háptico de selección |
| `SearchInput` | Búsqueda de líneas o paradas, con botón para borrar |
| `SegmentedControl` / `Tabs` | Alternar 2–4 vistas o valores (Lista/Mapa, Tema en Ajustes) |
| `Skeleton` / `SkeletonGroup` | Primera carga sin datos guardados. Nunca en recargas con datos en pantalla |
| `EmptyState` | Vacío real (sin favoritos, búsqueda sin resultados). No para errores |
| `ErrorState` | Error de carga sin datos que mostrar, con "Volver a intentar" si es reintentable |
| `FreshnessLabel` | Junto a todo dato en tiempo real. Calcula la edad con `meta.sourceTimestamp` y el intervalo R de Ajustes |
| `OfflineBanner` | Arriba del contenido cuando no hay conexión; la app sigue mostrando lo guardado |

**Estados de una pantalla con datos** (patrones de `briefs/README.md`):

| Estado | Qué se muestra |
|---|---|
| Carga inicial | `Skeleton` |
| Con datos | Contenido + `FreshnessLabel` |
| Dato viejo | Contenido + `FreshnessLabel` en warning; si es muy viejo (> 10 min), también una `Alert` warning |
| Error sin datos | `ErrorState` |
| Error con datos | Contenido + aviso |
| Sin conexión | `OfflineBanner` + último dato guardado |
| Vacío | `EmptyState` |

## Accesibilidad

- **Área táctil ≥ 44×44 pt (48 dp en Android).** Botones y chips más bajos amplían con `hitSlop` (`hitSlopFor`). Los segmentos y el botón de borrar búsqueda miden 44 o más.
- **Dynamic Type / escala de fuente:**
  - `allowFontScaling` siempre activo, con `maxFontSizeMultiplier` de **1.3 en texto** y **1.2 en títulos y etiquetas de tab/segmento**, por componente y no global (DESIGN.md §3.2).
  - Con escala grande, las filas crecen en alto: nunca se trunca el estado ni la frescura.
- **Roles y estados:**
  - Roles: `header` en títulos, `button`, `tab`/`tablist`, `alert` en `Alert`/`ErrorState`, `progressbar` ocupado en `SkeletonGroup`.
  - Estados: `accessibilityState` con `selected`/`disabled`/`busy`.
  - Cada control tiene `accessibilityLabel` en voseo.
- **Nunca solo color:** `StatusChip` y `FreshnessLabel` llevan glifo y texto, y `LineBadge` lleva la letra o el número.
- **Reduce Motion:** el único movimiento es el pulso del `Skeleton`, que se apaga con "Reducir movimiento" (`useReduceMotion`, que arranca en `true` hasta conocer la preferencia).
- **Lectura de la frescura:** `FreshnessLabel` se lee como "Actualizado hace 12 segundos" al enfocarlo y no se re-anuncia en cada tick.
- **Pendiente detectado en la Fase 3:** `OfflineBanner` declara `accessibilityRole="alert"` en un `View` que no es `accessible`, así que el rol no se expone como elemento (RNTL no lo encuentra con `getByRole('alert')`). Está reportado a la tarea de componentes.

## Háptica

`triggerHaptic(kind)` (`shared/ui/haptics.ts`, `expo-haptics`; suposición S25):
- **`selection`** al cambiar un segmento o un filtro (`SegmentedControl`, `Chip`).
- **`success`** al guardar un favorito (`Button haptic="success"`).
- **Nunca** en refrescos automáticos ni en errores.

Si el dispositivo no tiene motor o la persona los desactivó, no pasa nada (los errores se ignoran).

## Cómo agregar un componente o un ícono

1. **Componente:**
   - Va en `shared/ui/<Nombre>.tsx`, con colores solo de `useTheme()`, área táctil ≥ 44 y rol y etiqueta de accesibilidad.
   - Agregalo a `index.ts`, sumá una fila en el README de `shared/ui` y en la tabla de arriba, y escribí su test en `shared/ui/__tests__/` (render en claro y oscuro con `renderThemed`).
2. **Ícono:** sumá la fila en la tabla de "Íconos" (verificando el archivo) y la entrada en `shared/icons/map.ts`.

## Íconos (mapa curado)

Decisión: [`adr/ADR-0004-iconos-material-symbols.md`](adr/ADR-0004-iconos-material-symbols.md). Los íconos son **Material Symbols Rounded, FILL 1**, como SVG estático del paquete **`@material-symbols/svg-400` 0.48.2** (ver [`versiones.md`](versiones.md)), dibujados con `react-native-svg`. El componente `Icon` (tarea 3.5) acepta **solo** nombres de este mapa; sumar un ícono es sumar una fila acá y una entrada en el mapa.

### Cómo se verificó (2026-11-02)

Cada archivo se pidió con `HEAD` a la copia de jsDelivr del paquete publicado en npm, con la versión exacta:

```sh
curl -sI "https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@0.48.2/rounded/<nombre>-fill.svg"
```

Resultado: **42 archivos distintos, todos HTTP 200** (la tabla muestra el tamaño que informa el servidor, en bytes). Control negativo: un nombre inexistente (`rounded/ícono_inexistente-fill.svg`) da **HTTP 404**, así que el 200 significa que el archivo existe. Además se bajaron los 42 y **cada uno contiene exactamente un elemento `<path>`**.

### Tabla

Columnas: uso en la app → nombre en Material Symbols → archivo en `@material-symbols/svg-400` → verificado (HTTP 200 en `cdn.jsdelivr.net`, 2026-11-02, v0.48.2). Los usos salen de los briefs (`docs/briefs/`) y de los patrones compartidos de `docs/briefs/README.md`.

| Uso | Nombre Material Symbols | Archivo (`rounded/…`) | Verificado |
|---|---|---|---|
| Tab Inicio | `home` | `rounded/home-fill.svg` | HTTP 200 · 503 B |
| Tab Colectivos | `directions_bus` | `rounded/directions_bus-fill.svg` | HTTP 200 · 614 B |
| Tab Subtes | `subway` | `rounded/subway-fill.svg` | HTTP 200 · 662 B |
| Tab Favoritos | `star` | `rounded/star-fill.svg` | HTTP 200 · 387 B |
| Tab Tránsito (oculto en el MVP. N3) | `traffic` | `rounded/traffic-fill.svg` | HTTP 200 · 743 B |
| Ajustes (barra superior de Inicio) | `settings` | `rounded/settings-fill.svg` | HTTP 200 · 716 B |
| Acerca de | `info` | `rounded/info-fill.svg` | HTTP 200 · 698 B |
| Atrás | `arrow_back` | `rounded/arrow_back-fill.svg` | HTTP 200 · 289 B |
| Cerrar (sheet. aviso. modal) | `close` | `rounded/close-fill.svg` | HTTP 200 · 299 B |
| Flecha de navegación en filas (chevron) | `chevron_right` | `rounded/chevron_right-fill.svg` | HTTP 200 · 252 B |
| Enlace externo (Acerca de: fuentes y licencias) | `open_in_new` | `rounded/open_in_new-fill.svg` | HTTP 200 · 627 B |
| Buscar | `search` | `rounded/search-fill.svg` | HTTP 200 · 476 B |
| Limpiar búsqueda (reset del campo) | `cancel` | `rounded/cancel-fill.svg` | HTTP 200 · 495 B |
| Favorito activado (estrella llena) | `star` | `rounded/star-fill.svg` | HTTP 200 · 387 B |
| Favorito desactivado (estrella con contorno) **[excepción FILL 0]** | `star` | `rounded/star.svg` | HTTP 200 · 474 B |
| Reordenar favoritos (S33) | `drag_handle` | `rounded/drag_handle-fill.svg` | HTTP 200 · 448 B |
| Editar alias (S16) | `edit` | `rounded/edit-fill.svg` | HTTP 200 · 318 B |
| Borrar | `delete` | `rounded/delete-fill.svg` | HTTP 200 · 801 B |
| Deshacer (snackbar de S19) | `undo` | `rounded/undo-fill.svg` | HTTP 200 · 387 B |
| Paradas cercanas | `near_me` | `rounded/near_me-fill.svg` | HTTP 200 · 272 B |
| Centrar el mapa en mi ubicación | `my_location` | `rounded/my_location-fill.svg` | HTTP 200 · 652 B |
| Sin permiso de ubicación | `location_off` | `rounded/location_off-fill.svg` | HTTP 200 · 571 B |
| Marcador / punto en el mapa | `location_on` | `rounded/location_on-fill.svg` | HTTP 200 · 422 B |
| Vista de mapa | `map` | `rounded/map-fill.svg` | HTTP 200 · 386 B |
| Vista de lista | `list` | `rounded/list-fill.svg` | HTTP 200 · 947 B |
| Parada de colectivo | `departure_board` | `rounded/departure_board-fill.svg` | HTTP 200 · 848 B |
| Estación de subte | `subway` | `rounded/subway-fill.svg` | HTTP 200 · 662 B |
| Andén (arribos por andén) | `transfer_within_a_station` | `rounded/transfer_within_a_station-fill.svg` | HTTP 200 · 907 B |
| Sentido: ida y vuelta (alternar) | `swap_horiz` | `rounded/swap_horiz-fill.svg` | HTTP 200 · 472 B |
| Sentido: hacia la cabecera | `arrow_forward` | `rounded/arrow_forward-fill.svg` | HTTP 200 · 289 B |
| Ir al detalle: flecha al borde de la banda de señal (`SignBand`, Fase 5) | `arrow_forward` | `rounded/arrow_forward-fill.svg` | mismo archivo que la fila anterior |
| Refrescar | `refresh` | `rounded/refresh-fill.svg` | HTTP 200 · 480 B |
| Alerta / advertencia (Alert warning) | `warning` | `rounded/warning-fill.svg` | HTTP 200 · 486 B |
| Información (Alert info. "Con novedades") | `info` | `rounded/info-fill.svg` | HTTP 200 · 698 B |
| Error (ErrorState. Alert danger) | `error` | `rounded/error-fill.svg` | HTTP 200 · 685 B |
| OK / normal (StatusChip "Normal") | `check_circle` | `rounded/check_circle-fill.svg` | HTTP 200 · 430 B |
| Demoras (StatusChip "Con demoras") | `schedule` | `rounded/schedule-fill.svg` | HTTP 200 · 441 B |
| Interrumpida (StatusChip "Interrumpida") | `block` | `rounded/block-fill.svg` | HTTP 200 · 413 B |
| Sin información (StatusChip "Sin información") | `help` | `rounded/help-fill.svg` | HTTP 200 · 871 B |
| Sin conexión (OfflineBanner) | `wifi_off` | `rounded/wifi_off-fill.svg` | HTTP 200 · 798 B |
| Frescura del dato (FreshnessLabel. dato viejo) | `history` | `rounded/history-fill.svg` | HTTP 200 · 648 B |
| Tema claro | `light_mode` | `rounded/light_mode-fill.svg` | HTTP 200 · 1.451 B |
| Tema oscuro | `dark_mode` | `rounded/dark_mode-fill.svg` | HTTP 200 · 314 B |
| Tema del sistema | `brightness_auto` | `rounded/brightness_auto-fill.svg` | HTTP 200 · 928 B |
| Intervalo de refresco | `timer` | `rounded/timer-fill.svg` | HTTP 200 · 726 B |
| Privacidad (Acerca de) | `privacy_tip` | `rounded/privacy_tip-fill.svg` | HTTP 200 · 489 B |

### Notas

1. **Excepción de FILL: la estrella apagada.** `PRODUCT.md` fija FILL 1, pero un favorito *desactivado* con el mismo glifo lleno solo se distinguiría por el color, y el color no puede ser el único canal (`PRODUCT.md`, "Accessibility & Inclusion"). Por eso el estado "no es favorito" usa **`rounded/star.svg` (FILL 0, contorno)** y el estado "es favorito" usa `rounded/star-fill.svg`. Es el único ícono del mapa sin `-fill` *(suposición: a validar por el usuario; si no se acepta, la alternativa es mantener el glifo lleno y variar color + etiqueta de accesibilidad)*. El archivo `star.svg` también devolvió HTTP 200 (474 B).
2. **Nombres repetidos a propósito.** `star` (tab Favoritos y favorito activado), `info` (Acerca de y Alert info) `subway` (tab Subtes y estación) y `arrow_forward` (sentido hacia la cabecera e «ir al detalle» de la banda de señal, `irA`) se usan con el mismo glifo en dos lugares. En el mapa de código son una sola entrada con dos alias semánticos.
3. **Tránsito.** `traffic` está en el mapa solo para el tab Tránsito, que está oculto (N3 de `docs/briefs/README.md`). No hay que renderizarlo en el MVP.
4. **Compartir.** No se usa en el MVP, por eso no figura.
5. **Flecha de navegación.** `chevron_right` es el indicador de fila navegable; el botón "atrás" lo pone la navegación nativa (gesto de borde en iOS, Back predictivo en Android) y `arrow_back` queda para pantallas modales propias.
6. **Sentido.** Para las cabeceras de andén se usa `arrow_forward` junto al destino ("hacia Plaza de Mayo"); `swap_horiz` es para alternar entre dos sentidos.
7. **Etiqueta de accesibilidad obligatoria.** Los SVG no traen texto: cada uso lleva `accessibilityLabel` en voseo y rioplatense (por ejemplo, la estrella: "Quitar de favoritos" / "Agregar a favoritos") o `accessibilityElementsHidden`/`importantForAccessibility="no"` si es decorativo y hay un texto al lado. Nunca solo color.

### Uso en código

El componente `Icon` y el mapa viven en `apps/mobile/src/shared/icons/` (README de la carpeta: [`../apps/mobile/src/shared/icons/README.md`](../apps/mobile/src/shared/icons/README.md)). Los nombres de uso en código son los del mapa en camelCase (`inicio`, `colectivos`, `subtes`, `favoritoOn`, `favoritoOff`, `sinConexion`, …); `iconMap` en `map.ts` es la lista completa y `IconName` el tipo.

```tsx
import { Icon } from '@/shared/icons';
```

Decorativo (default): hay un texto al lado que dice lo mismo, así que el ícono se oculta a VoiceOver y TalkBack.

```tsx
<View style={{ flexDirection: 'row', gap: 8 }}>
  <Icon name="subtes" color={colors.text.primary} />
  <Text>Subtes</Text>
</View>
```

Con significado propio (por ejemplo, el estado de una línea o un botón-ícono): `accessibilityLabel` es obligatorio, en castellano rioplatense, y el ícono se expone como imagen con esa etiqueta.

```tsx
<Icon name="interrumpida" size={20} color={colors.danger.base} accessibilityLabel="Servicio interrumpido" />

<Pressable onPress={alternarFavorito} accessibilityRole="button" accessibilityLabel="Quitar de favoritos">
  <Icon name={esFavorito ? 'favoritoOn' : 'favoritoOff'} size={24} color={colors.primary.base} />
</Pressable>
```

Reglas: `size` es 16, 20, 24 (default) o 32; el color sale siempre de los tokens del tema; el área táctil de un botón-ícono la pone el botón (≥ 44×44 pt / 48×48 dp). Los ejemplos suponen un `colors` que sale de `useTheme()` (tarea 3.3); los nombres exactos de los roles los define el tema, no este documento. El color por default de `Icon` todavía es `#000000`, provisorio (TODO en `Icon.tsx`): pasale siempre `color` desde el tema.

### Cómo se dibujan

- Los SVG del paquete miden 48 px y usan `viewBox="0 -960 960 960"`. **Implementado (tarea 3.5):** cada archivo se importa como componente con `react-native-svg-transformer` 1.5.3 (SVGR, configurado en `apps/mobile/metro.config.js`) y `Icon` lo dibuja con `width`/`height` = `size` y `fill` = `color`. Metro empaqueta solo los 42 SVG que importa `map.ts`. Verificado con `expo export --platform ios`: el bundle trae los 42 `viewBox="0 -960 960 960"` y ningún `fill` fijo. Alternativa que se descartó: extraer el `d` de cada SVG a constantes con un script (todos tienen un solo `<path>`); se prefirió el transformer porque lo pide la tarea y evita un paso de build propio.
- Tamaños de referencia: 24 px por defecto, 20 px dentro de badges y chips, 28 px para el tab *(suposición)* y 32 px en estados vacíos *(suposición, igual al ícono de Card)* (`docs/02-obelisco-tokens.md` §4 fija 20 px en Badge, 24 px en Alert y 32 px en el ícono de Card). El área táctil de un ícono-botón es siempre ≥ 44×44 pt / 48×48 dp, aunque el glifo sea más chico.
- El color se hereda por `fill` desde los tokens del tema (claro y oscuro); no se hardcodea.

### Licencia y atribución

- `@material-symbols/svg-400` declara **Apache-2.0** (campo `license` del `package.json` publicado y archivo `LICENSE` del paquete, consultados el 2026-11-02). Es una redistribución de los íconos de Google hecha por <https://github.com/marella/material-symbols>; el paquete no trae un archivo `NOTICE` (HTTP 404 en `NOTICE` y `NOTICE.md`).
- Apache-2.0 permite uso comercial y redistribución, y pide conservar el aviso de licencia al redistribuir. Como los trazos quedan embebidos en la app, **la pantalla "Acerca de" tiene que mencionar "Íconos: Material Symbols (Google), licencia Apache 2.0" y enlazar al texto de la licencia** *(suposición: lo pide la licencia, pero la forma exacta es decisión del usuario; sumarlo al texto de `docs/05-privacidad.md` / Acerca de en la Fase 4)*.
- La tipografía Fira Sans (campo `license` de `@expo-google-fonts/fira-sans` en npm: `MIT AND OFL-1.1`) también van en esa lista de licencias.
