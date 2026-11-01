# Brief: Favoritos

> `shape` · modo **Operate** · plataforma adaptive. Suposiciones marcadas **(suposición)**; consolidadas en [README.md](README.md#suposiciones-consolidadas-a-validar-por-el-usuario).

## 1. Trabajo y audiencia

- **Quién:** quien repite los mismos viajes todos los días (casa ↔ trabajo) y no quiere buscar cada vez (`PRODUCT.md:20`). También quien está sin señal y necesita lo suyo igual.
- **Necesidad:** acceso en un toque a sus líneas, paradas y estaciones, con su dato vivo; y poder ordenarlos y nombrarlos a su manera.
- **Modo:** Operate.

## 2. Resultado y evidencia

- **Tarea principal:** abrir un favorito y ver su información; secundaria: administrar (alias, orden, borrar).
- **Éxito:** el favorito más usado está arriba, con su dato vivo visible sin abrirlo, y funciona offline con el último dato marcado.
- **Datos reales:** favoritos en MMKV detrás de `FavoritosRepository` (ADR-0003; plan 3.10), con tipo, id público, alias opcional y orden. Nada sale del teléfono (`docs/05-privacidad.md:22,35`). El dato vivo de cada favorito sale de las mismas queries de su feature.
- **Tipos (S14):**
  | Tipo | Dato vivo en la fila |
  |---|---|
  | Línea de subte | `StatusChip` (Normal / Con demoras / Interrumpida) |
  | Estación de subte | Próximo arribo por sentido ("→ Alem 2 min · → Rosas 5 min") |
  | Línea de colectivo | "18 en servicio" + alerta si hay *(suposición)* |
  | Parada de colectivo | Líneas que paran (estático). **Sin arribos**: no existen en la API (`docs/01a-api-console.md`). Punto de entrada futuro N4 |

## 3. Dirección estructural

1. Barra superior "Favoritos" + botón **Editar** (iOS) / acción de edición en el top app bar (Android).
2. **Lista única** en el orden que eligió la persona *(suposición: no se agrupa por tipo; el orden manual es lo que importa)*. Cada fila: ícono de tipo + `LineBadge`(s) + alias (o el nombre oficial si no hay alias) + nombre oficial en texto secundario cuando hay alias + dato vivo a la derecha o debajo.
3. Con > 15 favoritos, `SearchInput` arriba que filtra por alias y nombre *(suposición)*.
4. FreshnessLabel global de la lista (la más vieja de las que están en pantalla *(suposición)*).

**Modo edición:**
- Reordenar por **arrastre** (handle visible; plan 4.9), con alternativa accesible "Mover arriba/abajo" en acciones del lector de pantalla.
- Borrar: swipe nativo (iOS: swipe a la izquierda; Android: acción en la fila o swipe *(suposición)*) → se quita al instante y aparece snackbar/toast "Quitaste «Casa». **Deshacer**" (plan 4.9, S19).
- Editar alias: tocar la fila en modo edición → campo de texto en sheet con "Guardar"/"Cancelar"; máximo 30 caracteres (S16), con contador.

**Cómo se agrega un favorito:** desde el detalle de cada cosa (`FavoriteToggle`, estrella). Al guardar: haptic de éxito + confirmación breve "Guardado en favoritos" con acción "Ponerle nombre" *(suposición)*. No se agrega desde esta pantalla (salvo el atajo del EmptyState).

- **Momento focal:** la primera fila con su dato vivo.
- **Consecuencia para implementación:** la lista se pinta **síncrona** desde MMKV al abrir (sin skeleton para la estructura); solo los datos vivos cargan.

## 4. Alcance y límites

- **Fidelidad:** producción (Fase 4, tarea 4.9).
- **No hace:** sincronizar entre dispositivos (no hay cuentas), exportar/importar *(suposición: fuera del MVP)*, agrupar en carpetas, notificaciones por favorito, guardar cortes.
- **Anti-objetivos:** pedir login "para no perder tus favoritos"; diálogos de confirmación para cada borrado (se usa deshacer).

## 5. Estados y rangos

| Estado | Qué se ve |
|---|---|
| **Vacío** (0) | EmptyState que enseña: estrella + "Todavía no guardaste favoritos." + "Tocá la estrella en una línea, parada o estación para tenerla acá." + botones "Ver subtes" / "Buscar colectivo" |
| **Carga** | Estructura inmediata (MMKV); cada dato vivo con skeleton propio del tamaño del dato |
| **Normal** | §3 |
| **Dato viejo** | En la fila afectada, el dato vivo se atenúa con "hace 6 min"; la FreshnessLabel global pasa a warning |
| **Sin conexión** | Banner global; todos los favoritos visibles y tocables; datos vivos de caché con antigüedad; los que nunca se cargaron dicen "Sin datos guardados" |
| **Servicio no disponible** | Por fila: dato vivo reemplazado por "Sin información" + la pantalla muestra una Alert única "El servicio de la Ciudad no responde" con reintentar (no una por fila) |
| **Error en un tipo** (p. ej. subte OK, colectivos caído) | Solo las filas de ese tipo muestran "Sin información"; el resto normal |
| **Feed inexistente** | Filas de ese tipo muestran solo su información estática (p. ej. parada de colectivo siempre) |
| **Favorito huérfano** (la línea/parada ya no existe en el índice estático nuevo) | Fila con aviso "Esta parada ya no figura en los datos oficiales" + acción "Quitar" *(suposición)* |
| **Sin permiso de ubicación** | No aplica |
| **Deshacer expirado** | El borrado es definitivo; sin papelera |

Rangos realistas:
- **Cantidad:** 0, 10, 50 (S15). Con 50, la lista hace scroll y la búsqueda aparece; la performance del dato vivo se limita a las filas visibles *(suposición: no se hacen 50 requests; los datos vivos se piden solo para filas en pantalla y comparten caché)*.
- **Alias:** 0 a 30 caracteres, con emoji posibles; se truncan a 1 línea, el lector lee completo.
- **Mezcla:** todos del mismo tipo o los cuatro tipos mezclados.

## 6. Interacción y layout

- Pull to refresh actualiza los datos vivos visibles.
- Tocar una fila → detalle del tipo (N1: cambia de tab).
- Long press → menú contextual nativo: "Abrir", "Cambiar nombre", "Quitar".
- Arrastre: elevación/feedback visual del ítem levantado, haptic al levantar y al soltar *(suposición, alineado a nativo)*; Reduce Motion → sin animación de reacomodo.
- Lector de pantalla: "Casa. Parada Av. Rivadavia y Acoyte. Líneas 1, 25, 132." / "Trabajo. Estación Medrano, línea B. Hacia Leandro N. Alem en 2 minutos."

## 7. Restricciones y decisiones abiertas

- Safe areas; botón Editar/Listo nativo; el swipe de borrado no interfiere con el back por borde.
- Áreas táctiles 44/48, incluido el handle de arrastre.
- Componentes: filas de lista, `LineBadge`, `StatusChip`, `FreshnessLabel`, `SearchInput`, snackbar/toast con acción, sheet de edición, `EmptyState`, `OfflineBanner`.
- **Abiertas (no inventar):**
  - Lista única vs agrupada por tipo (recomendación: única con orden manual; validar).
  - Qué dato vivo mostrar para línea de colectivo (cantidad en servicio vs alerta vs nada).
  - Duración del deshacer (recomendación: el default de la plataforma, ~4–10 s).
  - Si la estación de subte guarda un **sentido** preferido (mostrar solo "Hacia Alem") o ambos.
  - Arribos en paradas de colectivo (N4): **no** en el MVP.
