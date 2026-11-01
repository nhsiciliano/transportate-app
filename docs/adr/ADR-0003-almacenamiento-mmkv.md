# ADR-0003 — Almacenamiento local con MMKV (en vez de expo-sqlite)

- **Estado:** Aceptada (2026-11-01)
- **Fase:** 1 (se implementa en Fase 3, tareas 3.9 y 3.10)
- **Origen:** `docs/00-plan.md`, decisión de arquitectura 3

## Contexto

La app guarda localmente: **favoritos** (pocas decenas de registros, con alias y orden), **ajustes** (tema, intervalo de refresco), el **índice estático** descargado (paradas, rutas, estaciones; ver ADR-0005 y `03-arquitectura.md`) y la **caché de TanStack Query** para el modo offline. No hay cuentas ni sincronización. Los favoritos se leen **de forma síncrona al arrancar** para pintar la primera pantalla sin parpadeos.

## Decisión

Usar **`react-native-mmkv` v4** (sobre Nitro Modules, API `createMMKV()`), siempre **detrás de una interfaz `FavoritosRepository`** (y equivalentes para ajustes). MMKV también actúa como *storage* del persister de TanStack Query (`@tanstack/query-async-storage-persister`, adaptando la API síncrona a la asíncrona que espera).

El índice estático grande (búsqueda de paradas en CABA) no es un caso de uso de pares clave-valor pequeños: se decide su formato en Fase 3/4 (ver Consecuencias).

## Alternativas consideradas

| Alternativa | Ventajas | Por qué no |
|---|---|---|
| **expo-sqlite** | Consultas relacionales, índices, transacciones | Sobreingeniería para decenas de registros; lectura asíncrona al arrancar; más código de esquema y migraciones. |
| **AsyncStorage** | Simple, ya usado en ejemplos de TanStack | Asíncrono y más lento; sin lectura síncrona al inicio. |
| **Archivos JSON (expo-file-system)** | Sin dependencias nativas extra | Hay que manejar atomicidad y lectura a mano. |
| **WatermelonDB / Realm** | Bases de datos reactivas completas | Mucho peso para los datos que hay. |

## Consecuencias

- (+) Lectura/escritura síncrona, arranque sin parpadeos, API mínima.
- (+) Un solo almacén para favoritos, ajustes y caché de queries.
- (+) La interfaz `FavoritosRepository` permite **migrar a SQLite sin tocar la UI** si aparece historial o consultas relacionales.
- (−) Dependencia nativa (Nitro Modules): obliga a dev client y New Architecture, igual que MapLibre (ADR-0002). Versión mínima de RN a respetar: ver `versiones.md`.
- (−) El contenido de MMKV está en claro en el sandbox de la app (el cifrado es opcional con `encryptionKey`); no se guardan secretos ni datos personales, así que no hace falta. Se documenta en `05-privacidad.md`.
- (−) Hay que versionar el esquema guardado (migraciones explícitas, tarea 3.10) porque no hay motor que lo haga.
- (−) El índice estático (decenas de miles de paradas) puede ser demasiado grande para una sola clave de MMKV: evaluar en Fase 3/4 un archivo en `expo-file-system` con el JSON versionado, manteniendo MMKV para metadatos (hash/versión).
