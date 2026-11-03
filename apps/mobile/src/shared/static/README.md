# shared/static — paquete estático en la app (tarea 4.2)

El proxy sirve el paquete estático versionado que genera `tools/gtfs` (`docs/06-proxy.md` §7):

- `/v1/static/manifest` (`ManifestV1`, TTL 300 s + ETag; hook `useManifest()` de `shared/api`);
- `/v1/static/:version/:archivo` (`client.staticFile(version, archivo)`, validado con `ARCHIVOS_ESTATICOS_V1`, inmutable).

```tsx
import { useStaticArchivo } from '@/shared/static';

const lineas = useStaticArchivo('subte-lineas.json');
if (lineas.isPending) return <Skeleton… />;
if (lineas.isLoadingError) return <ErrorState {...lineas.error?.userMessage()} />;
lineas.data.lineas; // SubteLineasArchivoV1
```

## Cómo se resuelve la versión

1. `useManifest()` trae el manifiesto. `archivos[archivo].url` es `<version>/<archivo>`: de ahí sale la versión (`versionFromManifest`).
2. El archivo se pide con la query key `['static', 'archivo', <archivo>, <version>]`, `staleTime: Infinity` (una versión no cambia nunca) y `gcTime` de 24 h (igual que el `maxAge` del persister MMKV, que lo guarda con el resto de la caché).
3. **Última versión conocida** (`lastKnown.ts`): cada descarga se guarda además en MMKV, en `transportate.static.<archivo>.v1` (`{ version, savedAt, data }`).
   - Al montar, el hook la lee (una vez por store, memoizada) y la muestra al instante, sin esperar al manifiesto.
   - Si el manifiesto confirma la misma versión, el archivo no se vuelve a pedir (`initialData`).
   - Si trae otra versión, la vieja se muestra como `placeholderData` mientras baja la nueva.
   - Si el manifiesto falla o no hay red, la pantalla sigue con la última conocida (`fromLastKnown: true`). Así funciona offline aunque la caché persistida haya vencido (el persister descarta todo si la app no se abrió en 24 h).
   - Una copia rota o fuera de contrato se ignora y se vuelve a bajar.
4. Sin manifiesto ni copia guardada: `isLoadingError` con el `ApiError` (`retryable`); `refetch()` reintenta el manifiesto, y con él llega el archivo.

| Campo                      | Qué es                                                  |
| -------------------------- | ------------------------------------------------------- |
| `data`                     | El archivo validado (o la última versión conocida)      |
| `version`                  | Versión del dato que se muestra                         |
| `isPending`                | Sin dato todavía: Skeleton                              |
| `isLoadingError` / `error` | Sin dato y falló el manifiesto o el archivo             |
| `fromLastKnown`            | El dato no es (todavía) el de la versión del manifiesto |
| `refetch()`                | Reintenta el manifiesto o el archivo                    |

## Archivos grandes (tarea 4.5)

`paradas.json` (1,7 MB), `lineas-colectivos.json` (161 KB) y los `.geojson` de `GEOJSON_ESTATICOS_V1` (`recorridos-colectivos.geojson`, 742 KB; `subte-red.geojson`) **no** pasan por la caché de TanStack Query: su persister guarda toda la caché en una sola clave MMKV y la reescribe entera en cada cambio. Con 2 MB adentro, cada refresco del estado del subte reescribiría 2 MB.

```tsx
const paradas = useStaticArchivoGrande('paradas.json');
if (paradas.isPending) return <Progreso progress={paradas.progress} />; // 0 a 1, o null
paradas.data?.paradas; // ParadasArchivoV1
```

- **`LargeFileManager`** (`largeFiles.ts`), uno por app:
  - Guarda el estado de cada archivo: dato, versión, progreso y error. Las pantallas lo leen con `useSyncExternalStore`.
  - El JSON se parsea una sola vez por sesión, y todas las pantallas comparten el mismo dato y el mismo progreso.
- **MMKV por archivo, una versión:**
  - `transportate.static.file.<archivo>.data` guarda el cuerpo tal cual llegó; `.meta` guarda `{ version, savedAt, bytes }`.
  - La meta se escribe última: si la app se corta en el medio, la copia queda inválida y se vuelve a bajar.
  - Una versión nueva pisa a la anterior, así que no se acumulan versiones.
- **Por qué MMKV y no `expo-file-system`:**
  - MMKV maneja bien valores de un par de MB.
  - `expo-file-system` no está en el dev client actual: sumarlo obliga a reconstruirlo.
  - Medido en Node: `JSON.parse` de `paradas.json` tarda unos 6 ms, y validarlo con Zod unos 15 ms más (en Hermes es varias veces más lento).
- **Validación:** con Zod solo al descargar. Al leer de MMKV solo se chequea que sea JSON con `version: 1`; una copia rota se borra y se vuelve a bajar.
- **Descarga con progreso** (`downloader.ts`):
  - Usa `XMLHttpRequest`, porque el `fetch` de React Native no expone el cuerpo como stream.
  - El avance sale de `loaded / total`. Si el servidor no informa el total (Cloudflare comprime), se usan los `bytes` del manifiesto. Queda topeado en 99 % hasta validar.
  - Timeout de 60 s y el mismo criterio de privacidad que el cliente: solo `Accept`, y errores con la ruta plantilla.
- **Versión nueva:** se baja en segundo plano y la vieja se sigue mostrando hasta que termina (`fromLastKnown: true`). Sin manifiesto (offline), se usa la copia guardada.
- **Errores:** una versión cuya descarga falló no se reintenta sola en cada render; `refetch()` la reintenta.
- **`.geojson`:** `useStaticArchivoGrande('recorridos-colectivos.geojson')` devuelve el `FeatureCollection` validado con su esquema de `GEOJSON_ESTATICOS_V1`. El almacenamiento es el mismo (un par de claves por archivo y una versión), y al leer de MMKV solo se chequea `type: 'FeatureCollection'`. Tipos: `ArchivoGrande = ArchivoEstatico | ArchivoGeoJson` y `ArchivoGrandeData<K>`.
- **`useStaticDownloadProgress(archivos)`:** avance combinado, para la fila del índice en Ajustes.
- **Tests:** `StaticStoreProvider` acepta `largeFiles` (un `LargeFileManager` con un descargador falso). Sin provider se usan MMKV y XHR.

## Tests

- `test/colectivos/largeFiles.test.tsx`: descarga con progreso, persistencia por archivo, relectura sin descargar, versión nueva, errores y copia rota.

`test/subtes/static.test.tsx`: versión resuelta con el manifiesto, query key con versión, última conocida de la misma versión (no vuelve a bajar), manifiesto caído con y sin copia, versión nueva con placeholder y copia rota.
