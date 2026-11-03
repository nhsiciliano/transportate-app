# 11 — Prueba manual en el iPhone (Fase 4)

Guía para validar la Fase 4 con el dev client en el iPhone. Es una checklist: tildá cada casilla, y si algo no se ve como dice, andá al bloque [Qué anotar si algo falla](#qué-anotar-si-algo-falla). Lo que Jest no puede probar (mapa real, gestos, háptico, tab bar nativa, VoiceOver) está marcado con **📱**.

Las pantallas de Colectivos (raíz, parada, línea con mapa) todavía no están integradas en `main`: se describen según el brief ([`briefs/02-colectivos.md`](briefs/02-colectivos.md)) y están marcadas **(a confirmar cuando se integre)**.

## 0. Preparación

- [ ] **Dev client instalado** (build de EAS, perfil `development`). Si cambió alguna dependencia nativa en la fase (MapLibre, ubicación, Reanimated, Gesture Handler), hace falta un build nuevo; si no, abre el viejo y falla al arrancar.
- [ ] **Proxy local** (en `apps/proxy`, con `.dev.vars` completo; nunca se commitea):

  ```sh
  cd apps/proxy
  pnpm exec wrangler dev --ip 0.0.0.0 --port 8787
  ```

- [ ] **IP de la Mac:** `ipconfig getifaddr en0`. En `apps/mobile/.env` poné `EXPO_PUBLIC_API_URL=http://<IP-de-la-Mac>:8787`. Abrí `http://<IP-de-la-Mac>:8787/v1/health` desde Safari del iPhone: tiene que responder `ok`.
- [ ] **Metro:** en `apps/mobile`, `pnpm exec expo start --dev-client`. Dejá esa terminal a la vista: ahí salen los logs.
- [ ] iPhone y Mac en la **misma red Wi‑Fi**. Abrí el dev client y elegí el servidor de Metro.
- [ ] Primer arranque: se ve el splash con la marca y después **Inicio**, con las 4 tabs nativas (Inicio, Colectivos, Subtes, Favoritos). Sin pantalla roja.

### Cómo forzar cada estado

| Estado | Cómo se fuerza | Qué tendría que pasar |
|---|---|---|
| **Sin conexión** | Modo avión (Wi‑Fi apagado) | Banner "Sin conexión. Mostramos lo último guardado." arriba, una sola vez en toda la app |
| **Servicio caído / último dato** | Cortá `wrangler dev` (Ctrl+C) con la app abierta | El contenido se queda y aparece "No pudimos actualizar. Mostramos lo último que sabemos." con "Reintentar" |
| **Dato viejo (frescura)** | Ajustes → "Actualizar cada" → 15 s, y dejá el proxy apagado unos minutos | La etiqueta pasa de "Actualizado hace 12 s" a "⚠ Dato de hace N min" en color de advertencia |
| **Tema** | Ajustes → Tema: Sistema / Claro / Oscuro. Y en el iPhone, Ajustes → Pantalla → Oscuro | Cambia al instante; con "Sistema" sigue al teléfono |
| **Texto grande** | iPhone: Ajustes → Accesibilidad → Pantalla y tamaño de texto → Texto más grande → al máximo | Nada se trunca ni se superpone; las filas crecen en alto |
| **Reducir movimiento** | iPhone: Ajustes → Accesibilidad → Movimiento → Reducir movimiento | Sin pulsos de skeleton ni animación de cámara en el mapa; el `Snackbar` aparece sin fundido |
| **VoiceOver** | Triple clic al botón lateral (si lo configuraste) o Ajustes → Accesibilidad → VoiceOver | Ver los recorridos de la sección 8 |

> Volvé a encender el proxy y la conexión después de cada prueba de error: "Reintentar" y el pull to refresh tienen que recuperar solos.

## 1. Inicio

- [ ] **Large title:** "Inicio" grande arriba, que se achica al scrollear. El botón de engranaje "Ajustes" se ve y se toca fácil.
- [ ] **Estado del subte:** 7 filas (A, B, C, D, E, H, Premetro) con su color y su estado (Normal / Con demoras / Interrumpida). Tocar una abre la línea en la tab Subtes.
- [ ] **Alert destacada** si hay una línea interrumpida o con demoras (a veces no hay: depende del día).
- [ ] **Favoritos:** hasta 5, con su dato vivo, y "Ver todos (N)" si hay más.
- [ ] **Pull to refresh** (arrastrar hacia abajo): el indicador nativo, y los datos se actualizan.
- [ ] **Sin conexión / proxy apagado:** el contenido se queda; ver la tabla de estados. **📱 Banner offline sin hueco:** con modo avión, el banner ocupa el margen superior y el header de la pantalla no deja un espacio vacío extra debajo ni se duplica el margen de la barra de estado.
- [ ] **Sin favoritos:** el bloque de favoritos explica cómo agregarlos.

## 2. Subtes

### Raíz

- [ ] **📱 Large title** "Subtes" grande en iOS, que se achica al scrollear (usa `headerLargeTitleEnabled`).
- [ ] Siete líneas en orden fijo, con color oficial, cabeceras ("Plaza de Mayo – San Pedrito") y estado con ícono y texto (no solo color).
- [ ] **Buscador de estaciones:** escribí "med" → aparece Medrano; con tildes y sin tildes da lo mismo. Algo que no existe ("zzz"): "No encontramos «zzz». Probá con otro nombre de estación."
- [ ] **Ver mapa** lleva al mapa de la red (sección 2.4).
- [ ] Proxy apagado y sin caché (reiniciá la app con el proxy apagado): se listan igual las 7 líneas con "Sin información" y un `ErrorState` con "Volver a intentar".

### Línea

- [ ] Insignia grande, estado, estrella de favorito (44×44).
- [ ] **Alertas** completas (una por alerta) o "Sin novedades informadas".
- [ ] Diagrama de estaciones; tocar una estación abre su detalle.
- [ ] **Premetro:** una sola línea con sus dos ramales ("Ramal Centro Cívico").

### Estación

- [ ] Nombre, línea y estrella. Bloques "Hacia <cabecera>" con hasta 3 arribos ("Llegando", "2 min").
- [ ] **Arribos congelados:** si el upstream sigue con el dato viejo de octubre, se ve "Dato de hace N días" atenuado en lugar de tiempos (esto es lo esperado, no un error).
- [ ] **📱 Estrella:** tocar guarda en favoritos con un háptico de éxito suave; tocar de nuevo la quita con un háptico de selección. VoiceOver anuncia "Guardado en favoritos" / "Quitado de favoritos".

### 2.4 Mapa de la red

- [ ] **📱 Los dos estilos del mapa:** en tema claro se ve el mapa gris claro (positron); en oscuro, el oscuro. Cambiá el tema desde Ajustes con el mapa ya abierto: el estilo cambia en vivo y los trazos se vuelven a dibujar.
- [ ] **📱 Trazos** con el color de cada línea, contorno que los separa del fondo (A, H y Premetro sobre claro; C y E sobre oscuro) y la letra de la línea sobre el trazo.
- [ ] **📱 Toques:** tocar una estación abre su detalle; tocar un trazo abre la línea; si caen juntos, gana la estación.
- [ ] **📱 Gesto de volver:** deslizá desde el borde izquierdo de la pantalla: tiene que volver atrás, sin que el mapa se arrastre. Y arrastrar el mapa desde el centro tiene que seguir andando.
- [ ] **📱 Atribución** del mapa siempre visible (© OpenStreetMap, OpenMapTiles, OpenFreeMap).
- [ ] **Controles:** "Norte arriba" se toca bien (48 pt); "Centrar en mi ubicación" aparece solo si ya diste el permiso y **nunca lo pide**.
- [ ] Con Reducir movimiento la cámara salta en lugar de animar.

## 3. Colectivos (a confirmar cuando se integre)

### Raíz

- [ ] **Primer uso, descarga del índice (4.5):** "Preparando el listado de líneas y paradas…" con barra de progreso que avanza. La búsqueda se habilita al terminar. 📱 Probalo con la red lenta o cortá la red a mitad: tiene que mostrar "No pudimos descargar las líneas y paradas" con reintentar, y retomar al volver.
- [ ] En **Ajustes → Índice de líneas y paradas** se ve la misma descarga con el progreso ("Descargando… 40 %") y el peso.
- [ ] **Búsqueda local:** por número ("60"), por ramal o por calle. Sin resultados: "No encontramos «608». Probá con el número de línea o el nombre de una calle." Anda también en modo avión.
- [ ] **📱 Paradas cercanas y permiso de ubicación pedido en contexto:** la app **no** pide la ubicación al abrirse. Recién al tocar "Paradas cercanas" (o "Activar") sale el diálogo del sistema ("Mientras se usa la app"). Con permiso: lista de paradas con distancia ("a 120 m") y las líneas que pasan.
- [ ] **Sin permiso:** si tocás "No permitir", queda el bloque "Activá la ubicación para ver paradas cerca tuyo. Solo se usa mientras la app está abierta y no sale de tu teléfono." con "Buscar a mano". Si ya lo negaste antes, el botón dice "Abrir configuración" y abre los Ajustes del iPhone.
- [ ] **Fuera de CABA:** si la ubicación está fuera de la Ciudad (podés simular una ubicación en el simulador de Xcode), "No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires."

### Parada

- [ ] Líneas que paran, con insignia tocable que abre la línea. Estrella de favorito. **No** hay arribos ni un "próximamente" (decisión N4).

### Línea con mapa

- [ ] **📱 Mapa a pantalla casi completa** con la línea, sus paradas y los colectivos activos como marcadores.
- [ ] **📱 La `formSheet` deja tocar el mapa:** con la hoja a media altura, tiene que poder arrastrarse, hacer zoom y tocar marcadores del mapa que queda visible arriba. Si el mapa no responde con la hoja abierta, anotalo (hay un plan B documentado).
- [ ] **📱 Tocar otro marcador** con la hoja abierta reemplaza el detalle; no apila hojas.
- [ ] Tres alturas de la hoja: colapsada (encabezado, "18 colectivos en servicio", frescura, estrella), media (alertas, ramal) y expandida (lista de vehículos).
- [ ] **Línea sin vehículos:** "No hay colectivos de esta línea con GPS activo ahora." (de noche, por ejemplo).
- [ ] **Dato viejo / servicio caído:** marcadores atenuados + "El servicio de la Ciudad no responde" con "Reintentar".
- [ ] **VoiceOver:** la hoja se anuncia como diálogo y al cerrarla el foco vuelve al mapa; la lista de vehículos da la misma información que el mapa.

## 4. Favoritos

- [ ] **Vacío:** estrella, "Todavía no guardaste favoritos.", "Tocá la estrella en una línea, parada o estación para tenerla acá." y los botones "Ver subtes" y "Buscar colectivo", que cambian de tab.
- [ ] **Agregar:** desde una línea y una estación de subte (y una línea/parada de colectivo) con la estrella. Volvé a Favoritos: aparecen en el orden en que los guardaste, de forma inmediata (sin skeleton de estructura).
- [ ] **Filas:** la línea y la estación de subte con **el color de su línea**; alias o nombre oficial, y debajo el nombre oficial si hay alias; a la derecha el dato vivo (estado, próximo arribo, "N en servicio").
- [ ] **Tocar una fila** abre el detalle en su tab correspondiente.
- [ ] **Frescura:** arriba de la lista, "Actualizado hace N s" con el dato más viejo de las filas que se ven. Pull to refresh actualiza.
- [ ] **Editar → Cambiar nombre:** sheet con contador "12/30"; no deja pasar de 30 (probá con emojis); "Guardar" lo muestra en la fila; campo vacío quita el alias; "Cancelar" no cambia nada.
- [ ] **Editar → Quitar:** sale al instante, sin diálogo, y aparece "Quitaste «Casa»." con **Deshacer**. 📱 El aviso tiene que verse **por encima de la tab bar nativa**, sin taparse. Deshacer lo devuelve a su lugar.
- [ ] **📱 Arrastre para reordenar** (cuando high-dev lo integre): en modo edición, agarrá el asa, el ítem se eleva con un háptico al levantar y otro al soltar; el orden queda guardado al cerrar y reabrir la app. Con Reducir movimiento no hay animación de reacomodo. **(a confirmar cuando se integre)**
- [ ] **Búsqueda:** con más de 15 favoritos aparece el campo; filtra por alias y nombre sin tildes.
- [ ] **Favorito huérfano:** no es fácil de forzar; si ves "Esta estación ya no figura en los datos oficiales", la fila no navega y tiene "Quitar".
- [ ] **Servicio caído:** con **todos** los favoritos en vivo fallando (apagá `wrangler dev` y esperá un refresco) aparece **una sola** Alert "El servicio de la Ciudad no responde" con "Reintentar" y cada fila dice "Sin información". Si solo falla un tipo (por ejemplo, colectivos), no hay Alert: solo esas filas dicen "Sin información".
- [ ] **Sin conexión:** todos los favoritos siguen visibles y tocables (están en el teléfono).

## 5. Ajustes

- [ ] Se abre desde el engranaje de Inicio y se vuelve con el gesto de borde.
- [ ] **Tema:** Sistema / Claro / Oscuro, al instante. Se mantiene al cerrar y reabrir la app.
- [ ] **Actualizar cada:** 15 / 20 / 30 / 60 s, con el texto de ayuda. Con 15 s se nota el refresco más seguido en Inicio; se mantiene al reabrir.
- [ ] **Índice de líneas y paradas:** "Versión del 12/10/2026 · 4,8 MB" (con tu fecha real), "Buscar actualización". Con modo avión dice "Necesitás conexión" y está deshabilitado. Con el proxy apagado: "No pudimos actualizar. Tocá para reintentar."
- [ ] **Limpiar datos guardados:** aviso "Listo, limpiamos los datos guardados". **No** borra favoritos ni ajustes. Después las pantallas vuelven a cargar con skeleton.
- [ ] **Borrar todos los favoritos:** deshabilitado con 0 ("No tenés favoritos guardados"). Con favoritos: diálogo nativo con "Cancelar" / "Borrar"; después aviso "Borraste tus favoritos." con **Deshacer**, que los restaura en el mismo orden. 📱 El aviso se ve sobre la tab bar.
- [ ] **📱 Ubicación (fila de Privacidad):** muestra el estado real: "Todavía no la pediste", "Permitida mientras usás la app" o "No permitida" (con "Podés buscar paradas a mano"). Sin preguntar, tocarla abre el diálogo del sistema; con permiso o bloqueado, abre los Ajustes del iPhone. Cambiá el permiso allá y volvé: la fila se actualiza sola.
- [ ] **Acerca de:** nombre, versión y build reales, atribución a los datos del Gobierno de la Ciudad (CC BY 2.5 AR), "Transportate no es una app oficial del Gobierno de la Ciudad.", privacidad en 4 puntos, mapa y diseño. Los dos enlaces abren Safari.
- [ ] **Licencias:** lista de librerías; tocar una despliega su texto.

## 6. Tema claro y oscuro (recorrido transversal)

- [ ] Recorré Inicio, Subtes (raíz, línea, estación, mapa), Favoritos y Ajustes en **Claro** y en **Oscuro**.
- [ ] Nada queda con texto ilegible, fondo que no cambió o un borde que desaparece. Los colores de línea (A, H, Premetro) siguen distinguibles en los dos temas.

## 7. Texto grande y Reducir movimiento

- [ ] Con el texto al máximo: las filas de Subtes, Favoritos y Ajustes crecen sin cortar el estado ni la frescura; los botones siguen tocables.
- [ ] Con Reducir movimiento: no pulsan los skeletons; el `Snackbar` y el mapa no se animan.

## 8. VoiceOver (2 o 3 recorridos clave)

- [ ] **Recorrido A, Inicio → línea:** una fila de línea se lee como una unidad ("Línea B, Normal…"), un toque doble abre el detalle, y el engranaje se anuncia como botón "Ajustes".
- [ ] **Recorrido B, Favoritos:** cada fila se lee como "Casa. Estación Medrano, Línea B. Hacia Leandro N. Alem en 2 minutos."; en edición, deslizá hacia arriba/abajo con un dedo para ver las acciones **"Mover arriba"** y **"Mover abajo"**; "Quitar" y "Cambiar nombre" se anuncian con el nombre de la fila.
- [ ] **Recorrido C, aviso con Deshacer:** al quitar un favorito, VoiceOver anuncia el aviso y se puede llegar a "Deshacer" antes de que se cierre (8 s).
- [ ] Opcional: el mapa de la red y la hoja de la línea (ver sección 3).

## Qué anotar si algo falla

Pasame un mensaje por falla con:

1. **Pantalla** y estado en el que estabas (tema, idioma de texto, modo avión, proxy encendido o apagado).
2. **Pasos** exactos, de a uno ("1. Abrí Subtes. 2. Tocá Ver mapa. 3. Deslizá desde el borde izquierdo…").
3. **Qué esperabas** (lo que dice esta guía) y **qué pasó**.
4. **Captura o video** de pantalla (en el iPhone: botón lateral + subir volumen).
5. **Log de la terminal de `expo start`** (las últimas ~30 líneas, sobre todo si hay una pantalla roja o un `console.error`) y, si es un tema de datos, de la terminal de `wrangler dev`.
6. **Versión del build:** Ajustes → Acerca de → "Versión x.y.z (build N)".

No incluyas capturas con tu ubicación exacta si no querés compartirla: la app no la guarda ni la manda, pero una captura del mapa sí la muestra.
