# HexDreams IRC 0.14.0 para Windows

- Salas y privados en ventanas internas independientes, con su lista de usuarios, borrador y posición de lectura. Se pueden mover, redimensionar, maximizar y organizar desde Ver → Ventanas → Mosaico o Cascada.
- Un clic en sala o conversación enfoca la escritura. Un clic en Notify abre las acciones del usuario, sin abrir un privado.
- WHO y WHOIS no cambian automáticamente de conversación. WHOIS conserva su ficha y los resultados también quedan en WHOIS / WHO.
- Autoaway en Configuración → Notificaciones y tema: tiempo de inactividad del equipo, mensaje y retorno automático opcional. Las ausencias manuales se respetan.
- Ctrl+Shift+Z oculta el programa en la bandeja de notificaciones y mantiene las conexiones.
- Sugerencias de nicks al escribir y de comandos al comenzar con `/`, incluidos los scripts activos. Tab y Shift+Tab recorren las coincidencias usando las letras originales.
- Scripts con permisos automáticos y un único control de activación. Cada script tiene un botón Ayuda con comandos y descripciones; se retira la lista de comandos del menú Scripts. Importar o editar deja el script desactivado hasta activarlo.
- Desconectar cierra las conversaciones de esa red. Al salir no se restauran salas ni privados abiertos; las redes, preferencias y archivos de historial se conservan.
- Se corrige el reenvío de eventos de sanciones de sala al escritorio.

## Uso

Extrae todo el ZIP y abre HexDreamsIRC.exe. Conserva tu configuración y tu certificado de firma existente. Autoaway se activa por separado. La descarga es una versión de prueba sin firma distribuida; la firma personal se realiza con Sign/Verify en tu Windows.

## Validación

Pruebas de lógica, Chromium y Electron real con un servidor IRC local; la publicación de Windows ejecuta estas comprobaciones y prueba también el ejecutable empaquetado. Las conversaciones de prueba son simuladas; el comportamiento de comandos depende del servidor IRC.
