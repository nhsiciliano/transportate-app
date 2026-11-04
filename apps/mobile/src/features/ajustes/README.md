# features/ajustes

Ajustes, Acerca de y Licencias (tarea 4.10; brief [`docs/briefs/06-ajustes.md`](../../../../../docs/briefs/06-ajustes.md), suposiciones S17–S19 y S27). Se abren como stack desde Inicio. Las rutas de `src/app/(tabs)/inicio/` (`ajustes.tsx`, `acerca.tsx`, `licencias.tsx`) solo montan las pantallas de acá. En la Fase 5 (F5-LOW-B) llevan la dirección «Señalética de terminal» con la **restricción máxima del modo Operate**: contrato en [`.impeccable/surfaces/src-features-ajustes-ajustesscreen-tsx.md`](../../../.impeccable/surfaces/src-features-ajustes-ajustesscreen-tsx.md), que hereda el mundo visual de [Inicio](../inicio/README.md).

## Brief operativo (Fase 5, F5-LOW-B: «Señalética de terminal»)

Ajustes es la trastienda de la señal: **listas agrupadas del sistema** con la tipografía (Fira Sans), la paleta (Obelisco v2 intacta) y la densidad de la dirección, y nada más. Sin bandas (`SignBand` es para valores vivos), sin pictogramas en cuadrado y sin movimiento firma. Tabs, header inline, gesto de volver y controles (`SegmentedControl`, el diálogo nativo) quedan como estaban. El copy no cambia: ya lo validó el usuario.

**Ajustes** (`AjustesScreen`) sobre `bg.elevated` en claro y `bg.base` en oscuro (como Inicio), con 12 pt entre secciones:

| Pieza | Medidas |
| --- | --- |
| Encabezado de sección | `fontFamily.text[600]` 13/16 `text.secondary`, caja de oración (misma forma que «Subte ahora» de Inicio), 8 pt sobre la placa; es un `header` para el lector |
| Placa | `Card` compartida con `padding: 0`: blanca (`bg.card`), outline 1 px `border.subtle`, radio 6, sin sombra; `overflow: hidden` para que el tinte de presionado respete el radio |
| Fila (`Row`) | `minHeight` 52, `paddingHorizontal` 16, `paddingVertical` 10, hairline `border.subtle` entre filas (nunca después de la última). Título 17/22 en 400 `text.primary`; detalle 15/20 `text.secondary`; nota de ayuda 13/16 `text.secondary`. Presionada: `bg.pressed` |
| Fila con control (`ControlRow`) | Título 17, el `SegmentedControl` compartido debajo (Tema; Actualizar cada) y la nota 13/16. No es tocable: el que se toca es el control |
| Chevron | `chevron` 20 `text.tertiary`, **solo** en filas que navegan («Acerca de Transportate», «Licencias de software de terceros»). Las que salen de la app (Ubicación con el permiso resuelto, los enlaces de Acerca) llevan `enlaceExterno` 16 en `text.tertiary` |
| Destructiva | «Borrar todos los favoritos» es una fila con el título en `role.danger.text` y el estado («Tenés 2 favoritos guardados.») como detalle; deshabilitada con 0 favoritos: título y detalle en `text.disabled` |
| Acción sin destino | «Limpiar datos guardados» y la acción del índice («Buscar actualización») van en `text.link` y sin chevron |
| Barra de descarga del índice | `role.secondary.base` sobre `bg.pressed`, 4 pt de alto, radio 2, debajo de «Descargando… 40 %»; decorativa (el porcentaje ya está escrito) |

Orden de lectura: Apariencia → Datos (Actualizar cada, Índice, Limpiar) → Favoritos → Privacidad → Información. Cada fila tocable es **un solo elemento accesible** con etiqueta compuesta («Borrar todos los favoritos, Tenés 2 favoritos guardados.»; «Ubicación, Permitida mientras usás la app. Tocá para abrir la configuración»). Áreas táctiles ≥ 52. Con Dynamic Type al tope (1.3 en el texto, 1.2 en títulos) las filas solo tienen `minHeight`: crecen en alto y no hay `numberOfLines` en ningún valor ni estado.

**Acerca de** (`AcercaScreen`) es lectura sobre el mismo fondo: ícono de la app como antes; nombre 28/34 en `fontFamily.heading[700]`; «Versión 0.1.0 (build N)» 15 `text.secondary`; títulos de sección 20/26 en 600; párrafos y bullets 17/26 en 400 `text.primary` con `maxFontSizeMultiplier` 1.3; «Enlaces» y «Software» son placas con chevron o enlace externo (enlaces en `text.link`). **Diseño** dice ahora (F5-ajustes-9): «La app sigue Obelisco v2, el sistema de diseño de la Ciudad de Buenos Aires, adaptado a nativo y con la tipografía Fira Sans. Sobre esa paleta tiene una dirección visual propia: «Señalética de terminal».» El test de 150–250 palabras sigue pasando.

**Licencias** (`LicenciasScreen`) es una placa con una fila por paquete: nombre 17/22 en 600, «versión · licencia» 15/20 `text.secondary`, chevron que gira al expandir y el texto de la licencia en 15/22 `text.secondary` (Fira Sans, no monoespaciada). `licencias.json` ya trae `@expo-google-fonts/fira-sans` (MIT AND OFL-1.1) y ningún Nunito ni Open Sans (hay un test que lo fija).

### Estados (Fase 5)

La forma cambia; el contenido y el copy de cada estado se conservan.

| Estado | Ajustes | Acerca de / Licencias |
| --- | --- | --- |
| Carga | Solo el índice es remoto: su fila mantiene el indicador y «Buscando…» (F5-ajustes-5); el resto es local y aparece de una | Local: sin carga |
| Vacío | «Borrar todos los favoritos» deshabilitada, título y detalle en `text.disabled`, «No tenés favoritos guardados» | Un paquete sin texto de licencia: «Este paquete no incluye el texto de la licencia…» |
| Error con reintento | Fila del índice: «No pudimos actualizar. Tocá para reintentar.» y la acción pasa a «Reintentar» | Un enlace que el sistema no abre se ignora sin romper la pantalla |
| Dato viejo | El índice conserva la versión y suma el renglón de error (ícono `error` + texto en `role.danger.text`) | — |
| Sin conexión | La acción dice «Necesitás conexión» y la fila queda deshabilitada (`text.disabled`); el banner global lo pone otra capa | Local: sin cambios |
| Sin permiso | Fila Ubicación: «No permitida» + «Podés buscar paradas a mano»; tocar abre la configuración del iPhone (ícono de salida) o pide el permiso si todavía se puede | — |

### Contraste (`tools/contraste/contraste.py`, fórmula WCAG 2.x)

Mínimo: 4,5:1 texto, 3:1 elementos gráficos. «Pistas» = fondo del par.

| Esquema | Par | Primer plano | Fondo | Ratio | Cumple |
| --- | --- | --- | --- | --- | :-: |
| claro | título 17 (`text.primary`) / placa | `#08202f` | `#ffffff` | 16,69:1 | ✅ |
| claro | título / presionada (`bg.pressed`) | `#08202f` | `#d6e4f6` | 12,95:1 | ✅ |
| claro | párrafos de Acerca (`text.primary`) / `bg.elevated` | `#08202f` | `#edf4ff` | 15,09:1 | ✅ |
| claro | detalle y nota (`text.secondary`) / placa | `#4a5766` | `#ffffff` | 7,38:1 | ✅ |
| claro | detalle / presionada | `#4a5766` | `#d6e4f6` | 5,72:1 | ✅ |
| claro | encabezado de sección y versión (`text.secondary`) / `bg.elevated` | `#4a5766` | `#edf4ff` | 6,67:1 | ✅ |
| claro | acción y enlaces (`text.link`) / placa | `#035c80` | `#ffffff` | 7,38:1 | ✅ |
| claro | enlaces de lectura (`text.link`) / `bg.elevated` | `#035c80` | `#edf4ff` | 6,67:1 | ✅ |
| claro | destructiva (`role.danger.text`) / placa | `#cb3232` | `#ffffff` | 5,20:1 | ✅ |
| claro | destructiva / presionada | `#cb3232` | `#d6e4f6` | 4,03:1 | ⚠️ |
| claro | chevron y enlace externo (`text.tertiary`) / placa | `#626e7e` | `#ffffff` | 5,18:1 | ✅ |
| claro | barra de descarga (`role.secondary.base`) / pista (`bg.pressed`) | `#035c80` | `#d6e4f6` | 5,72:1 | ✅ |
| claro | título deshabilitado (`text.disabled`, exento WCAG 1.4.3) | `#92a0b1` | `#ffffff` | 2,66:1 | exento |
| oscuro | título (`text.primary`) / placa | `#edf4ff` | `#1b2836` | 13,53:1 | ✅ |
| oscuro | párrafos de Acerca / `bg.base` | `#edf4ff` | `#000b18` | 17,89:1 | ✅ |
| oscuro | detalle y nota (`text.secondary`) / placa | `#c7d4e6` | `#1b2836` | 9,97:1 | ✅ |
| oscuro | encabezado de sección y versión / `bg.base` | `#c7d4e6` | `#000b18` | 13,18:1 | ✅ |
| oscuro | acción y enlaces (`text.link`) / placa | `#82bfe8` | `#1b2836` | 7,53:1 | ✅ |
| oscuro | enlaces de lectura / `bg.base` | `#82bfe8` | `#000b18` | 9,96:1 | ✅ |
| oscuro | destructiva (`role.danger.text`) / placa · presionada | `#ff7266` | `#1b2836` · `#253240` | 5,59 · 4,88:1 | ✅ |
| oscuro | chevron y enlace externo (`text.tertiary`) / placa · presionada | `#92a0b1` | `#1b2836` · `#253240` | 5,62 · 4,90:1 | ✅ |
| oscuro | barra de descarga (`role.secondary.base`) / pista (`bg.pressed`) | `#67a5cd` | `#253240` | 4,87:1 | ✅ |
| oscuro | título deshabilitado (`text.disabled`, exento) | `#626e7e` | `#1b2836` | 2,89:1 | exento |

- **Destructiva presionada en claro (⚠️):** `role.danger.text` sobre `bg.pressed` da 4,03:1 mientras el dedo está apoyado; en reposo (la fila que se lee) es 5,20:1. Es un estado transitorio y la fila ya dice «Borrar» con texto; se deja `bg.pressed` como pide el contrato (F5-ajustes-8).
- Los pares con el mismo valor que en Inicio (`text.link` y `text.secondary` sobre `bg.elevated`) coinciden con la tabla de [Inicio](../inicio/README.md).

## Brief operativo (Fase 4: contenido y copy; la forma de arriba lo reemplaza)

**Ajustes** es una lista agrupada: secciones con encabezado y tarjeta, filas de 52 pt o más (44 de área táctil más aire). Todo cambia al instante, sin "Guardar". El único estado con datos es la fila del índice; el resto es local.

| Sección | Qué muestra | Copy exacto |
|---|---|---|
| Apariencia | Tema: Sistema · Claro · Oscuro | "Tema" |
| Datos | Actualizar cada: 15 s · 20 s · 30 s · 60 s | "Más seguido usa más datos y batería. Solo se actualiza con la app abierta." |
| Datos | Índice de líneas y paradas | "Versión del 12/10/2026 · 4,8 MB" · acción "Buscar actualización" |
| Datos | Limpiar datos guardados | "Borra los datos de transporte guardados en tu teléfono. No toca tus favoritos." → aviso "Listo, limpiamos los datos guardados" |
| Favoritos | Borrar todos los favoritos | Diálogo "¿Borrar todos tus favoritos?" (Cancelar / Borrar) → aviso "Borraste tus favoritos." + "Deshacer" |
| Privacidad | Ubicación | Estado real del permiso: "Permitida mientras usás la app" · "No permitida" ("Podés buscar paradas a mano") · "Todavía no la pediste". Tocar pide el permiso o abre la configuración (F4-ubicacion-6) |
| Información | Acerca de Transportate | — |

**Estados de la fila del índice** (único dato remoto de la pantalla, `useManifest()`):

| Estado | Qué se ve |
|---|---|
| Carga (sin caché) | Indicador en la fila y "Buscando…". No hay skeleton de pantalla porque lo demás es local |
| Datos | La versión y el peso. Mientras se baja un archivo grande de Colectivos (`shared/static`): "Descargando… 40 %"; "Buscar actualización" también baja la versión nueva de lo ya descargado |
| Actualización fallida con datos | Se queda la versión y debajo: "No pudimos actualizar. Tocá para reintentar." |
| Error sin datos | "No pudimos actualizar. Tocá para reintentar." y la acción pasa a "Reintentar" |
| Sin conexión | La acción dice "Necesitás conexión" y la fila queda deshabilitada. El banner global lo pone otra capa |
| Vacío | "Borrar todos" deshabilitado y el texto "No tenés favoritos guardados" |

**Acerca de** es una lectura de 150–250 palabras (hay un test que lo verifica): ícono, nombre y "Versión 0.1.0 (build 12)"; **Datos** (GCBA, CC BY 2.5 AR, catálogo de paradas de BA Data, "Transportate no es una app oficial del Gobierno de la Ciudad.") con dos enlaces; **Privacidad** en 4 bullets; **Mapa**; **Diseño**; y la fila "Licencias de software de terceros". **Licencias** es una lista de nombre · versión · licencia, con el texto expandible.

**Avisos (`Snackbar`):** viven en el provider de la pantalla de Ajustes. Si la persona sale de Ajustes, el "Deshacer" se pierde (F4-ajustes-1).

## Suposiciones nuevas

| # | Suposición |
|---|---|
| F4-ajustes-1 | El `SnackbarProvider` se monta dentro de `AjustesScreen`, no en el layout raíz. "Deshacer" dura mientras la persona siga en Ajustes (8 s). Si otra pantalla necesita avisos, se sube al layout raíz. |
| F4-ajustes-2 | La fecha del índice sale en `dd/mm/aaaa` con hora de Buenos Aires (UTC−3 fijo, sin horario de verano desde 2009) y el peso es la suma de `archivos[*].bytes` en MB de 1.048.576 bytes, una decimal con coma. Se formatea a mano porque Hermes no siempre trae `Intl` con `es-AR`. |
| F4-ajustes-3 | Acerca de no tiene contacto ni "reportar un problema": es una decisión abierta del usuario (brief §3.6). Cuando se defina, va como fila en la sección Información. |
| F4-ajustes-4 | "Datos abiertos de la Ciudad" apunta a `https://www.buenosaires.gob.ar/datosabiertos` (responde 200 el 2026-11-03, aunque redirige a una página del sitio histórico). La licencia, a `https://creativecommons.org/licenses/by/2.5/ar/` (200). Ambos abren en el navegador del sistema; la decisión abierta del brief (navegador vs. in-app) queda en "navegador". |
| F4-ajustes-5 | "Limpiar datos guardados" vacía todo el `QueryClient`, incluido el manifiesto (se vuelve a pedir enseguida). No pide confirmación porque no es destructivo (se reconstruye solo). No toca favoritos ni preferencias. |
| F4-ajustes-6 | El cambio de tema es instantáneo, sin crossfade propio (el brief lo pedía "breve"). El `SegmentedControl` ya marca la selección y da el háptico. |
| F4-ajustes-7 | Licencias lista solo las `dependencies` directas de `apps/mobile` (25 paquetes), no las transitivas. Los paquetes del workspace (`@transportate/contracts`) se omiten porque es código propio. Las fuentes llevan MIT + OFL-1.1 (`LICENSE` y `LICENSE_FONT`). Tres paquetes no traen archivo de licencia (`expo-router`, `react-native-mmkv`, `react-native-nitro-modules`): se muestra el identificador y el enlace al repositorio. |
| F4-ajustes-8 | "Mapa" repite la atribución de ADR-0002 y suma la frase de `docs/05-privacidad.md` sobre el servicio externo de tiles (puede ver la IP y la zona). El texto exacto lo puede ajustar high-dev. |
| F4-ajustes-9 | Los avisos usan `colors.text.primary` como fondo y `colors.text.inverse` como texto: no hay un token de superficie inversa en `tokens.ts`. |

## Archivos

| Archivo | Qué hay |
|---|---|
| `AjustesScreen.tsx` | Pantalla. Recibe `queryCacheStore` (el `KeyValueStore` de la caché persistida) para poder probarla sin MMKV |
| `IndiceRow.tsx` | Fila del índice con sus estados. Lee el avance de la descarga de `shared/static` (o el `downloadProgress` que le pasen) |
| `AcercaScreen.tsx` | Acerca de. Versión con `expo-constants` (`expoConfig.version` + `nativeBuildVersion`) |
| `LicenciasScreen.tsx`, `licencias.ts`, `licencias.json` | Pantalla, esquema Zod del JSON y el JSON generado |
| `SettingsList.tsx` | `Section` (encabezado + placa), `Row`, `ControlRow`, `Hairline` y `RowTitle`/`RowDetail`/`RowNote` con la escala 17/15/13 y las medidas de la fila; las piezas de la lista agrupada (solo para estas pantallas) |
| `format.ts` | Fecha argentina y MB |
| `preferences.ts` | Opciones y copy de tema e intervalo, y `usePreference` (lógica de la Fase 3) |
| `images.d.ts` | Declaración de los `.png` importados |

## Cómo regenerar las licencias

Desde `apps/mobile`, con las dependencias instaladas:

```sh
pnpm licencias
```

`scripts/licencias.mjs` (Node, sin dependencias) recorre las `dependencies` de `package.json`, sigue los symlinks de pnpm y escribe `licencias.json` ordenado y sin fechas: correrlo dos veces no genera diff. Si el JSON con textos pasara de 300 KB, lo vuelve a escribir sin los textos (hoy pesa unos 47 KB). Hay que regenerarlo cuando cambian las dependencias.

## Suposiciones nuevas (Fase 5, F5-LOW-B)

| # | Suposición |
|---|---|
| F5-ajustes-1 | Las filas ya no llevan pictograma a la izquierda (`icon` salió de `Row`). La restricción máxima del contrato lo pide, y el de Ubicación (`sinUbicacion`) decía «sin ubicación» aun con el permiso concedido. |
| F5-ajustes-2 | «Borrar todos los favoritos» pasó de `Button` danger a una fila destructiva del contrato (título en `role.danger.text`); el estado («Tenés N favoritos guardados.» / «No tenés favoritos guardados») es su detalle y entra en la etiqueta accesible compuesta. El diálogo nativo y el «Deshacer» no cambian. |
| F5-ajustes-3 | Las acciones que no navegan («Limpiar datos guardados», «Buscar actualización») conservan `text.link` (el contrato fija `text.primary` para el título general, pero no dice cómo se distingue una acción sin destino; sin el color o un chevron la fila parecería informativa). Chevron solo navega; el ícono de salida es `enlaceExterno` 16. |
| F5-ajustes-4 | El indicador de salida de la fila Ubicación se muestra solo cuando tocarla abre la configuración del iPhone; cuando todavía puede pedir el permiso no lleva nada. |
| F5-ajustes-5 | Sin skeleton de pantalla: lo único remoto es la fila del índice y ya ocupa su lugar con el indicador y «Buscando…» desde el primer cuadro (la «silueta nueva» es la fila misma). |
| F5-ajustes-6 | Licencias pasó de `FlatList` a `ScrollView` con una sola placa: son unas 25 filas y no hace falta virtualizar; así el radio, el outline y los hairline son los de las demás placas. El texto de cada licencia sigue montándose solo al expandir. |
| F5-ajustes-7 | La barra de descarga solo se dibuja mientras hay avance (`downloadProgress !== null`), no durante «Buscando actualización…». Se oculta al lector: el porcentaje ya está en el texto de la fila. |
| F5-ajustes-8 | `role.danger.text` sobre `bg.pressed` en claro (4,03:1) queda por debajo de 4,5:1 mientras la fila está presionada; no se cambió el fondo de presionado del contrato. Si el usuario lo ve flojo, la salida es teñir las filas destructivas con `bg.elevated` al presionar. |
| F5-ajustes-9 | La redacción de «Diseño» en Acerca de es provisional (la revisa el usuario, ver el contrato). No se agregó una línea de Material Symbols: Acerca de nunca la tuvo (la atribución de los íconos vive en Licencias, como librería). |
| F5-ajustes-10 | `Snackbar` no se tocó (es de high-dev): toma el radio 6 de `component.card.radius`. Falta ver en el iPhone que se lea bien sobre la tab bar nativa y sobre la última placa. |

## Pendiente

Validar en el iPhone la forma nueva (ver [`docs/11-prueba-manual.md`](../../../../../docs/11-prueba-manual.md) §5): que el `Snackbar` quede por encima de la tab bar nativa, la fila Ubicación contra los permisos reales, el texto grande y la barra de descarga. La redacción de «Diseño» y el contacto de Acerca de (F4-ajustes-3) siguen abiertos para el usuario.
