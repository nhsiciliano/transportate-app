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

Esto está pensado para los archivos chicos de subte (`subte-lineas.json` 5 KB, `subte-estaciones.json` 17 KB). Los de colectivos (`indice-colectivos.json` 234 KB, `paradas.json` 1,7 MB) no deberían pasar por la caché de TanStack Query, que se serializa entera en cada escritura del persister. Para extenderlo:

- `LastKnownStore` es una interfaz: se puede implementar sobre `expo-file-system` y guardar ahí el archivo grande.
- El hook puede recibir opciones (por ejemplo, no guardar el dato en la caché de queries y leerlo del store) sin cambiar su resultado (`StaticQuery<T>`).

## Tests

`test/subtes/static.test.tsx`: versión resuelta con el manifiesto, query key con versión, última conocida de la misma versión (no vuelve a bajar), manifiesto caído con y sin copia, versión nueva con placeholder y copia rota.
