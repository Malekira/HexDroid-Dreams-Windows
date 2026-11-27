# Cambios autorizados · 27 de noviembre de 2026

La orden posterior «implementa» autoriza los cuatro bloques anotados y el editor
de topics de la última captura. Las anotaciones originales se conservan debajo
como referencia del alcance; sus indicaciones de esperar quedaron supersedidas.

Implementado y verificado con pruebas del motor, almacenamiento, Chromium y
Electron/IRC local: dos tablas de Scripts, edición/ayuda de compatibles,
eliminación del bloque Conexiones duplicado y del selector en ventanas,
configuración de sala moderada, envío de topic con formato IRC y vista previa,
y preferencias de solicitudes automáticas independientes por sala/red.

Los automatismos solicitan OP/VOICE al servicio configurable (Chan en Chatzona,
ChanServ por defecto en otras redes), después del inicio y NAMES, una vez por
entrada. No conceden privilegios y dependen de los comandos y permisos del
servicio real. No se verificó contra una cuenta de moderador de Chatzona.

## Topics con formato

- Editor visual con negrita, cursiva, subrayado, colores IRC 00–15, fondo y emojis.
- Vista previa y envío de códigos IRC; sin HTML en la conexión.
- Consulta de TOPIC/MODE y confirmación del servidor; sin cambios optimistas.
- Límites TOPICLEN anunciados por el servidor y longitud del comando codificado.

---

# Pendientes con diseño aprobado

## Pantalla Scripts · 27 de noviembre de 2026

Estado: **pendiente de implementación**. El usuario aprobó la vista previa y pidió
anotarla; no autorizó implementar este cambio todavía. No modificar el programa
por esta anotación.

- Título principal: **Scripts**.
- Dos apartados separados, abiertos y compactos, según la vista previa aprobada:
  - **Scripts .hex**, con el botón **Importar archivo .hex…**.
  - **Scripts compatibles**, con **Analizar archivo…** e **Importar archivo…**
    dentro de ese apartado, para archivos `.mrc` y `.xcr`.
- Ambos apartados deben usar el mismo formato de tabla y las mismas columnas:
  **Script | Activar | Editar | Ayuda | Eliminar**.
- Cada script compatible importado debe tener su propia fila, con los mismos
  controles y alineación que los scripts `.hex`. Editar y Ayuda deben funcionar,
  no ser botones decorativos.
- Quitar de la fila de compatibles las listas extensas de alias y eventos
  (`LOAD`, `OPEN`, `TEXT`, `DIALOG`, etc.); la información detallada queda en Ayuda.
- Sustituir la presentación actual «Compatibilidad mIRC · privados y diálogos»
  por el apartado **Scripts compatibles** mostrado en la vista previa.
- Aclaración breve bajo los botones: **.mrc / .xcr · Analizar no instala ni activa
  el archivo.**
- Conservar el texto breve sobre activación automática al importar o crear scripts.
- Mantener el tema elegido, márgenes cómodos y formato lo más compacto posible
  sin perder legibilidad ni intuición. Los nombres y las acciones deben caber sin
  recortes ni desplazamiento horizontal en el tamaño habitual de la ventana.

La aprobación corresponde al diseño mostrado, no a una implementación ya realizada.

## Quitar Conexiones del panel izquierdo · 27 de noviembre de 2026

Estado: **pendiente de implementación**, agregado a la lista de cambios que se
está anotando en la conversación.

- Quitar el bloque lateral **Conexiones**, incluido el encabezado, el icono del
  globo y la lista de perfiles/redes mostrada debajo (Dramatiik, Hannii, etc.).
- El usuario indica que esa información ya está arriba: conservar el selector
  de red y los controles de conexión de la barra superior.
- Ajustar el espacio y las separaciones del panel para no dejar un hueco por el
  bloque retirado. Mantener Notify, Salas, Privados y Sistema.
- No borrar redes, perfiles ni conexiones: el cambio corresponde a la presentación
  duplicada del panel lateral.

## Quitar el desplegable de disposición de las ventanas · 27 de noviembre de 2026

Estado: **pendiente de implementación**, dentro de los cambios que el usuario
está anotando.

- El usuario informa que no puede hacer clic en el desplegable «Ventana dividida»
  mostrado en el encabezado de las ventanas internas y pide retirarlo.
- Quitar ese desplegable de las ventanas internas, incluidas salas, privados y
  ventanas de Sistema que utilicen el mismo encabezado.
- Recuperar el espacio del control sin dejar separaciones vacías. Conservar los
  demás controles del encabezado.
- La petición se refiere a retirar el control de las ventanas; no implica borrar
  las funciones de mosaico o disposición disponibles en otros menús.

## Configuración de las salas moderadas · 27 de noviembre de 2026

Estado: **pendiente de implementación**, dentro de los cambios que el usuario
está anotando.

- Agregar un botón **Configuración de sala** en las salas que el usuario modera.
- Abrir un panel compacto, intuitivo y vinculado a la sala y red seleccionadas,
  que permita ver el **topic**, los **modos** y la lista de **bans**. Reutilizar las
  funciones y ventanas de moderación existentes cuando corresponda.
- Permitir editar el topic y los modos y gestionar bans según los permisos reales
  que el servidor otorgue al usuario; no presentar cambios como aplicados antes
  de recibir la respuesta del servidor.
- Incluir dos preferencias independientes por sala/red: **Auto-OP (+o)** y
  **Auto-voz (+v)**, para elegir si se solicita automáticamente ese modo propio
  al entrar en la sala. Guardar la elección y evitar solicitudes repetidas.
- La automatización debe utilizar los mecanismos admitidos por esa red/servicio
  y los permisos existentes. Activar una opción no concede privilegios por sí
  mismo; al implementar, comprobar los comandos y respuestas de la red.
- Desactivar la automatización no debe quitar un modo obtenido manualmente.
- No implementar este bloque todavía: conservarlo como pendiente de la sesión
  de anotaciones actual.
