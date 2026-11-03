# features/ubicacion

Ubicación compartida (Fase 4, tarea 4.7 y fila de Ajustes). La usan Colectivos ("Paradas cercanas"), el mapa ("centrar en mí") y Ajustes. **La ubicación nunca sale del teléfono**: no se guarda en MMKV ni en la caché de consultas y no se manda al proxy ([`docs/05-privacidad.md`](../../../../../docs/05-privacidad.md) §3).

## Brief operativo (tarea 4.1)

**Qué hay:** un hook (`useUbicacion`), un hook solo de permiso (`usePermisoUbicacion`), dos funciones puras (`isInsideCaba`, `distanceMeters`) y un bloque de pantalla (`PermisoUbicacionBloque`). No tiene pantalla propia.

| Estado del permiso                                                         | `permission`                  | Qué se ve (bloque / fila de Ajustes)                                                                                                                                                          |
| -------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nunca se preguntó                                                          | `undetermined`                | Bloque: "Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono." + "Activar" y "Buscar a mano". Ajustes: "Todavía no la pediste" |
| Permitido                                                                  | `granted`                     | El bloque no se muestra. Ajustes: "Permitida mientras usás la app"                                                                                                                            |
| Negado, se puede volver a preguntar (Android)                              | `denied`                      | Igual que `undetermined`: "Activar" vuelve a mostrar el diálogo. Ajustes: "No permitida" + "Podés buscar paradas a mano"                                                                      |
| Negado para siempre (iOS tras un "No permitir", o "No volver a preguntar") | `blocked`                     | Bloque: el mismo texto + "La ubicación está desactivada para Transportate." y botones "Abrir configuración" y "Buscar a mano". Ajustes: "No permitida"                                        |
| Sin posición todavía (permitido)                                           | `granted`, `position: null`   | La pantalla que consume decide (indicador propio). El hook no inventa una posición                                                                                                            |
| Fuera de CABA                                                              | `isInsideCaba(...) === false` | Lo muestra la pantalla de Colectivos: "No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires."                                                                           |

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

| Archivo                      | Qué hay                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `geo.ts`                     | `CABA_BBOX`, `isInsideCaba(lat, lon)` y `distanceMeters(a, b)` (haversine)                |
| `useUbicacion.ts`            | `usePermisoUbicacion()` (solo permiso) y `useUbicacion()` (permiso + posición en memoria) |
| `PermisoUbicacionBloque.tsx` | Bloque con el texto, "Activar" / "Abrir configuración" y "Buscar a mano"                  |
| `index.ts`                   | Exports públicos                                                                          |

## Uso

```tsx
const { permission, canAskAgain, position, request, openSettings } = useUbicacion();
if (permission !== 'granted') {
  return (
    <PermisoUbicacionBloque
      permission={permission}
      onRequest={request}
      onOpenSettings={openSettings}
      onManual={() => setModo('buscar')}
    />
  );
}
```

`useUbicacion({ watch: false })` lee el permiso y la posición una sola vez, sin suscripción. Los tests cambian el estado con `locationMock` (`test/mocks/expo-location.ts`).
