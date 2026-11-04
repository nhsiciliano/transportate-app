# Product

<!-- impeccable:product-schema 1 -->

> **Cómo se armó este archivo.** Lo generó el flujo `init` de Impeccable en la Fase 1, pero **sin entrevista con el usuario**: el coordinador pidió responder desde `docs/00-plan.md`. Todo lo que sale directo del plan está confirmado en el plan; lo que es una deducción nuestra está marcado como **(suposición)** y hay que validarlo en la revisión de Fase 1. Las secciones de más abajo no definen mundo visual: eso lo cubren `DESIGN.md` (Fase 3) y los briefs de `shape`.

## Platform

adaptive

Una sola base de código React Native con Expo (iOS + Android, dev client, New Architecture; no hay Expo Go). **Adaptive** significa que el producto respeta el lenguaje de cada sistema —Human Interface Guidelines en iOS, Material Design 3 en Android— en estructura, navegación e interacción, y expresa la marca por las capas que cada plataforma deja abiertas (color, tipografía, contenido). No hay versión web. *(Suposición: ver "Tensiones abiertas" en Brand Commitments, donde el plan fija íconos y tipografías que no son los nativos.)*

## Users

**Residentes y visitantes de la Ciudad Autónoma de Buenos Aires que se mueven en colectivo y subte.**

- Lo usan **en la calle y en movimiento**: parados en una parada, en un andén, caminando hacia una estación. Van **apurados**, con **una sola mano** y, muchas veces, con sol sobre la pantalla.
- A veces **sin señal** o con señal mala (subsuelo, túneles, zonas con cobertura floja). La app tiene que mostrar lo último que sabe y decir con claridad qué tan viejo es.
- Hablan **español rioplatense**; los visitantes pueden no conocer la red, así que nombres de líneas, estaciones y paradas tienen que ser inequívocos.
- Trabajo a resolver: *"¿cuándo pasa mi colectivo o mi subte, y está funcionando?"* en unos pocos segundos, y volver a consultar lo mismo todos los días sin buscarlo de nuevo (favoritos).

*(Suposición)* No hay segmentos secundarios confirmados (turistas, personas con movilidad reducida, conductores de colectivos). Se tratan como parte de la misma audiencia hasta que haya evidencia distinta.

## Product Purpose

**Transportate** muestra el transporte público de CABA **en tiempo real**: posiciones de colectivos, estado y próximos arribos del subte, y cortes de tránsito, en una app móvil sin cuentas ni datos personales y con favoritos guardados en el teléfono.

Éxito: el usuario obtiene la respuesta en menos de lo que tarda en cruzar la calle; sabe qué tan fresco es el dato; la app sigue siendo útil sin conexión (favoritos y último dato bueno). A nivel de ingeniería, éxito es escalar de cientos a millones de usuarios sin reescribir (proxy en dos capas, ver `docs/03-arquitectura.md` y `docs/04-escalabilidad.md`).

## Positioning

- **Sin cuentas, sin analytics, sin tracking.** Ni login, ni perfil, ni identificadores. La ubicación se usa solo en memoria y nunca sale del teléfono. Es una promesa de producto verificable en el código y en `docs/05-privacidad.md`, no un texto de marketing.
- **Datos oficiales del GCBA con atribución**, mostrados con su frescura ("hace X s") y su estado de degradación, en lugar de fingir tiempo real cuando la fuente no responde.
- **Diseño alineado al sistema Obelisco v2 del GCBA**, adaptado a nativo: se siente parte del ecosistema de la Ciudad.
- *(Suposición)* Lo que un competidor genérico no puede copiar sin cambiar su modelo de negocio es la combinación "gratis + sin datos personales + oficial". No se hizo relevamiento de competidores en Fase 1; hay que validar esta afirmación antes de usarla en copy público.

## Operating Context

- **Modo de diseño: Operate.** La persona viene a completar una tarea (ver una línea, una parada, un estado). Escaneabilidad, consistencia, expectativas nativas y la escena real de uso pesan más que la expresión. La marca vive en detalles precisos.
- **Fuentes de datos:** API de Transporte del GCBA (`https://apitransporte.buenosaires.gob.ar`), consumida **solo a través de un proxy propio** (Cloudflare Worker + Hono). El teléfono nunca habla con el upstream ni lleva credenciales. Spec: `docs/fuentes/api-transporte-v1.raml`; endpoints verificados: `docs/01-api-transporte.md`.
- **Datos estáticos** (GTFS de colectivos de ~209 MB y de subtes): se preprocesan offline, se filtran a CABA y se sirven como JSON compacto versionado; búsqueda y paradas cercanas ocurren **localmente** en el teléfono.
- **Refresco:** polling de 20 s (configurable) solo con la pantalla visible; pausa en segundo plano.
- **Riesgo operativo conocido:** el portal de datos abiertos informó en junio de 2026 que los datasets con formato API y GTFS estaban "suspendidos, en revisión y corrección". La app debe tratar la indisponibilidad del upstream como un estado normal, no excepcional (ver Product Principles).

## Capabilities and Constraints

Alcance del MVP (el plan habla de seis pantallas; ver `docs/00-plan.md`, tareas 1.9 y 3.8): Inicio, Colectivos, Subtes, Tránsito, Favoritos y Ajustes (con Acerca de como pantalla anidada). *(Suposición: así se cuentan las seis; los briefs de `shape` lo confirman.)*

Restricciones duras:

- **Sin login ni datos personales.** Favoritos, caché y ajustes viven en el dispositivo (MMKV). Nada de analytics, crash reporting con identificadores ni logs con IP/UA en el proxy.
- **Idioma: es-AR con voseo** en todo el copy ("tocá", "elegí", "volvé a intentar"). Sin localización a otros idiomas en el MVP. *(Suposición: formato de fecha, hora y números de Argentina.)*
- **Ubicación solo "mientras se usa"**, en memoria, con alternativa manual cuando no hay permiso.
- **Estados obligatorios en cada pantalla:** carga, vacío, error con reintento, dato viejo (stale), sin conexión, sin permiso de ubicación.
- **Colores de líneas de subte** tomados del GTFS oficial (`docs/02b-colores-subte.md`).
- **Terminología:** *línea* (colectivo y subte), *parada* (colectivo), *estación* y *andén* (subte), *ramal*, *corte* (tránsito), *frescura* ("hace 12 s").
- **Sin definir todavía:** si existen arribos por parada de colectivos en la API (Fase 1 lo confirma o descarta; si no hay feed, se omite la función); intervalo de refresco por defecto distinto de 20 s; modo oscuro (Obelisco no lo define, se deriva en Fase 1.6).

## Brand Commitments

Compromisos que el plan fija y que son **vinculantes** para el trabajo visual (se registran tal cual, sin ampliarlos):

- **Nombre:** Transportate.
- **Autoridad visual: Obelisco v2** (sistema de diseño del GCBA), adaptado a nativo. Tokens extraídos en `docs/02-obelisco-tokens.md` (Fase 1.5).
- **Tipografía:** **Fira Sans** (pesos 400/600/700), una sola familia para títulos y texto.
- **Dirección visual: «Señalética de terminal».** Elegida por el usuario el 2026-11-03 con Impeccable (contrato de dirección en `apps/mobile/.impeccable/surfaces/`), con el piloto en Inicio validado en el iPhone el 2026-11-04 y extendida al resto de la app ese mismo día. Aporta tipografía, densidad, placas y bandas de señal sobre la paleta de Obelisco v2, que no cambia; las tabs, los large titles, los headers, el gesto de volver, las sheets y los controles quedan nativos.
- **Íconos:** **Material Symbols Rounded**, **FILL 1**, como SVG (`@material-symbols/svg-400`).
- **Atribución obligatoria** a los datos del GCBA (licencia CC-BY-2.5-AR) en la pantalla "Acerca de".
- **Voz:** rioplatense, directa, sin jerga técnica; breve porque se lee de pie y en movimiento. *(Suposición: tono cercano pero sobrio, sin humor en estados de error del servicio.)*

**Tensiones abiertas (a resolver en `shape` / `adapt` nativo, no acá):**

1. Las guías de plataforma recomiendan SF Symbols y San Francisco en iOS, y Roboto + Material 3 en Android; el plan impone Material Symbols y Fira Sans en ambas. Hay que decidir cuánto de la identidad Obelisco se superpone a lo nativo (por ejemplo, tipografía de marca en títulos y la del sistema en controles) sin romper Dynamic Type, safe areas ni gesto de volver.
2. Obelisco es un sistema web y no define modo oscuro ni equivalentes de componentes nativos: la derivación (Fase 1.6) y la adaptación son decisiones de diseño pendientes.

## Evidence on Hand

- Spec RAML oficial de la API: `docs/fuentes/api-transporte-v1.raml`.
- GTFS estático de subtes verificado el 2026-11-01 (HTTP 200): colores por línea y estaciones en `docs/02b-colores-subte.md`.
- Credenciales de la API en un `.env` local (no versionado) del equipo de desarrollo.
- Tokens de Obelisco v2 (colores, escalas tipográficas) identificados en el plan; el detalle con archivo origen está en `docs/02-obelisco-tokens.md`.
- **No hay:** usuarios reales, métricas de uso, entrevistas, testimonios, benchmarks de competidores ni capturas de apps de referencia. No inventar ninguno.

## Product Principles

1. **La respuesta primero.** Cada pantalla resuelve una pregunta ("¿cuándo viene?", "¿funciona?") con lo más importante legible de un vistazo, con una mano y a la luz del día; lo demás es secundario.
2. **Decir siempre qué tan fresco es el dato.** Nunca mostrar un dato viejo como si fuera actual: "hace X s", aviso de dato viejo, y último dato bueno marcado como no actualizado cuando no hay red o el upstream falla.
3. **Degradar con elegancia.** Sin señal o con el servicio oficial caído, la app sigue mostrando favoritos y lo último conocido, dice qué pasó en lenguaje llano y ofrece reintentar. El error del servicio nunca se presenta como culpa de la persona.
4. **Privacidad por diseño, no por configuración.** Lo que no se necesita no se pide ni se guarda; la ubicación es efímera y local.
5. **Nativo primero, marca por las capas abiertas.** Navegación, gestos, controles y comportamiento de cada sistema se respetan; Obelisco aporta color, tipografía y tono.

## Accessibility & Inclusion

- **Estándar objetivo: WCAG 2.2 AA** *(suposición, alineada con el plan: contraste ≥ 4,5:1 para texto y ≥ 3:1 para UI en claro y oscuro)*.
- **Áreas táctiles:** 44×44 pt en iOS y 48×48 dp en Android; uso con una mano y pulgar.
- **Tipografía escalable:** Dynamic Type en iOS y escala de fuente (sp) en Android, con tope razonable (`maxFontSizeMultiplier`) y sin truncar información crítica.
- **El color nunca es el único canal:** las líneas de subte llevan siempre su letra; los estados (demora, interrupción) llevan ícono y texto.
- **Lectores de pantalla:** VoiceOver y TalkBack recorren las pantallas principales con etiquetas en castellano.
- **Reduce Motion / Remove animations** respetados; **modo claro y oscuro** de primera clase; uso al sol (alto contraste).
