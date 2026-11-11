# 12 — Publicación en iOS (TestFlight → App Store)

Guía operativa de la Fase 7: cómo llevar Transportate a producción en iOS, paso a paso. La mayor parte la hacés vos en App Store Connect y en una terminal; los agentes preparan el código, los docs y los borradores de la ficha.

- **Alcance:** solo iPhone, solo iOS, solo Argentina. TestFlight primero y App Store después.
- **Fuera de alcance de la fase:** Android / Google Play, dominio propio (solo se documenta la transición, §8), EAS Update, CI de EAS y video de App Preview.
- **Fecha de la guía:** 2026-11-10. Las decisiones de abajo las tomaste ese día; el plan está en [`00-plan.md`](00-plan.md) (Fase 7) y la crónica, en [`bitacora.md`](bitacora.md).
- **Reglas de esta guía:** no hay credenciales, mails ni rutas de tu máquina. El mail de contacto vive solo en la página de soporte del sitio; acá se lo llama «el mail de la página de soporte». La API Key de App Store Connect (`.p8`) **nunca va al repo**.

## 1. Resumen y estado

### Olas

| Ola | Qué | Quién | Estado |
|---|---|---|---|
| **B** | Proxy a producción en `workers.dev` | Coordinador | ✔ 2026-11-10 (`transportate-proxy-production`, secrets cargados, verificado con `curl`) |
| **A** | Código y docs: URL por perfil de EAS, guardias de build, versión 1.0.0, solo iPhone, Acerca de (privacidad y soporte), sitio estático, estos documentos | Agentes | ✔ 2026-11-10 (en `main`; sitio `transportate-site` desplegado; proxy redesplegado en 1.0.0) |
| **C** | App Store Connect: app, ficha base, App Privacy, API Key (§2) | Vos, con el coordinador en el navegador | En curso (2026-11-10): app creada (Apple ID `6833240838`, ya en `eas.json`), ficha de la 1.0.0, categorías, 4+, precio y disponibilidad cargados. Falta: publicar App Privacy, datos de contacto para revisión, copyright, API Key |
| **D** | Build de producción y submit (§3) | Vos, con apoyo | Pendiente |
| **E** | Prueba en TestFlight (§4) | Vos y testers | Pendiente |
| **F** | Ficha, capturas y envío a revisión (§5, §6, §7); gate de dominio (§8) | Vos y agentes | Pendiente |
| **G** | Cierre: docs al día, bitácora | Agentes | Pendiente |

### Decisiones (2026-11-10)

| Tema | Decisión |
|---|---|
| Dominio propio | **No hay.** TestFlight sale contra `*.workers.dev`, donde la Cache API no funciona (cada pedido llega al GCBA, §8). El dominio es **gate antes de App Store**, o aceptás el riesgo de forma explícita |
| Proxy | Ya desplegado: `https://transportate-proxy-production.nhsiciliano.workers.dev` (Worker `transportate-proxy-production`, 2026-11-10) |
| Sitio de privacidad y soporte | Worker con static assets `transportate-site` en la misma cuenta (carpeta `site/`): `https://transportate-site.nhsiciliano.workers.dev/`, `/privacidad`, `/soporte`. Se despliega con `pnpm --filter transportate-proxy exec wrangler deploy -c ../../site/wrangler.jsonc` ([`10-deploy.md`](10-deploy.md) §10) |
| Dispositivos | Solo iPhone (`supportsTablet: false`) |
| Versión | `1.0.0`; número de build remoto en EAS (`appVersionSource: remote` y `autoIncrement`) |
| App Privacy | «No recopilamos datos» (justificación en [`05-privacidad.md`](05-privacidad.md) §9) |
| Contacto | Mail público en la página de soporte del sitio. **No** va embebido en la app |
| Países | Solo Argentina |
| Perfiles de EAS | `development` y `development-simulator` → `.env` local con la IP de la LAN. `preview`, `preview-simulator` y `production` → `env.EXPO_PUBLIC_API_URL` en `eas.json` con la URL del Worker de producción. Un build de esos perfiles sin URL `https://` falla al leer `app.config.ts` ([`10-deploy.md`](10-deploy.md) §5) |
| Datos fijos | Bundle id `app.transportate.mobile`; EAS `@nhsiciliano/transportate`; Apple Team `C9SN4BNWU9`; `npx eas-cli@27.2.0` siempre desde `apps/mobile` |

## 2. App Store Connect, paso a paso (lo hacés vos)

1. **Programa y acuerdos.** Apple Developer Program activo. En App Store Connect → *Business* (o *Agreements*) aceptá el acuerdo de **apps gratuitas** (*Free Apps*) si figura pendiente: sin él no se puede enviar a revisión.
2. **Identificador.** `app.transportate.mobile`. Lo crea `eas build` la primera vez (§3); a mano, en *Certificates, Identifiers & Profiles* → *Identifiers*. No se puede cambiar una vez publicada la app.
3. **App nueva** (*Apps* → «+» → *New App*):
   - Plataforma: **iOS**.
   - Nombre: **Transportate**. Si está tomado, probá «Transportate BA» o «Transportate: subte y colectivos». El nombre bajo el ícono no cambia (sale de `name` en `app.config.ts`).
   - Idioma principal: **Español (México)** (App Store Connect no ofrece español de Argentina).
   - Bundle ID: `app.transportate.mobile`.
   - SKU: `transportate-ios-001`.
   - Anotá el **Apple ID numérico** de la app (*App Information* → *Apple ID*): va en `submit.production.ios.ascAppId` de `apps/mobile/eas.json`. No es un secreto.
4. **App Information.**
   - Categoría primaria **Navegación**; secundaria **Viajes**.
   - Derechos de contenido: la app **usa contenido de terceros** y tenés derecho a usarlo. Los datos de transporte del GCBA están bajo CC BY 2.5 AR (con atribución en Acerca de). Anotá que la API comunitaria de trenes no publica términos de uso: el dato se muestra con atribución y como no oficial.
5. **Clasificación por edad.** Cuestionario con todo «No» / «Ninguno»: queda **4+**.
6. **App Privacy.**
   - URL de la política: `https://transportate-site.nhsiciliano.workers.dev/privacidad` (cuando haya dominio, la nueva; §8).
   - Respuesta: **«No, no recopilamos datos de esta app»** (*Data Not Collected*).
   - Justificación punto por punto: [`05-privacidad.md`](05-privacidad.md) §9. Si el cuestionario te lleva por otro camino, volvé a leerla antes de contestar.
7. **API Key de App Store Connect** (*Users and Access* → *Integrations* → *Team Keys* → «+», rol **App Manager**):
   - El `.p8` se descarga **una sola vez**: guardalo fuera del repo (gestor de contraseñas o carpeta privada).
   - Anotá el **Key ID** y el **Issuer ID**.
   - Se la das a EAS en el primer `eas submit` o con `eas credentials` (§3). Si preferís declararla en `eas.json`, los campos son `ascApiKeyPath`, `ascApiKeyId` y `ascApiKeyIssuerId` de `submit.<perfil>.ios`, y el `.p8` queda **fuera del repo**.
8. **Precio y disponibilidad.** Precio: **gratis**. Disponibilidad: solo **Argentina**.
9. **TestFlight.**
   - Grupo **interno**: vos (y quienes tengan rol en App Store Connect). No pasa por revisión.
   - Testers **externos** (2 a 5 mails): el primer build de cada versión pasa por la **Beta App Review**, y hace falta completar la *Test Information*: descripción de la beta, mail de feedback (el de la página de soporte), URL de privacidad y datos de contacto. La app no pide login, así que no hay cuenta de prueba.

## 3. Build y submit

Todo desde `apps/mobile`, con la versión fijada de `eas-cli`:

```sh
npx eas-cli@27.2.0 whoami
npx eas-cli@27.2.0 config --profile production --platform ios   # 1.0.0, supportsTablet false, URL https
npx eas-cli@27.2.0 build --platform ios --profile production    # la primera vez es interactivo: certificado y perfil
npx eas-cli@27.2.0 build:list --platform ios --limit 3
npx eas-cli@27.2.0 submit --platform ios --latest               # la primera vez pide la API Key
```

- **Los comandos interactivos los corrés vos** en una terminal (`eas build` la primera vez pregunta por el login de Apple, el certificado y el perfil de aprovisionamiento; `eas submit` pide la API Key). Desde Claude Code: `! cd apps/mobile && npx eas-cli@27.2.0 build …`.
- Correr `eas-cli` **desde la raíz** del repo deja un `app.json` vacío: borralo.
- En `config` mirá tres cosas: `version` = `1.0.0`, `ios.supportsTablet` = `false` y `EXPO_PUBLIC_API_URL` con `https://`. Si falta la URL, el build falla al leer `app.config.ts`: es la guardia, no un error de EAS.
- En TestFlight el build pasa de *Processing* a *Ready to Test* en **10 a 30 minutos**.
- El build **no pide la declaración de cifrado**: `ITSAppUsesNonExemptEncryption: false` está en `app.config.ts` (la app solo usa HTTPS estándar).
- Si llega un mail con **ITMS-91053** (declaración de APIs de razón requerida), se agrega `ios.privacyManifests` en `app.config.ts` con las categorías que indique el mail y se vuelve a buildear.
- El número de build lo asigna EAS (`autoIncrement` en `production`, versión remota): no se edita a mano.

## 4. Prueba en TestFlight

Es la variante de [`11-prueba-manual.md`](11-prueba-manual.md) para un **build de tienda**: no hay Metro, ni proxy local, ni `.env`, ni dev menu. Instalás desde la app TestFlight y probás con datos reales.

| Qué | Cómo verificarlo |
|---|---|
| Versión | Ajustes → Acerca de muestra «Versión 1.0.0 (build N)» con el N del build instalado |
| Enlaces | Acerca de tiene «Política de privacidad» y «Soporte y contacto»; abren las páginas del sitio |
| Datos reales en las 4 tabs | Inicio, Colectivos, Subtes y Trenes muestran datos del día. **Es la prueba de que la URL del proxy quedó embebida** en el build |
| Servicio caído | Solo con **modo avión** (no hay proxy local que apagar): banner de sin conexión y último dato marcado como viejo |
| Ubicación | El permiso aparece con el texto en voseo; sin permiso, la app sigue andando con búsqueda manual |
| Mapa | Cargan los tiles (OpenFreeMap) en Colectivos y Subtes, en claro y oscuro |
| Modo oscuro y texto grande | Pantalla por pantalla, como en `11-prueba-manual.md` §6 |
| VoiceOver | Recorrido de las pantallas principales |
| Frío | Cerrar la app y abrirla de nuevo: favoritos y ajustes siguen |

Después de unos días: en App Store Connect → *TestFlight* → *Crashes* y *Feedback*, revisá si hay cuelgues o comentarios de los testers. Los reportes de TestFlight los envían los testers por su cuenta; la app no incluye ningún SDK de reportes.

## 5. Ficha de App Store (borradores para editar)

Idioma principal **es-MX**, con una copia idéntica en **es-ES**. Voz de [`PRODUCT.md`](../PRODUCT.md): voseo, directa, sin promesas de exactitud. Los límites son los de App Store Connect; cada borrador está medido contra ellos (conteo de caracteres entre paréntesis).

**Nombre** (máx. 30): `Transportate` (12)

**Subtítulo** (máx. 30): `Subte, colectivos y trenes` (26)

**Texto promocional** (máx. 170; se puede cambiar sin nueva revisión):

```
Mirá cuándo llega tu subte, tu colectivo o tu tren en Buenos Aires. Sin cuenta, sin publicidad y sin rastreo: tus favoritos quedan en tu teléfono.
```

(146)

**Descripción** (máx. 4000):

```
Transportate te muestra el transporte de Buenos Aires en tiempo real, en una sola app y sin vueltas.

SUBTE
Mirá el estado de cada línea, las alertas vigentes y los próximos subtes de cada estación, con hace cuánto se actualizó el dato.

COLECTIVOS
Buscá una línea y seguila en el mapa. Encontrá las paradas cerca tuyo y mirá cuándo llega el próximo colectivo cuando la fuente lo informa.

TRENES
Consultá las líneas de Trenes Argentinos, sus ramales y estaciones, las alertas y los próximos trenes por destino, con la hora programada y la estimada.

TUS FAVORITOS
Guardá tus líneas, paradas y estaciones, ponéles un nombre y ordenalos como quieras. Aparecen en Inicio para verlos en un toque.

SIN CUENTA, SIN RASTREO
No hace falta registrarte. No hay publicidad ni analíticas. Tus favoritos y ajustes quedan en tu teléfono, y tu ubicación solo se usa mientras la app está abierta, para mostrarte paradas cercanas, y nunca sale de tu teléfono.

DE DÓNDE SALEN LOS DATOS
Transportate es una aplicación independiente y no es una app oficial. Los datos de subte y colectivos son datos abiertos del Gobierno de la Ciudad de Buenos Aires (licencia CC BY 2.5 AR). Los de trenes salen de una API comunitaria no oficial que reúne información de Trenes Argentinos (SOFSE). El mapa usa OpenStreetMap, a través de OpenFreeMap.

Los datos pueden tardar en actualizarse o faltar: por eso siempre te decimos hace cuánto se actualizaron, y cuando no hay información, lo avisamos en lugar de inventar un horario. No los uses como única fuente para decisiones críticas.

Pensada para leerse de un vistazo, en la parada o en el andén: modo claro y oscuro, texto grande y compatible con VoiceOver.
```

(1679)

**Palabras clave** (máx. 100, separadas por coma, sin espacios después de la coma y sin repetir el nombre de la app):

```
transporte,subte,colectivo,bondi,tren,buenos aires,CABA,AMBA,paradas,arribos,mapa,estación,horarios
```

(99)

**URL de soporte:** `https://transportate-site.nhsiciliano.workers.dev/soporte`
**URL de privacidad:** `https://transportate-site.nhsiciliano.workers.dev/privacidad`
(con dominio propio, las URLs nuevas; §8)

**Novedades de la 1.0.0** (máx. 4000):

```
Primera versión de Transportate: estado y próximos subtes, colectivos en el mapa, trenes y tus favoritos, en una sola app. Sin cuenta y sin rastreo.
```

(148)

## 6. Notas para el revisor

Se pegan en *App Review Information* → *Notes*. No hay cuenta ni login, así que no se carga usuario de prueba.

**Español**

```
Transportate muestra el transporte de la Ciudad de Buenos Aires: subte, colectivos y trenes. No tiene cuentas ni login, y no recopila datos.

Los datos son de Buenos Aires, así que fuera de la ciudad algunas pantallas pueden verse vacías. Todo funciona sin ubicación. Para probar «Paradas cercanas», alcanza con simular una ubicación en la ciudad (por ejemplo, -34.6037, -58.3816) desde el simulador o desde un dispositivo.

La app no tiene sección de Tránsito (cortes de calles) porque no hay una fuente pública confiable; no es un error.

El mensaje «No hay próximos trenes informados para esta estación» significa que la fuente no informa trenes en ese momento (por ejemplo, fuera de horario); no es un fallo de la app.

Los datos de subte y colectivos son datos abiertos del Gobierno de la Ciudad de Buenos Aires (CC BY 2.5 AR). Los de trenes vienen de una API comunitaria no oficial con información de Trenes Argentinos (SOFSE); la atribución está en Ajustes → Acerca de y la app no se presenta como oficial.

El pronóstico de llegadas del subte puede venir sin cambios desde la fuente; en ese caso la app lo muestra como dato no actualizado.
```

**English**

```
Transportate shows public transport in Buenos Aires, Argentina: subway, buses and trains. It has no accounts or login and does not collect any data.

The data covers Buenos Aires, so outside the city some screens may look empty. Everything works without location access. To try "Nearby stops", simulate a location in the city (for example -34.6037, -58.3816) from the simulator or a device.

There is no Traffic section (street closures) because there is no reliable public source for it; this is intentional, not a bug.

The message "No hay próximos trenes informados para esta estación" ("No upcoming trains reported for this station") means the data source reports no trains at that moment (for example, outside service hours); it is not an app failure.

Subway and bus data is open data from the Buenos Aires City Government (CC BY 2.5 AR). Train data comes from an unofficial community API that republishes information from Trenes Argentinos (SOFSE); attribution is shown in Settings → About, and the app does not present itself as official.

The subway arrival forecast may come unchanged from the source; when that happens the app labels it as stale data.
```

## 7. Capturas

- **Obligatorias:** 6,9″ (**1320×2868**). Sin iPad (la app es solo iPhone). Apple escala las de 6,9″ para los otros tamaños de iPhone.
- **De dónde salen:** de un build `preview-simulator` (release para simulador, sin dev menu, con la URL del Worker de producción) instalado en un **simulador iPhone Pro Max**. Se instala y se arranca con `xcrun simctl`; el build se baja con `npx eas-cli@27.2.0 build:run` o desde la página del build en expo.dev.
- **Cómo prepararlas:**

  ```sh
  xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
  xcrun simctl location booted set -34.6037,-58.3816          # solo si la pantalla usa ubicación
  xcrun simctl ui booted appearance light                     # y luego dark
  xcrun simctl openurl booted "transportate://…"              # deep link a cada pantalla (rutas: 07-app.md §2)
  xcrun simctl io booted screenshot ~/Desktop/inicio-claro.png
  ```

  Al terminar: `xcrun simctl status_bar booted clear`.
- **Qué mostrar (5 o 6 pantallas):** Inicio, una línea de subte, el mapa de colectivos, Trenes, Favoritos y Acerca de. Claro y oscuro de las que quieras; elegí el orden que mejor cuente la app.
- **Datos en pantalla:** reales y del momento. Evitá capturas con un servicio caído o con «Dato de hace…» salvo que esa sea la pantalla.
- **Destino en el repo:** `design/store/ios/6.9/` (nombres tipo `01-inicio-claro.png`). Las capturas son derivadas de la app, no hay nada que atribuir más que la propia app.

## 8. Gate de dominio y transición

### Qué implica abrir en App Store sin dominio

En `*.workers.dev` la Cache API (`caches.default`) **no tiene efecto** ([`10-deploy.md`](10-deploy.md) §4). Con eso:

- **cada pedido de cada usuario llega al GCBA** (salvo el coalescing dentro de cada isolate);
- las únicas protecciones son el **rate limit de 60 pedidos cada 60 s** por cliente y ese coalescing por isolate;
- cada pedido de `/v1/static/*` lee R2.

Para unos pocos testers de TestFlight alcanza. Para abrir en App Store hace falta **dominio propio**, o que aceptes el riesgo de forma explícita (anotarlo en la bitácora).

### Cuando haya dominio (resumen; el procedimiento completo está en [`10-deploy.md`](10-deploy.md) §4)

1. El dominio, como zona activa en la cuenta de Cloudflare.
2. En `env.production` de `apps/proxy/wrangler.jsonc`: `routes: [{ "pattern": "api.<dominio>", "custom_domain": true }]` **manteniendo** `workers_dev: true`. Los builds ya publicados siguen apuntando a `workers.dev`.
3. Redeploy de `production`.
4. URL nueva en `env.EXPO_PUBLIC_API_URL` de `eas.json`.
5. Build nuevo → TestFlight → release.
6. Cuando el build viejo deje de usarse, `workers_dev: false`.

El sitio también pasa al dominio, y las URLs de Acerca de de ese build cambian (privacidad y soporte). Actualizá las URLs de la ficha (§5) y de App Privacy.

## 9. Freno de emergencia

| Qué | Cómo |
|---|---|
| Sacar la app de la venta | App Store Connect → la app → *Pricing and Availability* → *Remove from sale* (el efecto no es instantáneo en todas las tiendas; quienes ya la bajaron la conservan) |
| Volver el proxy atrás | `pnpm --filter transportate-proxy exec wrangler rollback --env production --message "…"` ([`10-deploy.md`](10-deploy.md) §7). No revierte secrets ni R2 |
| Apagar trenes | `TRENES_ENABLED` distinto de `"true"` en `env.production` de `wrangler.jsonc` + redeploy: `/v1/trenes/estado` responde `sin_datos` y `/alertas` y `/arribos` 503, sin llamar a la fuente. La app lo dice con «Sin información» |
| Frenar un build de TestFlight | App Store Connect → *TestFlight* → el build → *Expire Build* |

## 10. Riesgos

| Riesgo | Probabilidad / impacto | Mitigación |
|---|---|---|
| **Nombre ocupado** en App Store Connect | Media / bajo | Alternativas: «Transportate BA» o «Transportate: subte y colectivos» (§2.3). El nombre bajo el ícono no cambia |
| **Rechazo por la guía 4.2** (funcionalidad mínima) o por mostrar datos no oficiales | Baja / alto | Las notas del revisor (§6) explican fuentes y atribución; la app no se presenta como oficial; hay mapa, favoritos, 3 servicios y estados de error |
| **Pronóstico del subte congelado** y Tránsito oculto | Alta / medio | Documentado en las notas (§6) y en [`01-api-transporte.md`](01-api-transporte.md); la app marca el dato viejo y no inventa horarios |
| **Cache API inerte en `workers.dev`** | Cierta / medio | Gate de dominio antes de App Store (§8); mientras tanto, pocos testers y rate limit |
| **Build sin URL del proxy** | Baja / alto | Las guardias de `app.config.ts` hacen fallar el build si falta una URL `https://` en los perfiles `preview*` y `production` |
| **ITMS-91053** (APIs de razón requerida) | Media / bajo | Se agrega `ios.privacyManifests` y se vuelve a buildear (§3) |
| **Revisión en iPad en modo compatibilidad** | Media / bajo | Revisores de Apple a veces prueban en iPad aunque la app sea solo iPhone. La app corre escalada; las notas lo aclaran si hace falta |
| **API de trenes caída durante la revisión** | Media / medio | «Sin información» sin datos inventados; las notas explican el mensaje de la estación; plan de salida en [`01d-api-trenes-sofse.md`](01d-api-trenes-sofse.md) |
| **Primer pedido en frío lento** (`tripUpdates` del GCBA agotó el timeout en el primer pedido, 2026-11-10) | Media / bajo | El proxy devuelve el último dato bueno marcado `stale`; los pedidos siguientes tardan entre 0,06 y 0,18 s |

## Enlaces

- Despliegue y perfiles de EAS: [`10-deploy.md`](10-deploy.md) §4, §5 y §10.
- Privacidad y ficha de App Privacy: [`05-privacidad.md`](05-privacidad.md) §8 y §9.
- Prueba manual: [`11-prueba-manual.md`](11-prueba-manual.md).
- Plan de la fase: [`00-plan.md`](00-plan.md) (Fase 7).
