# features/ajustes

Ajustes, Acerca de y Licencias (tarea 4.10; brief [`docs/briefs/06-ajustes.md`](../../../../../docs/briefs/06-ajustes.md), suposiciones S17–S19 y S27). Se abren como stack desde Inicio. Las rutas de `src/app/(tabs)/inicio/` (`ajustes.tsx`, `acerca.tsx`, `licencias.tsx`) solo montan las pantallas de acá.

## Brief operativo (tarea 4.1)

**Ajustes** es una lista agrupada: secciones con encabezado y tarjeta, filas de 52 pt o más (44 de área táctil más aire). Todo cambia al instante, sin "Guardar". El único estado con datos es la fila del índice; el resto es local.

| Sección | Qué muestra | Copy exacto |
|---|---|---|
| Apariencia | Tema: Sistema · Claro · Oscuro | "Tema" |
| Datos | Actualizar cada: 15 s · 20 s · 30 s · 60 s | "Más seguido usa más datos y batería. Solo se actualiza con la app abierta." |
| Datos | Índice de líneas y paradas | "Versión del 12/10/2026 · 4,8 MB" · acción "Buscar actualización" |
| Datos | Limpiar datos guardados | "Borra los datos de transporte guardados en tu teléfono. No toca tus favoritos." → aviso "Listo, limpiamos los datos guardados" |
| Favoritos | Borrar todos los favoritos | Diálogo "¿Borrar todos tus favoritos?" (Cancelar / Borrar) → aviso "Borraste tus favoritos." + "Deshacer" |
| Información | Acerca de Transportate | — |

**Estados de la fila del índice** (único dato remoto de la pantalla, `useManifest()`):

| Estado | Qué se ve |
|---|---|
| Carga (sin caché) | Indicador en la fila y "Buscando…". No hay skeleton de pantalla porque lo demás es local |
| Datos | La versión y el peso. Con `downloadProgress` (lo pasa la tarea 4.5): "Descargando… 40 %" |
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
| `IndiceRow.tsx` | Fila del índice con sus estados; lista para que 4.5 le pase `downloadProgress` |
| `AcercaScreen.tsx` | Acerca de. Versión con `expo-constants` (`expoConfig.version` + `nativeBuildVersion`) |
| `LicenciasScreen.tsx`, `licencias.ts`, `licencias.json` | Pantalla, esquema Zod del JSON y el JSON generado |
| `SettingsList.tsx` | `Section` y `Row`, las piezas de la lista agrupada (solo para estas pantallas) |
| `format.ts` | Fecha argentina y MB |
| `preferences.ts` | Opciones y copy de tema e intervalo, y `usePreference` (lógica de la Fase 3) |
| `images.d.ts` | Declaración de los `.png` importados |

## Cómo regenerar las licencias

Desde `apps/mobile`, con las dependencias instaladas:

```sh
pnpm licencias
```

`scripts/licencias.mjs` (Node, sin dependencias) recorre las `dependencies` de `package.json`, sigue los symlinks de pnpm y escribe `licencias.json` ordenado y sin fechas: correrlo dos veces no genera diff. Si el JSON con textos pasara de 300 KB, lo vuelve a escribir sin los textos (hoy pesa unos 47 KB). Hay que regenerarlo cuando cambian las dependencias.

## Pendiente

- `// TODO 4.7`: fila **Ubicación** (estado del permiso y enlace a la configuración del sistema) cuando llegue `expo-location`.
- Progreso de descarga del índice (4.5).
