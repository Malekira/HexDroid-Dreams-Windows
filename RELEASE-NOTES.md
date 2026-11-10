# HexDreams IRC 0.20.0 para Windows

- Corrige los comandos a MeMo que recibían códigos de color y negrita de la escritura. `/msg memo read 7`, `/msg memo read last` y lo escrito directamente en el privado de MeMo se envían en texto plano, conservando las palabras y argumentos.
- Los servicios reconocidos, incluidos MemoServ, NickServ y ChanServ, no reciben formato de escritura, reemplazos del diccionario ni nick completion decorado. El envío interno también elimina formato IRC/ANSI al dirigir mensajes a estos servicios. Los mensajes normales conservan su formato.
- Los nicks de la lista de Notify son botones que abren el perfil lateral. El árbol mantiene el mismo comportamiento. Funciona incluso desde Status, sin cambiar de conversación, abrir un PV ni pedir WHOIS automáticamente; esas acciones siguen teniendo sus botones propios.
- Se conservan configuración, historial, scripts y rutas de firma.

## Uso

Extrae todo el ZIP y abre HexDreamsIRC.exe. Puedes ejecutar `/msg memo read 7` desde la conversación activa o escribir `read last` dentro del privado de MeMo. Haz clic en un nick de Notify para ver su perfil. El ZIP distribuido no está firmado.

## Validación

146 pruebas de lógica e integración, 60 flujos de interfaz y Electron real con IRC TCP/TLS. Las pruebas comprueban el envío exacto de MeMo sin formato, la conservación de estilos en chats normales y perfiles de Notify sin WHOIS/PV. Windows verifica el arranque normal y el ejecutable empaquetado antes de publicar el ZIP.
