# features/ubicacion

Ubicación compartida (Fase 4, tarea 4.7 y fila de Ajustes). La usan Colectivos ("Paradas cercanas"), el mapa ("centrar en mí") y Ajustes. **La ubicación nunca sale del teléfono**: no se guarda en MMKV ni en la caché de consultas y no se manda al proxy ([`docs/05-privacidad.md`](../../../../../docs/05-privacidad.md) §3).

## Brief operativo F5 (F5-MID-B)

`PermisoUbicacionBloque` pasa a la dirección «Señalética de terminal» (contrato de Colectivos: `apps/mobile/.impeccable/surfaces/src-features-colectivos-colectivosscreen-tsx.md`). **Copy y comportamiento no cambian** (S32, `F4-ubicacion-*`); cambia la forma:

- `Pictogram paradasCercanas` de 40 pt (`tone="board"`) a la izquierda; a su derecha, el título 17/600 «Activá la ubicación para ver paradas cerca tuyo» y el texto 15 `text.secondary` «Solo se usa mientras la app está abierta y no sale de tu teléfono.». Con `blocked`, una línea más: «La ubicación está desactivada para Transportate.».
- Debajo, los botones de siempre: «Activar» (o «Abrir configuración» si el sistema ya no deja preguntar) y «Buscar a mano», que pasan a la línea de abajo si no entran.
- Prop **`inset`**: dentro de una placa de tablero (`Board`), sin fondo ni borde propios, solo el padding de una fila (12 pt). Sin `inset`, el bloque va en una `Card`.
- El título es el encabezado accesible del bloque (antes era «Ubicación»). Constantes: `PERMISO_TITLE`, `PERMISO_DETAIL`, `PERMISO_MESSAGE` (los dos unidos, como se leía antes) y `PERMISO_BLOCKED_MESSAGE`.

| Estado del permiso | Forma F5 |
| --- | --- |
| `undetermined` / `denied` | Pictograma, título, texto, «Activar» y «Buscar a mano» |
| `blocked` | Lo mismo + la línea de configuración desactivada y «Abrir configuración» en lugar de «Activar» |
| `granted` | El bloque no se muestra |
| Carga / vacío / error | No aplican: el bloque es presentacional; la pantalla que lo usa resuelve la carga de la posición (en Colectivos, skeleton dentro de la placa) |
| Dynamic Type al tope | El título llega a 3–4 líneas y los botones se apilan; el pictograma queda arriba a la izquierda y no se trunca nada |

**Contraste:** título `text.primary` / `bg.card` 16,69:1 (claro) y 13,53:1 (oscuro); texto `text.secondary` / `bg.card` 7,38:1 y 9,97:1; `Pictogram board` ícono / cuadrado 13,07:1 y 11,09:1, cuadrado / `bg.card` 13,07:1 y 9,94:1 (≥ 3:1). Cálculo con `ratio` de `tools/contraste/contraste.py`; detalle completo en el [README de Colectivos](../colectivos/README.md#contraste-toolscontrastecontrastepy-función-ratio).

**Suposiciones F5:**

1. **F5-ubicacion-1** — Un solo componente para dos contextos: `inset` quita el fondo y el borde en vez de duplicar el bloque. Quien lo meta en una placa pasa `inset`; sin él, es una `Card` con la misma forma.
2. **F5-ubicacion-2** — El título pasa a ser un encabezado largo en lugar del «Ubicación» de antes: el lector ya anuncia de qué trata el bloque. `PERMISO_MESSAGE` se conserva con el texto unido para quien lo cite.
3. **F5-ubicacion-3** — El pictograma es decorativo (no es un elemento accesible aparte): la información la llevan el título y el texto.

## Brief operativo (tarea 4.1, Fase 4)

**Qué hay:** un hook (`useUbicacion`), un hook solo de permiso (`usePermisoUbicacion`), dos funciones puras (`isInsideCaba`, `distanceMeters`) y un bloque de pantalla (`PermisoUbicacionBloque`). No tiene pantalla propia.

| Estado del permiso                                                         | `permission`                  | Qué se ve (bloque / fila de Ajustes)                                                                                                                                                                 |
| -------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nunca se preguntó                                                          | `undetermined`                | Bloque: "Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono." + "Activar" y "Buscar a mano". Ajustes: "Todavía no la pediste"        |
| Permitido                                                                  | `granted`                     | El bloque no se muestra. Ajustes: "Permitida mientras usás la app"                                                                                                                                   |
| Negado, se puede volver a preguntar (Android)                              | `denied`                      | Igual que `undetermined`: "Activar" vuelve a mostrar el diálogo. Ajustes: "No permitida" + "Podés buscar paradas a mano"                                                                             |
| Negado para siempre (iOS tras un "No permitir", o "No volver a preguntar") | `blocked`                     | Bloque: el mismo texto + "La ubicación está desactivada para Transportate." y botones "Abrir configuración" y "Buscar a mano". Ajustes: "No permitida"                                               |
| Sin posición todavía (permitido)                                           | `granted`, `position: null`   | La pantalla que consume decide (indicador propio). El hook no inventa una posición. Si la lectura falló, `positionUnavailable: true` (Colectivos deja de mostrar "buscando…" y ofrece buscar a mano) |
| Fuera de CABA                                                              | `isInsideCaba(...) === false` | Lo muestra la pantalla de Colectivos: "No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires."                                                                                  |

**Reglas:** `request()` solo se llama desde una acción de la persona (S32); montar el hook nunca abre el diálogo del sistema. Al volver de la configuración del teléfono el permiso se vuelve a leer solo.

**Suposiciones nuevas:**

| #              | Suposición                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4-ubicacion-1 | `blocked` = `status === 'denied'` y `canAskAgain === false`. `denied` = negado pero todavía se puede preguntar. Es la única forma de distinguirlos con `expo-location`.                                                                                                                                                                                                                                       |
| F4-ubicacion-2 | `isInsideCaba` usa un rectángulo (no el polígono de la Ciudad): lat −34,71 a −34,52 y lon −58,54 a −58,33. Es el bbox con el que se relevó la Ciudad en `docs/01b-gtfs-alternativos.md` (consulta Overpass). Incluye un pedazo del Gran Buenos Aires pegado a la General Paz y el Riachuelo, a propósito: es mejor mostrar paradas cercanas de más que decirle "fuera de CABA" a alguien parado en el límite. |
| F4-ubicacion-3 | Precisión `Accuracy.Balanced` y el `watch` pide una actualización cada 10 s o 25 m, lo que ocurra primero. Alcanza para "paradas cerca tuyo" y gasta poca batería.                                                                                                                                                                                                                                            |
| F4-ubicacion-4 | El `watch` se detiene al desmontar y cuando la app pasa a segundo plano, y arranca de nuevo al volver. La última posición se queda en memoria hasta que llega la nueva. Si se pierde el permiso, `position` pasa a `null`.                                                                                                                                                                                    |
| F4-ubicacion-5 | Si la posición no se puede obtener (GPS apagado, timeout) el hook deja `position: null` y no tira: la pantalla ofrece la búsqueda a mano.                                                                                                                                                                                                                                                                     |
| F4-ubicacion-6 | En Ajustes, tocar la fila con el permiso sin preguntar (`undetermined`) o negado pero preguntable (`denied`) **pide el permiso directamente** (es una acción explícita de la persona, no "al abrir la app"). Con `granted` o `blocked` abre la configuración del teléfono.                                                                                                                                    |

## Archivos

| Archivo                      | Qué hay                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `geo.ts`                     | `CABA_BBOX`, `isInsideCaba(lat, lon)` y `distanceMeters(a, b)` (haversine)                                               |
| `useUbicacion.ts`            | `usePermisoUbicacion()` (permiso + `checked`) y `useUbicacion()` (permiso + posición en memoria + `positionUnavailable`) |
| `PermisoUbicacionBloque.tsx` | Bloque con pictograma, título, texto, "Activar" / "Abrir configuración" y "Buscar a mano" (`inset` dentro de una placa)       |
| `index.ts`                   | Exports públicos                                                                                                         |

## Uso

```tsx
const { permission, checked, position, positionUnavailable, request, openSettings } =
  useUbicacion();
// Antes de leer el permiso real, `permission` es `undetermined` por default: esperá a `checked`
// para no mostrar el bloque de permiso de más.
if (checked && permission !== 'granted') {
  return (
    <PermisoUbicacionBloque
      permission={permission}
      onRequest={request}
      onOpenSettings={openSettings}
      onManual={() => setModo('buscar')}
      // inset // dentro de una placa de tablero (Board), sin fondo propio
    />
  );
}
// Con permiso: `position === null && !positionUnavailable` → "buscando…"; `positionUnavailable` → buscar a mano.
```

| Campo                 | Qué es                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checked`             | Ya se leyó el permiso real al menos una vez (desde `usePermisoUbicacion`, que también usa `useUbicacion`)                                                        |
| `positionUnavailable` | Con permiso, la última lectura falló y no hay posición (servicios apagados, sin señal): deja de mostrarse "buscando…" y se ofrece buscar a mano (F4-ubicacion-5) |

`useUbicacion({ watch: false })` lee el permiso y la posición una sola vez, sin suscripción (para pantallas que solo necesitan "dónde estoy ahora", como Colectivos). El `watch` queda para el mapa. Ajustes usa solo `usePermisoUbicacion()`, que no lee la posición. Los tests cambian el estado con `locationMock` (`test/mocks/expo-location.ts`).
