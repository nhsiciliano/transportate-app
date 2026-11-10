---
version: 1
slug: "src-features-ajustes-ajustesscreen-tsx"
primary_target: "src/features/ajustes/AjustesScreen.tsx"
related_targets: ["src/features/ajustes/AcercaScreen.tsx","src/features/ajustes/LicenciasScreen.tsx","src/features/ajustes/SettingsList.tsx","src/features/ajustes/IndiceRow.tsx"]
---

# Ajustes — brief de superficie

Modo **Operate**. Stack desde Inicio: Ajustes (`src/features/ajustes/AjustesScreen.tsx` con `SettingsList.tsx` e `IndiceRow.tsx`), Acerca de (`AcercaScreen.tsx`) y Licencias (`LicenciasScreen.tsx`). Audiencia: la persona que ajusta el tema o el intervalo una vez, o quiere saber de dónde salen los datos. Tarea: cambiar una preferencia al instante y leer la atribución. Contenido real: Tema, Actualizar cada, índice de líneas y paradas con su versión y peso, limpiar datos, borrar favoritos, estado real del permiso de ubicación, Acerca de con atribución CC BY 2.5 AR y Licencias. Restricciones: las de Inicio; listas agrupadas del sistema (HIG: grouped/inset lists), controles nativos, sin «Guardar».

## Direction contract

THESIS: Ajustes es la trastienda de la señal: listas agrupadas del sistema, con la tipografía, la densidad y las placas de la dirección, y nada más. Se rechaza tanto la decoración (bandas o pictogramas en cuadrado acá) como la lista gris por defecto sin la precisión del resto de la app.

OWN-WORLD: hereda el de Inicio en lo que una lista agrupada admite: fondo `#edf4ff`, placas blancas con outline `#d6e4f6` y radio 6 (la `Card` compartida ya lo fija), encabezados de sección en 13/600 `text.secondary` como la etiqueta «Subte ahora», filas de 52 pt con el título en 17/400 y el detalle en 15 `text.secondary`, chevron del sistema solo en filas que navegan, `SegmentedControl` compartido para Tema e intervalo. Acerca de es lectura: 17/26 en Fira Sans 400, títulos 20/600, enlaces en `text.link`. Licencias: filas con nombre 17/600 y «versión · licencia» en 15 `text.secondary`, texto expandible en 15/22.

STORY: la persona cambia el tema o el intervalo y vuelve; o lee quién publica los datos y qué hace la app con su ubicación. Cree que la app no le esconde nada.

FIRST VIEWPORT (390×844, Ajustes): header nativo inline «Ajustes» con «Volver»; sección «Apariencia» con la placa «Tema» y el segmentado Sistema · Claro · Oscuro; sección «Datos» con la placa de tres filas (Actualizar cada con su segmentado y la nota en 13 `text.secondary`; Índice de líneas y paradas con «Versión del 12/10/2026 · 4,8 MB» y la acción «Buscar actualización»; Limpiar datos guardados); sección «Favoritos» con «Borrar todos los favoritos»; sección «Privacidad» con la fila Ubicación y su estado real; sección «Información» con «Acerca de Transportate» y chevron. No hay acción primaria: todo cambia al instante.

FORM: «Señalética de terminal» extendida (misma dirección que Inicio), decidida por el usuario el 2026-11-04, aplicada con la restricción máxima del modo Operate: tipografía, paleta, densidad; sin movimiento firma acá. seed:2db0aa292d67ea2e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones abiertas

- Contacto o «Reportar un problema» en Acerca de: **resuelto el 2026-11-10** (F4-ajustes-3). El contacto vive en la web: Acerca de suma, entre «Diseño» y «Software», la placa «Información» con dos filas de enlace externo del mismo material que «Enlaces» (`text.link`, ícono de salida): «Política de privacidad» y «Soporte y contacto», al sitio público `transportate-site.nhsiciliano.workers.dev` (las URLs que pide App Store). Sin mail ni formulario en la app. Alternativa a evaluar en la revisión: «Política de privacidad» como fila debajo de los bullets de «Privacidad», donde se lee como «el detalle de esto».
- El texto «Diseño» de Acerca de: **resuelto el 2026-11-06**. El usuario lo fijó en «La app sigue Obelisco v2, el sistema de diseño de la Ciudad de Buenos Aires, adaptado a nativo.», sin nombrar la dirección ni Fira Sans.
