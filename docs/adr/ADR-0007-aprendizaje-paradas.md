# ADR-0007 — Dónde corre el aprendizaje de paradas en producción

- **Estado:** Propuesta (2026-11-02). La confirma el usuario.
- **Origen:** ADR-0006 (tabla de equivalencias `stop_id` → parada BA, decisión 2 y "Consecuencias": "hay que operar un job de aprendizaje"). Método: `tools/gtfs/README.md`, "Equivalencias `stop_id` → parada". Captura: `tools/captura-posiciones/`.

## Contexto

La tabla de equivalencias publicada en el paquete estático (`equivalencias-paradas.json` e `indice-colectivos.json`) mejora con capturas de `vehiclePositions`. En cada pasada de un vehículo (cuando informa el siguiente `stop_id`), las capturas votan por la parada BA de esa línea que quedó en el tramo recorrido. Hoy esto se corre a mano: `tools/captura-posiciones` en una máquina local y `tools/gtfs` (`npm run build`) para generar el paquete. Hay que decidir dónde corre esto en producción.

**Cobertura actual** (`tools/gtfs/README.md`, build de referencia `14e3950b001f`):

| Captura acumulada | `stop_id` aprendidos | Predicciones de `tripUpdates` con parada BA | Sin ubicar | De las ubicadas en CABA, con parada |
|---|---:|---:|---:|---:|
| Sin capturas (solo semilla GTFS 2021) | 0 | 14,2 % | 60,8 % | 75,1 % |
| ~19 min | 1.497 | 16,3 % | 56,7 % | 74,6 % |
| ~30 min | 2.893 | 17,8 % | 53,0 % | 75,5 % |
| ~74 min (65 snapshots, 346 mil lecturas) | 8.092 | 21,1 % | 40,0 % | 78,9 % |

- Las predicciones son de todo el AMBA: el 33 % cae fuera de CABA y se descarta a propósito. La métrica que importa para la app es la última columna, más la caída de "sin ubicar".
- **Calidad:** donde hay semilla y aprendizaje, coinciden en el 86,7 % (2.256 casos). Las capturas ya corrigieron 118 semillas con IDs reasignados.
- Para comparar, el cruce espacial de la Fase 1 daba 69,5 % (`docs/01b-gtfs-alternativos.md` §3).

**Qué esperamos con 48 h** (estimación a confirmar con la captura de 24–48 h ya en curso): en 74 minutos el aprendizaje ya ubica 8.092 `stop_id` de los ~22 mil que aparecen en las capturas. Con dos días, incluidos picos, noches y un fin de semana, cada `stop_id` con servicio recibe decenas de pasadas. Esperamos:

- **"Sin ubicar" por debajo del 15 %**, limitado por `stop_id` de ramales con muy pocos vehículos o que no informan `stop_id`;
- **≥ 80 % de las predicciones en CABA con parada BA**, limitado por paradas que no están en el dataset BA o que quedan a más de 40 m.

Después de 48 h, la ganancia por día adicional debería ser chica. El valor de seguir capturando es **detectar cambios**: paradas nuevas `S…`, `stop_id` reasignados y recorridos modificados.

**Restricciones medidas:**

- **Volumen de la captura:** ~9,4 MB de CSV gzip cada ~75 min, es decir ~180 MB por día y ~360 MB por 48 h. Leerla en `tools/gtfs` tarda ~5 s por cada ~350 mil lecturas en una Mac (`tools/gtfs/README.md`).
- **CPU en Workers Free:** 10 ms por invocación, también en Cron Triggers (`docs/04-escalabilidad.md` §9). Decodificar el `vehiclePositions` completo (590 KB) cuesta ≈ 4–16 ms medido en Node, así que un cron que decodifica y acumula queda al límite o lo pasa. Votar requiere estado por vehículo entre minutos.
- **GitHub Actions:** un job dura como máximo 6 h, así que no puede capturar 48 h seguidas. En un repo privado, el plan gratuito da 2.000 minutos por mes: capturar de forma continua con Actions (≈ 43.000 min/mes) no entra.

## Opciones

| | Opción | Costo | Pros | Contras |
|---|---|---|---|---|
| **a** | **Job programado offline** (local o GitHub Actions): corre `tools/captura-posiciones` + `tools/gtfs` y sube el paquete a R2 con `upload-r2.sh` | USD 0 de Workers. Actions: unos minutos por corrida de procesamiento | Reutiliza tal cual las herramientas probadas (tests, contratos, sha256 en el manifiesto). Sin presión de CPU. El paquete se versiona y es reproducible | La **captura** necesita algo que esté prendido de forma continua (ver abajo). El paquete se actualiza por lotes (semanal), no en tiempo real |
| **b** | **Cron Trigger de Workers cada 60 s** que decodifica y acumula votos en R2/D1 | Free: ~1.440 invocaciones/día (a verificar si cuentan para las 100 k/día); D1/R2 dentro del gratuito | Todo en Cloudflare, sin máquina propia | El CPU por invocación (10 ms en Free) no alcanza para decodificar y votar el feed completo. El estado entre minutos (última lectura de cada vehículo) obliga a leer y escribir D1/R2 en cada tick. Habría que reescribir en el Worker la lógica que hoy está en `tools/gtfs` |
| **c** | **Durable Object de la capa B** (`FeedHub`, ADR-0005), que ya va a recibir el feed una vez por TTL | En Paid: CPU de la alarm (30 s) y GB-s del DO (`docs/04-escalabilidad.md`) | El feed ya está decodificado en memoria. El estado por vehículo vive naturalmente en el DO. Aprendizaje continuo sin job aparte | La capa B no existe todavía (Fase 5). Un DO residente 24 h no entra en Free. Mezcla en el camino caliente una tarea batch |

## Decisión (propuesta)

**MVP: opción (a)**, con la captura separada del procesamiento:

1. **Procesamiento y publicación: GitHub Actions `schedule` semanal** (por ejemplo, lunes 06:00 UTC, más `workflow_dispatch`):
   - baja las capturas de los últimos 7 días;
   - corre `pnpm install` y `tools/gtfs` (`npm ci && npm test && npm run build`), que valida contra los contratos y falla si algo no cumple;
   - sube el paquete con `upload-r2.sh`. `latest/manifest.json` se sube al final, así que una corrida fallida no publica nada.

   Los secrets van en GitHub Actions (`CLOUDFLARE_API_TOKEN` con permiso R2 y, si la captura los necesita, `GCBA_CLIENT_ID`/`GCBA_CLIENT_SECRET`): **nada de credenciales en el repo**. Las entradas fijas (CSV de paradas BA, zips GTFS) se bajan con caché de Actions o desde R2. El resumen de estadísticas (`out/last-build.json`) queda como artefacto de la corrida.
2. **Captura continua:** el job semanal no puede capturar (máximo 6 h por job). Para el MVP hay dos caminos, en orden de preferencia:
   - **Cron Worker mínimo de captura** (`tools/captura-worker`, a escribir): cada 60 s pide `vehiclePositions` completo y lo guarda **crudo, sin decodificar**, en R2 (`capturas/AAAA-MM-DD/HHMM.pb`). No decodifica ni vota, así que el CPU es casi nulo (el fetch y el `put` son I/O). Con una regla de ciclo de vida de 8 días en R2, el almacenamiento queda en ~5 GB: protobuf crudo ≈ 590 KB × 1.440 por día, dentro de los 10 GB-mes gratuitos. `tools/gtfs` agregaría un lector de `.pb` crudos además de los CSV de `tools/captura-posiciones`.
   - **Alternativa sin Workers:** seguir con `tools/captura-posiciones` en una máquina siempre prendida (una VM chica o un runner autoalojado) que sube los CSV del día a R2. Funciona hoy sin código nuevo, pero depende de una máquina propia.
3. **Evolución: opción (c)** cuando exista la capa B. El `FeedHub` de colectivos ya va a tener cada snapshot decodificado; acumular las transiciones por vehículo en su estado y volcar los votos a R2 una vez por hora es casi gratis en CPU. En ese momento el job semanal solo consolida y publica, y el Cron Worker de captura se apaga.

**Descartada para el MVP: (b).** El límite de CPU de Free no deja decodificar y votar en el Worker, y duplicaría en Workers la lógica de `tools/gtfs`, que hoy está testeada contra los contratos.

## Consecuencias

- (+) Costo de Workers ≈ 0 en el MVP. El paquete sigue siendo reproducible, validado contra los contratos y versionado por sha256.
- (+) La lógica de aprendizaje vive en un solo lugar (`tools/gtfs`), con tests.
- (−) Las equivalencias se actualizan una vez por semana. Una parada nueva tarda hasta una semana en tener arribos: aceptable, porque la app oculta los arribos donde no hay equivalencia (ADR-0006).
- (−) Hay que escribir y operar el Cron Worker de captura (o mantener una máquina) y vigilar que la captura no tenga huecos. El README de `tools/gtfs` documenta con cuánta captura se generó cada build.
- (−) El job semanal necesita `CLOUDFLARE_API_TOKEN` con escritura en R2, y posiblemente las credenciales del GCBA, como secrets de Actions. Hay que rotarlos y no imprimirlos en logs (`upload-r2.sh` no los imprime).
- **Revisar** este ADR si la captura de 48 h no confirma la estimación de cobertura, o cuando la capa B esté implementada.
