# 01d — Trenes: la fuente comunitaria de SOFSE

> Fase 6, tarea 6.2. Fecha de verificación: **2026-11-05**.
> Estado: **fuente evaluada y aceptada con riesgos conocidos** (decisión del usuario, 2026-11-05). No es una fuente oficial ni tiene garantías: este documento dice qué es, qué devuelve, cómo puede fallar y cómo salimos si falla. El lado de código (adaptador, contratos, rutas) lo documenta `06-proxy.md` cuando exista.

## 1. Por qué hace falta una fuente aparte

No hay trenes en la API de Transporte del GCBA ni en sus alternativas oficiales (ver también `01-api-transporte.md` y `01c-portal-datosabiertos-apis.md`):

| Candidato | Resultado (2026-11-05) |
|---|---|
| API de Transporte del GCBA, `/trenes/*` | **404**. El RAML no tiene un recurso de trenes. |
| GTFS estático de trenes del GCBA (`cdn.buenosaires.gob.ar/datosabiertos/datasets/trenes-gtfs/trenes-gtfs.zip`) | Es de **2020** (calendario de 2020-02 a 2020-04) y no trae `route_color`. Sus `route_id` sí coinciden con los ids de ramal de SOFSE. No tiene tiempo real. |
| `datos.gob.ar`, «Estaciones de trenes y servicios activos a 2022» (CC BY 4.0, actualizado 2026-08) | Solo geometría de estaciones y servicios: sin horarios, estado ni arribos. |
| API oficial de Trenes Argentinos (SOFSE) | **No se publica** como API abierta. La app oficial usa una API interna (`api-servicios.sofse.gob.ar/v1`) con login propio. |

La única fuente con estado de línea, ramales, estaciones y arribos en tiempo real es esa API interna, que una persona expone públicamente a través de un proxy comunitario.

## 2. Qué es la instancia

- **Instancia pública:** `https://ariedro.dev/api-trenes`. Es un servicio **personal y no oficial**.
- **Código:** `github.com/ariedro/api-trenes` (licencia **WTFPL**, 28 estrellas, creado en 2022). Último commit **2025-11-21**, «fix: update cipher». Proxy Express de una sola persona.
- **Documentación:** `https://trenes.sofse.apidocs.ar/` la escribió **un tercero** (Enzo Notario) y no tiene esquemas ni ejemplos de respuesta: los campos de la sección 5 salen de respuestas reales, no de ahí.
- **Qué NO tiene:** términos de uso, SLA, límite de pedidos declarado ni autenticación. Responde con CORS `*`.
- **Relación con SOFSE:** ninguna. SOFSE (Trenes Argentinos Operaciones) no avala ni mantiene esta instancia.

### Cómo funciona el login que reproduce

La API interna de SOFSE exige un token que la app oficial obtiene con un login que no es un secreto de cada persona:

1. El usuario se arma con la **fecha del día** codificada en base64 más la palabra «sofse».
2. La clave es **ese mismo usuario pasado por un cifrado de sustitución** que el autor sacó del APK descompilado de la app oficial (la explicación está en su blog, `ariedro.dev/3-hack-trains-api/`; el autor invoca la ley 27.275 de acceso a la información pública).
3. Con ese login se pide el token y se llama a la API de SOFSE.

Este documento **no reproduce el cifrado** ni lo vamos a implementar nosotros: el usuario decidió no tener un token propio (sección 7), y la prueba directa contra SOFSE quedó afuera del alcance. Lo que importa para el riesgo: **toda la instancia depende de que ese cifrado siga siendo el vigente**. Ya rotó al menos una vez (noviembre de 2025, el commit de arriba); cuando rota, el servicio se cae hasta que el autor lo arregla.

## 3. Cobertura

6 líneas de SOFSE en el área metropolitana (los `id` son los de `gerencias`):

| Línea | `idGerencia` | Ramales públicos |
|---|---:|---:|
| Roca | 11 | 12 |
| Sarmiento | 1 | 4 |
| Mitre | 5 | 5 |
| San Martín | 31 | 2 |
| Belgrano Sur | 21 | 3 |
| Tren de la Costa | 41 | 1 |

- **27 ramales públicos** y unas **300 estaciones** con latitud y longitud: la red completa que opera SOFSE, no solo CABA.
- «Regionales» (`idGerencia` 501) aparece en `gerencias` pero **no tiene ramales**; no se incluye.
- **No cubre Belgrano Norte (Ferrovías) ni Urquiza (Metrovías):** son concesiones privadas fuera de SOFSE. Trenes dice esto en la app (decisión abierta en el brief, `briefs/07-trenes.md`).

## 4. Qué sabemos y qué no

Verificado en vivo el 2026-11-05 con pedidos GET desde una Mac (no desde un Worker):

- **Latencia:** 1,3 a 2,5 s por pedido (el proxy comunitario encadena su login con la API de SOFSE).
- **Tamaños:** arribos de Retiro (13 trenes) **106 KB**; Caballito (4 trenes) **42 KB**. Cada servicio trae su itinerario completo (`desde`, `hasta`, `estaciones`), que es casi todo el peso: ≈ 8–10 KB por tren. Nosotros recortamos en el Worker (< 3 KB con `cantidad=8`).
- **Un path desconocido** responde **500** con «Not Found» (no 404): el adaptador no puede confiar en el código de estado para distinguir «no existe» de «se cayó».
- **No medido:** disponibilidad a lo largo del tiempo, comportamiento bajo carga, horario de mantenimiento, ni qué pasa cuando SOFSE tiene la API caída (más allá de la rotación del cifrado).

## 5. Endpoints

Base: `https://ariedro.dev/api-trenes`. Todos son `GET` y devuelven JSON. Los ejemplos están recortados de respuestas reales del 2026-11-05 (sin los campos pesados).

### 5.1 `/infraestructura/gerencias?idEmpresa=1` — líneas con su estado

Devuelve un arreglo de 7 elementos (6 líneas + Regionales). Campos:

| Campo | Tipo | Nota |
|---|---|---|
| `id` | número | `idGerencia` de la línea |
| `id_empresa` | número | siempre `1` acá |
| `nombre` | texto | «Roca», «San Martín», «Tren de la Costa»… |
| `estado` | `{ id, mensaje, color }` | **Hoy siempre `13` / «Alertas por ramal» / `#435a6c`** en las 7 líneas: no es un estado operativo útil. El estado de la línea se deriva de las alertas (reglas en `briefs/07-trenes.md`). |
| `alerta[]` | arreglo | alertas de **línea** (`ramal_id` y `estacion_id` en `null`) |

Cada alerta (mismo formato en gerencias, ramales y estaciones):

| Campo | Nota |
|---|---|
| `id`, `linea_id`, `ramal_id`, `estacion_id`, `sentido` | `null` cuando la alerta no apunta a ese nivel; `sentido` es texto `"1"`/`"2"` |
| `causa_gtfs`, `efecto_gtfs` | Enumeraciones al estilo GTFS-RT (`OTHER_CAUSE`, `OTHER_EFFECT`, y las demás). Hoy casi todo es `OTHER_*` |
| `contenido` | Texto libre en español, a veces con espacios al final |
| `habilitado` | `1`/`0` |
| `vigencia_desde`, `vigencia_hasta` | `YYYY-MM-DD HH:mm:ss` **sin zona** (hora de Argentina, a confirmar); `vigencia_hasta` puede ser `null` |
| `criticidad_orden` | Orden de severidad (el `4` de los ejemplos es el informativo) |
| `criticidad_color_fondo`, `criticidad_color_texto` | Colores de la alerta en la app oficial; no los usamos |
| `icono_fontawesome` | Ícono de la web; no lo usamos |

```json
{
  "id": 11,
  "id_empresa": 1,
  "nombre": "Roca",
  "estado": { "id": 13, "mensaje": "Alertas por ramal", "color": "#435a6c" },
  "alerta": [
    {
      "id": 98433,
      "linea_id": 11,
      "ramal_id": null,
      "estacion_id": null,
      "sentido": null,
      "causa_gtfs": "OTHER_CAUSE",
      "efecto_gtfs": "OTHER_EFFECT",
      "contenido": "Las personas con CUD pueden viajar en tren sin costo con SUBE. …",
      "habilitado": 1,
      "vigencia_desde": "2026-10-13 00:01:00",
      "vigencia_hasta": null,
      "criticidad_orden": 4
    }
  ]
}
```

### 5.2 `/infraestructura/ramales?idGerencia=<id>` — ramales de una línea

Arreglo de ramales. Campos usados:

| Campo | Nota |
|---|---|
| `id`, `nombre`, `siglas` | `id` = `ramalId` del contrato; «Once-Moreno», `OM` |
| `id_gerencia` | la línea |
| `id_estacion_inicial`, `id_estacion_final` | ids de las cabeceras |
| `cabecera_inicial`, `cabecera_final` | `{ id, nombre, siglas, nombre_corto, visibilidad }`; `visibilidad` es un **texto JSON** (`"{\"totem\": \"1\", \"app_mobile\": \"1\"}"`) |
| `estaciones` | cantidad de estaciones (`16` en Once-Moreno) |
| `operativo`, `publico`, `es_electrico`, `orden_ramal` | flags y orden; filtramos por `publico` |
| `alerta[]` | alertas de **ramal**; `sentido` `"1"` = hacia la cabecera final, `"2"` = hacia la inicial (deducido del texto de las alertas; a confirmar) |

```json
{
  "id": 1,
  "nombre": "Once-Moreno",
  "siglas": "OM",
  "id_gerencia": 1,
  "id_estacion_inicial": 293,
  "id_estacion_final": 278,
  "estaciones": 16,
  "publico": true,
  "cabecera_inicial": { "id": 293, "nombre": "Once", "nombre_corto": "Once" },
  "cabecera_final": { "id": 278, "nombre": "Moreno", "nombre_corto": "Moreno" },
  "alerta": [
    {
      "id": 99144,
      "linea_id": 1,
      "ramal_id": 1,
      "estacion_id": null,
      "sentido": "1",
      "contenido": "Hasta el 6/11 de lunes a sábados el último tren Once - Moreno partirá a las 23:02 h por obras.",
      "vigencia_desde": "2026-11-01 00:53:00",
      "vigencia_hasta": "2026-11-06 01:13:00"
    }
  ]
}
```

### 5.3 `/infraestructura/estaciones?idRamal=<id>` (o `?nombre=<prefijo>`) — estaciones

Arreglo de estaciones **en orden de recorrido** (`orden`). Los números vienen **como texto**, incluidas las coordenadas:

| Campo | Nota |
|---|---|
| `id_estacion` | texto; `estacionId` del contrato |
| `nombre` | «Once», «Caballito» |
| `orden`, `referencia_orden` | posición en el ramal |
| `latitud`, `longitud` | **texto** con 7 decimales |
| `andenes_habilitados` | cantidad de andenes (texto) |
| `incluida_en_ramales`, `operativa_en_ramales` | ids de ramal. Una estación sirve a varios ramales (Liniers está en cuatro) y puede estar incluida pero **no operativa** (Flores: incluida en 1 y 111, operativa solo en 1) |
| `visibilidad` | `{ totem, app_mobile }` |

```json
{
  "nombre": "Caballito",
  "id_estacion": "50",
  "orden": "1",
  "latitud": "-34.6192442",
  "longitud": "-58.4436522",
  "andenes_habilitados": "4",
  "visibilidad": { "totem": 1, "app_mobile": 1 },
  "incluida_en_ramales": [111, 1],
  "operativa_en_ramales": [111, 1]
}
```

Este endpoint no trae alertas. Las alertas con `estacion_id` no nulo **no aparecieron** en ninguna muestra (solo de línea y de ramal): no está verificado de dónde vendrían.

### 5.4 `/arribos/estacion/<id>?cantidad=N` — arribos en una estación

Un objeto `{ timestamp, total, results[] }`. `timestamp` es la hora del dato en **segundos Unix** (es el `sourceTimestamp` del contrato). Cada elemento de `results` tiene `arribo` (el paso por esta estación) y `servicio` (el tren):

| Campo | Nota |
|---|---|
| `arribo.llegada`, `arribo.salida` | `{ programada, estimada }` en ISO 8601 **UTC** (`…Z`). `estimada` falta cuando el tren no tiene posición; en la cabecera `llegada` es `{}` y `salida` puede traer `enAnden` (texto, por ejemplo «DENTRO DEL ANDEN dist: 61») |
| `arribo.segundos` | segundos hasta el paso, **medidos contra `timestamp`** |
| `arribo.anden` | `{ id, nombre }` |
| `arribo.parada` | `true` si el tren para |
| `servicio.ramal` | `{ id, nombre, tolerancia, cabeceraInicial, cabeceraFinal }` |
| `servicio.sentido` | `1` o `2`, como en las alertas |
| `servicio.cancelacion` | `null` o el dato de la cancelación; en las muestras siempre `null`, así que su forma **no está verificada** |
| `servicio.location` | `{ lat, long }` del tren (posición viva) |
| `servicio.tipo`, `servicio.leyenda`, `servicio.numero`, `servicio.equipo` | tipo de servicio (`Normal`), leyenda libre, número de servicio, formación |
| `servicio.desde`, `servicio.hasta`, `servicio.estaciones` | itinerario completo: **lo más pesado**; no se reenvía |

Recorte de una respuesta real de Caballito (2026-11-05), sin los campos pesados:

```json
{
  "timestamp": 1793878113,
  "total": 4,
  "results": [
    {
      "arribo": {
        "anden": { "id": 1476, "nombre": "1" },
        "nombre": "Caballito",
        "parada": true,
        "llegada": { "programada": "2026-11-05T11:26:15.000Z", "estimada": "2026-11-05T11:28:37.000Z" },
        "salida": { "programada": "2026-11-05T11:27:00.000Z", "estimada": "2026-11-05T11:29:22.000Z" },
        "segundos": 60
      },
      "servicio": {
        "numero": 3243,
        "ramal": {
          "id": 1,
          "nombre": "Once-Moreno",
          "cabeceraInicial": { "id": 293, "nombre": "Once" },
          "cabeceraFinal": { "id": 278, "nombre": "Moreno" }
        },
        "sentido": 1,
        "cancelacion": null,
        "location": { "lat": -34.617958, "long": -58.440979 }
      }
    }
  ]
}
```

Qué se ve en la muestra de Caballito: dos trenes en sentido 2 con la misma hora programada (11:26:15), uno estimado a las 11:32:08. La diferencia `estimada − programada` es la demora del tren (≈ 6 min). Los resultados mezclan ramales y sentidos: para armar un cartel por destino hay que agrupar por **ramal y sentido** y ordenar por `segundos` (es tarea del adaptador, no del upstream).

## 6. Riesgos

| Riesgo | Probabilidad / impacto | Qué hacemos |
|---|---|---|
| **Caída de la instancia** (servicio personal, sin SLA) | Media / Trenes queda sin datos | Estado `sin_datos`; la app muestra «Sin información», **no datos inventados**; último dato bueno marcado como viejo; el resto de la app no se afecta |
| **Rotación del cifrado** (ya pasó en nov 2025) | Media / caída hasta que el autor lo arregle (sin plazo conocido) | Es el mismo síntoma que la caída. **Kill-switch `TRENES_ENABLED`** en el Worker: en `false`, `/v1/trenes/*` responde `sin_datos` sin necesidad de una versión nueva de la app. Plan de salida (sección 7) |
| **Carga sobre un servidor personal** | Baja / nos pueden bloquear o la instancia se cae por culpa nuestra | Solo el Worker la consume (jamás la app); TTL de **60 s** para estado y alertas y de **30 s** para arribos; coalescing; ver `04-escalabilidad.md` §10. No hay rate limit declarado: ser buen vecino es decisión nuestra |
| **Legalidad y ausencia de términos de uso** | Baja–media / incierta | La instancia reproduce un login de la app oficial; el autor invoca la ley 27.275. No hay términos que cumplir ni garantías de que SOFSE lo tolere. **No implementamos el token nosotros** (decisión del usuario) para no sumar ese riesgo. Atribución honesta en Acerca de (texto en `PRODUCT.md`). Si SOFSE lo cierra, se desactiva con el kill-switch |
| **Cambio del formato** (campos nuevos, tipos que cambian) | Media / el adaptador falla | La fuente se aísla en un solo adaptador con validación Zod del upstream y fixtures reales: un cambio rompe un test, no la pantalla |
| **Dato incorrecto o viejo sin que lo sepamos** | Media / confianza | Las alertas son texto libre sin clasificación útil (`OTHER_EFFECT`): el estado se deriva con reglas conservadoras y nunca dice «Normal» sin datos; frescura siempre visible |
| **Latencia alta** (1,3–2,5 s) | Alta / experiencia | El proxy cachea; la app muestra el último dato y la frescura mientras refresca |
| **Cobertura parcial** | Cierta | Belgrano Norte y Urquiza no están: se dice en la app |

## 7. Plan de salida

La decisión es **depender de esto el menor tiempo posible**. Todo lo que sabe del upstream vive en dos archivos y una variable; el contrato `v1` de trenes no se toca si la fuente cambia.

| Qué cambia | Dónde | Qué hay que hacer |
|---|---|---|
| Aparece una **API oficial** de SOFSE o del GCBA | `apps/proxy/src/adapters/trenes/sofse.ts` (decodificación y mapeo) + `packages/contracts/src/upstream/sofse.ts` (esquemas Zod del upstream) + `TRENES_UPSTREAM_BASE` | Reescribir esos dos archivos contra la API nueva y apuntar la variable. Rutas, contrato `v1`, app, paquete estático y favoritos no cambian (los ids de ramal y estación son los de SOFSE) |
| La instancia comunitaria muere o rota el cifrado por mucho tiempo | La variable | (a) Esperar al autor, con `TRENES_ENABLED=false` mientras tanto; (b) apuntar `TRENES_UPSTREAM_BASE` a **otra instancia** del mismo proxy (es WTFPL: se puede alojar una propia, con el mismo contrato); (c) **token propio en el Worker** (login contra SOFSE desde el adaptador): requiere un cambio de capa A para aceptar `credentials` y una decisión nueva del usuario, porque suma el riesgo de la sección 6 |
| SOFSE bloquea o pide parar | `TRENES_ENABLED=false` | Se apaga sin publicar versión. La tab muestra «Sin información». Revisar si se quita la tab en la versión siguiente |
| Cambia solo el formato | `packages/contracts/src/upstream/sofse.ts` + fixtures | Actualizar el esquema y los fixtures, y el mapeo en `sofse.ts` |

Lo que **no** depende de la fuente y sobrevive a cualquier salida: el paquete estático de líneas, ramales y estaciones (`trenes-lineas.json`, `trenes-estaciones.json` en R2, ver `04-escalabilidad.md`), los favoritos de ramal y estación, los colores de línea (`02c-colores-trenes.md`) y toda la UI.

## 8. Decisiones de arquitectura que se derivan

Las implementa el proxy (Fase 6, tarea 6.1); se citan acá para que la evaluación y el código no se separen.

- **Aislamiento:** `apps/proxy/src/adapters/trenes/sofse.ts` + `packages/contracts/src/upstream/sofse.ts` + variable `TRENES_UPSTREAM_BASE`. Nada más conoce el formato.
- **TTL:** 60 s para estado y alertas (**7 requests** upstream por refresco: `gerencias` + una de `ramales` por cada una de las 6 líneas); 30 s para arribos (`cantidad=8`, recortados a menos de 3 KB).
- **Kill-switch** `TRENES_ENABLED`: en `false`, el estado es `sin_datos` y no hace falta una versión de la app.
- **Ids del contrato:** `LineaTrenId` por slug (`roca`, `sarmiento`, `mitre`, `san-martin`, `belgrano-sur`, `tren-de-la-costa`); `ramalId` y `estacionId` = id numérico de SOFSE, como texto.
- **Estático:** líneas, ramales y estaciones salen de un paquete generado por un paso `trenes` de `tools/gtfs` (a partir de los volcados de `tools/sofse-probe`), subido a R2 como `trenes-lineas.json` y `trenes-estaciones.json` (≈ 60 KB): la búsqueda de estaciones es local y no depende de la fuente.
- **Favoritos:** `FAVORITO_TIPOS` suma `ramal_tren` y `estacion_tren`; `schemaVersion` sigue en 1. Se guarda el **ramal** y la **estación**, no la línea (una línea tiene varios ramales).
- **Capa A:** acepta `credentials` opcional y una base distinta por adaptador (`03-arquitectura.md` §4): trenes es la primera fuente sin credenciales y con otra base.

## 9. Fuentes

- Repo de la instancia: `https://github.com/ariedro/api-trenes` (consultado el 2026-11-05).
- Blog del autor: `https://ariedro.dev/3-hack-trains-api/`.
- Documentación de terceros: `https://trenes.sofse.apidocs.ar/`.
- Muestras de respuestas reales del 2026-11-05 (gerencias, ramales de Sarmiento y Mitre, estaciones de Once–Moreno, arribos de Caballito y de Retiro): son la base de los ejemplos de arriba; los fixtures versionados los guarda el proxy en `apps/proxy/test/fixtures/` cuando se escriba el adaptador.
