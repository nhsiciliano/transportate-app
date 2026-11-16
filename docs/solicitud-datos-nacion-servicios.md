# Solicitud de datos de colectivos a Nación Servicios (Cuándo SUBO)

> **Borrador, sin enviar.** Lo envía el responsable del proyecto desde su propia casilla; este documento no manda nada. Completar `[Nombre]` y el dato de contacto, y **confirmar el destinatario antes de enviar** (ver las notas del final: no encontramos una casilla institucional publicada). No incluir credenciales (`client_id`/`client_secret`) en el correo.
>
> Contexto técnico y evidencia: [`01-api-transporte.md`](01-api-transporte.md), [`01b-gtfs-alternativos.md`](01b-gtfs-alternativos.md) y [`adr/ADR-0006-paradas-colectivos.md`](adr/ADR-0006-paradas-colectivos.md). Pedido hermano al GCBA: [`solicitud-gtfs-gcba.md`](solicitud-gtfs-gcba.md).

---

**Para:** Nación Servicios S.A. _(completar con la casilla o el canal institucional que corresponda)_
**Cc (sugerida):** Secretaría de Transporte de la Nación _(confirmar el área y la dirección antes de enviar)_
**Asunto:** Solicitud de GTFS vigente de colectivos del AMBA y de autorización de uso (Cuándo SUBO)

Estimados/as:

Me comunico en nombre de Transportate (<https://transportate.ar>), una aplicación móvil independiente, publicada en App Store, que muestra en tiempo real el subte, los colectivos y los trenes de la Ciudad de Buenos Aires. No tiene publicidad ni cuentas de usuario, no recopila datos personales y no se presenta como una aplicación oficial.

Para los colectivos usamos los datos abiertos de la API de Transporte del Gobierno de la Ciudad de Buenos Aires, con credenciales propias y bajo su licencia (CC BY 2.5 AR). Les escribo porque entendemos que esos datos tienen origen en el sistema que ustedes administran, y porque la información que hoy nos falta es la que Cuándo SUBO ya ofrece a sus usuarios.

**1. Solicitud principal: GTFS estático vigente de colectivos.**
Les pedimos, si es posible, el archivo GTFS estático actualizado de colectivos del Área Metropolitana de Buenos Aires: el que se corresponde con los identificadores que hoy circulan en el tiempo real (rutas, viajes, paradas y sentido). Les pedimos también que nos indiquen su fecha de vigencia y, si existe, su cronograma de actualización.

**2. Solicitud de autorización de uso.**
Los términos y condiciones de Cuándo SUBO establecen que el uso de su información requiere el consentimiento previo y por escrito de Nación Servicios S.A. Por eso no la hemos utilizado, y les solicitamos esa autorización para mostrar en nuestra aplicación la información de líneas, ramales, sentidos, paradas y horarios de colectivos, en las condiciones que ustedes indiquen.

**3. Alternativa: acceso a la interfaz de consulta.**
Si no fuera posible entregar el archivo GTFS, les consultamos si existe la posibilidad de obtener una clave de aplicación para la interfaz de consulta de Cuándo SUBO, con los límites de uso que consideren adecuados. La consultaríamos únicamente desde un servidor intermedio con caché, de modo que la cantidad de solicitudes a su servicio no dependa de la cantidad de personas que usan la aplicación.

**4. Por qué lo necesitamos.**
Al comparar los recursos disponibles el 1 de noviembre de 2026 observamos lo siguiente:

- Los GTFS estáticos de colectivos que están publicados corresponden a períodos anteriores. El más reciente que sirve la API de la Ciudad con frecuencias figura publicado por NSSA, en su versión 1.0, con vigencia del 1 de enero de 2018 al 31 de diciembre de 2021. No encontramos un GTFS de colectivos en el portal de datos abiertos de Transporte de la Nación.
- Los identificadores del tiempo real ya no se corresponden con los de esos archivos. De los 252 identificadores de ruta (`route_id`) que existen en ambos lados, ninguno representa la misma línea. Solo alrededor del 40 % de los identificadores de parada (`stop_id`) del tiempo real aparece en el GTFS de 2021, y los cerca de 3.600 identificadores con el formato nuevo (`S…`) no aparecen en ninguno.
- En consecuencia, hoy solo podemos mostrar arribos en una parte de las paradas, no podemos ofrecer la elección de sentido y no podemos mostrar el horario programado cuando una unidad no informa su posición.

Contar con el GTFS vigente nos permitiría mostrar arribos correctos en todas las paradas y dejar de inferirlos mediante aproximaciones, que son menos confiables.

**5. Consultas.**

- ¿Está previsto publicar el GTFS de colectivos como dato abierto? De ser así, ¿en qué portal y con qué licencia?
- ¿Con qué frecuencia cambian los identificadores de rutas y paradas, y existe algún aviso previo de esos cambios?
- ¿Hay un canal para reportar inconsistencias que detectemos en los datos (paradas mal ubicadas, líneas sin información)?
- Si este pedido debe dirigirse a otra área o seguir un trámite formal, les agradecemos que nos indiquen cuál.

**6. Nuestros compromisos.**

- Dar atribución a la fuente en la aplicación, con el texto que ustedes indiquen.
- No utilizar las marcas, los logotipos ni los diseños de SUBE o de Cuándo SUBO, ni presentar la aplicación como oficial o vinculada a ustedes.
- No redistribuir los archivos a terceros: los usaríamos solo para alimentar nuestra aplicación.
- Respetar los límites de uso que fijen y dejar de usar la información si en algún momento lo solicitan.

Quedamos a disposición para brindar cualquier información adicional, incluida una demostración de la aplicación, y agradecemos de antemano su respuesta.

Saludos cordiales,

[Nombre]
Transportate
[Dato de contacto institucional del proyecto, a completar por el responsable]

---

## Notas para quien lo envíe

- **Destinatario sin confirmar.** No encontramos una casilla institucional publicada de Nación Servicios para este tipo de pedidos (búsqueda del 2026-11-16). Canales a probar, en este orden: el contacto que figure en la aplicación o en la página de Cuándo SUBO (<https://www.argentina.gob.ar/sube/cuandosubo>); la mesa de entradas de Nación Servicios; y, si no hay respuesta, un pedido de acceso a la información pública (Ley 27.275) por Trámites a Distancia. Falta confirmar que esa ley alcance a Nación Servicios como sociedad de capital estatal.
- **Hasta tener la autorización por escrito, no se consume la interfaz de Cuándo SUBO ni se extraen datos de la aplicación.** Sus términos (última actualización: 4 de julio de 2019) lo prohíben sin consentimiento previo y por escrito, y limitan la información al uso personal de cada usuario. No se probó su API: solo sabemos que la versión web corre sobre OneBusAway, que trae una API con clave por instalación.
- Los números salen de las mediciones del 2026-11-01 (`01b-gtfs-alternativos.md` §1 a §3). Si pasa tiempo antes de enviarlo, reverificar con `tools/api-probe` y `tools/gtfs-cruce`.
- El correo no menciona datos personales de usuarios ni credenciales. No adjuntar el `.env`.
- Conviene enviarlo junto con el pedido al GCBA ([`solicitud-gtfs-gcba.md`](solicitud-gtfs-gcba.md)), que sigue sin enviar: son dos puertas al mismo dato. Ese borrador todavía dice `[Proyecto]` y sus mediciones son del 2026-11-01; completarlo y reverificarlo antes de mandarlo.
- Si hay respuesta con un GTFS nuevo: agregarlo a `CANDIDATOS` en `tools/gtfs-cruce/cruce.mjs`, correr el cruce, actualizar `01b` y reemplazar el ADR-0006 por uno nuevo. Si la autorización trae condiciones (atribución, límites, vigencia), anotarlas en `05-privacidad.md` y en Acerca de antes de usar el dato.
- Qué destraba en la app: elección de sentido, arribos en todas las paradas, horario programado como respaldo y, más adelante, paradas del Gran Buenos Aires.
