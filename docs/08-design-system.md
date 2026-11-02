# 08 — Sistema de diseño en React Native

> **Estado: 🚧 parcial.** Este documento arranca con una sola sección, **"Íconos (mapa curado)"**, que sale de la investigación de la tarea 3.5. **El resto del documento (tokens en código, tipografías cargadas, componentes de `shared/ui`, estados, accesibilidad, ejemplos y capturas) lo completa la tarea 3.11** cuando los componentes ya existan. Hasta entonces, la referencia visual es [`../DESIGN.md`](../DESIGN.md) y los tokens con cita están en [`02-obelisco-tokens.md`](02-obelisco-tokens.md).

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
2. **Nombres repetidos a propósito.** `star` (tab Favoritos y favorito activado), `info` (Acerca de y Alert info) y `subway` (tab Subtes y estación) se usan con el mismo glifo en dos lugares. En el mapa de código son una sola entrada con dos alias semánticos.
3. **Tránsito.** `traffic` está en el mapa solo para el tab Tránsito, que está oculto (N3 de `docs/briefs/README.md`). No hay que renderizarlo en el MVP.
4. **Compartir.** No se usa en el MVP, por eso no figura.
5. **Flecha de navegación.** `chevron_right` es el indicador de fila navegable; el botón "atrás" lo pone la navegación nativa (gesto de borde en iOS, Back predictivo en Android) y `arrow_back` queda para pantallas modales propias.
6. **Sentido.** Para las cabeceras de andén se usa `arrow_forward` junto al destino ("hacia Plaza de Mayo"); `swap_horiz` es para alternar entre dos sentidos.
7. **Etiqueta de accesibilidad obligatoria.** Los SVG no traen texto: cada uso lleva `accessibilityLabel` en voseo y rioplatense (por ejemplo, la estrella: "Quitar de favoritos" / "Agregar a favoritos") o `accessibilityElementsHidden`/`importantForAccessibility="no"` si es decorativo y hay un texto al lado. Nunca solo color.

### Cómo se dibujan

- Los SVG del paquete miden 48 px y usan `viewBox="0 -960 960 960"`. Como todos tienen **un solo `<path>`**, no hace falta un transformador de Metro: alcanza con extraer el atributo `d` de cada archivo del mapa a un módulo TypeScript de constantes (`as const`) con un script de build, y renderizar `<Svg viewBox="0 -960 960 960"><Path d={…} fill={color} /></Svg>` con `react-native-svg`. Así entra al bundle solo lo que el mapa usa (la consecuencia que anticipa ADR-0004). *(Es una recomendación de la investigación; el diseño final del componente es de la tarea 3.5.)*
- Tamaños de referencia: 24 px por defecto, 20 px dentro de badges y chips, 28 px para el tab *(suposición)* y 32 px en estados vacíos *(suposición, igual al ícono de Card)* (`docs/02-obelisco-tokens.md` §4 fija 20 px en Badge, 24 px en Alert y 32 px en el ícono de Card). El área táctil de un ícono-botón es siempre ≥ 44×44 pt / 48×48 dp, aunque el glifo sea más chico.
- El color se hereda por `fill` desde los tokens del tema (claro y oscuro); no se hardcodea.

### Licencia y atribución

- `@material-symbols/svg-400` declara **Apache-2.0** (campo `license` del `package.json` publicado y archivo `LICENSE` del paquete, consultados el 2026-11-02). Es una redistribución de los íconos de Google hecha por <https://github.com/marella/material-symbols>; el paquete no trae un archivo `NOTICE` (HTTP 404 en `NOTICE` y `NOTICE.md`).
- Apache-2.0 permite uso comercial y redistribución, y pide conservar el aviso de licencia al redistribuir. Como los trazos quedan embebidos en la app, **la pantalla "Acerca de" tiene que mencionar "Íconos: Material Symbols (Google), licencia Apache 2.0" y enlazar al texto de la licencia** *(suposición: lo pide la licencia, pero la forma exacta es decisión del usuario; sumarlo al texto de `docs/05-privacidad.md` / Acerca de en la Fase 4)*.
- Las tipografías Nunito y Open Sans (campo `license` de `@expo-google-fonts/nunito` y `/open-sans` en npm: `MIT AND OFL-1.1`) también van en esa lista de licencias.

## Pendiente (tarea 3.11)

Se completa con: tokens y cómo usarlos; escala tipográfica cargada y límites de Dynamic Type; cada componente de `shared/ui` con props, estados y ejemplos; patrones de estado (carga, vacío, error, stale, offline); accesibilidad probada; y cómo agregar un componente o un ícono nuevo.
