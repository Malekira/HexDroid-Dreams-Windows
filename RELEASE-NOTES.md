# HexDreams IRC 0.40.0-beta.8 · Scripts y configuración de sala

Scripts tiene dos apartados: Scripts .hex y Scripts compatibles, con las mismas
columnas Activar, Editar, Ayuda y Eliminar. Analizar no instala ni ejecuta.
Editar un compatible conserva su identificador, activación y archivos del addon.

Se retiran Conexiones del lateral y el selector Ventana dividida de los
encabezados. Las redes siguen en la barra superior y la vista de eventos sigue
disponible en Configuración → Paneles. No se eliminan los perfiles ni el mosaico.

Las salas moderadas tienen un botón de configuración: topic visual con colores
IRC, fondos, estilos, emojis y vista previa; modos confirmados; acceso a bans.
El envío respeta TOPICLEN, la codificación de la red y el límite del comando IRC.

Auto-OP y Auto-voz se guardan por sala y red. Solicitan OP/VOICE al servicio
configurable tras los comandos de inicio y NAMES, una vez por entrada. Chan es
el valor inicial para Chatzona y ChanServ para otras redes. Los permisos y los
comandos del servicio deben permitirlo; no conceden privilegios por sí solos.
Desactivarlos no quita modos existentes. No se probó una cuenta real de moderación.

Validación: pruebas del motor/almacenamiento, Chromium y Electron con IRC local;
la compilación Windows verifica también el ejecutable portable empaquetado.
Se conservan Anti-PV v87, los paneles compatibles y Ta-Te-Ti.
