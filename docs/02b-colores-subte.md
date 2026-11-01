# 02b — Colores oficiales de las líneas de subte

> Tarea 1.7 de la Fase 1. Fecha de verificación: **2026-11-01**.
> Estado: **verificado contra el GTFS estático oficial** (HTTP 200) y cruzado con fuentes públicas (Wikipedia). No se encontró un manual de identidad con códigos hex publicado por SBASE/Emova.

## 1. Fuente primaria: `routes.txt` del GTFS de subtes

- Endpoint: `GET https://apitransporte.buenosaires.gob.ar/subtes/feed-gtfs?client_id=<ID>&client_secret=<SECRET>` (documentado en `docs/fuentes/api-transporte-v1.raml:721-724`, bloque `/subtes/feed-gtfs`: "GTFS estático").
- Respuesta del 2026-11-01: **HTTP 200**, `application/x-zip-compressed`, 48.443 bytes, zip válido con 14 archivos (`agency`, `calendar`, `calendar_dates`, `fare_attributes`, `fare_rules`, `feed_info`, `frequencies`, `pathways`, `routes`, `shapes`, `stop_times`, `stops`, `transfers`, `trips`). El endpoint **no está suspendido** para este feed.
- `feed_info.txt`: publicador `GP-SBASE`, `feed_version` `2.0`, vigencia `20140501`–`20261231`. Ojo: el feed vence el 2026-12-31; hay que revisar si se republica.
- `agency.txt`: agencia `3` = "Subte de Buenos Aires", zona `America/Argentina/Buenos_Aires`.
- El `routes.txt` dentro del zip tiene fecha de archivo **2019-05-02**: los colores no cambiaron en años.

| `route_id` | `route_short_name` | `route_long_name` | `route_type` | `route_color` | `route_text_color` |
|---|---|---|---|---|---|
| `LineaA` | A | Plaza de Mayo - San Pedrito | 1 (subte) | `A5C8FF` | `000000` |
| `LineaB` | B | Leandro N. Alem - Juan Manuel de Rosas | 1 | `FF0000` | `000000` |
| `LineaC` | C | Retiro - Constitución | 1 | `0000FF` | `FFFFFF` |
| `LineaD` | D | Catedral - Congreso de Tucumán | 1 | `00AC67` | `000000` |
| `LineaE` | E | Retiro - Plaza de los Virreyes | 1 | `8300BB` | `FFFFFF` |
| `LineaH` | H | Facultad de Derecho - Hospitales | 1 | `FFF300` | `000000` |
| `PM-Civico` | PM-C | Saguier - Centro Cívico | 0 (tranvía/premetro) | `FFBD33` | `000000` |
| `PM-Savio` | PM-S | Saguier - Savio | 0 | `FFBD33` | `000000` |

Notas:

- No hay líneas F, G ni ramales de subte propiamente dichos; el **Premetro** figura como dos rutas (`PM-Civico`, `PM-Savio`) con el mismo color, y comparten 12 paradas (ver anexo).
- Los `route_id` tienen el formato `Linea<Letra>`; los usamos como clave de unión con `forecastGTFS` y `serviceAlerts` (a confirmar en `docs/01-api-transporte.md`).

## 2. Cruce con fuentes públicas

No encontramos un manual de identidad con hex en sitios oficiales: se revisaron `buenosaires.gob.ar/subte` (HTTP 200; en el HTML y los 3 CSS descargados no hay reglas de color por línea), `emova.com.ar` (HTTP 200; solo se miró el HTML de portada, sin hex de línea) y `sbase.com.ar` (no respondió). Las únicas fuentes con hex son las de Wikipedia, que **no son oficiales** pero sirven de referencia visual de la señalética real.

| Línea | GTFS (`route_color`) | Wikipedia: infobox de la línea | Wikipedia: mapa de la red (GeoJSON) | Nombre del color |
|---|---|---|---|---|
| A | `A5C8FF` | `08B0E1` | `00AEDC` | celeste |
| B | `FF0000` | `EE1B2C` | `EE1B2C` | rojo |
| C | `0000FF` | `1A66B1` | `0165AC` | azul |
| D | `00AC67` | `008067` | `008066` | verde |
| E | `8300BB` | `620085` | `6B1F7E` | violeta |
| H | `FFF300` | `FFD700` | `FED105` | amarillo |
| Premetro | `FFBD33` | `FDBB2E` | gris `808080` (en el mapa) | amarillo anaranjado |

Fuentes:

- Infobox de cada línea (campo `color_fondo`): `https://es.wikipedia.org/w/index.php?title=Línea_<X>_(subte_de_Buenos_Aires)&action=raw` y `…title=Premetro_(subte_de_Buenos_Aires)…` (consultadas el 2026-11-01).
- Mapa de la red (propiedades `stroke` del GeoJSON): `https://es.wikipedia.org/w/index.php?title=Subte_de_Buenos_Aires&action=raw`. Asignación de línea por color inferida del nombre del color, porque el GeoJSON no etiqueta cada trazo.
- Historia de los colores (1990s: B y D intercambian colores, C pasa de violeta a azul, E de amarillo a violeta): `https://en.wikipedia.org/wiki/Buenos_Aires_Underground` (sección de historia). Confirma que A=celeste, B=rojo, C=azul, D=verde, E=violeta, H=amarillo.

### Discrepancias

1. **El GTFS usa colores "de pantalla" puros** (`FF0000`, `0000FF`) en lugar de los tonos de señalética (`EE1B2C`, `1A66B1`). El **tono (hue) coincide en las seis líneas**; cambian saturación y luminosidad.
2. **Línea A**: la mayor diferencia. El GTFS publica `A5C8FF` (celeste pastel); la señalética es un celeste saturado (`08B0E1` / `00AEDC`). Con `A5C8FF` el contraste contra fondo claro es 1,57:1.
3. **Línea E**: `8300BB` (GTFS) es más claro y vivo que el violeta oscuro de señalética (`620085` / `6B1F7E`).
4. **Línea H**: `FFF300` (GTFS) es un amarillo limón; la señalética es un amarillo dorado (`FFD700` / `FED105`).
5. **Premetro**: GTFS y Wikipedia coinciden en el amarillo anaranjado (`FFBD33` vs `FDBB2E`); en el mapa de Wikipedia se dibuja en gris, que no tomamos.
6. Entre las dos fuentes de Wikipedia hay diferencias de 1–6 unidades por canal (por ejemplo D `008067` vs `008066`): son ruido, no discrepancia real.
7. Wikipedia pone texto **blanco** sobre el celeste de A y el amarillo de H y Premetro; con esos fondos el blanco tiene contraste 1,2–2,6:1, así que no se adopta. Se usa el `route_text_color` del GTFS.

## 3. Tabla final: hex a usar en la app

**Decisión:** usamos los valores del GTFS (`route_color` / `route_text_color`) como colores de línea. Razones: son el dato oficial del GCBA, son la misma fuente que alimenta la API en tiempo real (un cambio upstream se detecta comparando contra este archivo), y los pares fondo/texto ya cumplen WCAG AA. Los hex de Wikipedia quedan como alternativa de identidad visual, no como fuente de verdad.

| Línea | `route_id` | Fondo (hex) | Texto sobre el fondo | Contraste texto/fondo | Contra `#F3F6F9` (fondo claro) | Contra `#101E37` (fondo oscuro) |
|---|---|---|---|---|---|---|
| A | `LineaA` | `#A5C8FF` | `#000000` | 12,31:1 | 1,57:1 | 9,74:1 |
| B | `LineaB` | `#FF0000` | `#000000` | 5,25:1 | 3,69:1 | 4,16:1 |
| C | `LineaC` | `#0000FF` | `#FFFFFF` | 8,59:1 | 7,92:1 | 1,94:1 |
| D | `LineaD` | `#00AC67` | `#000000` | 7,10:1 | 2,73:1 | 5,62:1 |
| E | `LineaE` | `#8300BB` | `#FFFFFF` | 7,83:1 | 7,22:1 | 2,12:1 |
| H | `LineaH` | `#FFF300` | `#000000` | 18,07:1 | 1,07:1 | 14,31:1 |
| Premetro | `PM-Civico`, `PM-Savio` | `#FFBD33` | `#000000` | 12,58:1 | 1,54:1 | 9,96:1 |

Contrastes calculados con la fórmula de luminancia relativa de WCAG 2.x (2026-11-01).

### Reglas de uso (para Fase 3, `tokens.ts` y el componente de insignia de línea)

- **La insignia siempre lleva la letra** de la línea dentro (nunca el color solo): el color no es el único canal de información (WCAG 1.4.1).
- Texto sobre la insignia: siempre el `route_text_color` de esta tabla; todos los pares pasan AA (≥ 4,5:1), el más justo es B con 5,25:1.
- Cuando la insignia se apoya sobre una superficie con la que tiene menos de 3:1 (A, D, H y Premetro sobre fondo claro; C y E sobre fondo oscuro), agregar un **borde de 1–2 px** con el color de texto de la superficie (o un anillo del color opuesto) para delimitar la forma (WCAG 1.4.11).
- Para **barras o trazos de línea en el mapa** (sin letra): el trazo A pastel pierde contraste en el mapa claro; evaluar en Fase 4 usar el celeste de señalética (`#08B0E1`) solo para trazos en mapa y registrar la decisión en el ADR correspondiente. Hasta entonces, la tabla de arriba manda.
- Los valores se guardan en el JSON estático preprocesado por `tools/gtfs` (colores de línea) y se versionan con él; la app no los hardcodea: si cambian en el GTFS, el preprocesado los trae.

### Pendientes

- Confirmar si `tools/gtfs` debe leer `routes.txt` en cada ejecución (recomendado) o fijar la tabla de arriba.
- Cuando se publique el feed nuevo (el actual vence el 2026-12-31), repetir esta verificación.

## Anexo A — Estaciones por línea (GTFS de subtes, 2026-11-01)

Fuente: `stops.txt`, `stop_times.txt` y `trips.txt` del mismo zip. Estructura del feed:

- `location_type=1` (108 registros): **estación**; su `stop_id` tiene 4 dígitos (`1059`…`1166`) y es el que identifica la estación.
- `location_type=0` (214): **andén**; `stop_id` = estación + sufijo de sentido (`N`/`S` en líneas troncales, `E`/`O` en el Premetro). Es el nivel al que apuntan los `stop_times`.
- `location_type=2` (385): accesos y vestíbulos; `stop_id` = estación + dígito.
- Cada estación pertenece a **una sola línea**: los combinados (por ejemplo Pueyrredón de A, `1087`, y Pueyrredón de D, `1113`) figuran como estaciones distintas, cada una con su `stop_id`. Los únicos `stop_id` compartidos son los del Premetro entre `PM-Civico` y `PM-Savio`.
- Los nombres vienen **sin tildes** (`Constitucion`, `Saenz Peña`), tal cual el GTFS; la app debe mostrar el nombre normalizado desde el estático procesado, no el crudo.
- Las estaciones de cada línea son la unión de todos los `trip_id` de la ruta (la mayor parte de los trips no recorre todo el trazado). El orden va de una cabecera a la otra siguiendo los `stop_id` (con ajuste manual en E y H, donde las ampliaciones recientes tienen ids altos): es orientativo, no un orden publicado por el feed.
- Total: 108 estaciones: A 18, B 17, C 9, D 16, E 18, H 12 y Premetro 18 (`PM-Civico` 14 y `PM-Savio` 16, con 12 compartidas).

### A — Plaza de Mayo - San Pedrito (`LineaA`, 18 estaciones)

| # | Estación (`stop_name`) | `stop_id` | Andenes (`stop_id`) |
|---|---|---|---|
| 1 | San Pedrito | `1059` | `1059N`, `1059S` |
| 2 | San Jose de Flores | `1060` | `1060N`, `1060S` |
| 3 | Carabobo | `1061` | `1061N`, `1061S` |
| 4 | Puan | `1062` | `1062N`, `1062S` |
| 5 | Primera Junta | `1063` | `1063N`, `1063S` |
| 6 | Acoyte | `1064` | `1064N`, `1064S` |
| 7 | Rio de Janeiro | `1065` | `1065N`, `1065S` |
| 8 | Castro Barros | `1066` | `1066N`, `1066S` |
| 9 | Loria | `1067` | `1067N`, `1067S` |
| 10 | Plaza Miserere | `1068` | `1068N`, `1068S` |
| 11 | Alberti | `1069` | `1069S` |
| 12 | Pasco | `1070` | `1070N` |
| 13 | Congreso | `1071` | `1071N`, `1071S` |
| 14 | Saenz Peña | `1072` | `1072N`, `1072S` |
| 15 | Lima | `1073` | `1073N`, `1073S` |
| 16 | Piedras | `1074` | `1074N`, `1074S` |
| 17 | Peru | `1075` | `1075N`, `1075S` |
| 18 | Plaza de Mayo | `1076` | `1076N`, `1076S` |

### B — Leandro N. Alem - Juan Manuel de Rosas (`LineaB`, 17 estaciones)

| # | Estación (`stop_name`) | `stop_id` | Andenes (`stop_id`) |
|---|---|---|---|
| 1 | Juan Manuel de Rosas | `1077` | `1077N`, `1077S` |
| 2 | Echeverria | `1078` | `1078N`, `1078S` |
| 3 | De Los Incas - Parque Chas | `1079` | `1079N`, `1079S` |
| 4 | Tronador - Villa Ortuzar | `1080` | `1080N`, `1080S` |
| 5 | Federico Lacroze | `1081` | `1081N`, `1081S` |
| 6 | Dorrego | `1082` | `1082N`, `1082S` |
| 7 | Angel Gallardo | `1083` | `1083N`, `1083S` |
| 8 | Malabia | `1084` | `1084N`, `1084S` |
| 9 | Medrano | `1085` | `1085N`, `1085S` |
| 10 | Carlos Gardel | `1086` | `1086N`, `1086S` |
| 11 | Pueyrredon | `1087` | `1087N`, `1087S` |
| 12 | Pasteur | `1088` | `1088N`, `1088S` |
| 13 | Callao | `1089` | `1089N`, `1089S` |
| 14 | Uruguay | `1090` | `1090N`, `1090S` |
| 15 | Carlos Pellegrini | `1091` | `1091N`, `1091S` |
| 16 | Florida | `1092` | `1092N`, `1092S` |
| 17 | Leandro N. Alem | `1093` | `1093N`, `1093S` |

### C — Retiro - Constitución (`LineaC`, 9 estaciones)

| # | Estación (`stop_name`) | `stop_id` | Andenes (`stop_id`) |
|---|---|---|---|
| 1 | Constitucion | `1094` | `1094E`, `1094O` |
| 2 | San Juan | `1095` | `1095E`, `1095O` |
| 3 | Independencia | `1096` | `1096E`, `1096O` |
| 4 | Moreno | `1097` | `1097E`, `1097O` |
| 5 | Avenida de Mayo | `1098` | `1098E`, `1098O` |
| 6 | Diagonal Norte | `1099` | `1099E`, `1099O` |
| 7 | Lavalle | `1100` | `1100E`, `1100O` |
| 8 | General San Martin | `1101` | `1101E`, `1101O` |
| 9 | Retiro | `1102` | `1102E`, `1102O` |

### D — Catedral - Congreso de Tucumán (`LineaD`, 16 estaciones)

| # | Estación (`stop_name`) | `stop_id` | Andenes (`stop_id`) |
|---|---|---|---|
| 1 | Congreso de Tucuman | `1103` | `1103N`, `1103S` |
| 2 | Juramento | `1104` | `1104N`, `1104S` |
| 3 | Jose Hernandez | `1105` | `1105N`, `1105S` |
| 4 | Olleros | `1106` | `1106N`, `1106S` |
| 5 | Ministro Carranza | `1107` | `1107N`, `1107S` |
| 6 | Palermo | `1108` | `1108N`, `1108S` |
| 7 | Plaza Italia | `1109` | `1109N`, `1109S` |
| 8 | Scalabrini Ortiz | `1110` | `1110N`, `1110S` |
| 9 | Bulnes | `1111` | `1111N`, `1111S` |
| 10 | Agüero | `1112` | `1112N`, `1112S` |
| 11 | Pueyrredon | `1113` | `1113N`, `1113S` |
| 12 | Facultad de Medicina | `1114` | `1114N`, `1114S` |
| 13 | Callao | `1115` | `1115N`, `1115S` |
| 14 | Tribunales | `1116` | `1116N`, `1116S` |
| 15 | 9 de Julio | `1117` | `1117N`, `1117S` |
| 16 | Catedral | `1118` | `1118N`, `1118S` |

### E — Retiro - Plaza de los Virreyes (`LineaE`, 18 estaciones)

| # | Estación (`stop_name`) | `stop_id` | Andenes (`stop_id`) |
|---|---|---|---|
| 1 | Retiro | `1164` | `1164N`, `1164S` |
| 2 | Catalinas | `1165` | `1165N`, `1165S` |
| 3 | Correo Central | `1166` | `1166N`, `1166S` |
| 4 | Bolivar | `1119` | `1119N`, `1119S` |
| 5 | Belgrano | `1120` | `1120N`, `1120S` |
| 6 | Independencia | `1121` | `1121N`, `1121S` |
| 7 | San Jose | `1122` | `1122N`, `1122S` |
| 8 | Entre Rios | `1123` | `1123N`, `1123S` |
| 9 | Pichincha | `1124` | `1124N`, `1124S` |
| 10 | Jujuy | `1125` | `1125N`, `1125S` |
| 11 | General Urquiza | `1126` | `1126N`, `1126S` |
| 12 | Boedo | `1127` | `1127N`, `1127S` |
| 13 | La Plata | `1128` | `1128N`, `1128S` |
| 14 | Jose Maria Moreno | `1129` | `1129N`, `1129S` |
| 15 | Emilio Mitre | `1130` | `1130N`, `1130S` |
| 16 | Medalla Milagrosa | `1131` | `1131N`, `1131S` |
| 17 | Varela | `1132` | `1132N`, `1132S` |
| 18 | Plaza de los Virreyes | `1133` | `1133N`, `1133S` |

### H — Facultad de Derecho - Hospitales (`LineaH`, 12 estaciones)

| # | Estación (`stop_name`) | `stop_id` | Andenes (`stop_id`) |
|---|---|---|---|
| 1 | Facultad de Derecho | `1163` | `1163E`, `1163O` |
| 2 | Las Heras | `1162` | `1162E`, `1162O` |
| 3 | Santa Fe | `1161` | `1161E`, `1161O` |
| 4 | Cordoba | `1160` | `1160E`, `1160O` |
| 5 | Corrientes | `1141` | `1141E`, `1141O` |
| 6 | Once | `1140` | `1140E`, `1140O` |
| 7 | Venezuela | `1139` | `1139E`, `1139O` |
| 8 | Humberto 1 | `1138` | `1138E`, `1138O` |
| 9 | Inclan | `1137` | `1137E`, `1137O` |
| 10 | Caseros | `1136` | `1136E`, `1136O` |
| 11 | Parque Patricios | `1135` | `1135E`, `1135O` |
| 12 | Hospitales | `1134` | `1134E`, `1134O` |

### PM-C — Saguier - Centro Cívico (`PM-Civico`, 14 estaciones)

| # | Estación (`stop_name`) | `stop_id` | Andenes (`stop_id`) |
|---|---|---|---|
| 1 | Intendente Saguier | `1142` | `1142N`, `1142S` |
| 2 | Balbastro | `1143` | `1143N`, `1143S` |
| 3 | Mariano Acosta | `1144` | `1144N`, `1144S` |
| 4 | Somellera | `1145` | `1145N`, `1145S` |
| 5 | Ana Maria Janer | `1146` | `1146N`, `1146S` |
| 6 | Ntra. Sra. de Fatima | `1147` | `1147N`, `1147S` |
| 7 | Fernandez de la Cruz | `1148` | `1148N`, `1148S` |
| 8 | Presidente Illia | `1149` | `1149N`, `1149S` |
| 9 | Parque de la Ciudad | `1150` | `1150N`, `1150S` |
| 10 | Cecilia Grierson | `1151` | `1151N`, `1151S` |
| 11 | Escalada | `1152` | `1152N`, `1152S` |
| 12 | Pola | `1153` | `1153N`, `1153S` |
| 13 | Ana Diaz | `1154` | `1154N`, `1154S` |
| 14 | Centro Civico | `1155` | `1155N`, `1155S` |

### PM-S — Saguier - Savio (`PM-Savio`, 16 estaciones)

| # | Estación (`stop_name`) | `stop_id` | Andenes (`stop_id`) |
|---|---|---|---|
| 1 | Intendente Saguier | `1142` | `1142N`, `1142S` |
| 2 | Balbastro | `1143` | `1143N`, `1143S` |
| 3 | Mariano Acosta | `1144` | `1144N`, `1144S` |
| 4 | Somellera | `1145` | `1145N`, `1145S` |
| 5 | Ana Maria Janer | `1146` | `1146N`, `1146S` |
| 6 | Ntra. Sra. de Fatima | `1147` | `1147N`, `1147S` |
| 7 | Fernandez de la Cruz | `1148` | `1148N`, `1148S` |
| 8 | Presidente Illia | `1149` | `1149N`, `1149S` |
| 9 | Parque de la Ciudad | `1150` | `1150N`, `1150S` |
| 10 | Cecilia Grierson | `1151` | `1151N`, `1151S` |
| 11 | Escalada | `1152` | `1152N`, `1152S` |
| 12 | Pola | `1153` | `1153N`, `1153S` |
| 13 | Larrazabal | `1156` | `1156N`, `1156S` |
| 14 | Nicolas Descalzi | `1157` | `1157N`, `1157S` |
| 15 | Gabino Ezeiza | `1158` | `1158N`, `1158S` |
| 16 | General Savio | `1159` | `1159N`, `1159S` |
