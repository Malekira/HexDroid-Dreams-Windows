# HexDreams IRC 0.19.0 para Windows

- Corrige el rechazo de comandos largos como `/raw VALIDATE token` desde Status. `/raw` y `/quote` en Status envían el comando completo como una sola línea, sin el límite de 510 bytes de mensajes de chat, sin cortarlo ni dividirlo. El servidor decide si lo admite.
- Status permite introducir comandos de hasta 64 KiB, con un límite técnico de 65.534 bytes antes de CRLF. Sala, PV, PRIVMSG, NOTICE y TAGMSG conservan sus controles habituales.
- Se siguen rechazando saltos de línea e inyección de órdenes. Los tokens VALIDATE se omiten del diagnóstico de protocolo.
- Se conservan configuración, historial, scripts y rutas de firma.

## Uso

Extrae todo el ZIP y abre HexDreamsIRC.exe. Selecciona el Status de la red y ejecuta el comando completo, por ejemplo `/raw VALIDATE token`. El ZIP distribuido no está firmado.

## Validación

143 pruebas de lógica e integración, 58 flujos de interfaz y Electron real con IRC TCP/TLS. La prueba incluye un token de prueba de más de 12.000 caracteres, enviado completo desde el editor de Status y recibido como una sola orden por el servidor local. Windows comprueba el arranque normal y el ejecutable empaquetado antes de publicar.
