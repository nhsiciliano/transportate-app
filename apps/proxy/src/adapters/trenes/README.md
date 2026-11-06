# adapters/trenes

`createTrenesAdapter({ source, baseUrl, enabled, ttlSeconds, ttlEstadoSeconds, now })` implementa `TrenesAdapter` (Fase 6, ola 1): estado por línea y ramal, alertas y arribos por estación de los trenes metropolitanos de SOFSE (Trenes Argentinos).

## La fuente

`https://ariedro.dev/api-trenes` (var `TRENES_UPSTREAM_BASE`) es una **instancia pública comunitaria**, no oficial. Es un proxy Express que mantiene una persona: agrega la autenticación de la app oficial de Trenes Argentinos y reenvía a la API interna de SOFSE. No tiene auth, términos ni SLA, y tarda 1–2,5 s por pedido. Por eso:

- **TTL generosos** y **un solo refresco por clave** (la capa A, `EdgeCachedFeedSource`, ya lo hace).
- La fuente de trenes es **otra instancia** de `EdgeCachedFeedSource`, **sin credenciales** y con su propio texto de 503 («Servicio de trenes no disponible»). `User-Agent: transportate-proxy/0.1`.
- **Todo lo que conoce la forma y las URLs de la fuente vive en dos archivos:** `sofse.ts` (URLs, decodificación, fechas) y `packages/contracts/src/upstream/sofse.ts` (esquemas laxos). Cambiar de fuente mañana = reemplazar esos dos archivos y la var.
- Los tests nunca la llaman: usan las fixtures de `test/fixtures/sofse/` (`tools/sofse-probe`).

| Pedido                                            | Clave de caché                |                                TTL | Notas                                                                                 |
| ------------------------------------------------- | ----------------------------- | ---------------------------------: | ------------------------------------------------------------------------------------- |
| `GET /infraestructura/gerencias?idEmpresa=1`      | `trenes:gerencias`            | `TRENES_ESTADO_TTL_SECONDS` (60 s) | Las líneas con su `estado.mensaje` y sus alertas de línea. Regionales (501) se ignora |
| `GET /infraestructura/ramales?idGerencia=<id>` ×6 | `trenes:ramales:<idGerencia>` |                               60 s | Ramales con `publico`, `orden_ramal`, cabeceras y alertas de ramal                    |
| `GET /arribos/estacion/<id>?cantidad=8`           | `trenes:arribos:<estacionId>` |        `TRENES_TTL_SECONDS` (30 s) | Pesado (65–106 KB para 8–13 arribos): el proxy devuelve < 3 KB                        |

`loadRed()` (lo comparten `estadoLineas()` y `alertas()`) pide gerencias y los 6 ramales **con un único plazo de 5 s** (`RED_BUDGET_MS`) y sin reintento, como el fan-out de colectivos. Lo que no llega a tiempo sale del último dato bueno o se trata como caído.

**Concurrencia:** Workers deja **6 conexiones salientes simultáneas por request** y el séptimo fetch espera. Por eso `loadRed()` lleva a lo sumo 6 pedidos en vuelo (`RED_CONCURRENCIA`, con `settledConLimite`): gerencias y 5 ramales arrancan juntos y el sexto ramal (Tren de la Costa) arranca cuando termina el primero. En frío, con 1,3–2,5 s por pedido, son dos tandas de ≤ 2,5 s y entran en el plazo; en caliente todo sale de la caché sin red. Si el sexto no llega, la Costa queda con `ramales: []` y `meta.stale`.

Las líneas, en el orden fijo de `/v1/trenes/estado`, salen de la tabla `LINEAS_TREN` (`lineas.ts`):

| Línea              | `idGerencia` | Color     | Texto     |
| ------------------ | -----------: | --------- | --------- |
| `roca`             |           11 | `#F07D2B` | `#000000` |
| `sarmiento`        |            1 | `#B8237A` | `#FFFFFF` |
| `mitre`            |            5 | `#42B874` | `#000000` |
| `san-martin`       |           31 | `#6438C4` | `#FFFFFF` |
| `belgrano-sur`     |           21 | `#5C4858` | `#FFFFFF` |
| `tren-de-la-costa` |           41 | `#A020B8` | `#FFFFFF` |

La API no trae colores. Los de la tabla salen de [`docs/02c-colores-trenes.md`](../../../../../docs/02c-colores-trenes.md) (fuente de verdad, todos AA con su texto).

## Alertas

Una alerta de SOFSE (`gerencias[].alerta[]` o `ramales[].alerta[]`) **cuenta** solo si `habilitado === 1` y `vigencia_desde ≤ ahora ≤ vigencia_hasta` (`vigencia_hasta` null = sin fin). Se juntan las de la gerencia y las de todos sus ramales, sin repetir ids, y se traducen a `AlertaTrenV1`:

| Campo                              | Origen                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                               | `id` como string                                                                                                                                                                           |
| `linea`                            | `linea_id` → `lineaDeGerencia`; sin `linea_id`, la línea de la lista donde vino. Las de gerencias que no son de las seis se descartan                                                      |
| `ramalId`, `estacionId`, `sentido` | `ramal_id` (o el ramal donde vino), `estacion_id` y `sentido` (`"1"`/`"2"`) como strings                                                                                                   |
| `titulo`                           | Primera oración de `contenido` (un punto no cierra oración después de `Pza.`, `Fco.`, `hs.`, `Dr.` o una inicial como `M.C.G.`); si pasa de 120 caracteres, se corta en un espacio con `…` |
| `descripcion`                      | `contenido` con los espacios normalizados (la fuente trae espacios de más al final)                                                                                                        |
| `causa`, `efecto`                  | `causa_gtfs`; `efecto_gtfs` como nombre (si llegara un número GTFS-RT, se traduce con `effectName`)                                                                                        |
| `desde`, `hasta`                   | `vigencia_*` interpretadas en hora de Buenos Aires (ver «Supuestos»)                                                                                                                       |

Orden: por línea (orden fijo), luego la más severa primero, a igual severidad la de menor `criticidad_orden` y luego por id.

## Estado por línea y por ramal (`estadoLineas()`)

Se reutilizan a propósito los textos, la severidad y `estadoDe` de subtes (`../subtes/reglas.ts`). Severidad de una alerta:

| Severidad      | Si…                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `interrumpida` | `efecto_gtfs` = `NO_SERVICE`, o `contenido` matchea `TEXTO_INTERRUMPIDA` (`/sin servicio\|no (presta\|funciona)\|interrumpid\|suspendid/i`)   |
| `demorada`     | `efecto_gtfs` ∈ {`SIGNIFICANT_DELAYS`, `REDUCED_SERVICE`, `DETOUR`, `MODIFIED_SERVICE`, `STOP_MOVED`}, o `contenido` matchea `TEXTO_DEMORADA` |
| `informativa`  | el resto: no cambia el estado                                                                                                                 |

`estado.mensaje` de la gerencia también cuenta: `/interrump|suspend|sin servicio|cancelad/i` → `interrumpida`, `/demor|limitad|reducid/i` → `demorada`, cualquier otra cosa → informativa. **Hoy dice «Alertas por ramal» en todas las líneas** (color `#435a6c`): es un mensaje genérico y no implica demora.

- **Estado de la línea:** las alertas **de ramal** (con `ramal_id`, o venidas de `ramales[].alerta[]`) aportan como máximo `demorada`; solo las alertas **de línea** (sin `ramal_id`, de `gerencias[].alerta[]`) y su `estado.mensaje` pueden ponerla en `interrumpida`. Un ramal cortado (por ejemplo un regional con obras) no apaga la línea entera mientras los demás andan. Después `estadoDe`: interrumpida, demorada o normal.
- **`resumen`:** el `titulo` de la alerta más severa, aunque sea de un ramal; si es de un ramal se antepone su nombre («Constitución-Lobos: El servicio Cañuelas - Lobos se encuentra interrumpido…»). Si el `estado.mensaje` es más severo que todas las alertas (o no hay alertas y el mensaje no es informativo), el `estado.mensaje`. Sin nada de eso, no va.
- **`alertaIds`:** todas las alertas vigentes de la línea y sus ramales, en el orden de arriba.
- **`ramales`:** los ramales con `publico: true`, ordenados por `orden_ramal`. Estado de cada uno = máxima severidad entre sus alertas **propias sin tope** (un ramal sí puede estar `interrumpida`) y las alertas de la línea que no son de un ramal. Sus `alertaIds` son las propias primero y después esas de la línea.

Con la fixture real del 2026-11-05 a las 08:56: **Roca `demorada`** (el ramal Constitución-Lobos, alerta «Cañuelas - Lobos interrumpido por obras», está `interrumpida`, pero los otros 11 ramales andan; antes de este ajuste la línea entera salía `interrumpida`), **Sarmiento `demorada`** (Moreno-Mercedes, `SIGNIFICANT_DELAYS`), **Belgrano Sur `demorada`** («recorrido limitado» en M.C.G. Belgrano), y Mitre, San Martín y Tren de la Costa `normal` (`test/adapters/trenes.test.ts`). El detalle por ramal está en `ramales`; el nombre del ramal más afectado va al comienzo del `resumen`.

## Degradación

| Situación                                                                                            | `estadoLineas()`                                                                                    | `alertas()`                                     | `arribos()`                    |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------ |
| `gerencias` caída y sin último dato bueno (o cuerpo que no es de la fuente, como el 500 «Not Found») | **200** con las 6 líneas en `sin_datos`, `ramales: []`, `meta.stale: true`, `sourceTimestamp: null` | **503** `upstream_unavailable`                  | —                              |
| `gerencias` bien, algún `ramales` caído                                                              | Esa línea con `ramales: []` y estado solo por sus alertas de línea; `meta.stale: true`              | Las alertas de lo que llegó; `meta.stale: true` | —                              |
| Dato servido como último bueno                                                                       | `meta.stale: true`                                                                                  | `meta.stale: true`                              | `meta.stale: true`             |
| Arribos caídos y sin último dato bueno                                                               | —                                                                                                   | —                                               | **503** `upstream_unavailable` |

`meta.sourceTimestamp` de estado y alertas es **cuándo se leyó `gerencias`** (la fuente no informa la hora del dato). En arribos, el `timestamp` de la respuesta.

**Kill-switch:** con `TRENES_ENABLED` distinto de `"true"`, `estadoLineas()` responde 200 con las 6 líneas en `sin_datos`, `ramales: []` y `meta.stale: true`, y `alertas()` y `arribos()` lanzan `ApiError('upstream_unavailable', 'Trenes no disponible por ahora', 503)`. No se hace ningún pedido a la fuente.

## Arribos (`arribos(estacionId)`)

`estacionId` es el `id_estacion` de SOFSE (Retiro LGM `332`, Caballito `50`). Por cada `result`:

- **`linea`:** `servicio.gerencia.id` → `lineaDeGerencia` (si no es de las seis, se descarta).
- **`sentido`:** `servicio.sentido` como string. `1` va hacia la cabecera final del ramal y `2` hacia la inicial (verificado: en Caballito, ramal Once-Moreno, el sentido 1 va a Moreno). **`destino`** = nombre de esa cabecera.
- **`horaProgramada`** = `llegada.programada` o, si falta, `salida.programada` (en las terminales `llegada` viene vacío). **`horaEstimada`** = `llegada.estimada` o `salida.estimada`, si hay.
- **`enSegundos`** = (estimada si hay, si no programada) − `now`, redondeado. Se descartan los de menos de −30 s y se ordenan por `enSegundos`.
- **`anden`** = `arribo.anden.nombre` (no siempre viene); **`cancelado`** = `servicio.cancelacion` no nulo; **`servicioId`** = `servicio.id` (uuid).

`results: []` responde **200 con `arribos: []`**: la fuente devuelve lo mismo para una estación inexistente (`999999`) que para una estación sin trenes, así que no hay forma de distinguirlas (no hay 404).

## Supuestos verificados con las fixtures (2026-11-05)

- **Fechas de arribos:** los ISO vienen con `Z` y **son UTC reales**. En las 16 muestras, `arribo.segundos` coincide con `estimada − timestamp` (o `programada − timestamp` si no hay estimada) con ±3 s. Ejemplo: Retiro, `timestamp` 11:57:10Z, `salida.programada` 12:10:00Z y `segundos` 770. Si alguna vez llegaran sin offset, `parseIsoArribo` las toma como hora de Buenos Aires.
- **Fechas de alertas:** `vigencia_desde`/`vigencia_hasta` (`2026-11-05 08:32:00`) son **hora de Buenos Aires sin offset**. Se interpretan con `-03:00`: Argentina no tiene horario de verano desde 2009. La alerta 99285, con `vigencia_hasta` 09:36, era la de un tren de las 08:42 cancelado. `alertas()` las devuelve en UTC (`2026-11-05T11:32:00.000Z`).
- **`efecto_gtfs`:** en las 17 alertas de la captura llega **como nombre** (`OTHER_EFFECT` y `SIGNIFICANT_DELAYS`), nunca como número. El esquema acepta las dos formas por las dudas.
- **`criticidad_orden`:** valores 2, 3 y 4. Las informativas tienen 4, el tren demorado 3 y el cancelado 2: menor = más crítico. Solo se usa para ordenar; la severidad sale del efecto y el texto.
- **`habilitado`:** siempre `1` en la captura.
- **`estado.mensaje`:** «Alertas por ramal» en las 7 gerencias.
- **Paths desconocidos:** la fuente responde 500 con el texto «Not Found». La capa A lo trata como un 5xx (reintentable) y, sin último dato bueno, el adaptador degrada como arriba.
