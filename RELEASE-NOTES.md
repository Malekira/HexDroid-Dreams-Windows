# HexDroid Dreams 0.4.0 — identidad, configuración, fotos y colores

Extrae toda la carpeta del ZIP y abre HexDroidDreams.exe. Conserva una copia de tus datos antes de actualizar. El perfil de Windows y el certificado personal existente se mantienen.

- Editar red incluye identidad propia (nick, ident/usuario IRC, nombre real y foto), comandos posteriores a la conexión y separación entre comandos.
- Comandos directos `/login`, `/nick`, `/identify`, servicios y otros comandos IRC sin exigir `/raw`. En la secuencia de conexión se usa el mismo intérprete que en el chat, manteniendo el orden y los retrasos. `/identify` envía IDENTIFY a NickServ; `/login` envía LOGIN al servidor, que debe admitirlo.
- Los comandos guardados en Windows se protegen con el almacén seguro del usuario; las credenciales no se escriben en settings.json ni en el registro de protocolo.
- Configuración general con categorías desplegables a la izquierda y contenido a la derecha, navegación por teclado y desplazamiento vertical.
- Diálogos de la aplicación con dimensiones uniformes y contenido adaptable, evitando desplazamiento horizontal. Los selectores nativos de Windows conservan su disposición del sistema.
- Foto local de identidad por red mediante selector de archivos: vista previa, cambio y eliminación; se muestra en tus mensajes, lista de usuarios y pie del panel. No se publica automáticamente en IRC: para otros usuarios hacen falta una URL pública y metadatos compatibles del servidor.
- Fotos remotas: se procesan respuestas METADATA 761 y se espera la URL solicitada en una sola acción. La vista del chat se actualiza al cargar el avatar, sin esperar a otro mensaje. Las imágenes enlazadas HTTPS compatibles tienen un botón de carga manual, con confirmación del dominio.
- Colores IRC extendidos 0–98, fondos, hexadecimal, ANSI de 256 colores y RGB; colores visibles en la vista previa y muestras en el selector.

El ZIP incluye el script de firma personal y sus instrucciones. Para esta versión nueva repite Sign y Verify con el certificado ya creado; no hace falta volver a crear ni instalar el certificado. La distribución sigue sin firma comercial, y la política ASR puede seguir requiriendo la excepción puntual que ya configuraste.

Se conserva la funcionalidad IRC, DCC, cifrado, historial, scripts y respaldos de 0.3.0. Las extensiones dependen de las capacidades del servidor; AGE aún requiere validación cruzada Windows–Android. Véanse docs/ADVANCED.md y docs/FIRMA-PERSONAL.md.
