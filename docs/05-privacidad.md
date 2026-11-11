# 05 — Privacidad

Qué hace (y qué no hace) Transportate con los datos de las personas. Es un compromiso de producto (`PRODUCT.md`, Positioning) y una restricción de arquitectura: cada decisión técnica de este documento se puede verificar leyendo el código.

> **Estado:** diseño de la Fase 1. Los puntos marcados **(decisión pendiente)** se resuelven en la fase indicada y se anotan en la bitácora. Este documento no es asesoramiento legal; antes de publicar en las tiendas hay que revisar los formularios de privacidad de Apple (App Privacy) y Google (Data safety) contra lo que la app realmente hace.

## 1. Principios

1. **Sin cuentas.** No hay registro, login, perfil ni identificadores de usuario.
2. **Sin analytics.** Ningún SDK de analítica, atribución, publicidad ni *crash reporting* con identificadores en el MVP.
3. **Sin tracking.** No se cruzan datos entre sesiones ni dispositivos; no hay IDFA/GAID ni *fingerprinting*.
4. **Mínimo necesario.** Lo que no hace falta para mostrar el transporte no se pide ni se guarda.
5. **Local primero.** Favoritos, ajustes y caché viven en el teléfono y se borran al desinstalar o desde Ajustes.
6. **Verificable.** Lo que se promete acá debe poder comprobarse en el repo (dependencias, `wrangler.toml`, código del Worker).

## 2. Qué se guarda en el teléfono

Todo se guarda localmente con MMKV (ADR-0003), dentro del sandbox de la app. Nada de esto se envía a un servidor propio.

| Dato | Para qué | Contiene datos personales | Cómo se borra |
|---|---|---|---|
| **Favoritos** (líneas, paradas, estaciones; alias que elige la persona; orden) | Acceso rápido | El alias lo escribe la persona y podría ser personal ("Casa", "Trabajo"); **no se envía a ningún lado** | Ajustes → "Borrar favoritos" (con deshacer), o desinstalar |
| **Caché de consultas** (último dato bueno de colectivos, subtes, tránsito) | Modo offline y arranque rápido | No | Se vacía por antigüedad; Ajustes → limpiar caché |
| **Índice estático** (paradas, estaciones, rutas, colores de línea) | Búsqueda y paradas cercanas sin red | No: es información pública | Se reemplaza al actualizar la versión |
| **Ajustes** (tema, intervalo de actualización) | Preferencias | No | Ajustes, o desinstalar |

Notas:

- MMKV guarda en claro dentro del sandbox del sistema (el cifrado `encryptionKey` es opcional). No guardamos secretos ni datos sensibles, así que no se cifra; si algún día se guardara algo sensible, se revisa.
- Las copias de seguridad automáticas del sistema (iCloud, Google Backup) pueden incluir estos datos si el sistema las tiene activadas. **(Decisión pendiente, Fase 5):** evaluar excluirlos si la persona prefiere que no salgan del teléfono.

## 3. Qué nunca sale del teléfono

- **La ubicación.** Se pide con permiso *"mientras se usa"* (`expo-location`), solo para encontrar paradas cercanas, y se mantiene **solo en memoria**: no se escribe en MMKV, no se loguea, no viaja en ninguna request a nuestro proxy. Las paradas cercanas se calculan **localmente** contra el índice estático. Si no hay permiso, hay búsqueda manual.
  - **Permiso declarado (tarea 4.0, `apps/mobile/app.config.ts`):**
    - iOS: solo `NSLocationWhenInUseUsageDescription`, con el texto "Transportate usa tu ubicación solo mientras la app está abierta, para mostrarte paradas cercanas. No sale de tu teléfono.". Las claves de "siempre" y de movimiento se borran del `Info.plist`, y no se declara el modo de ubicación en segundo plano.
    - Android: `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION`, sin `ACCESS_BACKGROUND_LOCATION` ni servicio en primer plano.
    - Verificado con `expo prebuild` el 2026-11-03.
  - **Cuándo se pide:** en contexto, al tocar "Paradas cercanas" o "centrar en mí" (S32), nunca al abrir la app. Sin permiso, la app sigue andando.
  - **El mapa no cambia nada de esto.** La posición que dibuja el mapa se procesa en el teléfono y no forma parte de las requests de tiles. Lo único que OpenFreeMap puede inferir es la zona que se está mirando, como con cualquier mapa (sección 4).
- Los **favoritos y alias**.
- Cualquier identificador del dispositivo.

Para pedir datos de una línea, la app envía solo el identificador público de la línea o estación (por ejemplo `/v1/colectivos/lineas/60`). El proxy no recibe posición, ni historial, ni cuántos favoritos hay.

## 4. Terceros

| Tercero | Qué ve | Mitigación |
|---|---|---|
| **Cloudflare** (infraestructura del proxy) | Como proveedor de red, procesa las conexiones, incluida la IP, según su propia política. Nuestro código no la lee ni la guarda | Configuración mínima de observabilidad (sección 6); revisar su política al publicar |
| **OpenFreeMap** (tiles del mapa, mientras se use; ADR-0002) | El teléfono pide el estilo, los tiles, las fuentes y los íconos del mapa **directo** a `tiles.openfreemap.org`, sin pasar por nuestro proxy. El servicio ve la IP y, por los tiles que se piden, la zona que se mira. No recibe la ubicación de la persona (la posición no viaja en esas requests), cookies ni identificadores: MapLibre no tiene telemetría y la app no agrega headers | Declararlo en "Acerca de" (4.10). **(Decisión pendiente, Fase 5):** migrar a tiles propios (PMTiles en R2, servidos por nuestro proxy) para sacarlo del camino |
| **API Transporte del GCBA** (upstream) | Ve solo las requests del proxy con nuestras credenciales; nunca al teléfono | La app no habla con el upstream |
| **Tiendas (App Store / Google Play)** | Datos de instalación según sus reglas | Fuera de nuestro control |
| **Fuentes tipográficas** | Nada: Fira Sans se empaqueta en la app (no se descargan en ejecución) | — |
| **Actualizaciones OTA (EAS Update)** | Si se usaran, las consultas llegan a servidores de Expo | **(Decisión pendiente, Fase 5):** no usar OTA o declararlo |

## 5. Rate limiting sin persistir IPs

Objetivo: frenar abusos sin construir un registro de quién usa la app.

- Se usa el **binding nativo de Workers Rate Limiting** (`ratelimits` en `wrangler`, `period` de 10 o 60 s). Según la documentación de Cloudflare los contadores son **locales a cada ubicación** y se mantienen en memoria; el servicio es "permisivo y eventualmente consistente": frena ráfagas, no es un sistema de contabilidad exacta.
- **No se usa Durable Object, KV ni D1 para llevar cuenta por IP.** Nuestro código no escribe IPs en ningún almacenamiento.
- **(Decisión de diseño para Fase 2):** la clave que se pasa al binding no tiene por qué ser la IP cruda. Se puede usar `HMAC(secret, IP + fecha UTC)` truncado: sirve para contar dentro del día y no es reversible ni correlacionable entre días.
- Respuesta al exceso: `429` con `Retry-After`, sin cuerpo que repita datos del request.

## 6. Qué loguea el Worker y qué no

| Se hace | No se hace |
|---|---|
| **Desactivar los registros de invocación** (`observability.logs.invocation_logs = false`, parámetro documentado de Workers Logs), para no depender de qué campos del request incluya Cloudflare | Loguear IP, `User-Agent`, `Referer`, cabeceras, *query string* ni cuerpos de request |
| **Sampling bajo** (`head_sampling_rate`) para observabilidad general | Guardar historiales por usuario o por dispositivo |
| Contadores **agregados y anónimos** de salud: hits/misses de caché, latencias, errores del upstream, status de cada fuente | Identificadores de sesión, cookies, *fingerprints* |
| Errores del upstream con **fuente y código** (sin parámetros de request) | Los secretos: `client_id`/`client_secret` viven en `wrangler secret`, nunca en logs, respuestas ni repo |
| Cabeceras `Cache-Control` y `Vary` mínimas | Cookies o `Set-Cookie` |

Reglas para quien escriba el Worker en Fase 2:

- Antes de cada `console.log`, preguntarse si podría contener algo atribuible a una persona. Si hay duda, no se loguea.
- Los mensajes de error que se devuelven a la app **no incluyen** la URL del upstream (que lleva las credenciales en la *query*).
- Los fixtures de prueba no incluyen credenciales ni URLs con `client_id`/`client_secret`.
- Cualquier cambio de observabilidad se revisa contra este documento.

## 7. Texto base para la pantalla "Acerca de"

> Borrador en español rioplatense, a refinar con Impeccable `clarify` en Fase 4 (tarea 4.10). **(Suposición):** el nombre del desarrollador/a y los datos de contacto los completa el responsable del proyecto; no se inventan acá.

---

**Transportate**
Colectivos, subte y tránsito de la Ciudad de Buenos Aires, en tiempo real.

**Tu privacidad**
- No necesitás crear una cuenta.
- No usamos analíticas ni publicidad, y no te rastreamos.
- Tus favoritos, ajustes y datos guardados quedan en tu teléfono.
- Tu ubicación solo se usa mientras la app está abierta, para buscar paradas cerca tuyo, y nunca sale de tu teléfono.
- El mapa se descarga de un servicio externo (OpenFreeMap). Ese servicio puede ver tu dirección IP y la zona que mirás. *(Texto a ajustar cuando se autoalojen los tiles.)*

**De dónde salen los datos**
Los datos de transporte provienen de los datos abiertos del Gobierno de la Ciudad de Buenos Aires ([data.buenosaires.gob.ar](https://data.buenosaires.gob.ar)), publicados bajo licencia [Creative Commons Atribución 2.5 Argentina (CC BY 2.5 AR)](https://creativecommons.org/licenses/by/2.5/ar/). Transportate los procesa para mostrarlos; no los modifica con fines distintos.

Transportate es una aplicación independiente. **(Suposición a confirmar por el responsable del proyecto:)** no está desarrollada ni respaldada por el Gobierno de la Ciudad de Buenos Aires.

Los datos pueden tardar en actualizarse o fallar: siempre te mostramos hace cuánto se actualizaron. No los uses como única fuente para decisiones críticas.

Mapa: © contribuidores de OpenStreetMap · OpenMapTiles · OpenFreeMap. *(Texto exacto de atribución a confirmar con la documentación de cada proyecto en Fase 4.)*

Versión de la app: `x.y.z` · Versión del contrato de datos: `v1`

---

### Requisitos de atribución a verificar en Fase 4

- **CC BY 2.5 AR** exige atribución (autoría, fuente y licencia con enlace) y permite uso comercial y obras derivadas. Confirmar en la ficha de cada dataset del portal que la licencia sea esa; el portal tiene datasets con licencias distintas.
- Confirmar si la API Transporte tiene términos de uso adicionales a la licencia del dataset (revisar la consola oficial, tarea 1.2 / `01a-api-console.md`).
- La atribución debe ser visible sin salir de la app y enlazada desde Ajustes.

## 8. Lista de verificación antes de publicar

Revisada contra el repo el 2026-11-10 (Fase 7). Lo tildado se verifica leyendo `apps/mobile/package.json`, `apps/mobile/app.config.ts`, `apps/proxy/wrangler.jsonc` y el código de `apps/mobile/src`.

- [x] La app no incluye SDKs de analytics, ads ni crash reporting con identificadores. *(2026-11-10: ninguna dependencia de `apps/mobile/package.json` lo es; tampoco `expo-updates`.)*
- [x] La app no pide permisos más allá de ubicación "mientras se usa", con texto en voseo en `Info.plist`/manifest. *(2026-11-10: `app.config.ts` declara solo `NSLocationWhenInUseUsageDescription` con `LOCATION_WHEN_IN_USE_PERMISSION`; las claves de "siempre" y de movimiento están en `false`.)*
- [x] La ubicación no se persiste ni se envía: revisión de código. *(2026-11-10: `useUbicacion.ts` y `useLocationGranted.ts` no tocan MMKV, `fetch` ni `console`.)*
- [ ] La ubicación no se persiste ni se envía: revisión del tráfico de red de un build real. *Se cierra en la Fase 7, con la prueba en TestFlight (`12-publicacion.md` §4).*
- [x] El Worker no loguea campos del request; `invocation_logs = false` en `wrangler`. *(2026-11-10: `observability.logs.invocation_logs = false` en la raíz de `wrangler.jsonc`, desplegado en `production`. Falta ver en el dashboard que sigue apagado.)*
- [x] El tráfico de red de la app solo va a nuestro proxy y al proveedor de tiles declarado. *(2026-11-10: los únicos hosts del código de la app son `EXPO_PUBLIC_API_URL` y `tiles.openfreemap.org`; los enlaces de Acerca de abren el navegador del sistema.)*
- [x] "Acerca de" incluye atribución a GCBA (CC BY 2.5 AR), OSM/OpenMapTiles/OpenFreeMap, trenes y esta política. *(2026-11-10: la placa «Información» enlaza «Política de privacidad» y «Soporte y contacto», publicadas en `https://transportate-site.nhsiciliano.workers.dev`; la versión pública de esta política vive en `site/src/pages/privacidad.astro`.)*
- [ ] Formulario de App Privacy de App Store completado de acuerdo con este documento. *Se cierra en la Fase 7 (tarea 7.4); la respuesta y su justificación están en la sección 9.*
- [ ] Formulario de Data safety de Google Play. *Fuera de alcance de la Fase 7 (solo iOS).*
- [ ] Decisiones pendientes de las secciones 2, 4 y 5 resueltas y anotadas en `bitacora.md`. *Se cierra en la Fase 7. Estado al 2026-11-10: EAS Update no se usa (no hay `expo-updates`); siguen abiertas la exclusión de los datos de las copias de seguridad del sistema y los tiles propios; la clave del rate limit es un SHA-256 de la IP truncado a 32 caracteres hex (`src/middleware/rate-limit.ts`), sin secret ni fecha: más simple que el HMAC diario propuesto en la sección 5.*

## 9. Ficha de App Privacy (App Store)

**Respuesta en App Store Connect:** *«No, no recopilamos datos de esta app»* (*Data Not Collected*). URL de la política: la página `/privacidad` del sitio ([`10-deploy.md`](10-deploy.md) §10).

**Definición de Apple.** «Recopilar» (*collect*) es enviar datos fuera del dispositivo de modo que el desarrollador o sus socios puedan consultarlos más allá de lo necesario para atender el pedido en el momento. Los datos que se procesan solo en el teléfono no cuentan. Justificación, punto por punto:

| # | Lo que podría contar como dato | Por qué no es «recopilar» | Dónde se verifica |
|---|---|---|---|
| 1 | **Ubicación** | No sale del teléfono. Se pide "mientras se usa", queda solo en memoria y las paradas cercanas se calculan contra el índice estático local. No viaja en pedidos al proxy ni en los de tiles | Sección 3; `app.config.ts`; `features/ubicacion/useUbicacion.ts` |
| 2 | **Favoritos, alias y ajustes** | Quedan en MMKV, dentro del sandbox de la app. No se envían a ningún servidor | Sección 2 |
| 3 | **Caché de consultas y estático** | Información pública guardada localmente. No contiene datos de la persona | Sección 2 |
| 4 | **Cuentas e identificadores** | No hay cuentas, login, perfil, IDFA ni identificadores propios | `package.json`; sección 1 |
| 5 | **Analytics, publicidad, crash reporting** | Ningún SDK de estos tipos. Los cuelgues y comentarios de TestFlight los recibe Apple por la cuenta de cada tester, no la app | `package.json` |
| 6 | **IP en el proxy** | El Worker la usa solo para responder y limitar el ritmo: contadores del binding nativo en memoria de cada ubicación, con un hash truncado de la IP, sin persistirla. No guarda ni consulta historiales. `invocation_logs = false` y el código no loguea requests | Secciones 5 y 6; `wrangler.jsonc`; `src/middleware/rate-limit.ts` |
| 7 | **Tiles del mapa (OpenFreeMap)** | El teléfono los pide directo a `tiles.openfreemap.org`. Ese servicio ve la IP y la zona que se mira, no la ubicación, cookies ni identificadores; MapLibre no tiene telemetría. No lo consultamos nosotros ni ningún socio nuestro | Sección 4 |
| 8 | **Fuentes de datos (GCBA y la API comunitaria de trenes)** | Ven solo los pedidos del proxy con sus credenciales o sin ellas; nunca al teléfono | Sección 4 |

Este documento no es asesoramiento legal. Si el cuestionario de Apple te lleva a una pregunta que no se cubre acá (por ejemplo, por los tiles de un tercero), no contestes por intuición: anotala y revisá esta tabla.

**Qué revisar si algún día se agrega algo que sí recopile.** Antes de publicar el build que lo trae:

1. Cambiar la respuesta en App Privacy (tipos de datos, finalidad, si se vinculan a la persona, si se usan para rastrear) y, si hace falta, la declaración de privacidad del paquete (`ios.privacyManifests`).
2. Actualizar la página `/privacidad` del sitio, el texto de "Acerca de" (sección 7) y este documento.
3. Casos que lo disparan: analytics o crash reporting; cuentas o sincronización de favoritos; notificaciones push; EAS Update; mandar la ubicación al proxy (por ejemplo, para buscar paradas del lado del servidor); loguear requests en el Worker; tiles propios (cambia la fila 7); widgets o extensiones.
4. Anotar el cambio en `bitacora.md`.
