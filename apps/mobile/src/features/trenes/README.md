# features/trenes

Trenes metropolitanos de SOFSE (Fase 6, tarea 6.4): estado por línea y por ramal, alertas, estaciones y arribos por destino. Briefs: [`docs/briefs/07-trenes.md`](../../../../../docs/briefs/07-trenes.md) (suposiciones S34–S42) y el contrato de superficie [`.impeccable/surfaces/src-features-trenes-trenesscreen-tsx.md`](../../../.impeccable/surfaces/src-features-trenes-trenesscreen-tsx.md). Colores e insignias: [`docs/02c-colores-trenes.md`](../../../../../docs/02c-colores-trenes.md). Rutas finas en `src/app/(tabs)/trenes/`.

La app nunca llama a la fuente de trenes: solo al Worker (`/v1/trenes/*`) vía `shared/api` (`useEstadoTrenes`, `useAlertasTrenes`, `useArribosEstacionTren`). El estático sale del paquete en R2 (`trenes-lineas.json`, `trenes-estaciones.json`) con `useStaticArchivo`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `model.ts` | Funciones puras: `buildRedTrenes`, estado de línea, ramal y estación, alertas por línea, ramal y estación, búsqueda, `agruparArribosTren`, `arribosTrenVigentes`, `demoraDe`, nombres y siglas (tests en `__tests__/model.test.ts`) |
| `hooks.ts` | `useRedTrenes`, `useLineasTrenConEstado`, `useLineaTrenDetalle`, `useRamalDetalle`, `useEstacionTrenDetalle` |
| `components.tsx` | `LineaTrenBadge` (insignia con siglas), `AlertaTren` (alerta completa con sentido y vigencia), `Riel` (trazo de recorrido) |
| `deps.ts` | Lo que se reutiliza de Subtes (`ScreenScroll`, `EstadoBoard`, `RefreshErrorAlert`, `Rotulo`, `tonoNota`, `useFondo`, `AvisoAlert`, `estadoBanda`, `usePullToRefresh`): un solo punto de entrada para mudarlo a `shared/ui` en la tarea 6.8 |
| `TrenesScreen.tsx`, `LineaTrenScreen.tsx`, `RamalScreen.tsx`, `EstacionTrenScreen.tsx` | Las cuatro pantallas |

## Brief operativo («Señalética de terminal», modo Operate)

Mismo mundo que Inicio y Subtes: fondo `bg.elevated` en claro y `bg.base` en oscuro (`useFondo()`), placas blancas, bandas azules, Fira Sans, 12 pt entre bloques; header, large title, gesto de volver y controles nativos. Lo que cambia respecto de Subtes: la línea es una **insignia rectangular** con las siglas (R, S, M, SM, BS, TC) y el trazo del ramal lleva el color de la línea.

**Raíz** (`TrenesScreen`): large title «Trenes»; `SearchInput` «Buscá una estación» (filtra el estático sin red; resultados en placa con la insignia de la primera línea, el nombre y sus líneas). Las 6 líneas en **una** placa (`trenes-lineas`) en orden fijo Roca, Sarmiento, Mitre, San Martín, Belgrano Sur, Tren de la Costa: insignia de 32 (borde decidido contra `bg.card`), «Línea Roca» 17/600, debajo las cabeceras si tiene un solo ramal («Maipú – Delta») o «12 ramales», el `resumen` como nota del color del estado y `EstadoBoard` a la derecha; flecha → `/trenes/[linea]`. `FreshnessLabel` al pie. **Sin placa de mapa** (S34).

**Línea** (`LineaTrenScreen`): título nativo «Línea Sarmiento». Banda `lead` **fija** (sin flecha) con pictograma `tren`, «Línea Sarmiento · 4 ramales» y el estado en escala texto (con el resumen junto al cuadrado si hay problema). «Alertas»: las de la línea que **no** apuntan a un ramal (las de ramal se ven en el ramal), cada una completa con su vigencia («Hasta el 6/11 a las 01:13»), o «Sin novedades informadas». Placa «Ramales»: nombre («Once – Moreno»), las cabeceras (o la cantidad de estaciones si el nombre ya las dice), el estado del ramal y flecha → ramal. **Sin estrella**: se guarda el ramal o la estación, nunca la línea (S37).

**Ramal** (`RamalScreen`): título nativo «Once – Moreno»; estrella `FavoriteToggle tipo="ramal_tren"` en `headerRight` (guarda nombre «Once – Moreno» y subtítulo «Línea Sarmiento»). Banda `lead` fija con «Once – Moreno · Línea Sarmiento» y el estado del ramal (si la línea vino sin ramales, «Sin información»: no se inventa con el de la línea). Alertas del ramal (las de un sentido empiezan con «Hacia Moreno:», S39) y después las de la línea sin ramal. Placa «Estaciones» en orden de recorrido con el **riel** del color de la línea; las que figuran en el ramal pero no operan en él dicen «Sin servicio en este ramal» y no abren (brief §3).

**Estación** (`EstacionTrenScreen`): título nativo con el nombre; estrella `tipo="estacion_tren"` (subtítulo = sus líneas). Una fila de contexto por línea (insignia + «Línea Sarmiento», toca → la línea). Si algún ramal de la estación está interrumpido, `Alert` danger arriba. Alertas de la estación y de sus ramales. Después, **una banda `lead` fija por destino** (las 2 con el tren más próximo; el resto en la placa «Otros destinos»): pictograma `estacionTren`, «Hacia Moreno», «Próximo», el minuto a 56 pt (`round(enSegundos / 60)`, «Ahora» con menos de 60 s) y como estado muted, en líneas: «Andén 3 · Ramal Once – Moreno», «Después 7 y 12 min» (o «Único informado»), «Programado 11:26» si la demora es ≥ 2 min (S38) y «1 cancelado» si hubo cancelados antes. `transitionKey` = `${destino}:${minuto}`: cuando cambia el próximo tren la banda cruza en fundido de 200 ms (corte seco con Reducir movimiento). `FreshnessLabel` al pie.

| Estado | Raíz | Línea / Ramal | Estación |
|---|---|---|---|
| Carga sin caché | `Board.Skeleton` de 6 filas | Silueta: banda `lead` + placa | 2 `SignBand.Skeleton` `lead` (el nombre ya está en el título) |
| Vacío | Búsqueda sin resultados: «No encontramos «X». Probá con otro nombre de estación.» | Línea o ramal inexistente: `EmptyState`; sin alertas: «Sin novedades informadas» | Sin arribos: «No hay próximos trenes informados para esta estación.»; estación inexistente: `EmptyState` |
| Error sin datos | Las 6 filas en «Sin información» + `ErrorState` con reintento: «El servicio de trenes no responde en este momento.» | `ErrorState` en alertas; banda en «Sin información» | `ErrorState` en lugar de las bandas, con reintento |
| Fuente caída (200 con todo `sin_datos`: sin caché en el Worker o `TRENES_ENABLED=false`) | Las 6 filas en «Sin información» + aviso «La fuente de datos de trenes no responde.»; **nunca** «Normal» (S42) | Ramales en «Sin información» | — |
| Error con datos | Alert «No pudimos actualizar. Mostramos lo último que sabemos.» + «Reintentar» | ídem | ídem |
| Dato viejo | `FreshnessLabel` en warning | ídem | > 10 min: cada destino dice «Dato de hace N min» y «Puede no reflejar la situación actual» (S30) |
| Tren cancelado | — | — | No cuenta como próximo; si es el único de su destino, el destino dice «Cancelado» (S40) |
| Sin conexión | `OfflineBanner` global + lo persistido | ídem | ídem |
| Sin permiso de ubicación | No aplica: Trenes nunca pide ubicación | — | — |

### Decisiones de esta ola (lo que el brief dejaba abierto)

1. **Bandas por destino.** El agrupado es por `destino` (la cabecera hacia la que va el tren), no por ramal: dos ramales que van a Once comparten «Hacia Once». La banda nombra el ramal y el andén del próximo. Caben **2 bandas**; el resto de los destinos baja a la placa «Otros destinos» con el tiempo a la derecha (propuesta del contrato, a validar con Dynamic Type grande). El orden es por el primer tren de cada destino, cancelados incluidos.
2. **Insignias.** `LineBadge kind="tren"`: rectángulo redondeado (radio 8, como el de colectivo) con las siglas y los colores del estático; borde `text.primary` cuando el color da < 3:1 contra la superficie donde se apoya (en la raíz y los resultados, `bg.card`; en la estación, `bg.elevated`). La estación con varias líneas muestra una fila de contexto por línea.
3. **Estado «Normal».** La columna de estados usa las etiquetas de `STATUS` como Subtes («Normal», «Con demoras», «Interrumpida», «Sin información»); el contrato habla de «Sin novedades» para el normal, que queda para la revisión de cierre.
4. **Alertas de estación.** Se muestran las que nombran a la estación y las de sus ramales; las generales de la línea (hoy la del CUD en las seis) no se repiten en cada estación: están en la línea y el ramal.
5. **Estado de una estación** (banda de favorito): el peor de los ramales que la sirven.
6. **Belgrano Norte y Urquiza**: no tienen fuente; la raíz no dice nada todavía (decisión abierta del contrato).

### Pendiente

- **Tira «Trenes ahora» en Inicio:** fuera de esta fase (contrato, «Decisiones abiertas»). Inicio solo muestra favoritos de ramal y de estación como bandas.
- Mover a `shared/ui` lo que se reutiliza de Subtes (`deps.ts`) y el `Riel` (tarea 6.8).
- Mapa de trenes y posición del tren (la fuente trae `location` por servicio): fase posterior.

### Contraste

Los pares de placa, banda y nota son los de Subtes (`features/subtes/README.md`). Los de las insignias están en `docs/02c-colores-trenes.md` §3: el texto de cada insignia pasa AA (≥ 5,69:1) y el borde se agrega solo donde el color no llega a 3:1 contra la superficie (Roca, Mitre y San Martín en claro; Tren de la Costa en oscuro). El riel de Tren de la Costa en oscuro (1,31:1 contra la placa) lleva contorno `text.primary`.
