# Solicitud de GTFS estático vigente de colectivos al GCBA

> **Borrador, sin enviar.** Lo envía el responsable del proyecto desde su propia casilla; este documento no manda nada. Completar `[Nombre]` y `[Proyecto]`, y revisar la dirección de destino y la copia antes de enviar. No incluir credenciales (`client_id`/`client_secret`) en el correo.
>
> Contexto técnico y evidencia: [`01-api-transporte.md`](01-api-transporte.md), [`01b-gtfs-alternativos.md`](01b-gtfs-alternativos.md) y [`adr/ADR-0006-paradas-colectivos.md`](adr/ADR-0006-paradas-colectivos.md).

---

**Para:** apitransporte@buenosaires.gob.ar
**Cc (sugerida):** Secretaría de Transporte del Gobierno de la Ciudad de Buenos Aires *(completar con la casilla institucional que corresponda; confirmar el área y la dirección antes de enviar)*
**Asunto:** Solicitud de GTFS estático vigente de colectivos y consulta sobre el estado de la API de Transporte

Estimados/as:

Me comunico en nombre de [Proyecto], una aplicación móvil independiente, sin publicidad ni cuentas de usuario, que muestra información de transporte público de la Ciudad de Buenos Aires en tiempo real a partir de los datos abiertos de la API de Transporte. Utilizamos credenciales propias de la API, registradas conforme a los términos del servicio.

Les escribo para realizar tres consultas y una solicitud:

**1. Solicitud: GTFS estático vigente de colectivos.**
Les pedimos, si es posible, el archivo GTFS estático actualizado de colectivos que se corresponde con los datos que hoy publican en tiempo real, es decir, el que alimenta el sistema de localización de la flota (AVL) y el recurso `/colectivos/tripUpdates`. Les pedimos también que nos indiquen su fecha de vigencia y, si existe, su cronograma de actualización.

**2. Por qué lo necesitamos.**
Al comparar los recursos disponibles el 1 de noviembre de 2026 observamos lo siguiente:

- El GTFS estático de colectivos que sirve la API (`/colectivos/feed-gtfs`) y el publicado en el portal de datos abiertos corresponden a períodos anteriores: el de la API tiene fechas de servicio entre diciembre de 2020 y junio de 2021, y el del portal, entre septiembre y diciembre de 2019.
- Los identificadores del tiempo real no se corresponden con los de esos archivos: ninguno de los identificadores de ruta (`route_id`) que coinciden en ambos lados representa la misma línea, y solo alrededor del 40 % de los identificadores de parada (`stop_id`) del recurso `tripUpdates` aparece en el GTFS de 2021. Por ese motivo no podemos asociar de manera confiable cada predicción de arribo con el nombre y la ubicación de una parada.
- Sí encontramos un recurso vigente de paradas en el portal ("Colectivos: paradas", actualizado en septiembre de 2026), pero no incluye los identificadores de parada del tiempo real.

Contar con el GTFS vigente nos permitiría mostrar arribos correctos y evitar inferirlos mediante aproximaciones, que son menos confiables.

**3. Consultas sobre el estado de la API.**

- El portal de datos abiertos informa que los datasets con formato API y GTFS se encuentran "suspendidos, en revisión y corrección". Sin embargo, la API continúa respondiendo. ¿Cuál es el estado actual del servicio? ¿Existe una fecha prevista de restablecimiento, de cambios de formato o de baja de recursos?
- ¿Está prevista una nueva versión de la API (v2.0)? De ser así, ¿pueden compartirnos la documentación disponible, el cronograma y si habrá cambios en los identificadores de rutas y paradas, de modo de adaptarnos con anticipación?
- Observamos que el recurso `/colectivos/tripUpdates` responde pero no figura en la especificación publicada, y que `/subtes/forecastGTFS` no se actualiza desde el 24 de octubre de 2026. ¿Son comportamientos conocidos? ¿Hay un canal para reportar estos casos?
- ¿Existen límites de uso (cantidad de solicitudes por período) o condiciones adicionales a la licencia CC BY 2.5 AR que debamos respetar? Para reducir la carga, consultamos cada recurso a través de un servidor intermedio con caché, de modo que la cantidad de solicitudes a su servicio no dependa de la cantidad de personas que usan la aplicación.

Daremos atribución a la fuente en la aplicación, de acuerdo con la licencia de los datos. Quedamos a disposición para brindar cualquier información adicional y agradecemos de antemano su respuesta.

Saludos cordiales,

[Nombre]
[Proyecto]
[Dato de contacto institucional del proyecto, a completar por el responsable]

---

## Notas para quien lo envíe

- Los números salen de las mediciones del 2026-11-01 (`01-api-transporte.md`, `01b-gtfs-alternativos.md`). Si pasa tiempo antes de enviarlo, reverificar con `tools/api-probe` y `tools/gtfs-cruce`.
- El correo no menciona datos personales de usuarios ni credenciales. No adjuntar el `.env`.
- Si hay respuesta con un GTFS nuevo: agregarlo a `CANDIDATOS` en `tools/gtfs-cruce/cruce.mjs`, correr el cruce, actualizar `01b` y reemplazar el ADR-0006 por uno nuevo.
- Canal alternativo si no hay respuesta: formulario de contacto de BA Data en <https://data.buenosaires.gob.ar>.
