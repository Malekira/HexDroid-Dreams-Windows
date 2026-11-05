Primera versión de prueba de HexDroid Dreams para Windows 10/11 x64.

## Descargar y abrir

Descarga **HexDroid-Dreams-0.1.0-Windows-x64.zip** de los archivos de esta versión. Extrae TODO el ZIP y ejecuta **HexDroidDreams.exe** desde la carpeta extraída. No requiere MSI ni instalar Node.js.

Incluye salas como pestañas superiores, barra de conversaciones izquierda ajustable, usuarios ocultables a la derecha, menús discretos y configuración arriba a la derecha. Admite varias redes IRC, TLS, salas y mensajes privados.

Si no aparece la ventana, ejecuta **Iniciar-con-diagnostico.cmd**. Los registros y preferencias se guardan en `%APPDATA%\HexDroidDreams-Desktop`, en una carpeta independiente de versiones anteriores.

## Validación

Compilación y pruebas ejecutadas con éxito en el runner Windows de GitHub Actions: protocolo IRC y almacenamiento, conexión y mensajes por IPC en Electron real, salida/reentrada de salas, reapertura, instancia única y recuperación de configuración dañada. También se probaron los controles de interfaz en Chromium en Linux.

Esto no sustituye la prueba en tu equipo ni demuestra compatibilidad con todas las redes IRC. No se ha validado con una red IRC pública. La aplicación de prueba no está firmada digitalmente.

## Límites de esta primera versión

Todavía no incluye SASL/NickServ automático, DCC, cifrado de extremo a extremo, scripts, historial persistente ni reconexión automática. Las contraseñas del servidor se usan solo para la sesión y no se guardan en disco.

El código vive en la rama **dreams-windows**. La rama **main** y la aplicación Android no se modificaron.
