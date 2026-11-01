# Brief: Ajustes (y Acerca de)

> `shape` · modo **Operate** (Ajustes) y **Read** liviano (Acerca de) · plataforma adaptive. Suposiciones marcadas **(suposición)**; consolidadas en [README.md](README.md#suposiciones-consolidadas-a-validar-por-el-usuario).
> Navegación: stack que se abre desde el ícono de Ajustes en la barra de **Inicio** (S2); "Acerca de" es una pantalla anidada dentro de Ajustes (`docs/00-plan.md`, tareas 3.8 y 4.10).

## 1. Trabajo y audiencia

- **Quién:** uso ocasional: alguien que quiere cambiar el tema, ahorrar datos/batería con un refresco más lento, limpiar lo guardado, o saber de dónde salen los datos y qué se hace con su información.
- **Necesidad:** cambiar algo rápido y volver; confiar en la app (privacidad, fuente oficial).
- **Modo:** Operate en Ajustes (lista agrupada nativa); Read en Acerca de (texto breve y escaneable).

## 2. Resultado y evidencia

- **Tareas:** elegir tema; elegir intervalo de refresco; borrar favoritos; limpiar caché; revisar el permiso de ubicación; leer atribución y privacidad.
- **Éxito:** cada ajuste se aplica al instante, sin "Guardar"; la persona entiende en Acerca de que no hay cuentas ni tracking y que los datos son del GCBA.
- **Datos reales:** preferencias en MMKV; versión de la app; versión/fecha del índice estático (manifiesto con hash, `docs/03-arquitectura.md` §6); atribución **CC-BY-2.5-AR** a los datos del GCBA (`PRODUCT.md:67`); resumen de `docs/05-privacidad.md` (texto para la persona en `docs/05-privacidad.md:89-90`).

## 3. Dirección estructural

**Ajustes** — lista agrupada nativa (inset grouped en iOS; lista con encabezados de sección en Android):

| Sección | Ítem | Control | Detalle |
|---|---|---|---|
| Apariencia | Tema | Selección de 3 opciones: **Sistema** (default), Claro, Oscuro (S18) | iOS: fila con menú o pantalla de selección con check; Android: diálogo de opción única o fila con menú *(control nativo de cada plataforma)*. Se aplica al instante |
| Datos | Actualizar cada | 15 s · **20 s** (default) · 30 s · 60 s (S17) | Texto de ayuda: "Más seguido usa más datos y batería. Solo se actualiza con la app abierta." |
| Datos | Índice de líneas y paradas | Fila informativa + acción "Buscar actualización" *(suposición)* | "Versión del 12/10/2026 · 4,8 MB". Estados: actualizando con progreso, al día, error con reintento |
| Datos | Limpiar datos guardados | Acción (texto, no destructiva roja) | Borra la caché de consultas (`docs/05-privacidad.md:23`), **no** favoritos. Toast "Listo, limpiamos los datos guardados" |
| Favoritos | Borrar todos los favoritos | Acción destructiva (color danger) | Confirmación nativa (alert/diálogo) con "Borrar" / "Cancelar" (S19), y después toast con **Deshacer** |
| Privacidad | Ubicación | Fila con estado actual ("Permitida mientras usás la app" / "No permitida") | Toca → configuración del sistema de la app (no hay toggle propio: el permiso es del sistema) |
| Información | Acerca de Transportate | Navegación (push) | — |

**Acerca de** — pantalla de lectura corta:
1. Nombre, ícono y versión ("Transportate 1.0.0 (build 12)").
2. **Datos:** "Los datos de transporte son del Gobierno de la Ciudad de Buenos Aires (API de Transporte), publicados bajo licencia Creative Commons Atribución 2.5 Argentina." + enlace a la licencia y a la fuente *(suposición: URLs a confirmar)*. Aclaración: "Transportate no es una app oficial del Gobierno de la Ciudad." *(suposición: a validar; evita que se lea como app del GCBA aunque use Obelisco)*.
3. **Privacidad** en 3–4 bullets en voseo, tomados de `docs/05-privacidad.md:89-90`: sin cuentas; favoritos y ajustes quedan en tu teléfono; la ubicación solo se usa con la app abierta y nunca sale de tu teléfono; no medimos ni rastreamos lo que hacés.
4. **Diseño:** "Basado en Obelisco, el sistema de diseño de la Ciudad de Buenos Aires." *(suposición)*.
5. **Licencias de software de terceros** (pantalla generada) y, si corresponde, atribución de tiles del mapa (OpenFreeMap/OpenStreetMap, `docs/00-plan.md:36`) — la atribución de OSM es obligatoria donde se muestra el mapa; acá se repite.
6. Contacto/reportar un problema *(suposición: un mail o repositorio; decisión abierta, sin formularios ni telemetría)*.

- **Momento focal:** en Ajustes, ninguno (lista neutra); en Acerca de, el bloque de privacidad.
- **Consecuencia para implementación:** todo ajuste es reactivo (tema vía `ThemeProvider` con override, plan 3.3; intervalo vía configuración de TanStack Query).

## 4. Alcance y límites

- **Fidelidad:** producción (Fase 4, tarea 4.10).
- **No hace:** login, idioma (solo es-AR), notificaciones, tamaño de letra propio (se usa el del sistema), analytics opt-in (no hay analytics).
- **Anti-objetivos:** toggles que no hacen nada perceptible; textos legales largos dentro de la app; "Calificanos" insistente.

## 5. Estados y rangos

| Estado | Qué se ve |
|---|---|
| **Carga** | No hay: todo es local y síncrono. Excepción: fila del índice estático mientras consulta si hay versión nueva (indicador en la fila) |
| **Vacío** | Borrar favoritos deshabilitado con 0 favoritos ("No tenés favoritos guardados") |
| **Error** | Actualizar índice falla → texto en la fila "No pudimos actualizar. Tocá para reintentar." Sin ErrorState de pantalla |
| **Dato viejo** | No aplica, salvo el índice estático: si la versión supera N días *(decisión abierta)*, "Hay una versión más nueva" |
| **Sin conexión** | Banner global; ajustes locales funcionan; "Buscar actualización" deshabilitado con "Necesitás conexión" |
| **Servicio no disponible** | Solo afecta a la actualización del índice (mensaje en la fila) |
| **Feed inexistente** | No aplica: Ajustes no consume feeds en tiempo real. Si el proxy deja de servir el índice estático, la fila lo dice ("No hay actualizaciones disponibles por ahora") y se sigue usando la versión guardada |
| **Sin permiso de ubicación** | La fila Ubicación dice "No permitida" y explica "Podés buscar paradas a mano"; al tocar, abre configuración del sistema |
| **Permiso "preguntar cada vez"/aproximado** | Se refleja el estado real que devuelva el sistema *(suposición: `expo-location` lo expone)* |

Rangos:
- Ajustes: ~7 filas fijas; con Dynamic Type grande, las etiquetas y valores pasan a dos renglones (el valor debajo de la etiqueta), nunca truncados.
- Acerca de: ~150–250 palabras.

## 6. Interacción y layout

- Back nativo en ambos niveles; título inline.
- Cambiar tema: transición crossfade breve (o instantánea con Reduce Motion); haptic de selección.
- Acciones destructivas: confirmación + deshacer como se describe; nada de diálogos para acciones reversibles.
- Lector de pantalla: cada fila anuncia etiqueta + valor + rol ("Actualizar cada, 20 segundos, botón").
- Enlaces externos de Acerca de abren el navegador del sistema (o in-app browser nativo) *(decisión abierta)*.

## 7. Restricciones y decisiones abiertas

- Controles **nativos** de cada plataforma (S23): en iOS, lista inset grouped y menús/checkmarks; en Android, preferencias Material 3. La marca entra por tipografía de títulos, color de acento y tono del copy, no por controles propios (`PRODUCT.md:89`).
- Áreas táctiles 44/48 en filas completas.
- Componentes: listas agrupadas nativas, `Button` (acción destructiva), toast/snackbar con acción, `OfflineBanner`.
- **Abiertas (no inventar):**
  - Opciones exactas de intervalo y si el mínimo es 15 s (depende del TTL del proxy, `docs/00-plan.md:40`).
  - URLs de licencia, fuente y contacto; si se agrega la aclaración "no es app oficial".
  - Si "Limpiar datos guardados" también borra el índice estático (recomendación: no; tiene su propia fila).
  - Si se muestra el estado del servicio upstream (por ejemplo "Fuente de subtes: respondiendo") en Acerca de — útil para depurar, pero agrega superficie; recomendación: fuera del MVP.
