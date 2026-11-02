# shared/query — TanStack Query en React Native (tarea 3.9)

`QueryClient`, providers y estado de red y de foco de la app. Los hooks por recurso están en [`../api`](../api/README.md).

## Montaje

`src/app/_layout.tsx` monta los providers en este orden:

```
SafeAreaProvider → ThemeProvider → QueryProvider → RefreshIntervalProvider → FavoritosProvider → Stack
```

- **`QueryProvider`:** monta `PersistQueryClientProvider` con el persister de `shared/storage/queryPersister.ts` (MMKV, clave `transportate.query-cache.v1`, una escritura por segundo como mucho).
  - `maxAge`: 24 h, igual que `gcTime`; si fuera mayor, restauraría consultas ya recolectadas.
  - `buster`: `'v1'`, la versión del contrato. Si cambia el esquema, la caché vieja se descarta entera.
  - Solo se persisten las consultas exitosas.
  - Al montarse llama a `connectQueryManagers()`.
- **`RefreshIntervalProvider`:** intervalo de refresco de S17 (15, 20, 30 o 60 s; default 20 s).
  - Usa un `RefreshIntervalStore { get, set, subscribe? }` inyectable, igual que la preferencia de tema. En la app, `_layout.tsx` le pasa `createRefreshIntervalStore(getDefaultKeyValueStore())` (`shared/storage/preferences.ts`, MMKV); Ajustes escribe en la misma clave y el provider se entera por `subscribe`. Sin store, usa uno en memoria (tests).
  - `useRefreshInterval()` devuelve `{ seconds, setSeconds }`.

## React Native

`connectQueryManagers()` sigue la doc de TanStack para React Native:

- **`focusManager` ← `AppState`:** `active` es enfocada; `background` e `inactive`, sin foco.
- **`onlineManager` ← NetInfo:** `isConnected: false` es sin conexión. `null` (todavía no se sabe) cuenta como conectado, para no mostrar el banner de más.

En web quedan los listeners por defecto de TanStack.

`useIsOnline()` lee el `onlineManager` y alimenta el `OfflineBanner`. Así el banner y las consultas en pausa nunca se contradicen.

## Política de consultas

| Qué                                                            | Valor                                                                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `staleTime`                                                    | `meta.ttlSeconds × 1000` del último dato (20 s mientras no hay dato; manifiesto 300 s)              |
| `gcTime`                                                       | 24 h (para que el persister sirva offline)                                                          |
| `refetchInterval` (tiempo real)                                | Intervalo elegido ± 10 % de jitter, recalculado en cada ciclo (`withJitter`)                        |
| `refetchInterval` (estáticos: líneas de colectivo, manifiesto) | Sin polling (_suposición_: su TTL es de 24 h y 5 min; se revalidan al volver a la app si vencieron) |
| `refetchIntervalInBackground`                                  | `false`: en segundo plano no hay polling                                                            |
| `refetchOnWindowFocus` / `refetchOnReconnect`                  | `true`: al volver a primer plano o a tener conexión, se refresca lo vencido                         |
| `retry`                                                        | Solo si `error.retryable`, como mucho 3 veces (`shouldRetry`)                                       |
| `retryDelay`                                                   | 1 s, 2 s, 4 s… con tope de 30 s, y nunca menos que `retryAfterSeconds` (`retryDelay`)               |
| Sin conexión                                                   | Las consultas quedan en pausa (`isPaused`), no fallan, y la pantalla muestra lo persistido          |

**Último dato bueno:** si una actualización falla y ya había datos, TanStack Query v5 conserva `data` y pone `error`; el hook lo expone como `isRefreshError`. La pantalla muestra la Alert en línea ("No pudimos actualizar. Mostramos lo último que sabemos.") y la FreshnessLabel, y no el ErrorState (`docs/briefs/README.md`). No se usa `placeholderData: keepPreviousData`, porque al cambiar de estación o de línea mostraría datos de la anterior.

**Tipos:** `register.ts` declara `ApiError` como `defaultError` de TanStack Query, así que `query.error` siempre es un `ApiError`.

## Tests

- `src/shared/query/__tests__/queryClient.test.tsx`: reintentos, backoff, jitter, AppState, NetInfo, `useIsOnline` y el intervalo.
- `test/api/hooks.test.tsx`: polling solo en primer plano con un AppState simulado, reintentos y último dato bueno.
- `test/api/persistencia.test.tsx`: guarda la caché y la restaura sin red.
