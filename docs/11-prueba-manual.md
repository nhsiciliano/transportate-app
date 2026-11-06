# 11 — Prueba manual en el iPhone (Fase 4)

Guía para validar la Fase 4 con el dev client en el iPhone. Es una checklist: tildá cada casilla, y si algo no se ve como dice, andá al bloque [Qué anotar si algo falla](#qué-anotar-si-algo-falla). Lo que Jest no puede probar (mapa real, gestos, háptico, tab bar nativa, VoiceOver) está marcado con **📱**.

Todas las pantallas de la Fase 4 están integradas en `main`, incluidas Colectivos (raíz, parada y línea con mapa) y el arrastre de Favoritos. El detalle de cada una está en [`07-app.md`](07-app.md) y en el README de su feature.

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
- [ ] Primer arranque: se ve el splash con la marca y después **Inicio**, con las 4 tabs nativas (Inicio, Colectivos, Subtes, Trenes). Favoritos ya no es tab. Sin pantalla roja.

### Cómo forzar cada estado

| Estado | Cómo se fuerza | Qué tendría que pasar |
|---|---|---|
| **Sin conexión** | Modo avión (Wi‑Fi apagado) | Banner "Sin conexión. Mostramos lo último guardado." arriba, una sola vez en toda la app |
| **Servicio caído / último dato** | Cortá `wrangler dev` (Ctrl+C) con la app abierta | El contenido se queda y aparece "No pudimos actualizar. Mostramos lo último que sabemos." con "Reintentar" |
| **Dato viejo (frescura)** | Ajustes → "Actualizar cada" → 15 s, y dejá el proxy apagado unos minutos | La etiqueta pasa de "Actualizado hace 12 s" a "⚠ Dato de hace N min" en color de advertencia |
| **Trenes apagado** (kill-switch) | Reiniciá el proxy con `pnpm exec wrangler dev --ip 0.0.0.0 --port 8787 --var TRENES_ENABLED:false` | Las 6 líneas de Trenes pasan a «Sin información» y los arribos a un error con reintento; el resto de la app sigue igual (sección 3b) |
| **Tema** | Ajustes → Tema: Sistema / Claro / Oscuro. Y en el iPhone, Ajustes → Pantalla → Oscuro | Cambia al instante; con "Sistema" sigue al teléfono |
| **Texto grande** | iPhone: Ajustes → Accesibilidad → Pantalla y tamaño de texto → Texto más grande → al máximo | Nada se trunca ni se superpone; las filas crecen en alto |
| **Reducir movimiento** | iPhone: Ajustes → Accesibilidad → Movimiento → Reducir movimiento | Sin pulsos de skeleton ni animación de cámara en el mapa; el `Snackbar` aparece sin fundido; la banda grande de Inicio cambia sin fundido |
| **VoiceOver** | Triple clic al botón lateral (si lo configuraste) o Ajustes → Accesibilidad → VoiceOver | Ver los recorridos de la sección 8 |

> Volvé a encender el proxy y la conexión después de cada prueba de error: "Reintentar" y el pull to refresh tienen que recuperar solos.

## 1. Inicio

Desde la Fase 5, Inicio es el **piloto de la dirección «Señalética de terminal»**: fondo celeste muy claro, tipografía Fira Sans en toda la app y bandas de señal azules para los favoritos. Compará con el boceto `apps/mobile/.impeccable/mocks/decision/senal-terminal.html`.

- [ ] **Large title:** "Transportate" grande arriba (y debajo, en texto secundario, "Toda la información para moverte a tu alcance"), que se achica al scrollear. El botón de engranaje "Ajustes" se ve y se toca fácil. Las tabs y el gesto de volver son los nativos de siempre.
- [ ] **Tipografía:** títulos y textos del contenido en Fira Sans (más estrecha y técnica que la anterior); en la fuente del sistema solo los controles nativos y los títulos de header y large titles (chrome del sistema).
- [ ] **Tira «Subte ahora»:** tarjeta blanca con los 7 discos (A, B, C, D, E, H, Premetro) y una línea de estado. Con todo normal: "Todas las líneas funcionan con normalidad". Con demoras: "B con demoras · …" en ámbar. Tocar la tira abre Subtes.
- [ ] **Alert destacada** solo si hay una línea **interrumpida** (con demoras no hay Alert: lo dice la tira). Depende del día.
- [ ] **Bandas de favoritos:** hasta 5. La primera es grande (azul, 148 pt) con el minuto a escala monumental y «Próximo» si es un arribo; las demás son navy, más bajas. La flecha queda pegada al borde derecho (abajo en la grande, al medio en las chicas). Tocar una abre su detalle.
- [ ] **Líder por cercanía:** con el permiso de ubicación **ya concedido** (desde Colectivos o Ajustes), guardá dos estaciones o paradas lejanas entre sí; la banda grande es la más cercana a vos, aunque no sea la primera de la lista. Sin permiso, la grande es la primera. **Inicio nunca pide el permiso.**
- [ ] **Fundido:** cuando cambia el minuto de la banda grande (o el favorito más cercano), su contenido cruza en un fundido corto. Un refresco que no cambia el valor no se mueve. Con **Reducir movimiento**, cambio seco.
- [ ] **Estados de una banda:** con la línea de la estación con demoras, cuadrado ámbar + "Con demoras"; con dato viejo, "hace 6 min" al lado del valor; con el proxy apagado y sin caché, "Sin información".
- [ ] **Fila meta:** "Actualizado hace 12 s" a la izquierda y "Ver todos los favoritos (N)" a la derecha (abre Favoritos).
- [ ] **Texto grande (Dynamic Type al máximo):** las bandas crecen en alto; el nombre puede cortarse con "…", pero el minuto y el estado nunca se cortan (el minuto grande se achica un poco si no entra).
- [ ] **Modo oscuro:** las bandas pasan a celeste claro con texto oscuro y el cuadrado del pictograma oscuro; todo se lee bien al sol (subí el brillo).
- [ ] **Pull to refresh** (arrastrar hacia abajo): el indicador nativo, y los datos se actualizan.
- [ ] **Sin conexión / proxy apagado:** el contenido se queda; ver la tabla de estados. **📱 Banner offline sin hueco:** con modo avión, el banner ocupa el margen superior y el header de la pantalla no deja un espacio vacío extra debajo ni se duplica el margen de la barra de estado.
- [ ] **Sin favoritos:** el bloque explica cómo agregarlos ("Explorar subtes").

## 2. Subtes

### Raíz

- [ ] **📱 Large title** "Subtes" grande en iOS, que se achica al scrollear (usa `headerLargeTitleEnabled`).
- [ ] **📱 Placa de tablero:** las siete líneas en **una sola placa blanca** (radio chico, borde fino, sin sombra) sobre fondo celeste muy claro, en orden fijo. Cada fila: disco de la línea, «Línea B» y debajo las cabeceras ("Plaza de Mayo – San Pedrito"); a la derecha el estado («Normal» en gris; «Con demoras» con cuadradito ámbar; «Interrumpida» con cuadradito rojo) y la flecha pegada al borde. Si hay alerta, una tercera línea con su resumen en el color del estado.
- [ ] **Buscador de estaciones:** escribí "med" → aparece Medrano; con tildes y sin tildes da lo mismo. Algo que no existe ("zzz"): "No encontramos «zzz». Probá con otro nombre de estación."
- [ ] **Mapa de la red:** abajo de la frescura, una placa de una fila con el pictograma de mapa y flecha; abre el mapa (sección 2.4). Ya no hay botón «Ver mapa» arriba.
- [ ] **Texto grande (Dynamic Type al máximo):** las filas crecen en alto; el estado de la derecha nunca se corta.
- [ ] Proxy apagado y sin caché (reiniciá la app con el proxy apagado): se listan igual las 7 líneas con "Sin información" y un `ErrorState` con "Volver a intentar".

### Línea

- [ ] **📱 Banda de la línea:** arriba, una banda azul grande **sin flecha** con el pictograma del subte, «Línea B · Leandro N. Alem – Juan Manuel de Rosas» y el estado como valor; con demoras, cuadradito ámbar y «N alertas». La **estrella va en el header** (arriba a la derecha), no en el contenido.
- [ ] **Alertas** completas (una por alerta) o "Sin novedades informadas". El texto va **una sola vez**, en negrita con el ícono; debajo solo la descripción si agrega algo y el período ("Desde las 14:05"). GCBA suele mandar título y descripción iguales: no tiene que repetirse.
- [ ] **📱 Estaciones en placa** con el trazo vertical del color de la línea **continuo** de punta a punta (los separadores arrancan después del trazo); cada fila con flecha abre la estación; las afectadas por una alerta dicen «Con novedades» en ámbar.
- [ ] **Premetro:** una sola línea con sus dos ramales ("Ramal Centro Cívico").

### Estación

- [ ] **📱 Header:** título nativo con el nombre de la estación (sin la letra) y la estrella arriba a la derecha. Debajo, una fila con el disco de la línea y «Línea B · Leandro N. Alem – Juan Manuel de Rosas»; tocarla abre la línea.
- [ ] **📱 Bandas por sentido:** una banda azul grande por sentido, **sin flecha**: «Hacia Leandro N. Alem», «Próximo», el minuto enorme («4 min», «Llegando») y debajo «Después 7 y 12 min» (o «Único informado»). Un sentido sin trenes dice «Sin trenes informados». Cuando cambia el próximo tren, la banda cambia con un fundido corto (seco con Reducir movimiento).
- [ ] **Arribos congelados:** si el upstream sigue con el dato viejo de octubre, cada banda dice «Dato de hace N días» y «Puede no reflejar la situación actual» en lugar de tiempos (esto es lo esperado, no un error).
- [ ] **📱 Estrella:** tocar guarda en favoritos con un háptico de éxito suave; tocar de nuevo la quita con un háptico de selección. VoiceOver anuncia "Guardado en favoritos" / "Quitado de favoritos".

### 2.4 Mapa de la red

- [ ] **📱 Los dos estilos del mapa:** en tema claro se ve el mapa gris claro (positron); en oscuro, el oscuro. Cambiá el tema desde Ajustes con el mapa ya abierto: el estilo cambia en vivo y los trazos se vuelven a dibujar.
- [ ] **📱 Trazos** con el color de cada línea, contorno que los separa del fondo (A, H y Premetro sobre claro; C y E sobre oscuro) y la letra de la línea sobre el trazo.
- [ ] **📱 Toques:** tocar una estación abre su detalle; tocar un trazo abre la línea; si caen juntos, gana la estación.
- [ ] **📱 Gesto de volver:** deslizá desde el borde izquierdo de la pantalla: tiene que volver atrás, sin que el mapa se arrastre. Y arrastrar el mapa desde el centro tiene que seguir andando.
- [ ] **📱 Atribución** del mapa siempre visible (© OpenStreetMap, OpenMapTiles, OpenFreeMap).
- [ ] **Controles:** "Norte arriba" se toca bien (48 pt); "Centrar en mi ubicación" aparece solo si ya diste el permiso y **nunca lo pide**.
- [ ] Con Reducir movimiento la cámara salta en lugar de animar.

## 3. Colectivos

Desde la Fase 5, Colectivos usa la misma dirección que Inicio (**«Señalética de terminal»**): fondo celeste muy claro, **placas blancas** con filas separadas por un trazo fino para todo lo que se busca o se lista, y **bandas de señal azules** solo donde hay un valor que cambia (tus favoritos y el panel de la línea). Compará con Inicio: tienen que parecer la misma app. La flecha pegada al borde derecho aparece **solo** en las filas que abren algo.

### Raíz

- [ ] **Primer uso, descarga del índice (4.5):** "Preparando el listado de líneas y paradas…" con barra de progreso que avanza. La búsqueda se habilita al terminar. 📱 Probalo con la red lenta o cortá la red a mitad: tiene que mostrar "No pudimos descargar las líneas y paradas" con "Volver a intentar", y retomar al volver.
- [ ] En **Ajustes → Índice de líneas y paradas** se ve la misma descarga con el progreso ("Descargando… 40 %") y el peso.
- [ ] **Forma de la raíz:** large title "Colectivos", el campo de búsqueda y, debajo, las placas: "Paradas cercanas" (si ya diste el permiso), "Recientes" y, si guardaste favoritos de colectivo, "Tus favoritos" como bandas azules/navy. No hay tarjetas sueltas ni sombras; las placas son blancas con un borde finito.
- [ ] **Búsqueda local:** por número ("60"), por ramal o por calle (desde 3 caracteres para paradas). Líneas con la insignia del número, "Línea 60" y el ramal; paradas con el cuadrado oscuro y las líneas que paran ("60 · 152 · 168"). Todo en una sola placa, con flecha al borde. Sin resultados: "No encontramos «608». Probá con el número de línea o el nombre de una calle." Anda también en modo avión.
- [ ] **📱 Paradas cercanas y permiso de ubicación pedido en contexto:** la app **no** pide la ubicación al abrirse. Recién al tocar "Activar" en el bloque de paradas cercanas sale el diálogo del sistema ("Mientras se usa la app"). Con permiso: las 10 paradas más cercanas dentro de una placa, cada una con el cuadrado oscuro, la calle, las líneas que pasan ("60 · 152 · 168", o "60 · 152 · 168 y 4 más" si son muchas) y la distancia a la derecha ("a 120 m"); la última fila es "Ver más" (hasta 30).
- [ ] **Sin permiso:** el bloque va **dentro de la placa** "Paradas cercanas": cuadrado oscuro con el ícono de ubicación a la izquierda, "Activá la ubicación para ver paradas cerca tuyo" en negrita y debajo "Solo se usa mientras la app está abierta y no sale de tu teléfono.", con "Activar" y "Buscar a mano". Si tocás "No permitir", queda ese bloque. Si ya lo negaste antes, el botón dice "Abrir configuración" y abre los Ajustes del iPhone; al volver, la pantalla se actualiza sola.
- [ ] **Fuera de CABA:** con una ubicación fuera de la Ciudad (podés simularla en el simulador de Xcode): "No encontramos paradas cerca. Transportate cubre la Ciudad de Buenos Aires." con la búsqueda a mano disponible.
- [ ] **Recientes:** abrí una línea; al volver a la raíz aparece entre las últimas 5, en la placa "Recientes" (insignia, "Línea 152", "Ramal A · a Olivos" y la flecha).
- [ ] **Tus favoritos:** guardá una línea y una parada de colectivo; aparecen como bandas navy con el valor vivo ("18 en servicio") y la flecha al borde; tocar una abre su detalle.
- [ ] **Texto grande (Dynamic Type al máximo):** las filas crecen en alto, el nombre de la parada llega a 2 líneas y la distancia no se corta; el bloque de permiso apila los botones.

### Parada

- [ ] **Header nativo:** calle y altura como título, la estrella de favorito a la derecha (fácil de tocar) y, debajo, el barrio en gris. No hay banda azul: la parada no tiene un valor vivo.
- [ ] **Placa "Líneas que paran":** una fila por línea (insignia, "Línea 60", ramal y cabecera) con flecha al borde; tocarla abre la línea **con la cámara en esa parada**. Una línea que no figura en el listado aparece sin flecha y sin ser tocable.
- [ ] **Arribos solo si la respuesta los trae:** hoy lo normal es que **no** haya tiempos en las filas ni "Actualizado hace…" (decisión N4). Si aparecen, el primero va grande a la derecha de su fila ("2 min") y los siguientes (hasta 3 en total) chicos debajo, con la frescura al final de la pantalla.
- [ ] Una parada que ya no existe en el índice dice "No encontramos esta parada".

### Línea con mapa

- [ ] **📱 Mapa a pantalla casi completa** con el recorrido de la línea (punteado: es aproximado), las paradas (recién desde cierto zoom) y los colectivos activos como círculos con el número encima.
- [ ] **📱 Panel inferior con tres alturas:** colapsado (una **banda azul fija** con "Línea 152 · Ramal A", "En servicio" y el número de colectivos **bien grande**, con "hace 25 s" al lado; debajo, frescura, estrella y "Actualizar"), medio (ramales y la nota del sentido) y expandido (la placa "Colectivos en servicio"). La banda **no** lleva flecha ni se toca: es una señal. Se arrastra desde la manija o el encabezado; el botón de la manija ("Ver más" / "Ver la lista completa" / "Ver menos") hace lo mismo sin arrastrar.
- [ ] **📱 El panel y el mapa no compiten por los gestos:** arrastrar el panel no mueve el mapa, y arrastrar o hacer zoom en el mapa visible por encima del panel funciona con el panel en cualquier altura. En el nivel expandido, la lista scrollea sin mover el panel.
- [ ] **📱 Gesto de volver:** desde el borde izquierdo vuelve a la pantalla anterior sin arrastrar el mapa.
- [ ] **📱 La tab bar no tapa el panel:** con el panel colapsado se ve la banda **y** la fila de frescura, estrella y "Actualizar" **enteras por encima de la tab bar** (en claro y en oscuro); "Actualizar" y la estrella se pueden tocar. En el nivel expandido, el último colectivo de la lista se ve completo al scrollear hasta el final. Probalo con el teléfono en vertical y con el texto grande.
- [ ] **Lista a menos de 3 km:** con el permiso de ubicación dado, en el nivel expandido la placa se llama **"Colectivos a menos de 3 km"** y al lado dice **"3 de 7 en servicio"** (los que muestra de los que tiene la línea). Solo aparecen los colectivos a **3 km o menos**; el mapa sigue mostrándolos todos y la banda sigue diciendo el total (7). Con la app abierta unos minutos, los colectivos **van apareciendo** en la lista a medida que se acercan y **salen** cuando se alejan, con un fundido corto (**Reducir movimiento**: sin fundido). Un colectivo que elegiste (en el mapa o en la lista) **no desaparece** aunque se aleje; al "Cerrar", sale si está lejos. Si ninguno está a 3 km: **"Ningún colectivo a menos de 3 km. Hay 7 en servicio más lejos."**, sin botón. **Sin permiso de ubicación** la lista es la completa, se llama "Colectivos en servicio" y no dice "N de M".
- [ ] **Lista por cercanía:** con el permiso de ubicación dado, en el nivel expandido el primer colectivo es el que dice la menor distancia ("a 350 m de vos") y la lista va de más cerca a más lejos. Sin permiso, el orden es por dato más reciente y cada fila dice el ramal. Cada fila lleva el cuadrado oscuro con el colectivo, el interno y "hace 25 s" a la derecha, **sin flecha** (elegir no abre otra pantalla); el elegido queda con el fondo marcado.
- [ ] **Seguir un vehículo:** tocá un colectivo en el mapa (o en la lista): se resalta y **la banda se vuelve a señalizar** con un fundido corto: "Interno 1404", "Actualizado", "hace 25 s" y, con ubicación, "a 350 m de vos"; debajo aparecen **"Seguir"** y "Cerrar". "Cerrar" devuelve la banda al conteo, también con fundido; con **Reducir movimiento**, el cambio es seco. Con "Seguir" la cámara lo acompaña en cada actualización (📱 con un háptico de selección); con Reducir movimiento, la cámara salta. Volvé a tocar para dejar de seguir.
- [ ] **Ramal:** si el número tiene más de un ramal, los `Chip`s del nivel medio cambian de ramal y la cámara se vuelve a encuadrar. Aparece la nota "El GPS de los colectivos no informa el sentido: ves los de las dos direcciones."
- [ ] **Línea con muchos vehículos (más de 80):** los círculos se agrupan hasta cierto zoom; tocar un grupo acerca la cámara.
- [ ] **Flecha de rumbo:** la flecha ▲ solo aparece si el vehículo trae rumbo; hoy el proxy no lo manda, así que **no** tenés que ver flechas (es lo esperado).
- [ ] **"Centrar en mi ubicación"** en el mapa: pide el permiso en contexto la primera vez; con permiso centra el mapa y la lista suma "a 600 m de vos". Sin permiso no hay punto azul.
- [ ] **Línea sin vehículos:** la banda dice "Sin colectivos con GPS ahora" en lugar del número (de noche, por ejemplo).
- [ ] **Dato viejo / servicio caído:** con el proxy apagado, los marcadores se atenúan y aparece "No pudimos actualizar. Mostramos lo último que sabemos." con "Reintentar"; con el feed de más de 10 minutos, la banda muestra un cuadrado ámbar con "Las posiciones pueden no ser actuales". Sin datos en absoluto: mapa sin marcadores y `ErrorState` en el panel.
- [ ] **Polling solo a la vista:** salí de la línea (a otra tab) y fijate en la terminal de `wrangler dev` que dejan de llegar pedidos de posiciones de esa línea.
- [ ] **Texto grande en el panel:** la banda crece en alto y el número y "hace 25 s" nunca se cortan (el número se achica antes de cortarse).
- [ ] **VoiceOver:** la banda se lee de una vez ("Línea 60 · Ramal A, 18 colectivos en servicio, dato más viejo de hace 25 segundos"); el panel se lee con su botón de la manija; la lista de vehículos da la misma información que el mapa ("Interno 1404, actualizado hace 25 segundos, a 600 metros de vos") y marca el elegido con "Seleccionado".

## 3b. Trenes (Fase 6)

Tab nueva, espejo de Subtes y sin mapa. Los datos vienen de una **fuente comunitaria no oficial** de SOFSE a través de tu proxy (nunca desde la app): puede tardar 1–3 s en responder y puede caerse. Los colores de las líneas son **provisorios** (`02c-colores-trenes.md`): anotá si alguno no se parece al de la señalética real. Contrato visual: `apps/mobile/.impeccable/surfaces/src-features-trenes-trenesscreen-tsx.md`; brief: [`briefs/07-trenes.md`](briefs/07-trenes.md). Lo marcado *(a confirmar)* depende de decisiones de la ola 2 de la fase.

### Tab y raíz

- [ ] **📱 Tab visible y orden:** la barra tiene 4 tabs: Inicio, Colectivos, Subtes, **Trenes** (Trenes la última), con el ícono de tren del sistema. Favoritos no está en la barra y Tránsito sigue oculto.
- [ ] **📱 Large title** «Trenes» grande, que se achica al scrollear; **no hay mapa** ni botón de mapa.
- [ ] **📱 Placa de tablero:** las 6 líneas en **una sola placa blanca**, en orden fijo: Roca, Sarmiento, Mitre, San Martín, Belgrano Sur, Tren de la Costa. Cada fila: insignia **rectangular** del color de la línea con sus siglas (R, S, M, SM, BS, TC), «Línea Roca» y debajo «12 ramales» (o las cabeceras si tiene un solo ramal, como Tren de la Costa); a la derecha el estado y la flecha al borde. Belgrano Norte y Urquiza **no** están (no tienen fuente).
- [ ] **Estado de cada línea:** «Normal» en gris; «Con demoras» con cuadrado ámbar; «Interrumpida» con cuadrado rojo, y, solo si la línea tiene un problema, el resumen de la alerta en hasta dos líneas. Compará con las alertas de la app oficial de Trenes Argentinos. Ojo: **un ramal interrumpido deja su línea en «Con demoras»**, con el resumen prefijado por el ramal (por ejemplo «Cañuelas-Lobos: …» en Roca); «Interrumpida» en la línea solo con una alerta de toda la línea. El detalle por ramal sí muestra «Interrumpida». 
- [ ] **`FreshnessLabel`:** «Actualizado hace N s» bajo la placa. Pull to refresh actualiza.
- [ ] **Buscador:** «Buscá una estación» filtra las ~300 estaciones sin red y sin tildes («caballito», «tigre», «constitucion»); cada resultado dice a qué línea y ramales pertenece y abre la estación. Algo que no existe («Plaza Italia»): «No encontramos «Plaza Italia». Probá con otro nombre de estación.»
- [ ] **Modo avión:** las líneas y la búsqueda siguen funcionando (el estático está en el teléfono); el estado y los arribos muestran lo último con su antigüedad, y el banner global avisa.

### Línea y ramal

- [ ] **📱 Línea:** tocar «Línea Sarmiento» abre una pantalla con una banda fija arriba (**sin flecha**) con el estado de la línea, las alertas de la línea completas (una por alerta, con su vigencia) y una placa con los **ramales** (Once–Moreno, Merlo–Lobos, Moreno–Mercedes, Once–Bragado), cada uno con sus cabeceras y su estado. **Sin estrella en el header**: la línea no se guarda.
- [ ] **📱 Ramal:** tocar «Once – Moreno» abre una banda fija con el estado del ramal, la **estrella en el header**, las alertas del ramal (las de un solo sentido dicen «Hacia Moreno»/«Hacia Once») y las **16 estaciones en orden** en una placa, con el trazo vertical del color de la línea **continuo** y flecha en cada fila.
- [ ] **Ramal con alerta:** si un ramal tiene demora o está interrumpido (hoy hay alguno casi siempre), su fila en la línea y su banda lo dicen igual en las dos pantallas.
- [ ] **Estrella del ramal:** tocarla guarda con háptico de éxito; tocarla de nuevo, háptico de selección. VoiceOver anuncia «Guardado en favoritos» / «Quitado de favoritos».

### Estación

- [ ] **📱 Header:** título nativo con el nombre («Caballito»), estrella arriba a la derecha, y en el contenido la insignia de la línea.
- [ ] **📱 Una banda por destino:** por cada destino (cabecera hacia la que van los trenes), una banda fija **sin flecha**: «Hacia Moreno», «Próximo», el minuto enorme («4 min») y debajo el andén y el ramal («Andén 3 · Ramal Once–Moreno») y «Después 7 y 12 min». En una cabecera (Retiro, Once) solo aparecen los destinos hacia donde salen trenes. En una estación de varios destinos (Retiro, Liniers) solo los 2 más próximos son bandas; el resto va en la placa «Otros destinos» con el tiempo a la derecha. Las alertas de la estación aparecen **debajo** de las bandas.
- [ ] **Demora:** cuando el tren viene más tarde que lo programado, el minuto va con la hora estimada y aparece «Programado hh:mm» al lado o debajo.
- [ ] **Cancelado:** un servicio cancelado dice «Cancelado» y no cuenta como el próximo (no es fácil de forzar; si no aparece, anotalo como no verificado).
- [ ] **Fundido:** cuando cambia el próximo tren de un destino, la banda cruza en un fundido corto; con **Reducir movimiento**, cambio seco.
- [ ] **Dato viejo:** con el proxy apagado unos 10 minutos, los tiempos de las bandas se reemplazan por «Dato de hace N min» y se atenúan; la `FreshnessLabel` pasa a advertencia.
- [ ] **Estación sin trenes** (fuera de horario o no operativa en ese ramal): mensaje claro, sin banda inventada y sin error.
- [ ] **Refresco:** los arribos se actualizan solos cada ~30 s mientras la pantalla está a la vista, y se pausan al salir de la tab.

### Favoritos de tren

- [ ] **📱 Guardar:** una **estación** y un **ramal** con la estrella. En Favoritos aparecen como bandas con el pictograma de tren: la de ramal con su estado («Con demoras», «Normal»…), la de estación con el próximo tren por destino. Tocar una abre su detalle **en la tab Trenes** (ramal o estación), con flecha al borde.
- [ ] **Inicio:** una estación de tren guardada puede ser la banda líder si está más cerca (con el permiso de ubicación concedido); tocarla abre la estación. **No hay** tira «Trenes ahora» en Inicio (queda para después).
- [ ] **Edición:** alias, reordenar y quitar con Deshacer funcionan igual que con los de subte.
- [ ] **Línea no se guarda:** no hay estrella en la pantalla de línea.

### Estados y errores

- [ ] **Proxy apagado y sin caché** (reiniciá la app con `wrangler dev` cortado): la raíz lista las 6 líneas con «Sin información» y un error con «Volver a intentar» («El servicio de trenes no responde en este momento.»). En una estación, un `ErrorState` con reintento. Nunca «Normal» ni horarios inventados.
- [ ] **Con caché y proxy apagado:** el contenido se queda, con «No pudimos actualizar. Mostramos lo último que sabemos.» y la antigüedad.
- [ ] **Kill-switch:** con el proxy iniciado con `--var TRENES_ENABLED:false` (tabla de estados de la sección 0), Trenes muestra «Sin información» en las 6 líneas y los arribos fallan con reintento, **sin romper** Inicio, Subtes, Colectivos ni Favoritos (los favoritos de tren quedan visibles y tocables, con su dato en «Sin información»).
- [ ] **Fuente caída de verdad** (si pasa durante la prueba: la instancia comunitaria no tiene garantías): se ve lo mismo que con el kill-switch. Anotá la hora; no es un bug de la app.

### Modo oscuro, texto grande y VoiceOver

- [ ] **Modo oscuro:** las insignias de las líneas siguen legibles; **Tren de la Costa** (azul oscuro) lleva un **borde claro** porque casi no se distingue del fondo oscuro, y en **claro** llevan borde Roca, Mitre y San Martín (`02c-colores-trenes.md` §3). Los textos de las bandas y los estados se leen al sol.
- [ ] **Texto grande (Dynamic Type al máximo):** las filas crecen en alto; el estado de la derecha, el minuto y «Dato de hace N min» nunca se cortan; los nombres largos («Villa Ballester – Zárate», «Victoria – Capilla del Señor») pasan a dos líneas.
- [ ] **VoiceOver:** la fila de línea se lee «Línea Sarmiento, con demoras»; una banda de estación, «Hacia Moreno: próximo en 4 minutos, después en 7 y 12 minutos. Andén 3. Actualizado hace 10 segundos.». La insignia no debería leerse como siglas sueltas (R, SM…) además del nombre de la línea; el color nunca es la única pista.

## 4. Favoritos

- [ ] **📱 Botón Favoritos en el header de Inicio:** arriba a la derecha de Inicio hay una estrella llena **a la izquierda** del engranaje de Ajustes, los dos del mismo tamaño y fáciles de tocar, sin texto ni número. VoiceOver la anuncia como botón «Favoritos». Tocarla apila Favoritos (large title, «Editar» a la derecha, «Atrás» del sistema); volvé con el gesto de borde. Si saliste en modo edición, al volver a abrir arranca en modo lectura.
- [ ] **📱 Large title** "Favoritos" grande, que se achica al scrollear; "Editar"/"Listo" a la derecha. Nada queda debajo del header: ni la primera fila ni el estado vacío.
- [ ] **Vacío:** estrella, "Todavía no guardaste favoritos.", "Tocá la estrella en una línea, parada o estación para tenerla acá." y los botones "Ver subtes" y "Buscar colectivo", que cambian de tab.
- [ ] **Agregar:** desde una línea y una estación de subte (y una línea/parada de colectivo) con la estrella. Volvé a Favoritos: aparecen en el orden en que los guardaste, de forma inmediata (sin skeleton de estructura).
- [ ] **📱 Bandas:** cada favorito es una banda navy como las chicas de Inicio (mismo contenido): pictograma del tipo en el cuadrado, alias o nombre con su contexto («Línea B · Medrano», «Línea 152 · Ramal A», «Parada …») y el valor vivo grande («4 min», «2 en servicio», «Normal», las líneas de la parada). Una estación de una línea con demoras lleva el cuadradito ámbar «Con demoras»; un dato viejo, «hace 6 min». Separadas 8 pt sobre fondo celeste claro.
- [ ] **Tocar una banda** abre el detalle en su tab correspondiente (flecha al borde).
- [ ] **Frescura:** arriba de la lista, "Actualizado hace N s" con el dato más viejo de las filas que se ven. Pull to refresh actualiza.
- [ ] **📱 Edición en la misma banda:** «Editar» → las bandas cambian con un fundido corto (seco con Reducir movimiento) y conservan su forma: a la izquierda la manija «Reordenar», a la derecha el tacho «Quitar» en lugar de la flecha y un lapicito junto al nombre. «Listo» vuelve igual.
- [ ] **Editar → tocar el nombre:** abre el sheet del alias con contador "12/30"; no deja pasar de 30 (probá con emojis); "Guardar" lo muestra en la banda; campo vacío quita el alias; "Cancelar" no cambia nada.
- [ ] **Editar → Quitar:** sale al instante, sin diálogo, y aparece "Quitaste «Casa»." con **Deshacer**. 📱 El aviso tiene que verse **por encima de la tab bar nativa**, sin taparse. Deshacer lo devuelve a su lugar.
- [ ] **📱 Arrastre para reordenar:** en modo edición cada fila tiene una manija "Reordenar" de 44 × 44 a la izquierda; apoyá el dedo y arrastrá. La fila se eleva con un háptico al levantar y otro al soltar, y el orden queda guardado al cerrar y reabrir la app. Con Reducir movimiento no hay animación de reacomodo. Con un texto escrito en la búsqueda (más de 15 favoritos) el arrastre se desactiva a propósito.
- [ ] **Búsqueda:** con más de 15 favoritos aparece el campo; filtra por alias y nombre sin tildes.
- [ ] **Favorito huérfano:** no es fácil de forzar; si ves una banda con «Sin datos oficiales» y el cuadradito rojo «Ya no figura», no tiene flecha, no navega y tiene «Quitar» siempre visible.
- [ ] **VoiceOver en edición:** la manija, el nombre (botón con la pista «Cambiar nombre» y las acciones «Mover arriba/abajo») y «Quitar» se leen por separado.
- [ ] **Servicio caído:** con **todos** los favoritos en vivo fallando (apagá `wrangler dev` y esperá un refresco) aparece **una sola** Alert "El servicio de la Ciudad no responde" con "Reintentar" y cada fila dice "Sin información". Si solo falla un tipo (por ejemplo, colectivos), no hay Alert: solo esas filas dicen "Sin información".
- [ ] **Sin conexión:** todos los favoritos siguen visibles y tocables (están en el teléfono).

## 5. Ajustes

Desde la Fase 5, Ajustes, Acerca de y Licencias siguen la dirección «Señalética de terminal» con la restricción máxima: la misma tipografía (Fira Sans), el fondo celeste muy claro y las placas blancas de Inicio, pero **sin bandas ni pictogramas**: es una lista agrupada común y silenciosa.

- [ ] **Forma de la lista:** fondo celeste muy claro (en oscuro, el fondo de la app); cada sección tiene su encabezado chico en gris (Apariencia, Datos, Favoritos, Privacidad, Información) y debajo una placa blanca de esquinas apenas redondeadas, con un borde finito y **sin sombra**. Las filas se separan con una línea finita (nunca debajo de la última) y no llevan ícono a la izquierda.
- [ ] **Chevron solo donde navega:** la flechita `›` aparece **únicamente** en «Acerca de Transportate» (y en «Licencias de software de terceros», dentro de Acerca de). Ninguna otra fila de Ajustes la lleva. «Ubicación» muestra el ícono de salir solo cuando abre los Ajustes del iPhone.
- [ ] **Presionado:** al apoyar el dedo en una fila, se tiñe de celeste y el tinte respeta las esquinas de la placa.
- [ ] **Se abre desde el engranaje de Inicio y se vuelve con el gesto de borde.** Header nativo chico con «Ajustes» y «Atrás»; las tabs y el gesto son los de siempre.
- [ ] **Tema:** Sistema / Claro / Oscuro, al instante. Se mantiene al cerrar y reabrir la app.
- [ ] **Actualizar cada:** 15 / 20 / 30 / 60 s, con el texto de ayuda. Con 15 s se nota el refresco más seguido en Inicio; se mantiene al reabrir.
- [ ] **Índice de líneas y paradas:** "Versión del 12/10/2026 · 4,8 MB" (con tu fecha real), "Buscar actualización". Con modo avión dice "Necesitás conexión" y está deshabilitado. Con el proxy apagado: "No pudimos actualizar. Tocá para reintentar."
- [ ] **Limpiar datos guardados:** aviso "Listo, limpiamos los datos guardados". **No** borra favoritos ni ajustes. Después las pantallas vuelven a cargar con skeleton.
- [ ] **Borrar todos los favoritos:** ahora es una fila (no un botón) con el título en rojo; deshabilitada con 0 (título gris, "No tenés favoritos guardados"). Con favoritos: diálogo nativo con "Cancelar" / "Borrar"; después aviso "Borraste tus favoritos." con **Deshacer**, que los restaura en el mismo orden. 📱 El aviso se ve sobre la tab bar.
- [ ] **📱 Ubicación (fila de Privacidad):** muestra el estado real: "Todavía no la pediste", "Permitida mientras usás la app" o "No permitida" (con "Podés buscar paradas a mano"). Sin preguntar, tocarla abre el diálogo del sistema; con permiso o bloqueado, abre los Ajustes del iPhone. Cambiá el permiso allá y volvé: la fila se actualiza sola.
- [ ] **Texto grande en Ajustes:** con Dynamic Type al máximo, las filas crecen en alto: ni el valor ni el estado se cortan, y el segmentado de Tema y el de intervalo siguen enteros y tocables.
- [ ] **Barra de descarga (📱, solo si descarga el índice grande de Colectivos):** debajo de «Descargando… 40 %» una barra finita (4 pt) azul sobre celeste, sin animación propia.
- [ ] **Acerca de:** lectura en la misma tipografía, más aireada que la lista (nombre grande, párrafos de 17 pt, títulos de sección). «Diseño» dice solo que la app sigue Obelisco v2 adaptado a nativo (sin nombrar tipografía ni dirección, decisión del usuario del 2026-11-06). Además: nombre, versión y build reales, atribución a los datos del Gobierno de la Ciudad (CC BY 2.5 AR), "Transportate no es una app oficial del Gobierno de la Ciudad.", privacidad en 4 puntos, mapa y diseño. Los dos enlaces abren Safari.
- [ ] **Licencias:** una sola placa con una fila por librería (nombre en seminegrita y «versión · licencia» abajo); tocar una despliega su texto en Fira Sans y el chevron gira. Tiene que figurar `@expo-google-fonts/fira-sans` (MIT AND OFL-1.1) y **ninguna** Nunito ni Open Sans.

## 6. Tema claro y oscuro (recorrido transversal)

- [ ] Recorré Inicio, Subtes (raíz, línea, estación, mapa), Trenes (raíz, línea, ramal, estación), Favoritos y Ajustes en **Claro** y en **Oscuro**.
- [ ] Nada queda con texto ilegible, fondo que no cambió o un borde que desaparece. Los colores de línea (A, H, Premetro) siguen distinguibles en los dos temas.
- [ ] **📱 Oscuro con el sistema en claro:** dejá el iPhone en modo claro y elegí **Oscuro** en Ajustes. Los títulos grandes («Subtes», «Colectivos», «Favoritos»), los títulos de header («Ajustes», el nombre de una parada, «Línea 15A»), el botón «Atrás», «Editar/Listo» y la tab bar tienen que verse **oscuros y legibles** (texto claro sobre fondo oscuro), igual que la hora de la barra de estado. Volvé a **Sistema**: todo vuelve a claro. Repetí al revés (sistema en oscuro, elegí **Claro**).
- [ ] **📱 Títulos de header visibles:** cada tab raíz muestra su large title («Transportate», «Colectivos», «Subtes», «Trenes»; también «Favoritos» al abrirla desde Inicio) en la fuente del sistema, y el large title se achica al scrollear. Si un header queda alto y sin texto, es el defecto de iOS 26+ con fondo explícito en el header (`docs/07-app.md` §4, chrome nativo): anotalo.

## 7. Texto grande y Reducir movimiento

- [ ] Con el texto al máximo: las filas de Subtes, Trenes, Favoritos y Ajustes crecen sin cortar el estado ni la frescura; los botones siguen tocables.
- [ ] Con Reducir movimiento: no pulsan los skeletons; el `Snackbar` y el mapa no se animan.

## 8. VoiceOver (2 o 3 recorridos clave)

- [ ] **Recorrido A, Inicio:** el orden es Alert (si hay) → tira ("Subte ahora. Todas las líneas funcionan con normalidad.", botón) → bandas → frescura → "Ver todos los favoritos". Cada banda se lee de una vez ("Estación Medrano, Línea B, Hacia Leandro N. Alem en 4 minutos, con demoras") y un toque doble abre el detalle. El engranaje se anuncia como botón "Ajustes".
- [ ] **Recorrido B, Favoritos:** cada banda se lee como "Casa. Estación Medrano, Línea B, Hacia Leandro N. Alem en 2 minutos"; en edición, sobre el nombre deslizá hacia arriba/abajo con un dedo para ver las acciones **"Mover arriba"** y **"Mover abajo"**; "Quitar" se anuncia con el nombre de la banda y el nombre tiene la pista "Cambiar nombre".
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
